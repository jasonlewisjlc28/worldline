// Replicate WorldMap's unwrap+densify+earcut pipeline and verify coverage.
import { readFileSync } from "fs";
import earcut from "earcut";
import { feature } from "topojson-client";

const DEG = Math.PI / 180;
const MAX_EDGE = 1.5 * DEG;

const toVec3 = (lng, lat) => {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return [
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ];
};
const vecToLngLat = (v) => {
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v[1]))) / DEG;
  let lng = (Math.atan2(v[2], -v[0]) / DEG) - 180;
  if (lng < -180) lng += 360;
  if (lng > 180) lng -= 360;
  return [lng, lat];
};
const densify = (out, a, b) => {
  const va = toVec3(a[0], a[1]);
  const vb = toVec3(b[0], b[1]);
  const dot = Math.max(-1, Math.min(1, va[0]*vb[0] + va[1]*vb[1] + va[2]*vb[2]));
  const ang = Math.acos(dot);
  const steps = Math.min(16, Math.floor(ang / MAX_EDGE));
  for (let s = 1; s <= steps; s++) {
    const t = s / (steps + 1);
    const v = [va[0]+(vb[0]-va[0])*t, va[1]+(vb[1]-va[1])*t, va[2]+(vb[2]-va[2])*t];
    const n = Math.hypot(...v);
    out.push(vecToLngLat([v[0]/n, v[1]/n, v[2]/n]));
  }
  out.push(b);
};
const unwrapRing = (ring) => {
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0];
    const prev = out[out.length - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    densify(out, out[out.length - 1], [lng, ring[i][1]]);
  }
  return out;
};

// raster helpers on a 720x360 equirect grid
const W = 720, H = 360;
const px = (lng, lat) => [Math.floor(((lng + 180) / 360) * W), Math.floor(((90 - lat) / 180) * H)];
const grid = new Uint8Array(W * H);
const setPx = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = 1; };

function rasterRing(ring) {
  // scanline fill of a ring (outer or hole) — mark boundary + fill via even-odd
  const pts = ring.map(([lng, lat]) => px(lng, lat));
  for (let y = 0; y < H; y++) {
    const xs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) setPx(x, y);
    }
  }
}

function rasterTris(positions, idx) {
  const g2 = new Uint8Array(W * H);
  const set2 = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H) g2[y * W + x] = 1; };
  for (let t = 0; t < idx.length; t += 3) {
    const vs = [idx[t], idx[t + 1], idx[t + 2]].map((i) => {
      const lng = positions[i * 2], lat = positions[i * 2 + 1];
      return px(lng, lat);
    });
    // bbox raster: for each row, intersect edges
    const minY = Math.max(0, Math.min(vs[0][1], vs[1][1], vs[2][1]));
    const maxY = Math.min(H - 1, Math.max(vs[0][1], vs[1][1], vs[2][1]));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < 3; i++) {
        const [x1, y1] = vs[i], [x2, y2] = vs[(i + 1) % 3];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) set2(x, y);
    }
  }
  return g2;
}

const topo = JSON.parse(readFileSync("public/countries-110m.json", "utf8"));
const fc = feature(topo, topo.objects.countries);

for (const name of ["Canada", "United States of America", "Brazil", "Russia", "China", "Australia", "Greenland"]) {
  const f = fc.features.find((c) => c.properties.name === name);
  if (!f) { console.log(name, "NOT FOUND"); continue; }
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;

  grid.fill(0);
  for (const poly of polys) {
    rasterRing(unwrapRing(poly[0]));
    for (let hi = 1; hi < poly.length; hi++) {
      // holes: clear — approximated by not adding; even-odd outer-only would keep hole pixels set.
      // simpler: skip hole handling for the reference (holes are small); note it.
    }
  }
  let expected = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i]) expected++;

  // triangulated coverage
  const positions = [];
  let idxAll = [];
  let nan = 0, dup = 0;
  for (const poly of polys) {
    const flat = [];
    const holes = [];
    const base = positions.length / 2;
    for (let ri = 0; ri < poly.length; ri++) {
      const unwrapped = unwrapRing(poly[ri]);
      if (ri > 0) holes.push(positions.length / 2 - base);
      for (const [lng, lat] of unwrapped) {
        if (!isFinite(lng) || !isFinite(lat)) nan++;
        positions.push(lng, lat);
        flat.push(lng, lat);
      }
    }
    for (let i = 0; i + 3 < flat.length; i += 2) if (flat[i] === flat[i + 2] && flat[i + 1] === flat[i + 3]) dup++;
    const tri = earcut(flat, holes, 2);
    for (const t of tri) idxAll.push(base + t);
  }
  const g2 = rasterTris(positions, idxAll);
  let got = 0;
  for (let i = 0; i < g2.length; i++) if (g2[i]) got++;

  // degenerate triangles
  let degen = 0;
  for (let t = 0; t < idxAll.length; t += 3) {
    const a = [positions[idxAll[t]*2], positions[idxAll[t]*2+1]];
    const b = [positions[idxAll[t+1]*2], positions[idxAll[t+1]*2+1]];
    const c = [positions[idxAll[t+2]*2], positions[idxAll[t+2]*2+1]];
    const area = Math.abs((b[0]-a[0])*(c[1]-a[1]) - (c[0]-a[0])*(b[1]-a[1]));
    if (area < 1e-9) degen++;
  }

  // where is expected land missing from the triangles? report largest missing blob bbox
  let missing = 0;
  let mMinX = W, mMaxX = 0, mMinY = H, mMaxY = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] && !g2[i]) {
      missing++;
      const x = i % W, y = Math.floor(i / W);
      if (x < mMinX) mMinX = x; if (x > mMaxX) mMaxX = x;
      if (y < mMinY) mMinY = y; if (y > mMaxY) mMaxY = y;
    }
  }
  const toLngLat = (x, y) => [Math.round(((x / W) * 360 - 180) * 10) / 10, Math.round((90 - (y / H) * 180) * 10) / 10];
  console.log(
    name.padEnd(24),
    "expected px:", String(expected).padStart(7),
    "tri px:", String(got).padStart(7),
    "missing:", String(missing).padStart(6),
    ((missing / Math.max(1, expected)) * 100).toFixed(1) + "%",
    "tris:", String(idxAll.length / 3).padStart(6),
    "degen:", degen,
    "nan:", nan,
    "dups:", dup,
    missing > 0 ? "missing bbox lng[" + toLngLat(mMinX, 0)[0] + ".." + toLngLat(mMaxX, 0)[0] + "] lat[" + toLngLat(0, mMinY)[1] + ".." + toLngLat(0, mMaxY)[1] + "]" : ""
  );
}
