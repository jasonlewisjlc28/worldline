import "dotenv/config";
import mysql from "mysql2/promise";
import { describeConnection } from "./api/ai";

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const [conns] = await pool.query<any[]>(
    "SELECT id, person_a_id AS personAId, person_b_id AS personBId, summary FROM connections"
  );
  console.log("connections:", conns.length);
  for (const c of conns) {
    const [pa] = await pool.query<any[]>("SELECT name, title FROM persons WHERE id = ?", [c.personAId]);
    const [pb] = await pool.query<any[]>("SELECT name, title FROM persons WHERE id = ?", [c.personBId]);
    if (!pa.length || !pb.length) continue;
    const a = { name: pa[0].name, title: pa[0].title };
    const b = { name: pb[0].name, title: pb[0].title };
    try {
      const rel = await describeConnection(a, b);
      if (!rel.direct || !rel.alignment) {
        console.log(`#${c.id} ${a.name} ↔ ${b.name}: no alignment, skipping`);
        continue;
      }
      await pool.query("UPDATE connections SET alignment = ? WHERE id = ?", [
        JSON.stringify(rel.alignment),
        c.id,
      ]);
      console.log(`#${c.id} ${a.name} ↔ ${b.name}: overall ${rel.alignment.overall}/10 cap ${rel.alignment.cap}`);
    } catch (e) {
      console.log(`#${c.id} ${a.name} ↔ ${b.name}: ERROR ${(e as Error).message.slice(0, 120)}`);
    }
  }
  await pool.end();
}
main();
