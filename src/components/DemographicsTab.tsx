// U.S. demographics panel — built from official figures:
//   Race/ethnicity: U.S. Census Bureau, Vintage 2024 population estimates
//   Population/growth: U.S. Census Bureau 2024 estimates
//   Age distribution: U.S. Census Bureau 2024 estimates
//   Religion: Pew Research Center, 2023–24 Religious Landscape Study
// All values are percentages of the total population.

type Slice = { label: string; pct: number; color: string };

const RACE: Slice[] = [
  { label: "White (non-Hispanic)", pct: 58.9, color: "#b91c1c" },
  { label: "Hispanic / Latino", pct: 19.5, color: "#ea580c" },
  { label: "Black (non-Hispanic)", pct: 12.4, color: "#292524" },
  { label: "Asian (non-Hispanic)", pct: 6.1, color: "#ca8a04" },
  { label: "Two or more races", pct: 1.9, color: "#78716c" },
  { label: "American Indian / Alaska Native", pct: 1.1, color: "#4d7c0f" },
  { label: "Native Hawaiian / Pacific Islander", pct: 0.2, color: "#0f766e" },
];

const POP_STATS = [
  { label: "Population (2024)", value: "340.1M" },
  { label: "Annual growth", value: "+0.98%" },
  { label: "Median age", value: "39.1 yrs" },
  { label: "Under 18", value: "21.5%" },
];

const AGE: Slice[] = [
  { label: "Under 18", pct: 21.5, color: "#b91c1c" },
  { label: "18 – 44", pct: 35.8, color: "#ea580c" },
  { label: "45 – 64", pct: 24.5, color: "#ca8a04" },
  { label: "65 and over", pct: 18.0, color: "#292524" },
];

const RELIGION: Slice[] = [
  { label: "Protestant", pct: 40, color: "#b91c1c" },
  { label: "Religiously unaffiliated", pct: 29, color: "#78716c" },
  { label: "Catholic", pct: 19, color: "#ea580c" },
  { label: "Other Christian", pct: 3, color: "#ca8a04" },
  { label: "Jewish", pct: 2, color: "#4d7c0f" },
  { label: "Muslim", pct: 1, color: "#0f766e" },
  { label: "Buddhist", pct: 1, color: "#292524" },
  { label: "Hindu", pct: 1, color: "#a21caf" },
  { label: "Other religions", pct: 4, color: "#d6caba" },
];

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

function Donut({ data }: { data: Slice[] }) {
  const total = data.reduce((s, d) => s + d.pct, 0);
  let angle = 0;
  const cx = 90;
  const cy = 90;
  return (
    <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0">
      {data.map((d) => {
        const start = angle;
        angle += (d.pct / total) * 360;
        const end = angle - 0.4; // hairline gap between slices
        return (
          <path
            key={d.label}
            d={donutSegment(cx, cy, 88, 55, start, end)}
            fill={d.color}
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
        340.1M
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" className="fill-stone-500">
        residents
      </text>
    </svg>
  );
}

function BarRow({ label, pct, color }: Slice) {
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
          style={{ width: `${pct}%`, backgroundColor: color }}
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

export default function DemographicsTab() {
  return (
    <div className="space-y-6">
      {/* Race & ethnicity */}
      <section className="space-y-3">
        <SubHead>Race &amp; Ethnicity</SubHead>
        <div className="rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-4">
          <div className="flex flex-col items-center gap-4">
            <Donut data={RACE} />
            <ul className="w-full space-y-1.5">
              {RACE.map((d) => (
                <li key={d.label} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-stone-700">{d.label}</span>
                  <span className="ml-auto font-bold tabular-nums text-stone-900">
                    {d.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-stone-500">
            Source: U.S. Census Bureau population estimates (Vintage 2024).
          </p>
        </div>
      </section>

      {/* Population & growth */}
      <section className="space-y-3">
        <SubHead>Population &amp; Growth</SubHead>
        <div className="grid grid-cols-2 gap-2">
          {POP_STATS.map((s) => (
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
          The U.S. added roughly 3.3 million residents in 2024 — the fastest
          annual growth since 2001 — driven mostly by net international
          migration. Source: U.S. Census Bureau.
        </p>
      </section>

      {/* Age distribution */}
      <section className="space-y-3">
        <SubHead>Age Distribution</SubHead>
        <div className="space-y-3 rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-4">
          {AGE.map((d) => (
            <BarRow key={d.label} {...d} />
          ))}
          <p className="pt-1 text-[10px] leading-relaxed text-stone-500">
            Source: U.S. Census Bureau estimates (2024).
          </p>
        </div>
      </section>

      {/* Religion */}
      <section className="space-y-3">
        <SubHead>Religion</SubHead>
        <div className="space-y-3 rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-4">
          {RELIGION.map((d) => (
            <BarRow key={d.label} {...d} />
          ))}
          <p className="pt-1 text-[10px] leading-relaxed text-stone-500">
            Source: Pew Research Center, Religious Landscape Study (2023–24).
          </p>
        </div>
      </section>
    </div>
  );
}
