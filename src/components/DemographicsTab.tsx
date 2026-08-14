import { DEMOGRAPHICS, type DemoSlice } from "../data/demographics";

// Palette assigned by slice index.
const PALETTE = [
  "#b91c1c",
  "#ea580c",
  "#292524",
  "#ca8a04",
  "#78716c",
  "#4d7c0f",
  "#0f766e",
  "#a21caf",
  "#0369a1",
  "#d6caba",
];

function color(i: number) {
  return PALETTE[i % PALETTE.length];
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function donutSegment(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
) {
  const [x1, y1] = polar(cx, cy, rOuter, start);
  const [x2, y2] = polar(cx, cy, rOuter, end);
  const [x3, y3] = polar(cx, cy, rInner, end);
  const [x4, y4] = polar(cx, cy, rInner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M${x1},${y1} A${rOuter},${rOuter} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${rInner},${rInner} 0 ${large} 0 ${x4},${y4} Z`;
}

function Donut({ data, center }: { data: DemoSlice[]; center: string }) {
  const total = data.reduce((s, d) => s + d.pct, 0) || 1;
  let angle = 0;
  const cx = 90;
  const cy = 90;
  return (
    <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0">
      {data.map((d, i) => {
        const start = angle;
        angle += (d.pct / total) * 360;
        const end = angle - 0.4; // hairline gap between slices
        return (
          <path
            key={d.label}
            d={donutSegment(cx, cy, 88, 55, start, end)}
            fill={color(i)}
          />
        );
      })}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        className="fill-stone-900"
        fontSize="17"
        fontWeight="700"
      >
        {center}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fontSize="9"
        className="fill-stone-500"
      >
        residents
      </text>
    </svg>
  );
}

function BarRow({ label, pct, i }: DemoSlice & { i: number }) {
  const width = Math.min(100, pct);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-stone-800">{label}</span>
        <span className="text-xs font-bold tabular-nums text-stone-900">
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#efe3d3]">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color(i) }}
        />
      </div>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-bold uppercase tracking-widest text-[#b91c1c]">
      {children}
    </h4>
  );
}

export default function DemographicsTab({ countryName }: { countryName: string }) {
  const d = DEMOGRAPHICS[countryName];
  if (!d) {
    return (
      <p className="rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-4 text-xs italic text-stone-600">
        Demographics data is not yet available for this territory.
      </p>
    );
  }

  const statCards = [
    d.pop ? { label: "Population", value: d.pop } : null,
    d.grow ? { label: "Annual growth", value: d.grow } : null,
    d.u15 ? { label: "Under 15", value: d.u15 } : null,
    d.o65 ? { label: "65 and over", value: d.o65 } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-6">
      {/* Race & ethnicity */}
      <section className="space-y-3">
        <SubHead>Race &amp; Ethnicity</SubHead>
        <div className="rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-4">
          <div className="flex flex-col items-center gap-4">
            <Donut data={d.ethnicity} center={d.pop ?? "—"} />
            <ul className="w-full space-y-1.5">
              {d.ethnicity.map((s, i) => (
                <li key={s.label} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: color(i) }}
                  />
                  <span className="text-stone-700">{s.label}</span>
                  <span className="ml-auto font-bold tabular-nums text-stone-900">
                    {s.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-stone-500">
            Source: national census / CIA World Factbook estimates.
          </p>
        </div>
      </section>

      {/* Population & growth */}
      {statCards.length > 0 && (
        <section className="space-y-3">
          <SubHead>Population &amp; Growth</SubHead>
          <div className="grid grid-cols-2 gap-2">
            {statCards.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-3"
              >
                <p className="text-lg font-bold tabular-nums text-stone-900">
                  {s.value}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-stone-500">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-stone-500">
            Source: World Bank, World Development Indicators (latest 2019–2024
            estimate).
          </p>
        </section>
      )}

      {/* Age distribution */}
      {d.age.length > 0 && (
        <section className="space-y-3">
          <SubHead>Age Distribution</SubHead>
          <div className="space-y-3 rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-4">
            {d.age.map((s, i) => (
              <BarRow key={s.label} {...s} i={i} />
            ))}
            <p className="pt-1 text-[10px] leading-relaxed text-stone-500">
              Source: World Bank estimates.
            </p>
          </div>
        </section>
      )}

      {/* Religion */}
      <section className="space-y-3">
        <SubHead>Religion</SubHead>
        <div className="space-y-3 rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-4">
          {d.religion.map((s, i) => (
            <BarRow key={s.label} {...s} i={i} />
          ))}
          <p className="pt-1 text-[10px] leading-relaxed text-stone-500">
            Source: Pew Research Center / national censuses.
          </p>
        </div>
      </section>
    </div>
  );
}
