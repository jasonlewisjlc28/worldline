import { useState } from "react";
import { Leaf, Droplets, Zap, Gem, Flame, Mountain, TreePine, Wheat } from "lucide-react";
import { RESOURCES } from "../data/resources";
import { MINES } from "../data/mines";

type Sub = "production" | "food" | "energy";
const SUBS: { id: Sub; label: string; icon: React.ReactNode }[] = [
  { id: "production", label: "Resources & Production", icon: <Mountain size={12} /> },
  { id: "food", label: "Food & Agriculture", icon: <Wheat size={12} /> },
  { id: "energy", label: "Electricity & Fuel", icon: <Zap size={12} /> },
];

const PALETTE = ["#b91c1c", "#ea580c", "#292524", "#ca8a04", "#78716c", "#0f766e", "#4d7c0f", "#0369a1"];
const color = (i: number) => PALETTE[i % PALETTE.length];

function SubHead({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-bold uppercase tracking-widest text-[#b91c1c]">{children}</h4>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-4">{children}</div>;
}
function Source({ children }: { children: React.ReactNode }) {
  return <p className="pt-2 text-[10px] leading-relaxed text-stone-500">{children}</p>;
}
function Bar({ label, pct, i }: { label: string; pct: number; i: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-stone-800">{label}</span>
        <span className="text-xs font-bold tabular-nums text-stone-900">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#efe3d3]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color(i) }} />
      </div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e3c4c4] bg-white p-2.5">
      <p className="text-sm font-bold tabular-nums text-stone-900">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
    </div>
  );
}
function Missing() {
  return (
    <Card>
      <p className="text-xs italic text-stone-600">Data not available for this territory.</p>
    </Card>
  );
}

// donut pie chart (same style as Demographics)
function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function donutSegment(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r1, a0);
  const [x1, y1] = polar(cx, cy, r1, a1);
  const [x2, y2] = polar(cx, cy, r0, a1);
  const [x3, y3] = polar(cx, cy, r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}
function Donut({ data, onSelect }: { data: { label: string; pct: number }[]; onSelect?: (label: string, pct: number) => void }) {
  const segAngles: number[] = [];
  let a = 0;
  for (const d of data) {
    segAngles.push(a);
    a += (d.pct / 100) * 360;
  }
  const segs2 = data.map((d, i) => {
    const span = (d.pct / 100) * 360;
    const path = donutSegment(100, 100, 58, 96, segAngles[i], segAngles[i] + span);
    return (
      <path
        key={i}
        d={path}
        fill={color(i)}
        stroke="#f9f4ec"
        strokeWidth={1}
        className={onSelect ? "cursor-pointer transition hover:opacity-80" : undefined}
        onClick={onSelect ? () => onSelect(d.label, d.pct) : undefined}
      />
    );
  });
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0">{segs2}</svg>
      <ul className="w-full space-y-1.5">
        {data.map((d, i) => (
          <li
            key={i}
            className={`flex items-center justify-between gap-2 text-xs ${onSelect ? "cursor-pointer rounded px-1 py-0.5 hover:bg-white" : ""}`}
            onClick={onSelect ? () => onSelect(d.label, d.pct) : undefined}
          >
            <span className="flex items-center gap-1.5 text-stone-700">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color(i) }} />
              {d.label}
            </span>
            <span className="font-bold tabular-nums text-stone-900">{d.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- main tab
export default function ResourcesTab({ countryName, onShowMines }: { countryName: string; onShowMines?: (sites: { name: string; lat: number; lng: number; kind: "mine" | "refinery" }[]) => void }) {
  const [sub, setSub] = useState<Sub>("production");
  const [mineralSel, setMineralSel] = useState<{ label: string; pct: number } | null>(null);
  const r = RESOURCES[countryName];
  const otherElec =
    r && r.elec_fossil != null && r.elec_hydro != null && r.elec_nuclear != null
      ? Math.max(0, Math.round((100 - r.elec_fossil - r.elec_hydro - r.elec_nuclear) * 10) / 10)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSub(s.id)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              sub === s.id
                ? "border-[#b91c1c]/40 bg-[#f9ecec] text-[#b91c1c]"
                : "border-[#e3c4c4] bg-white text-stone-500 hover:text-stone-900"
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {!r ? (
        <Missing />
      ) : sub === "production" ? (
        <div className="space-y-4">
          {/* resource rents */}
          {(r.oil_rents != null || r.gas_rents != null || r.coal_rents != null || r.min_rents != null) && (
            <Card>
              <SubHead>Resource rents (% of GDP)</SubHead>
              <div className="mt-3 space-y-3">
                {r.oil_rents != null && <Bar label="Oil" pct={r.oil_rents} i={0} />}
                {r.gas_rents != null && <Bar label="Natural gas" pct={r.gas_rents} i={1} />}
                {r.coal_rents != null && <Bar label="Coal" pct={r.coal_rents} i={2} />}
                {r.min_rents != null && <Bar label="Minerals" pct={r.min_rents} i={3} />}
                {r.forest_rents != null && <Bar label="Forests" pct={r.forest_rents} i={4} />}
              </div>
              <Source>World Bank resource-rent estimates (latest).</Source>
            </Card>
          )}

          {/* minerals & timber */}
          {(r.minerals || r.timber) && (
            <Card>
              <SubHead>
                <span className="inline-flex items-center gap-1"><Gem size={12} /> Minerals &amp; <TreePine size={12} className="ml-1" /> Timber</span>
              </SubHead>
              {r.minerals && <p className="mt-2 text-[11px] leading-relaxed text-stone-600"><span className="font-semibold text-stone-800">Minerals:</span> {r.minerals}</p>}
              {r.mineralsChart && r.mineralsChart.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] italic text-stone-500">Click a mineral to see where it is mined &amp; refined.</p>
                  <Donut data={r.mineralsChart} onSelect={(label, pct) => {
                    setMineralSel({ label, pct });
                    const sites = (MINES[countryName]?.[label] ?? []).map((s) => ({
                      name: s.name, lat: s.lat, lng: s.lon, kind: s.kind,
                    }));
                    onShowMines?.(sites);
                  }} />
                  <p className="pt-2 text-[10px] leading-relaxed text-stone-500">Approximate share of mining output value — USGS / national mining statistics (latest available).</p>
                </div>
              )}
              {r.timber && <p className="mt-1.5 text-[11px] leading-relaxed text-stone-600"><span className="font-semibold text-stone-800">Timber:</span> {r.timber}</p>}
              {r.forest != null && (
                <p className="mt-1.5 text-[11px] text-stone-600">
                  <span className="font-semibold text-stone-800">Forest cover:</span> {r.forest}% of land area
                </p>
              )}
              <Source>Sources: USGS, FAO, national geological surveys.</Source>
            </Card>
          )}

          {/* trade exposure */}
          {(r.fuel_exp != null || r.ore_exp != null) && (
            <Card>
              <SubHead>Commodity trade exposure</SubHead>
              <div className="mt-3 space-y-3">
                {r.fuel_exp != null && <Bar label="Fuel share of exports" pct={r.fuel_exp} i={0} />}
                {r.ore_exp != null && <Bar label="Ores & metals share of exports" pct={r.ore_exp} i={3} />}
                {r.fuel_imp != null && <Bar label="Fuel share of imports" pct={r.fuel_imp} i={2} />}
              </div>
              <Source>World Bank / UN Comtrade merchandise-trade shares (latest).</Source>
            </Card>
          )}

          {/* water */}
          {r.water_stress != null && (
            <Card>
              <SubHead>
                <span className="inline-flex items-center gap-1"><Droplets size={12} /> Water stress</span>
              </SubHead>
              <div className="mt-3">
                <Bar
                  label="Freshwater withdrawals, % of renewable internal resources"
                  pct={Math.min(100, r.water_stress)}
                  i={0}
                />
                <p className="mt-2 text-[11px] leading-relaxed text-stone-600">
                  {r.water_stress >= 75
                    ? "Extremely high stress — withdrawals approach or exceed renewable supply (aquifer depletion risk)."
                    : r.water_stress >= 40
                      ? "High stress — water use is a binding constraint on agriculture and industry."
                      : r.water_stress >= 20
                        ? "Moderate stress."
                        : "Low stress — renewable supply comfortably exceeds withdrawals."}
                  {r.water_stress > 100 ? " (Above 100% = mining non-renewable groundwater.)" : ""}
                </p>
              </div>
              <Source>World Bank / FAO AQUASTAT (latest).</Source>
            </Card>
          )}
        </div>
      ) : sub === "food" ? (
        <div className="space-y-4">
          {/* agricultural output pie */}
          {r.foodOutput && r.foodOutput.length > 0 ? (
            <Card>
              <SubHead>Agricultural output</SubHead>
              <div className="mt-3">
                <Donut data={r.foodOutput} />
              </div>
              <Source>Approximate share of agricultural output value — FAOSTAT / national statistics (latest available).</Source>
            </Card>
          ) : (
            <Missing />
          )}

          {/* food balance */}
          {(r.agri_exp != null || r.agri_imp != null) && (
            <Card>
              <SubHead>
                <span className="inline-flex items-center gap-1"><Wheat size={12} /> Food balance</span>
              </SubHead>
              <div className="mt-3 space-y-3">
                {r.agri_exp != null && <Bar label="Food & agriculture going out (share of exports)" pct={r.agri_exp} i={1} />}
                {r.agri_imp != null && <Bar label="Food coming in (share of imports)" pct={r.agri_imp} i={5} />}
              </div>
              {r.agri_exp != null && r.agri_imp != null && (
                <p className="mt-3 rounded-md border border-[#e3c4c4] bg-white p-2.5 text-[11px] leading-relaxed text-stone-700">
                  {r.agri_exp >= r.agri_imp ? (
                    <>
                      <span className="font-bold text-green-700">Net food exporter.</span> Food and agricultural goods
                      make up <span className="font-semibold">{r.agri_exp}%</span> of merchandise exports versus{" "}
                      <span className="font-semibold">{r.agri_imp}%</span> of imports — the country sells more food
                      abroad than it buys.
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-red-700">Net food importer.</span> Food makes up{" "}
                      <span className="font-semibold">{r.agri_imp}%</span> of merchandise imports versus{" "}
                      <span className="font-semibold">{r.agri_exp}%</span> of exports — the country relies on
                      foreign supply for part of its food needs.
                    </>
                  )}
                </p>
              )}
              <Source>World Bank / UN Comtrade merchandise-trade shares (latest available year).</Source>
            </Card>
          )}
        </div>
      ) : sub === "energy" ? (
        <div className="space-y-4">
          {r.energyProd != null && r.energyCons != null && (
            <Card>
              <SubHead>Energy balance</SubHead>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#e3c4c4]">
                      <th className="pb-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wide text-stone-500">Total Production (Quad BTU)</th>
                      <th className="pb-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wide text-stone-500">Total Consumption (Quad BTU)</th>
                      <th className="pb-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wide text-stone-500">Net Energy Gap</th>
                      <th className="pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">Per Capita Cons. (M BTU)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 pr-3 text-sm font-bold tabular-nums text-stone-900">{r.energyProd}</td>
                      <td className="py-2 pr-3 text-sm font-bold tabular-nums text-stone-900">{r.energyCons}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums">
                          <span className={`inline-block h-2 w-2 rounded-full ${r.energyGap != null && r.energyGap >= 0 ? "bg-green-600" : "bg-red-600"}`} />
                          <span className={r.energyGap != null && r.energyGap >= 0 ? "text-green-700" : "text-red-700"}>
                            {r.energyGap != null && r.energyGap >= 0 ? "+" : ""}{r.energyGap} {r.energyGap != null && r.energyGap >= 0 ? "Surplus" : "Deficit"}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 text-sm font-bold tabular-nums text-stone-900">{r.energyPc ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Source>Source: EIA primary energy estimates (2023).</Source>
            </Card>
          )}
          {r.elec_fossil != null ? (
            <Card>
              <SubHead>Electricity generation mix</SubHead>
              <div className="mt-3 space-y-3">
                <Bar label="Fossil fuels" pct={r.elec_fossil} i={2} />
                {r.elec_hydro != null && <Bar label="Hydro" pct={r.elec_hydro} i={5} />}
                {r.elec_nuclear != null && <Bar label="Nuclear" pct={r.elec_nuclear} i={7} />}
                {otherElec != null && <Bar label="Wind, solar & other renewables" pct={otherElec} i={6} />}
              </div>
              <Source>World Bank electricity-mix estimates (latest). "Wind, solar & other" derived as remainder.</Source>
            </Card>
          ) : (
            <Missing />
          )}
          {(r.oil != null || r.gas != null || r.coal != null) && (
            <Card>
              <SubHead>
                <span className="inline-flex items-center gap-1"><Flame size={12} /> Oil, Gas &amp; Coal production</span>
              </SubHead>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="Crude oil, kb/d" value={r.oil != null ? r.oil.toLocaleString() : "—"} />
                <Stat label="Natural gas, bcm/yr" value={r.gas != null ? r.gas.toLocaleString() : "—"} />
                <Stat label="Coal, Mt/yr" value={r.coal != null ? r.coal.toLocaleString() : "—"} />
              </div>
              {r.oilNote && <p className="mt-2 text-[11px] leading-relaxed text-stone-600">{r.oilNote}</p>}
              {r.reserves && (
                <p className="mt-2 text-[11px] leading-relaxed text-stone-600">
                  <span className="font-semibold text-stone-800">Reserves &amp; strategic notes:</span> {r.reserves}
                </p>
              )}
              <Source>Sources: EIA, OPEC, BP Statistical Review (latest year documented).</Source>
            </Card>
          )}
          {(r.fuel_exp != null || r.fuel_imp != null || r.fuelOut || r.fuelIn) && (
            <Card>
              <SubHead>
                <span className="inline-flex items-center gap-1"><Leaf size={12} /> Fuel trade dependency</span>
              </SubHead>
              <div className="mt-3 space-y-3">
                {r.fuel_exp != null && <Bar label="Fuel share of exports" pct={r.fuel_exp} i={0} />}
                {r.fuel_imp != null && <Bar label="Fuel share of imports" pct={r.fuel_imp} i={2} />}
              </div>
              <div className="mt-4 space-y-3">
                {r.fuelOut && r.fuelOut.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                      <span className="text-red-700">→</span> Fuels going out
                    </p>
                    <ul className="mt-1.5 space-y-2">
                      {r.fuelOut.map((f, i) => (
                        <li key={i} className="rounded-md border border-[#e3c4c4] bg-white p-2.5">
                          <p className="text-xs font-semibold text-stone-900">{f.fuel}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">{f.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.fuelIn && r.fuelIn.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                      <span className="text-red-700">←</span> Fuels coming in
                    </p>
                    <ul className="mt-1.5 space-y-2">
                      {r.fuelIn.map((f, i) => (
                        <li key={i} className="rounded-md border border-[#e3c4c4] bg-white p-2.5">
                          <p className="text-xs font-semibold text-stone-900">{f.fuel}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">{f.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Source>Sources: EIA, UN Comtrade, national customs & energy ministries (latest documented).</Source>
            </Card>
          )}
        </div>
      ) : null}

      {mineralSel && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e3c4c4] bg-[#f9f4ec] p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-72 sm:rounded-lg sm:border">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-stone-900">{mineralSel.label}</p>
              <p className="text-[10px] text-stone-500">{mineralSel.pct}% of mining output — sites pinned on globe</p>
            </div>
            <button
              type="button"
              className="rounded p-1 text-stone-500 hover:bg-white"
              onClick={() => { setMineralSel(null); onShowMines?.([]); }}
            >
              ×
            </button>
          </div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {(MINES[countryName]?.[mineralSel.label] ?? []).map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-stone-700">
                <span className={`mt-1 inline-block h-2 w-2 shrink-0 ${s.kind === "refinery" ? "bg-[#0f766e]" : "bg-[#b91c1c]"}`} />
                <span>
                  <span className="font-semibold">{s.name}</span>
                  {s.note && <span className="text-stone-500"> — {s.note}</span>}
                </span>
              </li>
            ))}
            {(MINES[countryName]?.[mineralSel.label] ?? []).length === 0 && (
              <li className="text-[11px] italic text-stone-500">No named sites documented here yet.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
