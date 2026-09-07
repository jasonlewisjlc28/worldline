import { useEffect, useMemo, useState } from "react";
import { X, MapPin, Factory } from "lucide-react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
type Topology = any;
type GeometryCollection = any;
import { MINES } from "../data/mines";

const MAP_URL = "/countries-110m.json";

let topoCache: Promise<Topology> | null = null;
function loadTopo() {
  if (!topoCache) {
    topoCache = fetch(MAP_URL).then((r) => r.json());
  }
  return topoCache;
}

export default function MineralDetail({
  countryName,
  mineral,
  pct,
  onClose,
}: {
  countryName: string;
  mineral: string;
  pct: number;
  onClose: () => void;
}) {
  const [topo, setTopo] = useState<Topology | null>(null);
  useEffect(() => {
    let on = true;
    loadTopo().then((t) => on && setTopo(t as Topology));
    return () => { on = false; };
  }, []);

  const sites = MINES[countryName]?.[mineral] ?? [];

  const { countryPath, othersPath, project } = useMemo(() => {
    if (!topo) return { countryPath: "", othersPath: "", project: null as null | ((c: [number, number]) => [number, number] | null) };
    const coll = topo.objects.countries as GeometryCollection;
    const fc: any = feature(topo, coll);
    const feats: any[] = fc.features ?? [fc];
    const norm = (n: string) => n.toLowerCase().replace(/[^a-z]/g, "");
    const target = norm(countryName);
    const ALIAS: Record<string, string> = {
      unitedstatesofamerica: "unitedstates",
      ctedivoire: "ctedivoire",
      demrepcongo: "demrepcongo",
      centralafricanrep: "centralafricanrep",
      dominicanrep: "dominicanrep",
      eqguinea: "eqguinea",
      ssudan: "ssudan",
      bosniaandherz: "bosniaandherz",
      macedonia: "macedonia",
      solomonis: "solomonis",
      eswatini: "eswatini",
      falklandis: "falklandis",
      wsahara: "wsahara",
      frsantarcticlands: "frsantarcticlands",
    };
    const t2 = ALIAS[target] ?? target;
    const cfeat = feats.find((f) => norm(f.properties?.name ?? "") === t2) ?? null;
    const W = 640, H = 440;
    const proj = geoMercator();
    if (cfeat) proj.fitExtent([[16, 16], [W - 16, H - 60]], cfeat);
    else proj.fitExtent([[16, 16], [W - 16, H - 60]], { type: "FeatureCollection", features: feats } as any);
    const path = geoPath(proj);
    return {
      countryPath: cfeat ? path(cfeat) ?? "" : "",
      othersPath: path({ type: "FeatureCollection", features: feats.filter((f) => f !== cfeat) } as any) ?? "",
      project: (c: [number, number]) => proj(c) as [number, number] | null,
    };
  }, [topo, countryName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#e3c4c4] bg-[#f4f1ea] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e3c4c4] p-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900">{mineral}</h3>
            <p className="text-xs text-stone-600">
              {countryName} — {pct}% of mining output value
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-stone-500 hover:bg-white hover:text-stone-900">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <svg viewBox="0 0 640 440" className="w-full rounded-lg border border-[#e3c4c4] bg-[#eef2f3]">
            <path d={othersPath} fill="#e5e0d4" stroke="#c9c2b2" strokeWidth={0.4} />
            <path d={countryPath} fill="#f3d9d9" stroke="#b91c1c" strokeWidth={0.8} />
            {sites.map((s, i) => {
              const p = project?.([s.lon, s.lat]);
              if (!p) return null;
              return (
                <g key={i}>
                  <circle cx={p[0]} cy={p[1]} r={5} fill={s.kind === "refinery" ? "#0f766e" : "#b91c1c"} opacity={0.9} stroke="#fff" strokeWidth={1.5} />
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-stone-600">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#b91c1c]" /> Mine</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0f766e]" /> Refinery / processing</span>
          </div>

          <ul className="mt-3 space-y-2">
            {sites.length === 0 && (
              <li className="rounded-md border border-[#e3c4c4] bg-white p-3 text-xs italic text-stone-600">
                Named extraction sites for this mineral are not yet documented here.
              </li>
            )}
            {sites.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-md border border-[#e3c4c4] bg-white p-3">
                <span className={`mt-0.5 shrink-0 ${s.kind === "refinery" ? "text-[#0f766e]" : "text-[#b91c1c]"}`}>
                  {s.kind === "refinery" ? <Factory size={14} /> : <MapPin size={14} />}
                </span>
                <span>
                  <span className="block text-xs font-semibold text-stone-900">{s.name}</span>
                  {s.note && <span className="mt-0.5 block text-[11px] leading-snug text-stone-600">{s.note}</span>}
                  <span className="mt-0.5 block text-[10px] tabular-nums text-stone-400">
                    {Math.abs(s.lat).toFixed(2)}°{s.lat >= 0 ? "N" : "S"}, {Math.abs(s.lon).toFixed(2)}°{s.lon >= 0 ? "E" : "W"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] leading-relaxed text-stone-500">
            Sources: USGS, company filings, national geological surveys (latest documented).
          </p>
        </div>
      </div>
    </div>
  );
}
