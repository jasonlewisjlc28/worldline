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
  onSelect: (id: number) => void;
  onBackgroundClick?: () => void;
};

/** Horizontal pixel distance between two longitudes at a given scale, with antimeridian wrap. */
function xDistance(
  project: (lng: number, lat: number) => [number, number] | null,
  aLng: number,
  bLng: number,
  lat: number
): number {
  const a = project(aLng, lat);
  const b = project(bLng, lat);
  if (!a || !b) return Infinity;
  return Math.abs(a[0] - b[0]);
}

export default function WorldMap({
  persons,
  connections,
  selectedId,
  highlightIds,
  onSelect,
  onBackgroundClick,
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [zoomK, setZoomK] = useState(1);

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
      // Route via antimeridian if that makes the path shorter (e.g. Russia–USA)
      const direct = xDistance(project, pa.lng, pb.lng, (pa.lat + pb.lat) / 2);
      const wrapped = xDistance(
        project,
        pa.lng > 0 ? pa.lng - 360 : pa.lng + 360,
        pb.lng,
        (pa.lat + pb.lat) / 2
      );
      const aLng = wrapped < direct ? (pa.lng > 0 ? pa.lng - 360 : pa.lng + 360) : pa.lng;
      const steps = 64;
      const pts: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lng = aLng + (pb.lng - aLng) * t;
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
          {/* graticule-ish subtle countries */}
          {countries.map((c, i) => (
            <path
              key={c.id ?? i}
              d={pathGen(c as never) ?? ""}
              fill="#132039"
              stroke="#1e3050"
              strokeWidth={0.5}
            >
              <title>{c.properties?.name}</title>
            </path>
          ))}

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
