import { useMemo, useState } from "react";
import { geoOrthographic, geoGraticule10, geoPath, geoCentroid, geoDistance } from "d3-geo";
import { Leaf, Droplets, Zap, Gem, Flame, Mountain, TreePine, Wheat, CircleDot } from "lucide-react";
import { RESOURCES } from "../data/resources";
import topoData from "../../public/countries-110m.json";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

type Sub = "production" | "energy" | "flows";
const SUBS: { id: Sub; label: string; icon: React.ReactNode }[] = [
  { id: "production", label: "Resources & Production", icon: <Mountain size={12} /> },
  { id: "energy", label: "Energy Mix", icon: <Zap size={12} /> },
  { id: "flows", label: "Trade Flows", icon: <CircleDot size={12} /> },
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

// ---------------------------------------------------------------- globe
const worldFeatures: GeoJSON.FeatureCollection = topojson.feature(
  topoData as unknown as Topology,
  (topoData as unknown as Topology).objects.countries as GeometryCollection
) as never;

function FlowGlobe({ countryName }: { countryName: string }) {
  const W = 340;
  const H = 340;
  const cx = W / 2;
  const cy = H / 2;

  const { proj, graticule, landPath, centroid, flows, arcs } = useMemo(() => {
    const feature = (worldFeatures.features as GeoJSON.Feature[]).find(
      (f) => (f.properties as { name: string }).name === countryName
    );
    const centroid: [number, number] = feature ? (geoCentroid(feature) as [number, number]) : [0, 20];
    const proj = geoOrthographic()
      .translate([cx, cy])
      .scale(130)
      .rotate([-centroid[0], -centroid[1]])
      .clipAngle(90);
    const pathGen = geoPath(proj);
    const graticule = pathGen(geoGraticule10() as never);
    const landPath = pathGen(worldFeatures as never);
    const r = RESOURCES[countryName];
    const flows = r?.flows ?? [];
    const nameToFeature = new Map(
      (worldFeatures.features as GeoJSON.Feature[]).map((f) => [
        (f.properties as { name: string }).name,
        f,
      ])
    );
    // loose partner-name matching against topo names
    const aliases: Record<string, string[]> = {
      "China": ["China"], "United States": ["United States of America"], "Russia": ["Russia"],
      "EU": [], "Japan": ["Japan"], "India": ["India"], "Brazil": ["Brazil"], "Germany": ["Germany"],
      "France": ["France"], "Italy": ["Italy"], "Spain": ["Spain"], "Netherlands": ["Netherlands"],
      "South Korea": ["South Korea"], "Turkey": ["Turkey"], "UAE": ["United Arab Emirates"],
      "Saudi Arabia": ["Saudi Arabia"], "Canada": ["Canada"], "Mexico": ["Mexico"],
      "Australia": ["Australia"], "United Kingdom": ["United Kingdom"], "Norway": ["Norway"],
      "Kazakhstan": ["Kazakhstan"], "Turkmenistan": ["Turkmenistan"], "Belarus": ["Belarus"],
      "Belgium": ["Belgium"], "Switzerland": ["Switzerland"], "South Africa": ["South Africa"],
      "Thailand": ["Thailand"], "Vietnam": ["Vietnam"], "Malaysia": ["Malaysia"],
      "Indonesia": ["Indonesia"], "Argentina": ["Argentina"], "Chile": ["Chile"],
      "Dem. Rep. Congo": ["Dem. Rep. Congo"], "Israel": ["Israel"], "Jordan": ["Jordan"],
      "Egypt": ["Egypt"], "Qatar": ["Qatar"], "Kuwait": ["Kuwait"], "Iran": ["Iran"],
      "Iraq": ["Iraq"], "Nigeria": ["Nigeria"], "Algeria": ["Algeria"], "Libya": ["Libya"],
      "Azerbaijan": ["Azerbaijan"], "Czechia": ["Czechia"], "Hungary": ["Hungary"],
      "Austria": ["Austria"], "Poland": ["Poland"], "Romania": ["Romania"], "Ukraine": ["Ukraine"],
      "Uzbekistan": ["Uzbekistan"], "Tajikistan": ["Tajikistan"], "Sweden": ["Sweden"],
      "Finland": ["Finland"], "Denmark": ["Denmark"], "Greece": ["Greece"],
      "South Sudan": ["S. Sudan"], "Côte d'Ivoire": ["Côte d'Ivoire"],
    };
    const arcs: { d: string; partner: string; resource: string }[] = [];
    for (const f of flows) {
      const key = Object.keys(aliases).find((k) => f.partner.startsWith(k));
      const targetNames = key ? aliases[key] : [];
      const tf = targetNames.length ? nameToFeature.get(targetNames[0]) : undefined;
      if (!tf) continue;
      const tc = geoCentroid(tf) as [number, number];
      // skip if either endpoint sits on the far side of the globe
      if (geoDistance(centroid, [-proj.rotate()[0], -proj.rotate()[1]]) > Math.PI / 2) continue;
      if (geoDistance(tc, [-proj.rotate()[0], -proj.rotate()[1]]) > Math.PI / 2) continue;
      const s = proj(centroid);
      const t = proj(tc);
      if (!s || !t) continue;
      const mx = (s[0] + t[0]) / 2;
      const my = (s[1] + t[1]) / 2;
      const qx = cx + (mx - cx) * 1.25;
      const qy = cy + (my - cy) * 1.25;
      arcs.push({ d: `M${s[0]},${s[1]} Q${qx},${qy} ${t[0]},${t[1]}`, partner: f.partner, resource: f.resource });
    }
    return { proj, graticule, landPath, centroid, flows, arcs };
  }, [countryName, cx, cy]);

  const home = proj(centroid);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[340px]">
        <circle cx={cx} cy={cy} r={130} fill="#f4f1ea" stroke="#b91c1c" strokeOpacity={0.25} />
        {graticule && <path d={graticule} fill="none" stroke="#a8a29e" strokeWidth={0.4} strokeOpacity={0.55} />}
        {landPath && <path d={landPath} fill="#ece7dd" stroke="#d6caba" strokeWidth={0.4} />}
        {arcs.map((a) => (
          <path key={a.partner + a.resource} d={a.d} fill="none" stroke="#b91c1c" strokeWidth={1.2} strokeOpacity={0.85}>
            <animate attributeName="stroke-dashoffset" from="274" to="0" dur="2.4s" repeatCount="indefinite" />
          </path>
        ))}
        {home && (
          <>
            <rect x={home[0] - 5} y={home[1] - 5} width={10} height={10} fill="#b91c1c" />
            <text x={home[0] + 9} y={home[1] + 3} fontSize={9} fontWeight={700} fill="#292524">
              {countryName.length > 18 ? countryName.slice(0, 16) + "…" : countryName}
            </text>
          </>
        )}
      </svg>
      {flows.length === 0 && (
        <p className="text-[11px] italic text-stone-500">No documented resource flows for this country.</p>
      )}
      <ul className="mt-1 w-full space-y-1.5">
        {flows.map((f, i) => (
          <li key={i} className="flex items-baseline gap-2 text-[11px]">
            <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-[#b91c1c]" />
            <span className="font-semibold text-stone-900">{f.partner}</span>
            <span className="text-stone-600">— {f.resource}{f.note ? ` (${f.note})` : ""}</span>
          </li>
        ))}
      </ul>
      <Source>
        Globe shows flows whose partner country is visible on the near side.
        Sources: UN Comtrade, EIA, national customs (latest available year per
        country).
      </Source>
    </div>
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
      ) : (
        <Card>
          <SubHead>Bilateral resource flows</SubHead>
          <div className="mt-3">
            <FlowGlobe countryName={countryName} />
          </div>
        </Card>
      )}
    </div>
  );
}
