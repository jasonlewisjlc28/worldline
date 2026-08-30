import { useState } from "react";
import { Leaf, Droplets, Zap, Gem, Flame, Mountain, TreePine, Wheat } from "lucide-react";
import { RESOURCES } from "../data/resources";

type Sub = "production" | "energy";
const SUBS: { id: Sub; label: string; icon: React.ReactNode }[] = [
  { id: "production", label: "Resources & Production", icon: <Mountain size={12} /> },
  { id: "energy", label: "Energy Mix", icon: <Zap size={12} /> },
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

// ---------------------------------------------------------------- main tab
export default function ResourcesTab({ countryName }: { countryName: string }) {
  const [sub, setSub] = useState<Sub>("production");
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
          {/* fossil production stats */}
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
              {r.timber && <p className="mt-1.5 text-[11px] leading-relaxed text-stone-600"><span className="font-semibold text-stone-800">Timber:</span> {r.timber}</p>}
              {r.forest != null && (
                <p className="mt-1.5 text-[11px] text-stone-600">
                  <span className="font-semibold text-stone-800">Forest cover:</span> {r.forest}% of land area
                </p>
              )}
              <Source>Sources: USGS, FAO, national geological surveys.</Source>
            </Card>
          )}

          {/* trade exposure + food */}
          {(r.fuel_exp != null || r.agri_exp != null) && (
            <Card>
              <SubHead>
                <span className="inline-flex items-center gap-1"><Wheat size={12} /> Food &amp; trade exposure</span>
              </SubHead>
              <div className="mt-3 space-y-3">
                {r.fuel_exp != null && <Bar label="Fuel share of exports" pct={r.fuel_exp} i={0} />}
                {r.ore_exp != null && <Bar label="Ores & metals share of exports" pct={r.ore_exp} i={3} />}
                {r.agri_exp != null && <Bar label="Food & ag share of exports" pct={r.agri_exp} i={1} />}
                {r.fuel_imp != null && <Bar label="Fuel share of imports" pct={r.fuel_imp} i={2} />}
                {r.agri_imp != null && <Bar label="Food share of imports" pct={r.agri_imp} i={5} />}
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
      ) : sub === "energy" ? (
        <div className="space-y-4">
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
          {(r.fuel_exp != null || r.fuel_imp != null) && (
            <Card>
              <SubHead>
                <span className="inline-flex items-center gap-1"><Leaf size={12} /> Fuel trade dependency</span>
              </SubHead>
              <div className="mt-3 space-y-3">
                {r.fuel_exp != null && <Bar label="Fuel share of exports" pct={r.fuel_exp} i={0} />}
                {r.fuel_imp != null && <Bar label="Fuel share of imports" pct={r.fuel_imp} i={2} />}
              </div>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
