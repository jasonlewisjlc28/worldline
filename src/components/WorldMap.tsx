import { useEffect, useMemo, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoCentroid } from "d3-geo";
import { drag } from "d3-drag";
import { zoom as d3zoom } from "d3-zoom";
import { select } from "d3-selection";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { ConnectionDto, PersonDto } from "@contracts/types";

type CountryFeature = {
  type: "Feature";
  id?: string;
  properties: { name: string };
  geometry: GeoJSON.Geometry;
};

export type WorldMapProps = {
  persons: PersonDto[];
  connections: ConnectionDto[];
  selectedId: number | null;
  highlightIds?: Set<number>;
  selectedCountry?: string | null;
  onSelect: (id: number) => void;
  onCountryClick?: (countryName: string) => void;
  onBackgroundClick?: () => void;
};

// Reference-site palette: cream canvas, ink lines, soft glow dots, red accents.
const INK = "#292524";
const INK_SOFT = "#a8a29e";
const CREAM = "#f4f1ea";
const LAND = "#ece7dd";
const RED = "#b91c1c";

export default function WorldMap({
  persons,
  connections,
  selectedId,
  highlightIds,
  selectedCountry,
  onSelect,
  onCountryClick,
  onBackgroundClick,
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [rotation, setRotation] = useState<[number, number, number]>([-20, -30, 0]);
  const [globeK, setGlobeK] = useState(1);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [hoveredPerson, setHoveredPerson] = useState<number | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetch("/countries-110m.json")
      .then((r) => r.json())
      .then((topo: Topology) => {
        const fc = feature(topo, topo.objects.countries as never) as unknown as {
          features: CountryFeature[];
        };
        setCountries(fc.features);
      })
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.max(300, width), h: Math.max(200, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const baseRadius = Math.min(size.w, size.h) * 0.42;

  const { projection, pathGen } = useMemo(() => {
    const projection = geoOrthographic()
      .translate([size.w / 2, size.h / 2])
      .scale(baseRadius * globeK)
      .rotate(rotation)
      .clipAngle(90);
    const pathGen = geoPath(projection);
    return { projection, pathGen };
  }, [size, rotation, globeK, baseRadius]);

  // Drag to rotate the globe; wheel to zoom (scale extent keeps the globe sane).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sel = select(svg);

    const dragBehavior = drag<SVGSVGElement, unknown>().on("drag", (event: { dx: number; dy: number }) => {
      setRotation((prev) => {
        const sensitivity = 0.35 / Math.max(0.6, globeK);
        const next: [number, number, number] = [
          prev[0] + event.dx * sensitivity,
          Math.max(-85, Math.min(85, prev[1] - event.dy * sensitivity)),
          0,
        ];
        return next;
      });
    });

    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 6])
      .on("zoom", (event) => setGlobeK(event.transform.k));

    sel.call(dragBehavior);
    sel.call(zoomBehavior);
    sel.on("dblclick.zoom", null);
    return () => {
      sel.on(".drag", null);
      sel.on(".zoom", null);
    };
  }, [globeK]);

  const isVisible = (lng: number, lat: number) =>
    geoDistance([lng, lat], [-rotation[0], -rotation[1]]) < Math.PI / 2;

  const personById = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons]
  );

  // De-overlap: persons sharing (nearly) identical coordinates fan out into a ring.
  const displayPos = useMemo(() => {
    const groups = new Map<string, PersonDto[]>();
    for (const p of persons) {
      const key = `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
      const g = groups.get(key) ?? [];
      g.push(p);
      groups.set(key, g);
    }
    const pos = new Map<number, { lat: number; lng: number }>();
    for (const g of groups.values()) {
      if (g.length === 1) {
        pos.set(g[0].id, { lat: g[0].lat, lng: g[0].lng });
        continue;
      }
      const latRad = (g[0].lat * Math.PI) / 180;
      const baseRing = Math.min(6, 3 + g.length * 0.6);
      const radius = baseRing / Math.max(1, Math.sqrt(globeK));
      g.forEach((p, i) => {
        const angle = (2 * Math.PI * i) / g.length - Math.PI / 2;
        pos.set(p.id, {
          lat: g[0].lat + radius * Math.sin(angle),
          lng: g[0].lng + (radius * Math.cos(angle)) / Math.max(0.3, Math.cos(latRad)),
        });
      });
    }
    return pos;
  }, [persons, globeK]);

  const posOf = (p: PersonDto) => displayPos.get(p.id) ?? { lat: p.lat, lng: p.lng };

  // Arcs only for the selected person — thin curves lifted above the surface.
  const arcs = useMemo(() => {
    if (selectedId == null) return [];
    const out: { id: number; d: string }[] = [];
    for (const c of connections) {
      if (c.personAId !== selectedId && c.personBId !== selectedId) continue;
      // Draw the arc STARTING at the selected person so the traveling light
      // pulses outward from them toward their ties.
      const from = personById.get(selectedId);
      const other = personById.get(c.personAId === selectedId ? c.personBId : c.personAId);
      if (!from || !other) continue;
      const pa = posOf(from);
      const pb = posOf(other);
      // Hide the arc when either endpoint sits behind the globe's horizon,
      // matching how the square markers disappear on the far side.
      if (!isVisible(pa.lng, pa.lat) || !isVisible(pb.lng, pb.lat)) continue;
      const sa = projection([pa.lng, pa.lat]);
      const sb = projection([pb.lng, pb.lat]);
      if (!sa || !sb) continue;
      const mx = (sa[0] + sb[0]) / 2;
      const my = (sa[1] + sb[1]) / 2;
      const cx = size.w / 2;
      const cy = size.h / 2;
      // Control point pushed outward from globe center → arc lifts off the surface.
      const lift = 1.18;
      const qx = cx + (mx - cx) * lift;
      const qy = cy + (my - cy) * lift;
      out.push({ id: c.id, d: `M${sa[0]},${sa[1]} Q${qx},${qy} ${sb[0]},${sb[1]}` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, connections, personById, projection, displayPos, size]);

  // Smoothly rotate/zoom the globe to face a clicked country.
  const focusAnim = useRef<number | null>(null);

  const focusPoint = (lng: number, lat: number, targetK = 2.6) => {
    const targetRot: [number, number, number] = [-lng, -lat, 0];
    const startRot = rotation;
    // shortest rotation path in longitude
    let dLng = targetRot[0] - startRot[0];
    dLng = ((dLng + 540) % 360) - 180;
    const startK = globeK;
    const t0 = performance.now();
    const dur = 800;
    if (focusAnim.current) cancelAnimationFrame(focusAnim.current);
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - u, 3); // easeOutCubic
      setRotation([
        startRot[0] + dLng * e,
        startRot[1] + (targetRot[1] - startRot[1]) * e,
        0,
      ]);
      setGlobeK(startK + (targetK - startK) * e);
      if (u < 1) focusAnim.current = requestAnimationFrame(step);
    };
    focusAnim.current = requestAnimationFrame(step);
  };

  const focusCountry = (f: CountryFeature) => {
    const [lng, lat] = geoCentroid(f as never);
    focusPoint(lng, lat);
  };

  const spherePath =
    pathGen({ type: "Sphere" } as unknown as GeoJSON.Feature) ?? "";
  const graticulePath = pathGen({ type: "Feature", geometry: { type: "MultiLineString", coordinates: geoGraticule10() }, properties: {} } as never) ?? "";

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-[#f4f1ea]">
      <div className="relative h-full w-full">
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="block cursor-grab active:cursor-grabbing"
          onMouseMove={(e) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onClick={(e) => {
            if (e.target === svgRef.current) onBackgroundClick?.();
          }}
        >
          {/* ocean sphere */}
          <path d={spherePath} fill={CREAM} stroke={INK} strokeWidth={1} />
          {/* graticule — the reference's signature wireframe */}
          <path d={graticulePath} fill="none" stroke={INK_SOFT} strokeWidth={0.4} strokeOpacity={0.55} />
          {/* countries: ink outlines, cream fill; hover/selected tint */}
          {countries.map((c, i) => {
            const name = c.properties?.name ?? "";
            const hovered = hoveredCountry === name;
            const selected = selectedCountry === name;
            const d = pathGen(c as never);
            if (!d) return null;
            return (
              <path
                key={c.id ?? i}
                d={d}
                fill={selected ? "#e8c8c8" : hovered ? "#f0d5d5" : LAND}
                stroke={hovered || selected ? RED : INK}
                strokeWidth={hovered || selected ? 1 : 0.45}
                strokeOpacity={hovered || selected ? 1 : 0.7}
                className="cursor-pointer"
                style={{ transition: "fill 150ms" }}
                onMouseEnter={() => setHoveredCountry(name)}
                onMouseLeave={() => setHoveredCountry(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (name) {
                    focusCountry(c);
                    onCountryClick?.(name);
                  }
                }}
              >
                <title>{name}</title>
              </path>
            );
          })}

          {/* connection arcs — only the selected person's ties */}
          {arcs.map((a) => (
            <g key={a.id}>
              <path
                d={a.d}
                fill="none"
                stroke={RED}
                strokeWidth={1.6}
                strokeOpacity={0.9}
              />
              {/* white illuminating pulse traveling from the selected person
                  along each tie to the people they're connected to */}
              <path
                d={a.d}
                fill="none"
                stroke="#ffffff"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="14 260"
                style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.95))" }}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="274"
                  to="0"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ))}

          {/* person dots — ink squares with a soft glow, red when selected */}
          {persons.map((p) => {
            const dp = posOf(p);
            if (!isVisible(dp.lng, dp.lat)) return null;
            const pt = projection([dp.lng, dp.lat]) as [number, number] | null;
            if (!pt) return null;
            const selected = p.id === selectedId;
            const highlighted = (highlightIds?.has(p.id) ?? false) || hoveredPerson === p.id;
            const r = selected ? 6 : highlighted ? 5 : 4;
            const color = selected ? RED : INK;
            return (
              <g
                key={p.id}
                transform={`translate(${pt[0]},${pt[1]})`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPerson(p.id)}
                onMouseLeave={() => setHoveredPerson(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  focusPoint(dp.lng, dp.lat, 3.4);
                  onSelect(p.id);
                }}
              >
                {/* soft glow halo */}
                <circle
                  r={r + 7}
                  fill={color}
                  opacity={selected ? 0.28 : 0.14}
                  style={{ filter: "blur(3px)" }}
                />
                <rect
                  x={-r}
                  y={-r}
                  width={r * 2}
                  height={r * 2}
                  fill={color}
                  style={{ transition: "all 150ms" }}
                />
                <text
                  y={-r - 8}
                  textAnchor="middle"
                  fill={selected ? RED : INK}
                  fontSize={selected ? 13 : 11}
                  fontWeight={selected ? 800 : 600}
                  style={{
                    paintOrder: "stroke",
                    stroke: CREAM,
                    strokeWidth: 3,
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  {p.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {/* floating country name label follows the cursor */}
      {hoveredCountry && cursor && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[#d6ccc0] bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#7f1d1d] shadow-lg"
          style={{ left: cursor.x + 14, top: cursor.y + 10 }}
        >
          {hoveredCountry}
        </div>
      )}
      {persons.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-stone-400">
          <p className="text-lg font-medium">This world is empty</p>
          <p className="mt-1 text-sm">
            Use the search bar below to add your first figure
          </p>
        </div>
      )}
    </div>
  );
}
