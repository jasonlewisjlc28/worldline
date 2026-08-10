import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { zoom as d3zoom, type ZoomBehavior } from "d3-zoom";
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
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [zoomK, setZoomK] = useState(1);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
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

  const { projection, pathGen } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent(
      [
        [10, 10],
        [size.w - 10, size.h - 10],
      ],
      { type: "Sphere" } as unknown as GeoJSON.Feature
    );
    const pathGen = geoPath(projection);
    return { projection, pathGen };
  }, [size]);

  // Pan & zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const g = select(svg).select<SVGGElement>("g.map-root");
    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = d3zoom<
      SVGSVGElement,
      unknown
    >()
      .scaleExtent([1, 12])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
        setZoomK(event.transform.k);
      });
    const sel = select(svg);
    sel.call(zoomBehavior);
    sel.on("dblclick.zoom", null); // disable dblclick zoom so clicks feel instant
    return () => {
      sel.on(".zoom", null);
    };
  }, []);

  const project = (lng: number, lat: number): [number, number] | null =>
    projection([lng, lat]) as [number, number] | null;

  const personById = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons]
  );

  // De-overlap: persons sharing (nearly) identical coordinates are fanned out
  // into a ring around the shared point so every dot stays clickable & labeled.
  const displayPos = useMemo(() => {
    const groups = new Map<string, PersonDto[]>();
    for (const p of persons) {
      const key = `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
      const g = groups.get(key) ?? [];
      g.push(p);
      groups.set(key, g);
    }
    const pos = new Map<number, { lat: number; lng: number; grouped: boolean }>();
    for (const g of groups.values()) {
      if (g.length === 1) {
        pos.set(g[0].id, { lat: g[0].lat, lng: g[0].lng, grouped: false });
        continue;
      }
      // Ring offsets in degrees, scaled with latitude so they look even on the map.
      // Shrink the ring as the user zooms in so it doesn't become enormous.
      const latRad = (g[0].lat * Math.PI) / 180;
      const baseRadius = Math.min(6, 3 + g.length * 0.6);
      const radius = baseRadius / Math.max(1, Math.sqrt(zoomK));
      g.forEach((p, i) => {
        const angle = (2 * Math.PI * i) / g.length - Math.PI / 2;
        pos.set(p.id, {
          lat: g[0].lat + radius * Math.sin(angle),
          lng: g[0].lng + (radius * Math.cos(angle)) / Math.max(0.3, Math.cos(latRad)),
          grouped: true,
        });
      });
    }
    return pos;
  }, [persons, zoomK]);

  const posOf = (p: PersonDto) => displayPos.get(p.id) ?? { lat: p.lat, lng: p.lng, grouped: false };

  const links = useMemo(() => {
    const out: {
      id: number;
      d: string;
      a: PersonDto;
      b: PersonDto;
      width: number;
    }[] = [];
    for (const c of connections) {
      const a = personById.get(c.personAId);
      const b = personById.get(c.personBId);
      if (!a || !b) continue;
      const pa = posOf(a);
      const pb = posOf(b);
      // Choose the shorter longitudinal direction (handle antimeridian crossings
      // like Russia–USA), then sample the straight equirect segment in lng/lat.
      let dLng = pb.lng - pa.lng;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      const steps = 64;
      const pts: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lng = pa.lng + dLng * t;
        const lat = pa.lat + (pb.lat - pa.lat) * t;
        const p = project(lng, lat);
        if (p) pts.push(p);
      }
      if (pts.length < 2) continue;
      const d =
        `M${pts[0][0]},${pts[0][1]}` +
        pts.slice(1).map((p) => `L${p[0]},${p[1]}`).join("");
      out.push({ id: c.id, d, a, b, width: 1.5 });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, personById, projection, displayPos]);

  const isLinkHighlighted = (aId: number, bId: number) => {
    if (selectedId != null && (aId === selectedId || bId === selectedId)) return true;
    if (highlightIds && (highlightIds.has(aId) || highlightIds.has(bId))) return true;
    return false;
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-[#070d1a]">
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
        <g className="map-root">
          {/* ocean sphere */}
          <path
            d={pathGen({ type: "Sphere" } as unknown as GeoJSON.Feature) ?? ""}
            fill="#0a1428"
          />
          {/* countries — hover highlights light blue, click opens the country panel */}
          {countries.map((c, i) => {
            const name = c.properties?.name ?? "";
            const hovered = hoveredCountry === name;
            const selected = selectedCountry === name;
            return (
              <path
                key={c.id ?? i}
                d={pathGen(c as never) ?? ""}
                fill={selected ? "#1d4d7a" : hovered ? "#2b5d8f" : "#132039"}
                stroke={hovered || selected ? "#7dd3fc" : "#1e3050"}
                strokeWidth={hovered || selected ? 1 : 0.5}
                className="cursor-pointer"
                style={{ transition: "fill 150ms, stroke 150ms" }}
                onMouseEnter={() => setHoveredCountry(name)}
                onMouseLeave={() => setHoveredCountry(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (name) onCountryClick?.(name);
                }}
              >
                <title>{name}</title>
              </path>
            );
          })}

          {/* connection arcs */}
          {links.map((l) => {
            const hot = isLinkHighlighted(l.a.id, l.b.id);
            return (
              <path
                key={l.id}
                d={l.d}
                fill="none"
                stroke={hot ? "#38bdf8" : "#8b6fe8"}
                strokeOpacity={hot ? 0.95 : 0.7}
                strokeWidth={hot ? 2.4 : 1.8}
                style={{ transition: "stroke 200ms, stroke-opacity 200ms" }}
              />
            );
          })}

          {/* person dots (de-overlapped positions) */}
          {persons.map((p) => {
            const dp = posOf(p);
            const pt = project(dp.lng, dp.lat);
            if (!pt) return null;
            const selected = p.id === selectedId;
            const highlighted = highlightIds?.has(p.id) ?? false;
            const r = selected ? 9 : highlighted ? 7 : 5.5;
            return (
              <g
                key={p.id}
                transform={`translate(${pt[0]},${pt[1]})`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(p.id);
                }}
              >
                {(selected || highlighted) && (
                  <circle
                    r={r + 7}
                    fill="none"
                    stroke={selected ? "#38bdf8" : "#a78bfa"}
                    strokeOpacity={0.5}
                    strokeWidth={1.5}
                  />
                )}
                <circle
                  r={r}
                  fill={selected ? "#38bdf8" : "#e2b341"}
                  stroke="#0b1220"
                  strokeWidth={1.5}
                  style={{ transition: "r 150ms" }}
                />
                <text
                  y={-r - 6}
                  textAnchor="middle"
                  fill={selected ? "#bae6fd" : "#d7dee9"}
                  fontSize={selected ? 13 : 11}
                  fontWeight={selected ? 700 : 500}
                  style={{
                    paintOrder: "stroke",
                    stroke: "#070d1a",
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
        </g>
      </svg>
      {/* floating country name label follows the cursor */}
      {hoveredCountry && cursor && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-sky-400/40 bg-[#0c1526]/95 px-2.5 py-1 text-xs font-semibold text-sky-200 shadow-lg"
          style={{ left: cursor.x + 14, top: cursor.y + 10 }}
        >
          {hoveredCountry}
        </div>
      )}
      {persons.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-slate-500">
          <p className="text-lg font-medium">This world is empty</p>
          <p className="mt-1 text-sm">
            Use the search bar below to add your first figure
          </p>
        </div>
      )}
    </div>
  );
}
