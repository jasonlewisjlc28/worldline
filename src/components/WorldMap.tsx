import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createLivestockSystem, type LivestockSystem } from "./pastureLivestock";
import earcut from "earcut";
import { geoCentroid, geoContains, geoDistance } from "d3-geo";
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
  // Geolocated resource markers (mines / refineries) shown as squares.
  markers?: { name: string; lat: number; lng: number; kind: "mine" | "refinery"; color?: string }[];
  /** basin/shale outlines: hand-drawn style dashed loops with name labels */
  heat?: { name: string; lat: number; lng: number; rx: number; ry: number; rot: number; color: string; poly?: [number, number][] }[];
  // When set (with a new nonce), smoothly rotate/zoom the globe to this point.
  focusRequest?: { lat: number; lng: number; nonce: number } | null;
  /** country whose cropland regions should be marked with the neon cornfield */
  cropland?: string | null;
  /** width of the UI panel overlapping the right edge; the globe re-centers left */
  obscuredRight?: number;
};

// Reference-site palette: cream canvas, ink lines, soft glow dots, red accents.
const INK = "#292524";
const INK_SOFT = "#a8a29e";
const CREAM = "#f4f1ea";
const LAND = "#ece7dd";
const RED = "#b91c1c";
const HOVER = "#f0d5d5";
const SELECTED = "#e8c8c8";

const DEG = Math.PI / 180;
const R = 1; // globe radius in world units
const FOV = 30; // degrees — near-orthographic feel
const SURFACE = 1.002; // land sits above the ocean sphere
const GRATICULE = 1.0005; // graticule under the land (as in the old SVG draw order)

type Cam = { az: number; el: number; dist: number };

const toVec3 = (lng: number, lat: number, r: number = R): THREE.Vector3 => {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
};

const azOf = (c: THREE.Vector3) => Math.atan2(c.x, c.z);
const elOf = (c: THREE.Vector3) => Math.asin(Math.max(-1, Math.min(1, c.y / c.length())));

const vecToLngLat = (v: THREE.Vector3): [number, number] => {
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v.y))) / DEG;
  let lng = Math.atan2(v.z, -v.x) / DEG - 180;
  if (lng < -180) lng += 360;
  if (lng > 180) lng -= 360;
  return [lng, lat];
};

// Densify one ring segment with sphere-hugging points so triangulated edges
// never dip below the ocean surface (which used to show as a white fringe).
const MAX_EDGE = 1.5 * DEG;
const densify = (out: [number, number][], a: [number, number], b: [number, number]) => {
  const va = toVec3(a[0], a[1], 1);
  const vb = toVec3(b[0], b[1], 1);
  const steps = Math.min(16, Math.floor(va.angleTo(vb) / MAX_EDGE));
  for (let s = 1; s <= steps; s++) {
    const v = va.clone().lerp(vb, s / (steps + 1)).normalize();
    out.push(vecToLngLat(v));
  }
  out.push(b);
};

// Unwrap a ring's longitudes around its first point so polygons crossing the
// antimeridian stay continuous for triangulation, and densify every edge.
const unwrapRing = (ring: [number, number][]): [number, number][] => {
  const out: [number, number][] = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0];
    const prev = out[out.length - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    densify(out, out[out.length - 1], [lng, ring[i][1]]);
  }
  return out;
};

// Angular radius of a feature around its centroid (sampled ring vertices).
const angularRadius = (f: CountryFeature, centroid: [number, number]): number => {
  let max = 0.02;
  const visit = (ring: [number, number][]) => {
    for (const [lng, lat] of ring) {
      const d = geoDistance([lng, lat], centroid);
      if (d > max) max = d;
    }
  };
  const g = f.geometry;
  if (g.type === "Polygon") g.coordinates.forEach((p) => visit(p as [number, number][]));
  else if (g.type === "MultiPolygon") g.coordinates.forEach((poly) => poly.forEach((p) => visit(p as [number, number][])));
  return max;
};

const fitDistance = (alpha: number): number => {
  const beta = (FOV / 2) * 0.55 * DEG; // country fills ~55% of the view height
  const d = 1.1 * ((Math.sin(alpha) / Math.tan(beta)) - Math.cos(alpha));
  // never fly so close that the camera sits on the ground — small countries
  // simply appear smaller instead of filling the whole frame
  return Math.max(0.55, Math.min(6, d));
};

// Camera-pose solver for country camera mode. The preferred starting tilt
// Camera-pose solver for country camera mode. The goal is a "map-like" view:
// hover nearly straight over the country's spherical center so the country
// reads like a flat map of itself (north-up roll is applied by the render
// loop). If any part of the country would still fall outside the visible cap
// (hidden behind the globe's curve), blend smoothly toward a fully face-on
// pose until every vertex sits inside the horizon.
const countryView = (f: CountryFeature, centroidLngLat: [number, number]) => {
  const [lng, lat] = centroidLngLat;
  const C = toVec3(lng, lat, R);
  const verts: THREE.Vector3[] = [];
  const visit = (ring: [number, number][]) => {
    for (const [vlng, vlat] of ring) verts.push(toVec3(vlng, vlat, R));
  };
  const g = f.geometry;
  if (g.type === "Polygon") g.coordinates.forEach((p) => visit(p as [number, number][]));
  else if (g.type === "MultiPolygon") g.coordinates.forEach((poly) => poly.forEach((p) => visit(p as [number, number][])));

  // spherical center of the country (where a face-on camera would hover)
  const mean = new THREE.Vector3();
  for (const v of verts) mean.add(v);
  const M = mean.lengthSq() < 1e-9 ? C.clone() : mean.normalize();

  const alpha = angularRadius(f, [lng, lat]);
  const angBetween = (a: THREE.Vector3, b: THREE.Vector3) =>
    Math.acos(Math.max(-1, Math.min(1, a.dot(b) / (a.length() * b.length()))));
  // horizon angle for a camera at radius p from the globe center
  const horizon = (p: number) => Math.acos(Math.min(1, R / p));

  // Face-on pose: the camera hovers along the radius through the country's
  // spherical center, so the country reads like a flat map of itself
  // (north-up roll is applied by the render loop). Zoom out only as far as
  // needed to keep every vertex comfortably inside the visible cap.
  const S = M;
  const sc = S.dot(C);
  let d = fitDistance(alpha);
  for (let k = 0; k < 40; k++) {
    const disc = sc * sc - (1 - d * d);
    if (disc >= 0) {
      const p = sc + Math.sqrt(disc);
      let worst = 0;
      for (const v of verts) worst = Math.max(worst, angBetween(v, S));
      if (worst <= 0.85 * horizon(p)) break;
    }
    d *= 1.08;
  }
  const p = sc + Math.sqrt(Math.max(0, sc * sc - (1 - d * d)));
  const u = S.clone().multiplyScalar(p).sub(C).divideScalar(d); // unit offset
  return {
    az: azOf(u),
    el: Math.asin(Math.max(-1, Math.min(1, u.y))),
    dist: d,
    focus: C,
  };
};

// ----------------------------------------------------------- cropland layer
// Global cropland grid (Mehrabi et al. 2025, CC-BY 4.0): 1440x720 Uint8
// percent cells, 0.25°, row 0 = 90°N..89.75°N, col 0 = 180°W..179.75°W.
const GRID_W = 1440;
const GRID_H = 720;
const GRID_CELL = 0.25;
const CROPLAND_MIN_PCT = 20;

let croplandGridCache: Uint8Array | null = null;
let croplandGridPromise: Promise<Uint8Array> | null = null;
const loadCroplandGrid = () => {
  if (croplandGridCache) return Promise.resolve(croplandGridCache);
  if (!croplandGridPromise) {
    croplandGridPromise = fetch("/data/cropland.bin")
      .then((r) => {
        if (!r.ok) throw new Error(`Cropland grid: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => {
        croplandGridCache = new Uint8Array(b);
        return croplandGridCache;
      });
  }
  return croplandGridPromise;
};

let pastureGridCache: Uint8Array | null = null;
let pastureGridPromise: Promise<Uint8Array> | null = null;
const loadPastureGrid = () => {
  if (pastureGridCache) return Promise.resolve(pastureGridCache);
  if (!pastureGridPromise) {
    pastureGridPromise = fetch("/data/pasture.bin")
      .then((r) => {
        if (!r.ok) throw new Error(`Pasture grid: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => {
        pastureGridCache = new Uint8Array(b);
        return pastureGridCache;
      });
  }
  return pastureGridPromise;
};

// The cornfield GLB ships PBR materials, but the scene is unlit (flat
// MeshBasicMaterial everywhere) — convert to basic, keeping the neon look via
// emissive colors, alpha-cutout leaf/tassel cards, and the transparent body.
let cornfieldCache: THREE.Group | null = null;
let cornfieldPromise: Promise<THREE.Group> | null = null;
const loadCornfield = () => {
  if (cornfieldCache) return Promise.resolve(cornfieldCache);
  if (!cornfieldPromise) {
    cornfieldPromise = new GLTFLoader()
      .loadAsync("/preview/neon-corn-lowpoly.glb")
      .then((g: any) => {
        g.scene.traverse((o: any) => {
          // Hide the plane outline boxes (same as the preview's "Planes off"):
          // the red drawings on the cards stay visible. NOTE: wire_cards is a
          // LINES primitive, which GLTFLoader builds as THREE.Line — not a
          // Mesh — so this check must run before the isMesh filter below.
          if (o.name === "wire_cards") o.visible = false;
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const conv = mats.map((m: any) => {
            const src = m as THREE.MeshStandardMaterial;
            const emissive =
              src.emissive && (src.emissive.r > 0.01 || src.emissive.g > 0.01 || src.emissive.b > 0.01)
                ? src.emissive
                : src.color;
            return new THREE.MeshBasicMaterial({
              color: emissive.clone(),
              map: src.map ?? null,
              transparent: src.transparent,
              opacity: src.opacity,
              alphaTest: src.alphaTest || 0,
              side: src.side,
              wireframe: src.wireframe,
              depthWrite: src.depthWrite,
            });
          });
          mesh.material = Array.isArray(mesh.material) ? conv : conv[0];
        });
        cornfieldCache = g.scene;
        return g.scene;
      });
  }
  return cornfieldPromise;
};

// Holographic load-in for the cornfield layer. Each stalk clones its
// materials so it can fade in on its own stagger, sweeping south (screen
// bottom) to north while growing from its base.
type CornGrowItem = {
  obj: THREE.Object3D;
  basePos: THREE.Vector3;
  up: THREE.Vector3;
  scale: number;
  heightScale: number;
  widthScale: number;
  height: number;
  delay: number; // ms after t0
  dur: number; // ms
  seed: number;
  mats: { m: THREE.Material; target: number; transparent0: boolean }[];
};
const CORN_GROW_STAGGER = 1.1; // s, sweep window across the country's latitude
const CORN_GROW_DUR = 0.55; // s per stalk

type AgriculturalKind = "crop" | "pasture";
type AgriculturalCell = { key: number; lng: number; lat: number; pct: number };
type AgriculturalRegion = {
  kind: AgriculturalKind;
  lng: number;
  lat: number;
  radiusDeg: number;
  cells: AgriculturalCell[];
  cellSet: Set<number>;
  pts: { lng: number; lat: number }[]; // dominant land-use cell centers
};

// Deterministic RNG so a country's scatter layout survives re-renders.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hashName = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Each six-vertex card is one leaf. Give a small set of shared stalk variants
// subtle differences in node height, leaf size, azimuth, and pitch. Geometry is
// shared within each variant, so the field stays cheap to render.
const makeCornGrowthVariant = (proto: THREE.Group, rng: () => number) => {
  const variant = proto.clone(true);
  variant.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || o.name !== "cards") return;
    const geometry = mesh.geometry.clone();
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const base = new THREE.Vector3();
    const point = new THREE.Vector3();
    for (let first = 0; first + 5 < positions.count; first += 6) {
      base.set(
        (positions.getX(first) + positions.getX(first + 1)) * 0.5,
        (positions.getY(first) + positions.getY(first + 1)) * 0.5,
        (positions.getZ(first) + positions.getZ(first + 1)) * 0.5
      );
      const radial = new THREE.Vector3(base.x, 0, base.z);
      if (radial.lengthSq() < 1e-8) radial.set(1, 0, 0);
      radial.normalize();
      const tangent = new THREE.Vector3(-radial.z, 0, radial.x);
      const leafSize = 0.94 + rng() * 0.12;
      const transform = new THREE.Matrix4()
        .makeTranslation(base.x, base.y + (rng() - 0.5) * 0.036, base.z)
        .multiply(new THREE.Matrix4().makeRotationY((rng() - 0.5) * 0.24))
        .multiply(new THREE.Matrix4().makeRotationAxis(tangent, (rng() - 0.5) * 0.16))
        .multiply(new THREE.Matrix4().makeScale(leafSize, leafSize, leafSize))
        .multiply(new THREE.Matrix4().makeTranslation(-base.x, -base.y, -base.z));
      for (let i = first; i < first + 6; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(transform);
        positions.setXYZ(i, point.x, point.y, point.z);
      }
    }
    positions.needsUpdate = true;
    geometry.computeBoundingSphere();
    mesh.geometry = geometry;
  });
  return variant;
};

// Find contiguous crop- and pasture-dominant regions inside a country. Each
// 0.25° cell has exactly one land-use owner, so the two overlays never compete
// and corn can be restricted to the same crop-dominant geometry.
const agriculturalRegions = (
  f: CountryFeature,
  cropGrid: Uint8Array,
  pastureGrid: Uint8Array
): AgriculturalRegion[] => {
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  const visitRing = (ring: [number, number][]) => {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  };
  const g = f.geometry;
  if (g.type === "Polygon") g.coordinates.forEach((p) => visitRing(p as [number, number][]));
  else if (g.type === "MultiPolygon") g.coordinates.forEach((poly) => poly.forEach((p) => visitRing(p as [number, number][])));

  const j0 = Math.max(0, Math.floor((minLng + 180) / GRID_CELL));
  const j1 = Math.min(GRID_W - 1, Math.floor((maxLng + 180) / GRID_CELL));
  const i0 = Math.max(0, Math.floor((90 - maxLat) / GRID_CELL));
  const i1 = Math.min(GRID_H - 1, Math.floor((90 - minLat) / GRID_CELL));

  const owners = new Map<number, AgriculturalKind>();
  for (let i = i0; i <= i1; i++) {
    const lat = 90 - (i + 0.5) * GRID_CELL;
    for (let j = j0; j <= j1; j++) {
      const key = i * GRID_W + j;
      const crop = cropGrid[key];
      const pasture = pastureGrid[key];
      if (Math.max(crop, pasture) < CROPLAND_MIN_PCT) continue;
      const lng = -180 + (j + 0.5) * GRID_CELL;
      if (geoContains(f as never, [lng, lat])) {
        // Ties favor crops, preserving the previous cornfield behavior.
        owners.set(key, crop >= pasture ? "crop" : "pasture");
      }
    }
  }
  if (owners.size === 0) return [];

  // 8-connected components, separated at crop/pasture boundaries.
  const clusters: { kind: AgriculturalKind; cells: AgriculturalCell[] }[] = [];
  const seen = new Set<number>();
  for (const [start, startKind] of owners) {
    if (seen.has(start)) continue;
    const comp: AgriculturalCell[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const key = stack.pop()!;
      const kind = owners.get(key)!;
      const i = Math.floor(key / GRID_W);
      const j = key % GRID_W;
      const lng = -180 + (j + 0.5) * GRID_CELL;
      const lat = 90 - (i + 0.5) * GRID_CELL;
      comp.push({
        key,
        lng,
        lat,
        pct: kind === "crop" ? cropGrid[key] : pastureGrid[key],
      });
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = i + di, nj = j + dj;
          if (ni < 0 || ni >= GRID_H || nj < 0 || nj >= GRID_W) continue;
          const nk = ni * GRID_W + nj;
          if (owners.get(nk) === startKind && !seen.has(nk)) {
            seen.add(nk);
            stack.push(nk);
          }
        }
      }
    }
    clusters.push({ kind: startKind, cells: comp });
  }

  // Rank by real land-use weight and retain the country's dominant regions.
  clusters.sort((a, b) => {
    const sa = a.cells.reduce((s, c) => s + c.pct, 0);
    const sb = b.cells.reduce((s, c) => s + c.pct, 0);
    return sb - sa;
  });
  const out: AgriculturalRegion[] = [];
  for (const { kind, cells: comp } of clusters) {
    if (out.length >= 12) break;
    const total = comp.reduce((s, c) => s + c.pct, 0);
    if (total < 30) continue; // ignore specks
    let lng = 0, lat = 0;
    for (const c of comp) {
      lng += c.lng * c.pct;
      lat += c.lat * c.pct;
    }
    lng /= total;
    lat /= total;
    let radius = 0.7;
    for (const c of comp) radius = Math.max(radius, geoDistance([c.lng, c.lat], [lng, lat]) / DEG);
    radius += 0.18;
    out.push({
      kind,
      lng,
      lat,
      radiusDeg: radius,
      cells: comp,
      cellSet: new Set(comp.map((c) => c.key)),
      pts: comp.map((c) => ({ lng: c.lng, lat: c.lat })),
    });
  }
  return out;
};

const AGRICULTURE_COLORS: Record<AgriculturalKind, string> = {
  crop: "#1f9d55",
  pasture: "#e53935",
};

// One surface-hugging mesh per land-use type. The hatch is procedural and in
// geographic units, so its spacing is consistent between countries without a
// texture swimming across the globe or changing density between regions.
const makeAgricultureSurface = (regions: AgriculturalRegion[], kind: AgriculturalKind) => {
  const positions: number[] = [];
  const geoCoords: number[] = [];
  const indices: number[] = [];
  const borderPositions: number[] = [];
  const radius = SURFACE + (kind === "pasture" ? 0.00105 : 0.00085);
  const borderRadius = SURFACE + (kind === "pasture" ? 0.00135 : 0.00115);
  const half = GRID_CELL * 0.5;
  const steps = 2;

  for (const reg of regions) {
    if (reg.kind !== kind) continue;
    for (const cell of reg.cells) {
      const base = positions.length / 3;
      for (let y = 0; y <= steps; y++) {
        const lat = cell.lat - half + (GRID_CELL * y) / steps;
        for (let x = 0; x <= steps; x++) {
          const lng = cell.lng - half + (GRID_CELL * x) / steps;
          const v = toVec3(lng, lat, radius);
          positions.push(v.x, v.y, v.z);
          geoCoords.push(lng, lat);
        }
      }
      for (let y = 0; y < steps; y++) {
        for (let x = 0; x < steps; x++) {
          const a = base + y * (steps + 1) + x;
          const b = a + 1;
          const c = a + steps + 1;
          const d = c + 1;
          indices.push(a, b, c, b, d, c);
        }
      }

      // Only exterior component edges become outlines; shared cell edges do
      // not produce a dark grid over the hatch.
      const i = Math.floor(cell.key / GRID_W);
      const j = cell.key % GRID_W;
      const edges = [
        { neighbor: (i - 1) * GRID_W + j, a: [cell.lng - half, cell.lat + half], b: [cell.lng + half, cell.lat + half] },
        { neighbor: (i + 1) * GRID_W + j, a: [cell.lng - half, cell.lat - half], b: [cell.lng + half, cell.lat - half] },
        { neighbor: i * GRID_W + j - 1, a: [cell.lng - half, cell.lat - half], b: [cell.lng - half, cell.lat + half] },
        { neighbor: i * GRID_W + j + 1, a: [cell.lng + half, cell.lat - half], b: [cell.lng + half, cell.lat + half] },
      ];
      for (const edge of edges) {
        if (reg.cellSet.has(edge.neighbor)) continue;
        const a = toVec3(edge.a[0], edge.a[1], borderRadius);
        const b = toVec3(edge.b[0], edge.b[1], borderRadius);
        borderPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }

  const group = new THREE.Group();
  if (indices.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aGeo", new THREE.Float32BufferAttribute(geoCoords, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(AGRICULTURE_COLORS[kind]) },
        uOpacity: { value: 0.88 },
      },
      vertexShader: `
        attribute vec2 aGeo;
        varying vec2 vGeo;
        void main() {
          vGeo = aGeo;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vGeo;
        void main() {
          float lat = vGeo.y * 0.01745329252;
          vec2 p = vec2(vGeo.x * cos(lat), vGeo.y);
          float diagonal = (p.x - p.y) * 8.0;
          float along = (p.x + p.y) * 6.0;
          float distToLine = abs(fract(diagonal) - 0.5);
          float lineAA = max(fwidth(diagonal) * 0.65, 0.002);
          float stroke = 1.0 - smoothstep(0.09 - lineAA, 0.09 + lineAA, distToLine);
          float dashAA = max(fwidth(along) * 0.65, 0.002);
          float dash = smoothstep(0.36 - dashAA, 0.36 + dashAA, fract(along));
          float alpha = stroke * dash * uOpacity;
          if (alpha < 0.015) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = kind === "pasture" ? 4 : 3;
    group.add(mesh);
  }
  if (borderPositions.length) {
    const border = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(borderPositions, 3)),
      new THREE.LineBasicMaterial({
        color: AGRICULTURE_COLORS[kind],
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    border.renderOrder = kind === "pasture" ? 6 : 5;
    group.add(border);
  }
  return group;
};

// Evenly spread subset of the region's real cropland cells: farthest-point
// sampling keeps the geographic shape instead of random scatter.
const sampleCells = (
  pts: { lng: number; lat: number }[],
  n: number,
  rng: () => number
) => {
  if (pts.length <= n) return pts;
  const d2 = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => {
    const dx = a.lng - b.lng;
    const dy = (a.lat - b.lat) * 0.7; // rough latitude compression
    return dx * dx + dy * dy;
  };
  const picked = new Set<number>();
  const first = Math.floor(rng() * pts.length);
  picked.add(first);
  const chosen = [pts[first]];
  const dist = pts.map((p) => d2(p, pts[first]));
  while (chosen.length < n) {
    let bi = -1;
    let bd = -1;
    for (let i = 0; i < pts.length; i++) {
      if (picked.has(i)) continue;
      if (dist[i] > bd) {
        bd = dist[i];
        bi = i;
      }
    }
    if (bi < 0) break;
    picked.add(bi);
    chosen.push(pts[bi]);
    for (let i = 0; i < pts.length; i++) {
      const nd = d2(pts[i], pts[bi]);
      if (nd < dist[i]) dist[i] = nd;
    }
  }
  return chosen;
};

// Canvas-texture label sprite (name text with cream halo).
const makeLabelSprite = (text: string, color: string, opts?: { square?: boolean; glow?: string; fontSize?: number }): THREE.Sprite => {
  const fontSize = opts?.fontSize ?? 30;
  const pad = 12;
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d")!;
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const tw = Math.ceil(ctx.measureText(text).width);
  cv.width = Math.max(64, tw + pad * 2);
  cv.height = fontSize + (opts?.square ? 90 : pad * 2);
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = cv.width / 2;
  if (opts?.square) {
    // soft glow
    const g = ctx.createRadialGradient(cx, cv.height - 34, 2, cx, cv.height - 34, 30);
    g.addColorStop(0, opts.glow ?? color);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = color;
    ctx.fillRect(cx - 9, cv.height - 43, 18, 18);
  }
  ctx.lineWidth = 5;
  ctx.strokeStyle = CREAM;
  ctx.strokeText(text, cx, fontSize / 2 + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, cx, fontSize / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const worldH = 0.062;
  sp.scale.set((cv.width / cv.height) * worldH, worldH, 1);
  sp.renderOrder = 10;
  return sp;
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
  markers,
  heat,
  focusRequest,
  cropland,
  obscuredRight = 0,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // --- three.js scene lives in refs (rendered imperatively, not by React) ---
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const countriesGroupRef = useRef<THREE.Group | null>(null);
  const overlayGroupRef = useRef<THREE.Group | null>(null); // persons/arcs/markers/heat
  const countryMeshesRef = useRef<{ mesh: THREE.Mesh; outlines: THREE.LineLoop[]; name: string }[]>([]);
  const personSpritesRef = useRef<Map<number, THREE.Sprite>>(new Map());
  const pulsesRef = useRef<{ curve: THREE.QuadraticBezierCurve3; sprite: THREE.Sprite; offset: number }[]>([]);
  const camRef = useRef<Cam>({ az: 0.65, el: 0.52, dist: 4.4 });
  const focusRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const obscuredRightRef = useRef(obscuredRight);
  useEffect(() => {
    obscuredRightRef.current = obscuredRight;
  }, [obscuredRight]);
  const tweenToken = useRef(0);
  const zoomToken = useRef(0);
  const zoomAnim = useRef<{ from: number; to: number } | null>(null);
  // distance a flyTo tween is heading toward; wheel zoom measures its first
  // step from this so scrolling mid-flight doesn't lurch from a far-out point
  const flyDistTarget = useRef<number | null>(null);
  const lastCountryPoint = useRef<THREE.Vector3 | null>(null);
  const desiredOverview = useRef<Cam>({ az: 0.65, el: 0.52, dist: 4.4 });
  const croplandGroupRef = useRef<THREE.Group | null>(null);
  const croplandToken = useRef(0);
  const croplandCountRef = useRef(0);
  const cornGrowRef = useRef<{ items: CornGrowItem[]; t0: number } | null>(null);
  const livestockRef = useRef<LivestockSystem | null>(null);

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

  const overviewDist = (w: number, h: number) => {
    const fPx = (h / 2) / Math.tan((FOV / 2) * DEG); // focal length in px
    return Math.max(2.2, fPx / (0.42 * Math.min(w, h)));
  };

  // Build the static globe: sphere, rim, graticule.
  const buildGlobe = (scene: THREE.Scene) => {
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshBasicMaterial({ color: CREAM })));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 96, 64), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })));
    // graticule every 20°
    const g: number[] = [];
    const seg = 72;
    const push = (a: THREE.Vector3, b: THREE.Vector3) => g.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (let lng = -180; lng < 180; lng += 20) {
      for (let i = 0; i < seg; i++) {
        const la = -90 + (i / seg) * 180;
        const lb = -90 + ((i + 1) / seg) * 180;
        push(toVec3(lng, la, GRATICULE), toVec3(lng, lb, GRATICULE));
      }
    }
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let i = 0; i < seg; i++) {
        const ln = -180 + (i / seg) * 360;
        const ln2 = -180 + ((i + 1) / seg) * 360;
        push(toVec3(ln, lat, GRATICULE), toVec3(ln2, lat, GRATICULE));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(g, 3));
    scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: INK_SOFT, transparent: true, opacity: 0.55 })));
  };

  // Initialize renderer/scene/camera once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(CREAM);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 200);
    buildGlobe(scene);

    const countriesGroup = new THREE.Group();
    const overlayGroup = new THREE.Group();
    scene.add(countriesGroup);
    scene.add(overlayGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    countriesGroupRef.current = countriesGroup;
    overlayGroupRef.current = overlayGroup;

    // --- interaction handlers ---
    const raycaster = new THREE.Raycaster();
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;

    const castAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const personsHit = raycaster.intersectObjects([...personSpritesRef.current.values()], false);
      const countryHit = raycaster.intersectObjects(countryMeshesRef.current.map((c) => c.mesh), false);
      return { personsHit, countryHit };
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      tweenToken.current++; // grabbing interrupts any in-flight camera tween
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* synthetic/idle pointer */ }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        lastX = e.clientX;
        lastY = e.clientY;
        const cam = camRef.current;
        // drag right swings the world left (camera moves right around the
        // focus); drag up raises the camera elevation
        cam.az += dx * 0.0055;
        cam.el = Math.max(-1.45, Math.min(1.5, cam.el - dy * 0.0055));
        return;
      }
      const { personsHit, countryHit } = castAt(e.clientX, e.clientY);
      const name = countryHit[0] ? (countryHit[0].object.userData.name as string) : null;
      setHoveredCountry(name);
      renderer.domElement.style.cursor = personsHit[0] || countryHit[0] ? "pointer" : "grab";
    };

    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      if (moved > 6) return; // it was a drag, not a click
      const { personsHit, countryHit } = castAt(e.clientX, e.clientY);
      if (personsHit[0]) {
        onSelect(personsHit[0].object.userData.id as number);
        return;
      }
      if (countryHit[0]) {
        const name = countryHit[0].object.userData.name as string;
        if (name) onCountryClick?.(name);
        return;
      }
      onBackgroundClick?.();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      tweenToken.current++;
      const cam = camRef.current;
      // keep the camera comfortably outside the globe when orbiting the whole
      // world; allow close zoom only around a focused surface point
      const minD = focusRef.current.length() < 0.5 ? 1.55 : 0.12;
      // smooth, gradual zoom: accumulate the target distance and ease toward
      // it over a short animation instead of jumping per wheel event; clamp
      // per-event delta so trackpad bursts can't lurch the camera
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 33; // line-mode wheels
      if (e.deltaMode === 2) dy *= 300; // page-mode wheels
      dy = Math.max(-120, Math.min(120, dy));
      const zooming = zoomToken.current > 0 ? zoomAnim.current : null;
      const current = zooming ? zooming.to : (flyDistTarget.current ?? cam.dist);
      flyDistTarget.current = null; // wheel now owns the distance
      const to = Math.max(minD, Math.min(40, current * Math.exp(dy * 0.0018)));
      if (Math.abs(to - cam.dist) < 1e-6) return;
      const token = ++zoomToken.current;
      const from = cam.dist;
      zoomAnim.current = { from, to };
      const t0 = performance.now();
      const dur = 280;
      const step = () => {
        if (zoomToken.current !== token) return;
        const u = Math.min(1, (performance.now() - t0) / dur);
        const ee = 1 - Math.pow(1 - u, 3); // easeOutCubic
        camRef.current = { ...camRef.current, dist: from + (to - from) * ee };
        if (u < 1) requestAnimationFrame(step);
        else zoomAnim.current = null;
      };
      requestAnimationFrame(step);
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    // render loop
    let raf = 0;
    const loop = () => {
      const cam = camRef.current;
      const focus = focusRef.current;
      const off = new THREE.Vector3(
        Math.sin(cam.az) * Math.cos(cam.el),
        Math.sin(cam.el),
        Math.cos(cam.az) * Math.cos(cam.el)
      ).multiplyScalar(cam.dist);
      camera.position.copy(focus).add(off);
      // country camera mode reads like a map: roll the camera so the focus
      // point's local north points to the top of the screen. The whole-world
      // view keeps its default orientation.
      const up = new THREE.Vector3(0, 1, 0);
      if (focus.lengthSq() > 0.25) {
        const view = off.clone().multiplyScalar(-1 / cam.dist); // camera -> focus
        up.addScaledVector(view, -up.dot(view));
        if (up.lengthSq() < 1e-4) {
          // essentially over the pole: anchor screen-up to the meridian at lng 0
          up.set(0, 0, -1).addScaledVector(view, view.z);
        }
        up.normalize();
      }
      camera.up.copy(up);
      camera.lookAt(focus);
      // shift the camera right so the focus point lands centered in the area
      // left of the UI panel — self-correcting: project the focus, measure the
      // error against the visible-strip center, translate by exactly that
      const obs = obscuredRightRef.current;
      if (obs > 0) {
        const cw = renderer.domElement.clientWidth || 1;
        camera.updateMatrixWorld(true);
        const ndc = focus.clone().project(camera);
        const err = ndc.x - (-obs / cw); // strip center in NDC
        const hfov = 2 * Math.atan(Math.tan((FOV / 2) * DEG) * camera.aspect);
        camera.translateX(err * Math.tan(hfov / 2) * cam.dist);
      }
      // traveling pulse along each selected-person arc
      const t = performance.now() / 1000;
      for (const p of pulsesRef.current) {
        const u = (t * 0.45 + p.offset) % 1;
        p.sprite.position.copy(p.curve.getPoint(u));
      }
      // holographic cornfield load-in: each stalk rises from the ground and
      // grows bottom-up with a flickering fade, staggered south to north
      const cg = cornGrowRef.current;
      if (cg) {
        const now = performance.now();
        let settled = 0;
        for (const it of cg.items) {
          const p = Math.min(1, Math.max(0, (now - cg.t0 - it.delay) / it.dur));
          if (p <= 0) {
            it.obj.visible = false;
            continue;
          }
          it.obj.visible = true;
          const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
          // Grow about the base at each plant's own slight proportions. The
          // country scale remains the baseline for every stalk in the field.
          const g = Math.max(0.02, e);
          it.obj.scale.set(
            it.scale * it.widthScale * g,
            it.scale * it.heightScale * g,
            it.scale * it.widthScale * g
          );
          it.obj.position.copy(it.basePos).addScaledVector(it.up, -(1 - e) * it.height * 0.35);
          const flick = p < 0.8 ? 0.7 + 0.3 * Math.abs(Math.sin(p * 22 + it.seed)) : 1;
          for (const rec of it.mats) rec.m.opacity = rec.target * p * flick;
          if (p >= 1) {
            for (const rec of it.mats) {
              rec.m.opacity = rec.target;
              rec.m.transparent = rec.transparent0;
            }
            settled++;
          }
        }
        if (settled === cg.items.length) cornGrowRef.current = null;
      }
      livestockRef.current?.update(t, camera, camRef.current.dist);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.removeChild(dom);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      countriesGroupRef.current = null;
      overlayGroupRef.current = null;
      countryMeshesRef.current = [];
      personSpritesRef.current.clear();
      pulsesRef.current = [];
      cornGrowRef.current = null;
      livestockRef.current?.dispose();
      livestockRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize / panel occlusion.
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    renderer.setSize(size.w, size.h);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  }, [size, obscuredRight]);

  // Recompute the overview distance when the viewport changes.
  useEffect(() => {
    const d = overviewDist(size.w, size.h);
    desiredOverview.current = { ...desiredOverview.current, dist: d };
    if (!selectedCountry && selectedId == null && !focusRequest) {
      camRef.current.dist = d;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // Build country meshes + outlines.
  useEffect(() => {
    const group = countriesGroupRef.current;
    if (!group) return;
    group.clear();
    countryMeshesRef.current = [];
    const entries: { mesh: THREE.Mesh; outlines: THREE.LineLoop[]; name: string }[] = [];
    for (const f of countries) {
      const name = f.properties?.name ?? "";
      const polys: [number, number][][][] =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates as [number, number][][]]
          : f.geometry.type === "MultiPolygon"
            ? (f.geometry.coordinates as [number, number][][][])
            : [];
      const positions: number[] = [];
      const outlineRings: THREE.Vector3[][] = [];
      const idx: number[] = [];
      for (const poly of polys) {
        // earcut input for this polygon: flat [lng,lat,...] + hole start indices
        const flat: number[] = [];
        const holes: number[] = [];
        const base = positions.length / 3;
        for (let ri = 0; ri < poly.length; ri++) {
          const unwrapped = unwrapRing(poly[ri]);
          if (ri > 0) holes.push(positions.length / 3 - base);
          outlineRings.push(unwrapped.map(([lng, lat]) => toVec3(lng, lat, SURFACE)));
          for (const [lng, lat] of unwrapped) {
            const v = toVec3(lng, lat, SURFACE);
            positions.push(v.x, v.y, v.z);
            flat.push(lng, lat);
          }
        }
        const tri = earcut(flat, holes, 2);
        for (let t = 0; t < tri.length; t++) idx.push(base + tri[t]);
      }
      if (idx.length === 0) continue;
      // Subdivide every triangle until all edges are < ~1° of arc, so each
      // triangle's flat face hugs the sphere (long chords would sag below the
      // ocean surface and show through as pale streaks/patches).
      const posArr = positions.slice();
      const midCache = new Map<string, number>();
      const midpoint = (a: number, b: number): number => {
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        let m = midCache.get(key);
        if (m == null) {
          const x = posArr[a * 3] + posArr[b * 3];
          const y = posArr[a * 3 + 1] + posArr[b * 3 + 1];
          const z = posArr[a * 3 + 2] + posArr[b * 3 + 2];
          const n = Math.hypot(x, y, z) || 1;
          m = posArr.length / 3;
          posArr.push((x / n) * SURFACE, (y / n) * SURFACE, (z / n) * SURFACE);
          midCache.set(key, m);
        }
        return m;
      };
      const chord = (a: number, b: number): number => {
        const dx = posArr[a * 3] - posArr[b * 3];
        const dy = posArr[a * 3 + 1] - posArr[b * 3 + 1];
        const dz = posArr[a * 3 + 2] - posArr[b * 3 + 2];
        return Math.hypot(dx, dy, dz);
      };
      const EDGE_LIMIT = 1.0 * DEG; // radians of arc (chord ≈ angle at small angles)
      let tris = idx;
      for (let iter = 0; iter < 10; iter++) {
        const next: number[] = [];
        let splitAny = false;
        for (let t = 0; t < tris.length; t += 3) {
          const a = tris[t], b = tris[t + 1], c = tris[t + 2];
          const tooLong = (p: number, q: number) => {
            const ang = 2 * Math.asin(Math.min(1, chord(p, q) / (2 * SURFACE)));
            return ang > EDGE_LIMIT;
          };
          if (!tooLong(a, b) && !tooLong(b, c) && !tooLong(c, a)) {
            next.push(a, b, c);
            continue;
          }
          splitAny = true;
          const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
          next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
        }
        tris = next;
        if (!splitAny) break;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
      geo.setIndex(tris);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: LAND, side: THREE.DoubleSide }));
      mesh.userData.name = name;
      const outlines = outlineRings.map(
        (pts) =>
          new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.7 })
          )
      );
      group.add(mesh);
      for (const o of outlines) group.add(o);
      entries.push({ mesh, outlines, name });
    }
    countryMeshesRef.current = entries;
  }, [countries]);

  // Country tint: hover + selected.
  useEffect(() => {
    for (const { mesh, outlines, name } of countryMeshesRef.current) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (name === selectedCountry) mat.color.set(SELECTED);
      else if (name === hoveredCountry) mat.color.set(HOVER);
      else mat.color.set(LAND);
      const active = name === selectedCountry || name === hoveredCountry;
      for (const o of outlines) {
        const om = o.material as THREE.LineBasicMaterial;
        om.color.set(active ? RED : INK);
        om.opacity = active ? 1 : 0.7;
      }
    }
  }, [hoveredCountry, selectedCountry, countries]);

  // Person de-overlap: persons sharing (nearly) identical coordinates fan out into a ring.
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
      g.forEach((p, i) => {
        const angle = (2 * Math.PI * i) / g.length - Math.PI / 2;
        pos.set(p.id, {
          lat: g[0].lat + 5 * Math.sin(angle),
          lng: g[0].lng + (5 * Math.cos(angle)) / Math.max(0.3, Math.cos(latRad)),
        });
      });
    }
    return pos;
  }, [persons]);

  // Build overlays: persons, arcs, markers, heat loops.
  useEffect(() => {
    const group = overlayGroupRef.current;
    if (!group) return;
    group.clear();
    personSpritesRef.current.clear();
    pulsesRef.current = [];

    const personById = new Map(persons.map((p) => [p.id, p]));
    const posOf = (p: PersonDto) => displayPos.get(p.id) ?? { lat: p.lat, lng: p.lng };

    // persons — ink squares with glow + name
    for (const p of persons) {
      const dp = posOf(p);
      const sp = makeLabelSprite(p.name, p.id === selectedId ? RED : INK, { square: true, glow: p.id === selectedId ? RED : INK, fontSize: 26 });
      sp.position.copy(toVec3(dp.lng, dp.lat, 1.004));
      sp.userData.id = p.id;
      group.add(sp);
      personSpritesRef.current.set(p.id, sp);
    }

    // connection arcs + traveling pulse for the selected person
    if (selectedId != null) {
      const from = personById.get(selectedId);
      if (from) {
        const pa = posOf(from);
        const A = toVec3(pa.lng, pa.lat, SURFACE);
        let i = 0;
        for (const c of connections) {
          if (c.personAId !== selectedId && c.personBId !== selectedId) continue;
          const other = personById.get(c.personAId === selectedId ? c.personBId : c.personAId);
          if (!other) continue;
          const pb = posOf(other);
          const B = toVec3(pb.lng, pb.lat, SURFACE);
          const angle = A.angleTo(B);
          const M = A.clone().add(B).normalize().multiplyScalar(1 + 0.25 * angle);
          const curve = new THREE.QuadraticBezierCurve3(A, M, B);
          const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
          group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.9 })));
          // white glowing pulse traveling from the selected person outward
          const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ color: "#ffffff", depthTest: false, transparent: true, opacity: 0.95 }));
          pulse.scale.set(0.03, 0.03, 1);
          pulse.renderOrder = 11;
          group.add(pulse);
          pulsesRef.current.push({ curve, sprite: pulse, offset: (i * 0.37) % 1 });
          i++;
        }
      }
    }

    // resource markers — squares with name labels
    for (const m of markers ?? []) {
      const mk = m.color ?? (m.kind === "refinery" ? "#0f766e" : RED);
      const pos = toVec3(m.lng, m.lat, 1.004);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: mk }));
      box.position.copy(pos);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: mk, transparent: true, opacity: 0.22, depthTest: false }));
      glow.scale.set(0.07, 0.07, 1);
      glow.position.copy(pos);
      const label = makeLabelSprite(m.name, INK, { fontSize: 22 });
      label.position.copy(pos).add(new THREE.Vector3(0, 0.05, 0));
      group.add(box, glow, label);
    }

    // heat loops — dashed great-circle-ish loops with name labels
    for (const h of heat ?? []) {
      const C = toVec3(h.lng, h.lat, 1);
      const east = new THREE.Vector3(0, 1, 0).cross(C).normalize();
      const north = C.clone().cross(east).normalize();
      const rot = h.rot * DEG;
      const pts: THREE.Vector3[] = [];
      const N = 40;
      const src: [number, number][] = h.poly ?? Array.from({ length: N }, (_, k) => {
        const a = (k / N) * Math.PI * 2;
        return [h.lng + h.rx * Math.cos(a), h.lat + h.ry * Math.sin(a)];
      });
      for (const [lon, lat] of src) {
        const dLng = (lon - h.lng) * DEG;
        const dLat = (lat - h.lat) * DEG;
        const dir = east.clone().multiplyScalar(dLng * Math.cos(rot) - dLat * Math.sin(rot))
          .add(north.clone().multiplyScalar(dLng * Math.sin(rot) + dLat * Math.cos(rot)));
        pts.push(C.clone().add(dir).normalize().multiplyScalar(1.004));
      }
      const loop = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineDashedMaterial({ color: h.color, dashSize: 0.02, gapSize: 0.016, transparent: true, opacity: 0.85 })
      );
      loop.computeLineDistances();
      group.add(loop);
      const label = makeLabelSprite(h.name, h.color, { fontSize: 24 });
      label.position.copy(C).multiplyScalar(1.03).add(north.clone().multiplyScalar(h.ry * DEG + 0.03));
      group.add(label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons, connections, selectedId, markers, heat, displayPos]);

  // Person highlight sizing.
  useEffect(() => {
    for (const [id, sp] of personSpritesRef.current) {
      const active = id === selectedId || (highlightIds?.has(id) ?? false);
      const base = 0.062;
      const img = sp.material.map!.image as HTMLCanvasElement;
      sp.scale.set((img.width / img.height) * base * (active ? 1.25 : 1), base * (active ? 1.25 : 1), 1);
    }
  }, [highlightIds, selectedId, persons]);

  // ---- camera director: the camera is a pure function of app state ----
  const flyTo = (target: { az: number; el: number; dist: number; focus: THREE.Vector3 }, dur = 900) => {
    zoomToken.current++; // cancel any in-flight wheel-zoom
    zoomAnim.current = null;
    const token = ++tweenToken.current;
    const from = { ...camRef.current, focus: focusRef.current.clone() };
    let dAz = target.az - from.az;
    dAz = ((dAz + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const t0 = performance.now();
    flyDistTarget.current = target.dist;
    const step = () => {
      if (tweenToken.current !== token) return;
      const u = Math.min(1, (performance.now() - t0) / dur);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; // easeInOutCubic
      camRef.current = {
        az: from.az + dAz * e,
        el: from.el + (target.el - from.el) * e,
        dist: from.dist + (target.dist - from.dist) * e,
      };
      focusRef.current.copy(from.focus).lerp(target.focus, e);
      if (u < 1) requestAnimationFrame(step);
      else flyDistTarget.current = null;
    };
    requestAnimationFrame(step);
  };

  const countryByName = useMemo(
    () => new Map(countries.map((c) => [c.properties?.name ?? "", c])),
    [countries]
  );

  // Cropland layer: place the neon cornfield on the country's major growing
  // regions whenever the Food & Agriculture tab is active.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (croplandGroupRef.current) {
      scene.remove(croplandGroupRef.current);
      croplandGroupRef.current = null;
    }
    cornGrowRef.current = null;
    livestockRef.current?.dispose();
    livestockRef.current = null;
    croplandCountRef.current = 0;
    if (!cropland) return;
    const f = countryByName.get(cropland);
    if (!f) return;
    const token = ++croplandToken.current;
    let cancelled = false;
    (async () => {
      const [cropGrid, pastureGrid, proto] = await Promise.all([
        loadCroplandGrid(),
        loadPastureGrid(),
        loadCornfield(),
      ]);
      if (cancelled || croplandToken.current !== token) return;
      const regions = agriculturalRegions(f, cropGrid, pastureGrid);
      croplandCountRef.current = regions.length;
      if (regions.length === 0) return;
      const [clng, clat] = geoCentroid(f as never);
      const countryRadiusDeg = angularRadius(f, [clng, clat]) / DEG;
      const group = new THREE.Group();
      // Surface hatching stays just above the land and below all agricultural
      // models. The two land-use classes occupy mutually exclusive cells.
      group.add(makeAgricultureSurface(regions, "crop"));
      group.add(makeAgricultureSurface(regions, "pasture"));
      const livestockPromise = createLivestockSystem({
        regions,
        rng: mulberry32(hashName(`${f.properties.name}:pasture-livestock`)),
        toVec3,
        surface: SURFACE + 0.003,
      });
      // Country size remains the baseline stalk scale; larger regions are shown
      // with MORE stalks, never bigger ones. Small deterministic variations keep
      // individual plants from looking cloned without changing that hierarchy.
      const stalkScale = Math.min(
        0.03,
        Math.max(0.004, countryRadiusDeg * DEG * R * 0.18)
      );
      const baseStalkH = 2.0 * stalkScale; // GLB stalk is ~2 units tall
      const growthRng = mulberry32(hashName(`${f.properties.name}:corn-growth`));
      const growthVariants = Array.from({ length: 12 }, () => makeCornGrowthVariant(proto, growthRng));
      const rng = mulberry32(hashName(f.properties.name));
      const placed: {
        inst: THREE.Object3D;
        pos: THREE.Vector3;
        up: THREE.Vector3;
        lat: number;
        heightScale: number;
        widthScale: number;
      }[] = [];
      for (const reg of regions) {
        if (reg.kind !== "crop") continue; // pasture-dominant cells never grow corn
        const rWorld = reg.radiusDeg * DEG * R;
        const ground = baseStalkH * 0.85;
        // density target from region area; slight overlap allowed, capped both
        // for perf and by how many real cropland cells the region has
        const nTarget = Math.max(
          3,
          Math.min(64, Math.round((2.6 * Math.PI * rWorld * rWorld) / (ground * ground)))
        );
        const chosen = sampleCells(reg.pts, Math.min(nTarget, reg.pts.length), rng);
        for (const cell of chosen) {
          const inst = growthVariants[Math.floor(rng() * growthVariants.length)].clone(true);
          const heightScale = 0.94 + rng() * 0.12;
          const widthScale = 0.97 + rng() * 0.06;
          const stalkH = baseStalkH * heightScale;
          const pos = toVec3(cell.lng, cell.lat, R * 1.004);
          const up = pos.clone().normalize();
          const north = new THREE.Vector3(0, 1, 0).addScaledVector(up, -up.y);
          if (north.lengthSq() < 1e-6) north.set(0, 0, -1).addScaledVector(up, up.z);
          north.normalize();
          const east = new THREE.Vector3().crossVectors(north, up).normalize();
          const zed = new THREE.Vector3().crossVectors(east, up).normalize();
          inst.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, zed));
          inst.rotateY(rng() * Math.PI * 2); // random lean direction
          // holographic load-in starts as a tiny stalk at the ground, sunk;
          // the render loop grows it from its base on its stagger
          inst.scale.set(stalkScale * widthScale * 0.02, stalkScale * heightScale * 0.02, stalkScale * widthScale * 0.02);
          inst.position.copy(pos).addScaledVector(up, -stalkH * 0.35);
          group.add(inst);
          placed.push({ inst, pos, up, lat: cell.lat, heightScale, widthScale });
        }
      }
      // Stagger south-first so the field sweeps onto the map bottom-up.
      let latMin = Infinity;
      let latMax = -Infinity;
      for (const p of placed) {
        latMin = Math.min(latMin, p.lat);
        latMax = Math.max(latMax, p.lat);
      }
      const latSpan = Math.max(1e-6, latMax - latMin);
      const items: CornGrowItem[] = placed.map((p) => {
        // per-stalk material clones so the fade can be staggered without
        // touching the shared cached proto materials
        const mats: CornGrowItem["mats"] = [];
        p.inst.traverse((o: any) => {
          if (o.name === "wire_cards") return; // outline boxes stay hidden
          const mo = o as THREE.Mesh;
          if (!mo.material) return;
          const list = Array.isArray(mo.material) ? mo.material : [mo.material];
          const cloned = list.map((m0: any) => {
            const m = m0.clone();
            mats.push({ m, target: m.opacity, transparent0: m.transparent });
            m.transparent = true;
            m.opacity = 0;
            return m;
          });
          mo.material = Array.isArray(mo.material) ? cloned : cloned[0];
        });
        return {
          obj: p.inst,
          basePos: p.pos.clone(),
          up: p.up.clone(),
          scale: stalkScale,
          heightScale: p.heightScale,
          widthScale: p.widthScale,
          height: baseStalkH * p.heightScale,
          delay: ((latMax - p.lat) / latSpan) * CORN_GROW_STAGGER * 1000 + rng() * 180,
          dur: CORN_GROW_DUR * 1000,
          seed: rng() * 10,
          mats,
        };
      });
      const livestock = await livestockPromise;
      if (cancelled || croplandToken.current !== token) {
        livestock.dispose();
        return;
      }
      group.add(livestock.group);
      livestockRef.current = livestock;
      scene.add(group);
      croplandGroupRef.current = group;
      cornGrowRef.current = { items, t0: performance.now() };
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropland, countryByName]);

  useEffect(() => {
    const dOv = overviewDist(size.w, size.h);
    if (selectedCountry) {
      const f = countryByName.get(selectedCountry);
      if (f) {
        const [lng, lat] = geoCentroid(f as never);
        const c = toVec3(lng, lat, R);
        lastCountryPoint.current = c;
        const view = countryView(f as CountryFeature, [lng, lat]);
        flyTo({ az: view.az, el: view.el, dist: view.dist, focus: view.focus }, 900);
        return;
      }
    }
    if (focusRequest) {
      const c = toVec3(focusRequest.lng, focusRequest.lat, R);
      flyTo({ az: azOf(c), el: elOf(c), dist: 0.5, focus: c }, 900);
      return;
    }
    if (selectedId != null) {
      const p = persons.find((pp) => pp.id === selectedId);
      if (p) {
        const dp = displayPos.get(p.id) ?? { lat: p.lat, lng: p.lng };
        const c = toVec3(dp.lng, dp.lat, R);
        flyTo({ az: azOf(c), el: elOf(c), dist: 0.45, focus: c }, 900);
        return;
      }
    }
    // overview: face the last-focused country (or the default view)
    const c = lastCountryPoint.current;
    if (c) flyTo({ az: azOf(c), el: elOf(c), dist: dOv, focus: new THREE.Vector3(0, 0, 0) }, 900);
    else flyTo({ az: 0.65, el: 0.52, dist: dOv, focus: new THREE.Vector3(0, 0, 0) }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry, selectedId, focusRequest?.nonce, countryByName, persons, displayPos, size]);

  // debug handle for the in-app browser tests (harmless in production)
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__worldmap = {
      getCam: () => ({ ...camRef.current, focus: focusRef.current.toArray(), mode: selectedCountry ? "country" : "free" }),
      getRotation: () => {
        const c = camRef.current;
        return [c.az / DEG, c.el / DEG, c.dist];
      },
      getGlobeK: () => camRef.current.dist,
      getTilt: () => camRef.current.el / DEG,
      getSelected: () => selectedCountry ?? null,
      focusAt: (lng: number, lat: number, dist = 0.2) => {
        tweenToken.current++;
        zoomToken.current++;
        zoomAnim.current = null;
        flyDistTarget.current = null;
        const point = toVec3(lng, lat, R);
        focusRef.current.copy(point);
        camRef.current = { az: azOf(point), el: elOf(point), dist };
      },
      getCountryCount: () => countryMeshesRef.current.length,
      getCropland: () => croplandCountRef.current,
      getLivestock: () => ({
        count: livestockRef.current?.cows.length ?? 0,
        visible: livestockRef.current?.cows.filter((c) => c.obj.visible).length ?? 0,
        cows: livestockRef.current?.cows.map((c) => ({
          state: c.state,
          stateElapsed: c.stateElapsed,
          stateDuration: c.stateDuration,
          routeDistance: c.routeDistance,
          routeLength: c.route?.length ?? 0,
          speed: c.speed,
          walkRate: c.walkRate,
          gaitGroundSpeed: c.gaitGroundSpeed,
          modelHeightOffset: c.model.position.y,
          bodyOffset: c.bodyOffset.toArray(),
          stridePerCycle: c.gaitGroundSpeed * 2 / c.modelScale,
          modelScale: c.modelScale,
          walkPhase: ((c.walkAction.time % 2) + 2) % 2,
          phaseProgress: c.hologram.progress,
          phaseDelay: c.hologram.delay,
          phaseDuration: c.hologram.duration,
          feet: c.feet.map((foot) => ({
            name: foot.name,
            planted: foot.planted,
            released: foot.released,
            lockWeight: foot.lockWeight,
            lockError: foot.lockError,
            naturalUpperLength: foot.naturalUpperLength,
            naturalLowerLength: foot.naturalLowerLength,
            upperLength: foot.upperLength,
            lowerLength: foot.lowerLength,
            reachRatio: foot.reachRatio,
            upperAngle: foot.upperAngle,
            lowerAngle: foot.lowerAngle,
            hoofAngle: foot.hoofAngle,
            hoofNormalError: foot.hoofNormalError,
            anchor: foot.anchor.toArray(),
            position: foot.hoof.getWorldPosition(new THREE.Vector3()).toArray(),
          })),
          walkWeight: c.walkWeight,
          targetWalkWeight: c.targetWalkWeight,
          blendStartWeight: c.blendStartWeight,
          blendElapsed: c.blendElapsed,
          blendDuration: c.blendDuration,
          frameDt: c.lastFrameDt,
          grazeTime: c.grazeAction.time,
          walkTime: c.walkAction.time,
          grazeTimeScale: c.grazeAction.timeScale,
          walkTimeScale: c.walkAction.timeScale,
          heading: c.heading,
          blockedTime: c.blockedTime,
          yieldAfter: c.yieldAfter,
          visible: c.obj.visible,
          lng: c.lng,
          lat: c.lat,
          cellKey: c.cellKey,
          patch: c.patch.id,
          patchCells: c.patch.cells.length,
          patchAreaKm2: Math.round(c.patch.areaKm2),
          scaleFactor: c.patch.scaleFactor,
          routeEndCell: c.route?.endCell ?? null,
          position: c.obj.position.toArray(),
        })) ?? [],
      }),
      getScene: () => sceneRef.current,
      setLivestockPlaybackRate: (rate: number) => {
        const safeRate = THREE.MathUtils.clamp(rate, 0.1, 4);
        for (const cow of livestockRef.current?.cows ?? []) {
          cow.grazeAction.setEffectiveTimeScale(safeRate);
          cow.walkRate = safeRate;
          cow.speed = cow.gaitGroundSpeed * safeRate;
          cow.walkAction.setEffectiveTimeScale(safeRate * cow.walkWeight);
        }
      },
      setLayerVisible: (layer: string, visible: boolean) => {
        const groups: Record<string, (THREE.Object3D | null)[]> = {
          sphere: sceneRef.current ? [sceneRef.current.children[0]] : [],
          rim: sceneRef.current ? [sceneRef.current.children[1]] : [],
          graticule: sceneRef.current ? [sceneRef.current.children[2]] : [],
          countries: [countriesGroupRef.current],
          overlay: [overlayGroupRef.current],
        };
        for (const g of groups[layer] ?? []) if (g) g.visible = visible;
      },
      project: (lng: number, lat: number) => {
        const cam = cameraRef.current;
        const renderer = rendererRef.current;
        if (!cam || !renderer) return null;
        const v = toVec3(lng, lat, SURFACE).project(cam);
        const rect = renderer.domElement.getBoundingClientRect();
        return {
          x: rect.left + ((v.x + 1) / 2) * rect.width,
          y: rect.top + ((-v.y + 1) / 2) * rect.height,
          behind: v.z > 1,
        };
      },
    };
  });

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-[#f4f1ea]">
      {/* floating country name label follows the cursor */}
      {hoveredCountry && cursor && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[#d6ccc0] bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#7f1d1d] shadow-lg"
          style={{ left: cursor.x + 14, top: cursor.y + 10 }}
        >
          {hoveredCountry}
        </div>
      )}
    </div>
  );
}
