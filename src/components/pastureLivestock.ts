import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export type LivestockCell = { key: number; lng: number; lat: number; pct: number };
export type LivestockRegion = {
  kind: "crop" | "pasture";
  cells: LivestockCell[];
};

type VecFactory = (lng: number, lat: number, r?: number) => THREE.Vector3;
type LngLat = { lng: number; lat: number };

type PasturePatch = {
  id: number;
  cells: LivestockCell[];
  byKey: Map<number, LivestockCell>;
  areaKm2: number;
  scaleFactor: number;
};

type Route = {
  points: LngLat[];
  cumulative: number[];
  length: number;
  endCell: number;
};

type FootCalibration = {
  landingOffset: THREE.Vector3;
  groundNormalLocal: THREE.Vector3;
};

type FootRig = {
  name: string;
  upper: THREE.Bone;
  lower: THREE.Bone;
  hoof: THREE.Bone;
  contactHeight: number;
  stanceStart: number;
  stanceEnd: number;
  naturalUpperLength: number;
  naturalLowerLength: number;
  upperRestPosition: THREE.Vector3;
  lowerRestPosition: THREE.Vector3;
  hoofRestPosition: THREE.Vector3;
  upperRestScale: THREE.Vector3;
  lowerRestScale: THREE.Vector3;
  hoofRestScale: THREE.Vector3;
  upperBendAxis: THREE.Vector3;
  lowerBendAxis: THREE.Vector3;
  landingOffset: THREE.Vector3;
  groundNormalLocal: THREE.Vector3;
  planted: boolean;
  inStance: boolean;
  released: boolean;
  hasAnchor: boolean;
  lockWeight: number;
  anchor: THREE.Vector3;
  lockError: number;
  reachRatio: number;
  upperLength: number;
  lowerLength: number;
  upperAngle: number;
  lowerAngle: number;
  hoofAngle: number;
  hoofNormalError: number;
};

type CowPhaseMaterial = {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
};

type CowHologram = {
  materials: CowPhaseMaterial[];
  uniforms: {
    uCowPhase: { value: number };
    uCowPhaseMin: { value: number };
    uCowPhaseSpan: { value: number };
    uCowPhaseSeed: { value: number };
  };
  shadow: THREE.MeshBasicMaterial;
  shadowOpacity: number;
  delay: number;
  duration: number;
  progress: number;
  settled: boolean;
};

type Cow = {
  obj: THREE.Group;
  model: THREE.Object3D;
  patch: PasturePatch;
  rank: number;
  cellKey: number;
  lng: number;
  lat: number;
  heading: number;
  state: "graze" | "walk";
  stateElapsed: number;
  stateDuration: number;
  route: Route | null;
  routeDistance: number;
  speed: number;
  walkRate: number;
  gaitGroundSpeed: number;
  modelScale: number;
  bodyOffset: THREE.Vector3;
  feet: FootRig[];
  walkWeight: number;
  targetWalkWeight: number;
  blendStartWeight: number;
  blendElapsed: number;
  blendDuration: number;
  blockedTime: number;
  yieldAfter: number;
  grazeAction: THREE.AnimationAction;
  walkAction: THREE.AnimationAction;
  mixer: THREE.AnimationMixer;
  lastUpdate: number;
  lastFrameDt: number;
  frameOffset: number;
  rng: () => number;
  up: THREE.Vector3;
  hologram: CowHologram;
};

export type LivestockSystem = {
  group: THREE.Group;
  cows: Cow[];
  update: (now: number, camera: THREE.Camera, camDist: number) => void;
  dispose: () => void;
};

const GRID_W = 1440;
const GRID_H = 720;
const GRID_CELL = 0.25;
const CELL_KM = 111.195 * GRID_CELL;
const MIN_PATCH_AREA_KM2 = 2200;
const MIN_PATCH_CELLS = 6;
const DEFAULT_COW_HEIGHT = 0.018;
// Route travel is local -Z, matching the source gait's forward direction.
const COW_MODEL_FORWARD = 0;
// The source's 10–13 s and 22–24 s sections are one-off neck-lift/lower
// transitions. They must not be inside an independently looping action: the
// raised 12 s grazing pose otherwise snaps back to the lowered 0 s pose.
// Keep only the stable source loops; the live crossfade performs the neck lift.
const GRAZE_LOOP_START_SECONDS = 0;
const GRAZE_LOOP_END_SECONDS = 10.5;
const WALK_LOOP_START_SECONDS = 13;
const WALK_LOOP_END_SECONDS = 21;
const WALK_CYCLE_SECONDS = 2;
// Preserve the authored support posture. The source front legs naturally approach
// full extension, so a permanent body drop would manufacture excess knee flexion.
// Compensation is reserved for targets that exceed the rig's natural reach.
const WALK_BODY_DROP_SOURCE = 0;
const MAX_ADDITIONAL_BODY_DROP_SOURCE = 0.025;
const MAX_BODY_SHIFT_SOURCE = 0.045;
const MAX_LEG_EXTENSION = 1;
const LOCK_RELEASE_DISTANCE_SOURCE = 0.008;
const FOOT_LIFTOFF_BLEND_SECONDS = 0.12;
const MAX_UPPER_SWING = THREE.MathUtils.degToRad(12);
const MAX_LOWER_SWING = THREE.MathUtils.degToRad(14);
const MAX_HOOF_SWING = THREE.MathUtils.degToRad(12);
const MAX_LEG_TWIST = THREE.MathUtils.degToRad(4);
const MAX_HOOF_TWIST = THREE.MathUtils.degToRad(3);
const CROSSFADE_SECONDS = 1.15;
// Match the cornfield's south-to-north activation sweep. The shader reveals the
// cow from its hooves upward, so entrance animation never scales the rig or
// moves a planted hoof away from its terrain anchor.
const COW_PHASE_STAGGER_SECONDS = 1.1;
const COW_PHASE_DURATION_SECONDS = 0.55;

// Stance windows within the source's two-second cycle, measured from the hoof
// trajectories. A wrapped interval (start > end) crosses the cycle boundary.
const FOOT_GAIT = [
  { name: "front_L", contactHeight: 0.179, stanceStart: 0.5, stanceEnd: 1.7 },
  { name: "front_R", contactHeight: 0.179, stanceStart: 1.5, stanceEnd: 0.7 },
  { name: "hind_L", contactHeight: 0.279, stanceStart: 0.9, stanceEnd: 0.3 },
  { name: "hind_R", contactHeight: 0.279, stanceStart: 0, stanceEnd: 1.3 },
] as const;

type CowAsset = {
  scene: THREE.Group;
  graze: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  height: number;
  phaseMin: number;
  stridePerCycle: number;
  feet: Record<string, FootCalibration>;
};

let cowAssetPromise: Promise<CowAsset> | null = null;

const phaseClip = (source: THREE.AnimationClip, name: string, start: number, end: number) => {
  const tracks = source.tracks.map((track) => {
    const times: number[] = [0];
    const stride = track.getValueSize();
    const interpolant = track.getInterpolation() === THREE.InterpolateDiscrete
      ? track.InterpolantFactoryMethodDiscrete()
      : track.InterpolantFactoryMethodLinear();
    const values: number[] = Array.from(interpolant.evaluate(start));
    // Sample exact boundaries as well as retaining the original interior keys.
    // Constant translation/scale tracks often have keys only at 0 and 24 s;
    // dropping those keys would leave a stable sub-clip with an empty track.
    for (let i = 0; i < track.times.length; i++) {
      const t = track.times[i];
      if (t <= start || t >= end) continue;
      times.push(t - start);
      for (let k = 0; k < stride; k++) values.push(track.values[i * stride + k]);
    }
    times.push(end - start);
    values.push(...interpolant.evaluate(end));
    const TrackConstructor = track.constructor as new (
      name: string,
      times: number[],
      values: number[]
    ) => THREE.KeyframeTrack;
    return new TrackConstructor(track.name, times, values);
  });
  return new THREE.AnimationClip(name, end - start, tracks);
};

// Measure the actual in-place gait instead of assuming a stride length. The
// calibration rig is independent, so sampling never changes the asset instances.
const calibrateWalking = (scene: THREE.Group, walk: THREE.AnimationClip) => {
  const model = cloneSkeleton(scene);
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(walk);
  action.play();
  const sample = (time: number) => {
    // Stance intervals near the loop boundary finish in the next gait cycle.
    // Wrap them instead of clamping them to the clip's last key, which would
    // shorten the final front-right and hind-left stride measurements.
    const target = THREE.MathUtils.euclideanModulo(time, walk.duration);
    // A tiny real mixer step forces evaluation even when sampling backwards.
    action.time = Math.max(0, target - 1e-4);
    action.paused = false;
    mixer.update(1e-4);
    model.updateMatrixWorld(true);
  };
  const feet: Record<string, FootCalibration> = {};
  const strides: number[] = [];
  const cycles = Math.max(1, Math.floor(walk.duration / WALK_CYCLE_SECONDS));
  for (const gait of FOOT_GAIT) {
    const upper = model.getObjectByName(`${gait.name}_upper`)!;
    const hoof = model.getObjectByName(`${gait.name}_hoof`)!;
    let stride = 0;
    for (let cycle = 0; cycle < cycles; cycle++) {
      const start = cycle * WALK_CYCLE_SECONDS + gait.stanceStart;
      const end = cycle * WALK_CYCLE_SECONDS +
        (gait.stanceEnd > gait.stanceStart ? gait.stanceEnd : gait.stanceEnd + WALK_CYCLE_SECONDS);
      sample(start);
      const touchdown = hoof.getWorldPosition(new THREE.Vector3());
      sample(end);
      const liftoff = hoof.getWorldPosition(new THREE.Vector3());
      // During stance the in-place hoof moves +Z; forward root travel is -Z.
      stride += Math.max(0, liftoff.z - touchdown.z);
    }
    strides.push(stride / cycles);

    const stanceDuration = gait.stanceEnd > gait.stanceStart
      ? gait.stanceEnd - gait.stanceStart
      : gait.stanceEnd + WALK_CYCLE_SECONDS - gait.stanceStart;
    const middle = gait.stanceStart + stanceDuration * 0.5;
    sample(middle);
    const groundNormalLocal = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(hoof.getWorldQuaternion(new THREE.Quaternion()).invert())
      .normalize();
    sample(gait.stanceStart);
    feet[gait.name] = {
      landingOffset: hoof.getWorldPosition(new THREE.Vector3())
        .sub(upper.getWorldPosition(new THREE.Vector3())),
      groundNormalLocal,
    };
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  const stridePerCycle = strides.reduce((sum, value) => sum + value, 0) / strides.length;
  if (!(stridePerCycle > 0.01)) throw new Error("Pasture cow gait has no measurable stride");
  return { stridePerCycle, feet };
};

const loadCowAsset = () => {
  if (!cowAssetPromise) {
    cowAssetPromise = new GLTFLoader()
      .loadAsync("/preview/Red_Holographic_Cow_Seamless_V5_Triangular.glb")
      .then((gltf) => {
        const source = gltf.animations[0];
        if (!source) throw new Error("Pasture cow model has no animation");
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          // Keep the source emissive triangular texture and UV channel, but use
          // line-only transparency for an X-ray view through the whole animal.
          // Dark face interiors disappear while front and back grid lines remain
          // visible; geometry, skinning, and animation are unchanged.
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            material.color.setRGB(0.001, 0, 0);
            material.emissive.setRGB(0.9, 0.005, 0.025);
            material.emissiveIntensity = 1.4;
            material.transparent = true;
            material.opacity = 1;
            material.depthWrite = false;
            material.blending = THREE.NormalBlending;
            material.side = THREE.DoubleSide;
            material.toneMapped = false;
            material.onBeforeCompile = (shader) => {
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
                #ifdef USE_EMISSIVEMAP
                  float xrayLine = texture2D(emissiveMap, vEmissiveMapUv).r;
                  diffuseColor.a *= smoothstep(0.16, 0.55, xrayLine);
                #endif`
              );
            };
            material.customProgramCacheKey = () => "pasture-cow-xray-v1";
            material.needsUpdate = true;
          }
          mesh.renderOrder = 12;
          mesh.frustumCulled = false; // bounds change during skeletal grazing/walking
        });
        const walk = phaseClip(
          source,
          "Independent walking",
          Math.min(WALK_LOOP_START_SECONDS, source.duration),
          Math.min(WALK_LOOP_END_SECONDS, source.duration)
        );
        const calibration = calibrateWalking(gltf.scene, walk);
        return {
          scene: gltf.scene,
          graze: phaseClip(
            source,
            "Independent grazing",
            GRAZE_LOOP_START_SECONDS,
            Math.min(GRAZE_LOOP_END_SECONDS, source.duration)
          ),
          walk,
          height: Math.max(0.001, size.y),
          phaseMin: box.min.y,
          ...calibration,
        };
      });
  }
  return cowAssetPromise;
};

const localDistance = (a: LngLat, b: LngLat) => {
  const lat = ((a.lat + b.lat) * 0.5 * Math.PI) / 180;
  const x = (a.lng - b.lng) * Math.cos(lat);
  return Math.hypot(x, a.lat - b.lat);
};

const connectedPasturePatches = (regions: LivestockRegion[]): PasturePatch[] => {
  const patches: PasturePatch[] = [];
  for (const region of regions) {
    if (region.kind !== "pasture") continue;
    const remaining = new Map(region.cells.map((c) => [c.key, c]));
    while (remaining.size) {
      const first = remaining.values().next().value as LivestockCell;
      const cells: LivestockCell[] = [];
      const stack = [first];
      remaining.delete(first.key);
      while (stack.length) {
        const cell = stack.pop()!;
        cells.push(cell);
        const i = Math.floor(cell.key / GRID_W);
        const j = cell.key % GRID_W;
        const neighbors = [
          i > 0 ? cell.key - GRID_W : -1,
          i + 1 < GRID_H ? cell.key + GRID_W : -1,
          j > 0 ? cell.key - 1 : -1,
          j + 1 < GRID_W ? cell.key + 1 : -1,
        ];
        for (const key of neighbors) {
          const next = remaining.get(key);
          if (!next) continue;
          remaining.delete(key);
          stack.push(next);
        }
      }

      let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
      let areaKm2 = 0;
      for (const c of cells) {
        const i = Math.floor(c.key / GRID_W);
        const j = c.key % GRID_W;
        minI = Math.min(minI, i); maxI = Math.max(maxI, i);
        minJ = Math.min(minJ, j); maxJ = Math.max(maxJ, j);
        areaKm2 += CELL_KM * CELL_KM * Math.max(0.05, Math.cos(c.lat * Math.PI / 180)) * c.pct / 100;
      }
      // One-cell-wide corridors and tiny/diagonal fragments cannot support
      // natural wandering. They retain only the red hatch surface.
      const narrow = Math.min(maxI - minI + 1, maxJ - minJ + 1) < 2;
      if (cells.length < MIN_PATCH_CELLS || areaKm2 < MIN_PATCH_AREA_KM2 || narrow) continue;
      const scaleT = Math.min(1, Math.log(areaKm2 / MIN_PATCH_AREA_KM2) / Math.log(200000 / MIN_PATCH_AREA_KM2));
      patches.push({
        id: patches.length,
        cells,
        byKey: new Map(cells.map((c) => [c.key, c])),
        areaKm2,
        scaleFactor: 0.75 + scaleT * 1.25,
      });
    }
  }
  return patches.sort((a, b) => b.areaKm2 - a.areaKm2);
};

const neighborSteps = (patch: PasturePatch, key: number) => {
  const i = Math.floor(key / GRID_W);
  const j = key % GRID_W;
  const out: { key: number; cost: number }[] = [];
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || ni >= GRID_H || nj < 0 || nj >= GRID_W) continue;
      const next = ni * GRID_W + nj;
      if (!patch.byKey.has(next)) continue;
      if (di && dj) {
        // No corner cutting: diagonal travel is valid only when all four
        // surrounding cells belong to this same continuous pasture patch.
        if (!patch.byKey.has(i * GRID_W + nj) || !patch.byKey.has(ni * GRID_W + j)) continue;
      }
      out.push({ key: next, cost: di && dj ? Math.SQRT2 : 1 });
    }
  }
  return out;
};

const findCellPath = (patch: PasturePatch, start: number, end: number) => {
  if (start === end) return [start];
  const open = new Set<number>([start]);
  const cameFrom = new Map<number, number>();
  const g = new Map<number, number>([[start, 0]]);
  const target = patch.byKey.get(end)!;
  while (open.size) {
    let current = -1;
    let best = Infinity;
    for (const key of open) {
      const c = patch.byKey.get(key)!;
      const score = (g.get(key) ?? Infinity) + localDistance(c, target) / GRID_CELL;
      if (score < best) { best = score; current = key; }
    }
    if (current === end) {
      const path = [end];
      while (path[0] !== start) path.unshift(cameFrom.get(path[0])!);
      return path;
    }
    open.delete(current);
    for (const next of neighborSteps(patch, current)) {
      const tentative = (g.get(current) ?? Infinity) + next.cost;
      if (tentative >= (g.get(next.key) ?? Infinity)) continue;
      cameFrom.set(next.key, current);
      g.set(next.key, tentative);
      open.add(next.key);
    }
  }
  return [] as number[];
};

const roundedRoute = (patch: PasturePatch, start: LngLat, startKey: number, endKey: number): Route | null => {
  const keys = findCellPath(patch, startKey, endKey);
  if (keys.length < 2) return null;
  const anchors = [start, ...keys.slice(1).map((key) => patch.byKey.get(key)!)];
  const points: LngLat[] = [{ lng: start.lng, lat: start.lat }];
  for (let i = 1; i < anchors.length - 1; i++) {
    const prev = anchors[i - 1], curr = anchors[i], next = anchors[i + 1];
    const entry = { lng: curr.lng + (prev.lng - curr.lng) * 0.34, lat: curr.lat + (prev.lat - curr.lat) * 0.34 };
    const exit = { lng: curr.lng + (next.lng - curr.lng) * 0.34, lat: curr.lat + (next.lat - curr.lat) * 0.34 };
    points.push(entry);
    // Quadratic corner rounding stays inside the convex current grid cell.
    for (let s = 1; s <= 5; s++) {
      const t = s / 5;
      const u = 1 - t;
      points.push({
        lng: u * u * entry.lng + 2 * u * t * curr.lng + t * t * exit.lng,
        lat: u * u * entry.lat + 2 * u * t * curr.lat + t * t * exit.lat,
      });
    }
  }
  points.push(anchors[anchors.length - 1]);
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + localDistance(points[i - 1], points[i]) * Math.PI / 180);
  }
  const length = cumulative[cumulative.length - 1];
  return length > 0.0001 ? { points, cumulative, length, endCell: endKey } : null;
};

const minimumCowSeparation = (a: Cow, b: Cow) =>
  1.15 + Math.max(a.patch.scaleFactor, b.patch.scaleFactor) * 0.85;

const separatedFromHerd = (cow: Cow, point: LngLat, cows: Cow[]) =>
  cows.every((other) =>
    other === cow ||
    localDistance(point, other) >= minimumCowSeparation(cow, other)
  );

const cellKeyAtPoint = (patch: PasturePatch, point: LngLat) => {
  const i = Math.floor((90 - point.lat) / GRID_CELL);
  const j = Math.floor((point.lng + 180) / GRID_CELL);
  if (i < 0 || i >= GRID_H || j < 0 || j >= GRID_W) return null;
  const key = i * GRID_W + j;
  return patch.byKey.has(key) ? key : null;
};

const chooseRoute = (cow: Cow): Route | null => {
  const current = cow.patch.byKey.get(cow.cellKey)!;
  const local = cow.patch.cells.filter((cell) =>
    cell.key !== cow.cellKey && localDistance(current, cell) <= 4.5
  );
  if (!local.length) return null;
  const preferred = local.filter((cell) => localDistance(current, cell) >= 0.55);
  // Select only local destinations. The old unrestricted fallback could send a
  // cow across an entire continent instead of producing a short grazing wander.
  for (const pool of [preferred, local]) {
    for (let attempt = 0; attempt < 16 && pool.length; attempt++) {
      const destination = pool[Math.floor(cow.rng() * pool.length)];
      const route = roundedRoute(cow.patch, cow, cow.cellKey, destination.key);
      if (route && route.length >= 0.003 && route.length <= 0.07) return route;
    }
  }
  return null;
};

const timeWalkingRoute = (cow: Cow) => {
  if (!cow.route) return;
  cow.speed = cow.gaitGroundSpeed * cow.walkRate;
  // The route duration follows the measured stride. It never changes the gait
  // to fit an arbitrary arrival time, which would reintroduce foot sliding.
  cow.stateDuration = cow.route.length / Math.max(1e-6, cow.speed);
};

const sampleRoute = (route: Route, distance: number) => {
  const d = Math.max(0, Math.min(route.length, distance));
  let i = 1;
  while (i < route.cumulative.length - 1 && route.cumulative[i] < d) i++;
  const a = route.points[i - 1], b = route.points[i];
  const span = Math.max(1e-8, route.cumulative[i] - route.cumulative[i - 1]);
  const t = (d - route.cumulative[i - 1]) / span;
  return {
    lng: a.lng + (b.lng - a.lng) * t,
    lat: a.lat + (b.lat - a.lat) * t,
    dLng: b.lng - a.lng,
    dLat: b.lat - a.lat,
  };
};

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smoother01 = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const independentRandom = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const alignIncomingAction = (cow: Cow, walking: boolean) => {
  const incoming = walking ? cow.walkAction : cow.grazeAction;
  const outgoing = walking ? cow.grazeAction : cow.walkAction;
  // Phase alignment is only safe while the incoming action has no visible
  // weight. Reversing an in-flight blend must never reset either action's time.
  if (incoming.getEffectiveWeight() > 0.0001) return;
  const fromDuration = outgoing.getClip().duration;
  const toDuration = incoming.getClip().duration;
  const phase = fromDuration > 0 ? outgoing.time / fromDuration : 0;
  incoming.time = THREE.MathUtils.euclideanModulo(phase * toDuration, toDuration);
  incoming.paused = false;
};

const setCowWalkTarget = (cow: Cow, target: number) => {
  if (target === cow.targetWalkWeight) return;
  alignIncomingAction(cow, target === 1);
  cow.targetWalkWeight = target;
  cow.blendStartWeight = cow.walkWeight;
  cow.blendElapsed = 0;
};

const updateCowCrossfade = (cow: Cow, dt: number) => {
  if (cow.walkWeight !== cow.targetWalkWeight) {
    cow.blendElapsed = Math.min(cow.blendDuration, cow.blendElapsed + dt);
    const progress = cow.blendDuration > 0 ? cow.blendElapsed / cow.blendDuration : 1;
    const eased = smoother01(THREE.MathUtils.clamp(progress, 0, 1));
    cow.walkWeight = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(cow.blendStartWeight, cow.targetWalkWeight, eased),
      0,
      1
    );
    if (progress >= 1) cow.walkWeight = cow.targetWalkWeight;
  }
  // Both actions continue advancing at their own playback rates. The fade is
  // driven by elapsed real time, so leg/neck/body interpolation stays fluid at
  // every action timeScale and can reverse without a pose reset.
  cow.grazeAction.setEffectiveWeight(1 - cow.walkWeight);
  cow.walkAction.setEffectiveWeight(cow.walkWeight);
};

const stanceContains = (phase: number, start: number, end: number) =>
  start <= end ? phase >= start && phase < end : phase >= start || phase < end;

const setBoneWorldQuaternion = (bone: THREE.Bone, world: THREE.Quaternion) => {
  const parent = bone.parent;
  if (!parent) return;
  const parentWorld = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(parentWorld.multiply(world));
};

const limitRotationAngle = (rotation: THREE.Quaternion, maximum: number) => {
  const q = rotation.clone().normalize();
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(q.w, -1, 1));
  if (angle <= maximum || angle < 1e-8) return q;
  return new THREE.Quaternion().slerp(q, maximum / angle);
};

// Constrain the IK delta, not the authored animation pose. Swing and twist have
// separate budgets so the solver cannot flip a knee/hock or corkscrew an ankle.
const constrainBoneRotation = (
  bone: THREE.Bone,
  authored: THREE.Quaternion,
  hingeAxis: THREE.Vector3,
  maxSwing: number,
  maxTwist: number
) => {
  const delta = authored.clone().invert().multiply(bone.quaternion).normalize();
  const axis = hingeAxis.clone().normalize();
  const projection = axis.clone().multiplyScalar(
    delta.x * axis.x + delta.y * axis.y + delta.z * axis.z
  );
  const twist = new THREE.Quaternion(projection.x, projection.y, projection.z, delta.w);
  if (twist.lengthSq() < 1e-10) twist.identity();
  else twist.normalize();
  const swing = delta.clone().multiply(twist.clone().invert());
  const limitedSwing = limitRotationAngle(swing, maxSwing);
  const limitedTwist = limitRotationAngle(twist, maxTwist);
  bone.quaternion.copy(authored).multiply(limitedSwing).multiply(limitedTwist).normalize();
};

const restoreRigProportions = (foot: FootRig) => {
  // These tracks are constant in the source. Reasserting the bind transforms
  // makes it impossible for any later IK stage to scale or translate a segment.
  foot.upper.position.copy(foot.upperRestPosition);
  foot.lower.position.copy(foot.lowerRestPosition);
  foot.hoof.position.copy(foot.hoofRestPosition);
  foot.upper.scale.copy(foot.upperRestScale);
  foot.lower.scale.copy(foot.lowerRestScale);
  foot.hoof.scale.copy(foot.hoofRestScale);
};

// Analytic two-bone IK with fixed segment lengths, an authored bend pole,
// reach clamping, constrained joint deltas, and independent hoof alignment.
const solveFootIK = (
  cow: Cow,
  foot: FootRig,
  target: THREE.Vector3,
  weight: number,
  groundNormal: THREE.Vector3
) => {
  const { upper, lower, hoof } = foot;
  upper.parent?.updateWorldMatrix(true, false);
  const authoredUpper = upper.quaternion.clone();
  const authoredLower = lower.quaternion.clone();
  const authoredHoof = hoof.quaternion.clone();
  const authoredHoofWorld = hoof.getWorldQuaternion(new THREE.Quaternion());
  const u = upper.getWorldPosition(new THREE.Vector3());
  const l = lower.getWorldPosition(new THREE.Vector3());
  const upperLength = foot.naturalUpperLength;
  const lowerLength = foot.naturalLowerLength;
  const maximumReach = (upperLength + lowerLength) * MAX_LEG_EXTENSION;
  const minimumReach = Math.abs(upperLength - lowerLength) + 1e-6;
  const toTarget = target.clone().sub(u);
  const rawDistance = toTarget.length();
  if (rawDistance < 1e-10 || weight <= 0) return 0;
  const direction = toTarget.multiplyScalar(1 / rawDistance);
  const distance = THREE.MathUtils.clamp(rawDistance, minimumReach, maximumReach);
  const clampedTarget = u.clone().addScaledVector(direction, distance);
  const along = (upperLength * upperLength + distance * distance - lowerLength * lowerLength) / (2 * distance);
  const bendHeight = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const lowerOffset = l.clone().sub(u);
  const bend = lowerOffset.clone().addScaledVector(direction, -lowerOffset.dot(direction));
  if (bend.lengthSq() < 1e-10) {
    bend.set(0, 0, -1).applyQuaternion(cow.obj.getWorldQuaternion(new THREE.Quaternion()));
    bend.addScaledVector(direction, -bend.dot(direction));
  }
  if (bend.lengthSq() < 1e-10) bend.set(0, 1, 0).addScaledVector(direction, -direction.y);
  bend.normalize();
  const lowerTarget = u.clone().addScaledVector(direction, along).addScaledVector(bend, bendHeight);

  const upperWorld = upper.getWorldQuaternion(new THREE.Quaternion());
  const upperDelta = new THREE.Quaternion().setFromUnitVectors(
    lowerOffset.normalize(),
    lowerTarget.clone().sub(u).normalize()
  );
  setBoneWorldQuaternion(upper, upperDelta.multiply(upperWorld));
  constrainBoneRotation(upper, authoredUpper, foot.upperBendAxis, MAX_UPPER_SWING, MAX_LEG_TWIST);
  if (weight < 1) upper.quaternion.slerpQuaternions(authoredUpper, upper.quaternion.clone(), weight);
  upper.updateWorldMatrix(false, true);

  const solvedLower = lower.getWorldPosition(new THREE.Vector3());
  const solvedHoof = hoof.getWorldPosition(new THREE.Vector3());
  const lowerWorld = lower.getWorldQuaternion(new THREE.Quaternion());
  const lowerDelta = new THREE.Quaternion().setFromUnitVectors(
    solvedHoof.clone().sub(solvedLower).normalize(),
    clampedTarget.clone().sub(solvedLower).normalize()
  );
  setBoneWorldQuaternion(lower, lowerDelta.multiply(lowerWorld));
  constrainBoneRotation(lower, authoredLower, foot.lowerBendAxis, MAX_LOWER_SWING, MAX_LEG_TWIST);
  if (weight < 1) lower.quaternion.slerpQuaternions(authoredLower, lower.quaternion.clone(), weight);
  lower.updateWorldMatrix(false, true);

  // Calibrated contact normals keep the authored sole flat. Only a bounded
  // terrain-normal correction is permitted; the ankle never twists to reach IK.
  const authoredNormal = foot.groundNormalLocal.clone().applyQuaternion(authoredHoofWorld).normalize();
  const alignment = new THREE.Quaternion().setFromUnitVectors(authoredNormal, groundNormal);
  const desiredHoofWorld = alignment.multiply(authoredHoofWorld);
  setBoneWorldQuaternion(hoof, desiredHoofWorld);
  constrainBoneRotation(hoof, authoredHoof, foot.groundNormalLocal, MAX_HOOF_SWING, MAX_HOOF_TWIST);
  if (weight < 1) hoof.quaternion.slerpQuaternions(authoredHoof, hoof.quaternion.clone(), weight);
  hoof.updateWorldMatrix(false, true);

  const finalUpper = upper.getWorldPosition(new THREE.Vector3());
  const finalLower = lower.getWorldPosition(new THREE.Vector3());
  const finalHoof = hoof.getWorldPosition(new THREE.Vector3());
  foot.upperLength = finalUpper.distanceTo(finalLower);
  foot.lowerLength = finalLower.distanceTo(finalHoof);
  foot.reachRatio = finalUpper.distanceTo(finalHoof) / (upperLength + lowerLength);
  foot.upperAngle = authoredUpper.angleTo(upper.quaternion);
  foot.lowerAngle = authoredLower.angleTo(lower.quaternion);
  foot.hoofAngle = authoredHoof.angleTo(hoof.quaternion);
  const actualNormal = foot.groundNormalLocal.clone()
    .applyQuaternion(hoof.getWorldQuaternion(new THREE.Quaternion())).normalize();
  foot.hoofNormalError = actualNormal.angleTo(groundNormal);
  return finalHoof.distanceTo(target);
};

const gaitInterval = (from: number, to: number) =>
  THREE.MathUtils.euclideanModulo(to - from, WALK_CYCLE_SECONDS);

const planFootLanding = (cow: Cow, foot: FootRig, surface: number, untilLanding: number) => {
  const forward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(cow.obj.getWorldQuaternion(new THREE.Quaternion()));
  // untilLanding is in source-clip seconds. At any playback rate the body will
  // advance by gaitGroundSpeed times that phase interval before touchdown.
  const predictedUpper = foot.upper.getWorldPosition(new THREE.Vector3())
    .addScaledVector(forward, cow.gaitGroundSpeed * untilLanding);
  const modelRotation = cow.model.getWorldQuaternion(new THREE.Quaternion());
  const landingOffset = foot.landingOffset.clone()
    .multiplyScalar(cow.modelScale).applyQuaternion(modelRotation);
  return predictedUpper.add(landingOffset).normalize()
    .multiplyScalar(surface + foot.contactHeight * cow.modelScale);
};

const updateFootLocks = (cow: Cow, surface: number, dt: number) => {
  const phase = THREE.MathUtils.euclideanModulo(cow.walkAction.time, WALK_CYCLE_SECONDS);
  const walking = cow.walkWeight >= 0.98;
  const ikWeight = walking
    ? 1
    : smoother01(THREE.MathUtils.clamp((cow.walkWeight - 0.8) / 0.2, 0, 1));
  for (const foot of cow.feet) restoreRigProportions(foot);
  cow.obj.updateMatrixWorld(true);

  const supporting: FootRig[] = [];
  for (const foot of cow.feet) {
    const stance = walking && stanceContains(phase, foot.stanceStart, foot.stanceEnd);
    const untilLanding = gaitInterval(phase, foot.stanceStart);
    if (stance && !foot.inStance) {
      // Keep the late-swing landing plan through touchdown. A first/mid-stance
      // initialization falls back to the authored contact projected onto the
      // local spherical surface; neither case resets a valid planned anchor.
      if (!foot.hasAnchor) {
        foot.anchor.copy(foot.hoof.getWorldPosition(new THREE.Vector3()))
          .normalize().multiplyScalar(surface + foot.contactHeight * cow.modelScale);
      }
      foot.hasAnchor = true;
      foot.released = false;
    } else if (!stance && walking && untilLanding < 0.3) {
      const planned = planFootLanding(cow, foot, surface, untilLanding);
      if (!foot.hasAnchor) foot.anchor.copy(planned);
      else foot.anchor.lerp(planned, 1 - Math.exp(-dt * 14));
      foot.hasAnchor = true;
      foot.released = false;
    }
    if (stance && !foot.released && foot.hasAnchor) supporting.push(foot);
  }

  // Small, smooth whole-body compensation moves shoulders, pelvis, and center
  // of mass together. It replaces the old large downward pull on the skeleton.
  const desiredOffset = new THREE.Vector3(
    0,
    -WALK_BODY_DROP_SOURCE * cow.modelScale * cow.walkWeight,
    0
  );
  const modelRotation = cow.model.getWorldQuaternion(new THREE.Quaternion());
  const worldShift = new THREE.Vector3();
  for (const foot of supporting) {
    const upper = foot.upper.getWorldPosition(new THREE.Vector3());
    const maxReach = foot.naturalUpperLength + foot.naturalLowerLength;
    const excess = upper.distanceTo(foot.anchor) - maxReach;
    if (excess <= 0) continue;
    const toward = foot.anchor.clone().sub(upper);
    toward.addScaledVector(cow.up, -toward.dot(cow.up));
    if (toward.lengthSq() > 1e-12) {
      worldShift.add(toward.normalize().multiplyScalar(Math.min(excess, MAX_BODY_SHIFT_SOURCE * cow.modelScale)));
    }
  }
  if (supporting.length) worldShift.multiplyScalar(1 / supporting.length);
  if (worldShift.length() > MAX_BODY_SHIFT_SOURCE * cow.modelScale) {
    worldShift.setLength(MAX_BODY_SHIFT_SOURCE * cow.modelScale);
  }
  const localShift = worldShift.clone().applyQuaternion(modelRotation.clone().invert());
  localShift.y = 0;
  desiredOffset.add(localShift);

  // model.position is already expressed in globe-scale parent units. Applying
  // modelScale here again would under-predict the required support correction.
  const predictedDelta = desiredOffset.clone().sub(cow.model.position)
    .applyQuaternion(modelRotation);
  let supportDrop = 0;
  for (const foot of supporting) {
    const upper = foot.upper.getWorldPosition(new THREE.Vector3()).add(predictedDelta);
    const maxReach = foot.naturalUpperLength + foot.naturalLowerLength;
    if (upper.distanceTo(foot.anchor) <= maxReach) continue;
    let low = 0;
    let high = MAX_ADDITIONAL_BODY_DROP_SOURCE * cow.modelScale;
    for (let iteration = 0; iteration < 10; iteration++) {
      const middle = (low + high) * 0.5;
      const candidate = upper.clone().addScaledVector(cow.up, -middle);
      if (candidate.distanceTo(foot.anchor) > maxReach) low = middle;
      else high = middle;
    }
    supportDrop = Math.max(supportDrop, high);
  }
  desiredOffset.y -= supportDrop * ikWeight;
  cow.bodyOffset.lerp(desiredOffset, 1 - Math.exp(-dt * 24));
  cow.bodyOffset.y = THREE.MathUtils.clamp(
    cow.bodyOffset.y,
    -(WALK_BODY_DROP_SOURCE + MAX_ADDITIONAL_BODY_DROP_SOURCE) * cow.modelScale,
    0
  );
  const horizontal = new THREE.Vector2(cow.bodyOffset.x, cow.bodyOffset.z);
  if (horizontal.length() > MAX_BODY_SHIFT_SOURCE * cow.modelScale) {
    horizontal.setLength(MAX_BODY_SHIFT_SOURCE * cow.modelScale);
    cow.bodyOffset.x = horizontal.x;
    cow.bodyOffset.z = horizontal.y;
  }
  cow.model.position.copy(cow.bodyOffset);
  cow.obj.updateMatrixWorld(true);

  for (const foot of cow.feet) {
    const stance = walking && stanceContains(phase, foot.stanceStart, foot.stanceEnd);
    const untilLanding = gaitInterval(phase, foot.stanceStart);
    const sinceLift = gaitInterval(foot.stanceEnd, phase);
    if (!stance && sinceLift > 0.3 && untilLanding > 0.35 && foot.lockWeight < 0.02) {
      foot.hasAnchor = false;
    }
    // Begin releasing before the authored hoof lifts. Engagement follows source
    // phase (and therefore playback rate); release remains smoothly damped while
    // the foot returns to its unconstrained swing pose.
    const untilLift = gaitInterval(phase, foot.stanceEnd);
    const liftoffWeight = stance
      ? smoother01(THREE.MathUtils.clamp(untilLift / FOOT_LIFTOFF_BLEND_SECONDS, 0, 1))
      : 0;
    const targetWeight = stance && foot.hasAnchor && !foot.released ? ikWeight * liftoffWeight : 0;
    const response = targetWeight > foot.lockWeight ? 20 * cow.walkRate : 12;
    foot.lockWeight += (targetWeight - foot.lockWeight) * (1 - Math.exp(-dt * response));
    if (targetWeight === 1 && foot.lockWeight > 0.995) foot.lockWeight = 1;
    if (targetWeight === 0 && foot.lockWeight < 0.002) foot.lockWeight = 0;

    let solved = false;
    if (foot.hasAnchor && foot.lockWeight > 0) {
      const normal = foot.anchor.clone().normalize();
      const error = solveFootIK(cow, foot, foot.anchor, foot.lockWeight, normal);
      solved = true;
      foot.lockError = stance && !foot.released ? error : 0;
      if (stance && !foot.released && targetWeight >= 0.995 && foot.lockWeight === 1 &&
          error > LOCK_RELEASE_DISTANCE_SOURCE * cow.modelScale) {
        // Anatomy and posture outrank a lock. Fade back to the authored stride
        // and establish a fresh, reachable contact on the next step.
        foot.released = true;
        foot.planted = false;
      }
    }
    if (!solved) {
      foot.lockError = 0;
      const actual = foot.hoof.getWorldPosition(new THREE.Vector3());
      const contactRadius = surface + foot.contactHeight * cow.modelScale;
      if (ikWeight > 0 && actual.length() < contactRadius) {
        actual.normalize().multiplyScalar(contactRadius);
        solveFootIK(cow, foot, actual, ikWeight, actual.clone().normalize());
      } else {
        const upper = foot.upper.getWorldPosition(new THREE.Vector3());
        const lower = foot.lower.getWorldPosition(new THREE.Vector3());
        const hoof = foot.hoof.getWorldPosition(new THREE.Vector3());
        foot.upperLength = upper.distanceTo(lower);
        foot.lowerLength = lower.distanceTo(hoof);
        foot.reachRatio = upper.distanceTo(hoof) / (foot.naturalUpperLength + foot.naturalLowerLength);
        foot.upperAngle = 0;
        foot.lowerAngle = 0;
        foot.hoofAngle = 0;
        foot.hoofNormalError = 0;
      }
    }
    foot.planted = stance && !foot.released && targetWeight >= 0.995 && foot.lockWeight === 1 &&
      foot.lockError <= LOCK_RELEASE_DISTANCE_SOURCE * cow.modelScale;
    foot.inStance = stance;
  }
};

const beginCowGraze = (cow: Cow) => {
  if (cow.state === "graze") return;
  cow.state = "graze";
  cow.stateElapsed = 0;
  cow.stateDuration = 7 + cow.rng() * 10;
  setCowWalkTarget(cow, 0);
};

const beginCowWalk = (cow: Cow, route: Route) => {
  cow.route = route;
  cow.routeDistance = 0;
  cow.state = "walk";
  cow.stateElapsed = 0;
  cow.blockedTime = 0;
  cow.yieldAfter = 1.4 + cow.rng() * 1.8;
  timeWalkingRoute(cow);
  setCowWalkTarget(cow, 1);
};

const setCowTransform = (cow: Cow, toVec3: VecFactory, surface: number, dLng = 0, dLat = 1, dt = 0) => {
  const up = toVec3(cow.lng, cow.lat, 1).normalize();
  const north = new THREE.Vector3(0, 1, 0).addScaledVector(up, -up.y);
  if (north.lengthSq() < 1e-6) north.set(0, 0, -1).addScaledVector(up, up.z);
  north.normalize();
  const east = new THREE.Vector3().crossVectors(north, up).normalize();
  const localNorth = new THREE.Vector3().crossVectors(east, up).normalize();
  if (Math.abs(dLng) + Math.abs(dLat) > 1e-7) {
    const cosLat = Math.max(0.1, Math.cos(cow.lat * Math.PI / 180));
    // local -Z is forward. In this east/up/-north basis, positive route yaw
    // is therefore the negative of Three.js's positive local Y rotation.
    const desired = Math.atan2(-dLng * cosLat, dLat);
    const turn = wrapAngle(desired - cow.heading);
    // Planted feet cannot support an in-place pivot. Turn gradually enough for
    // the gait to release and replant each hoof around the curve.
    const maxTurn = dt * 0.45;
    cow.heading += THREE.MathUtils.clamp(turn * (1 - Math.exp(-dt * 3)), -maxTurn, maxTurn);
  }
  cow.obj.position.copy(toVec3(cow.lng, cow.lat, surface));
  cow.obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, localNorth));
  cow.obj.rotateY(cow.heading);
  cow.up.copy(up);
};

const updateCowHologram = (cow: Cow, progress: number) => {
  const hologram = cow.hologram;
  hologram.progress = progress;
  hologram.uniforms.uCowPhase.value = progress;
  if (hologram.settled) return;
  if (progress >= 1) {
    // The finished material is exactly the original X-ray treatment: no scan
    // band, flicker, transparency change, or residual entrance opacity.
    hologram.uniforms.uCowPhase.value = 1;
    for (const record of hologram.materials) {
      record.material.opacity = record.opacity;
      record.material.transparent = record.transparent;
    }
    hologram.shadow.opacity = hologram.shadowOpacity;
    hologram.settled = true;
    return;
  }
  const flicker = progress < 0.8
    ? 0.7 + 0.3 * Math.abs(Math.sin(progress * 22 + hologram.uniforms.uCowPhaseSeed.value * 10))
    : 1;
  for (const record of hologram.materials) {
    record.material.transparent = true;
    record.material.opacity = record.opacity * progress * flicker;
  }
  const shadowEase = progress * progress * (3 - 2 * progress);
  hologram.shadow.opacity = hologram.shadowOpacity * shadowEase;
};

export const createLivestockSystem = async ({
  regions,
  rng,
  toVec3,
  surface,
}: {
  regions: LivestockRegion[];
  rng: () => number;
  toVec3: VecFactory;
  surface: number;
}): Promise<LivestockSystem> => {
  const patches = connectedPasturePatches(regions);
  const group = new THREE.Group();
  group.name = "Pasture livestock";
  const spawns: { patch: PasturePatch; cell: LivestockCell; rank: number }[] = [];
  let remaining = 24;
  for (const patch of patches) {
    if (remaining <= 0) break;
    const desired = Math.min(6, remaining, 1 + Math.floor(patch.areaKm2 / 30000));
    const minimumSeparation = 1.15 + patch.scaleFactor * 0.85;
    const candidates = patch.cells.slice();
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const chosen: LivestockCell[] = [];
    for (const cell of candidates) {
      const clearOfPatch = chosen.every((c) => localDistance(c, cell) >= minimumSeparation);
      const clearOfHerd = spawns.every((s) =>
        localDistance(s.cell, cell) >=
        1.15 + Math.max(s.patch.scaleFactor, patch.scaleFactor) * 0.85
      );
      if (clearOfPatch && clearOfHerd) chosen.push(cell);
      if (chosen.length >= desired) break;
    }
    chosen.forEach((cell, rank) => spawns.push({ patch, cell, rank }));
    remaining -= chosen.length;
  }
  if (!spawns.length) {
    return { group, cows: [], update: () => undefined, dispose: () => undefined };
  }

  const asset = await loadCowAsset();
  const cows: Cow[] = spawns.map(({ patch, cell, rank }, index) => {
    const random = independentRandom(Math.floor(rng() * 4294967296));
    const obj = new THREE.Group();
    obj.name = `Pasture cow ${index + 1}`;
    const model = cloneSkeleton(asset.scene);
    model.rotation.y = COW_MODEL_FORWARD;
    const scale = DEFAULT_COW_HEIGHT * patch.scaleFactor / asset.height;
    model.scale.setScalar(scale);

    // Each cow owns its materials and phase uniforms so the activation sweep can
    // stagger individuals without changing the cached source asset or its rig.
    const phaseUniforms: CowHologram["uniforms"] = {
      uCowPhase: { value: 0 },
      uCowPhaseMin: { value: asset.phaseMin },
      uCowPhaseSpan: { value: asset.height },
      uCowPhaseSeed: { value: (index * 0.61803398875) % 1 },
    };
    const phaseMaterials: CowPhaseMaterial[] = [];
    const materialClones = new Map<THREE.Material, THREE.Material>();
    model.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = sources.map((source) => {
        const existing = materialClones.get(source);
        if (existing) return existing;
        const material = source.clone();
        materialClones.set(source, material);
        phaseMaterials.push({
          material,
          opacity: material.opacity,
          transparent: material.transparent,
        });
        if (material instanceof THREE.MeshStandardMaterial) {
          material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, phaseUniforms);
            shader.vertexShader = shader.vertexShader.replace(
              "#include <common>",
              `#include <common>
              uniform float uCowPhaseMin;
              uniform float uCowPhaseSpan;
              varying float vCowPhaseHeight;`
            ).replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
              vCowPhaseHeight = clamp((position.y - uCowPhaseMin) / uCowPhaseSpan, 0.0, 1.0);`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <common>",
              `#include <common>
              uniform float uCowPhase;
              uniform float uCowPhaseSeed;
              varying float vCowPhaseHeight;`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <emissivemap_fragment>",
              `#include <emissivemap_fragment>
              #ifdef USE_EMISSIVEMAP
                float xrayLine = texture2D(emissiveMap, vEmissiveMapUv).r;
                diffuseColor.a *= smoothstep(0.16, 0.55, xrayLine);
              #endif
              float cowPhaseEdge = uCowPhase * 1.16;
              float cowPhaseMask = 1.0 - smoothstep(
                cowPhaseEdge - 0.055,
                cowPhaseEdge + 0.02,
                vCowPhaseHeight
              );
              if (cowPhaseMask < 0.001) discard;
              float cowPhaseActive = 1.0 - smoothstep(0.82, 1.0, uCowPhase);
              float cowPhaseBand = exp(-pow((vCowPhaseHeight - cowPhaseEdge) * 32.0, 2.0));
              float cowPhaseScan = 0.86 + 0.14 * sin(
                (vCowPhaseHeight * 44.0 - uCowPhase * 9.0 + uCowPhaseSeed) * 6.2831853
              );
              diffuseColor.a *= cowPhaseMask * mix(1.0, cowPhaseScan, cowPhaseActive);
              totalEmissiveRadiance += vec3(1.0, 0.035, 0.08) * cowPhaseBand * cowPhaseActive * 1.6;`
            );
          };
          material.customProgramCacheKey = () => "pasture-cow-xray-phase-v1";
          material.needsUpdate = true;
        }
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    });
    obj.add(model);

    const shadowOpacity = 0.16;
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x3f2525,
      transparent: true,
      opacity: shadowOpacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 20),
      shadowMaterial
    );
    shadow.name = "Cow contact shadow";
    shadow.scale.set(scale * 0.75, scale * 1.25, scale);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.00005;
    obj.add(shadow);
    group.add(obj);

    const mixer = new THREE.AnimationMixer(model);
    const grazeAction = mixer.clipAction(asset.graze);
    const walkAction = mixer.clipAction(asset.walk);
    grazeAction.play();
    walkAction.play();
    grazeAction.timeScale = 0.88 + random() * 0.24;
    walkAction.timeScale = 0.9 + random() * 0.2;
    grazeAction.time = random() * asset.graze.duration;
    walkAction.time = random() * asset.walk.duration;
    const bones = new Map<string, THREE.Bone>();
    model.traverse((node) => {
      if (node instanceof THREE.Bone) bones.set(node.name, node);
    });
    const feet: FootRig[] = FOOT_GAIT.map((gait) => {
      const upper = bones.get(`${gait.name}_upper`)!;
      const lower = bones.get(`${gait.name}_lower`)!;
      const hoof = bones.get(`${gait.name}_hoof`)!;
      const upperRestPosition = upper.position.clone();
      const lowerRestPosition = lower.position.clone();
      const hoofRestPosition = hoof.position.clone();
      return {
        ...gait,
        upper,
        lower,
        hoof,
        naturalUpperLength: lowerRestPosition.length() * scale,
        naturalLowerLength: hoofRestPosition.length() * scale,
        upperRestPosition,
        lowerRestPosition,
        hoofRestPosition,
        upperRestScale: upper.scale.clone(),
        lowerRestScale: lower.scale.clone(),
        hoofRestScale: hoof.scale.clone(),
        upperBendAxis: lowerRestPosition.clone().normalize(),
        lowerBendAxis: hoofRestPosition.clone().normalize(),
        landingOffset: asset.feet[gait.name].landingOffset.clone(),
        groundNormalLocal: asset.feet[gait.name].groundNormalLocal.clone(),
        planted: false,
        inStance: false,
        released: false,
        hasAnchor: false,
        lockWeight: 0,
        anchor: new THREE.Vector3(),
        lockError: 0,
        reachRatio: 0,
        upperLength: lowerRestPosition.length() * scale,
        lowerLength: hoofRestPosition.length() * scale,
        upperAngle: 0,
        lowerAngle: 0,
        hoofAngle: 0,
        hoofNormalError: 0,
      };
    });
    if (feet.some((foot) => !foot.upper || !foot.lower || !foot.hoof)) {
      throw new Error("Pasture cow rig is missing a hoof IK chain");
    }
    const walking = random() > 0.55;
    const walkRate = walkAction.timeScale;
    const gaitGroundSpeed = asset.stridePerCycle * scale / WALK_CYCLE_SECONDS;
    const cow: Cow = {
      obj,
      model,
      patch,
      rank,
      cellKey: cell.key,
      lng: cell.lng,
      lat: cell.lat,
      heading: random() * Math.PI * 2,
      state: walking ? "walk" : "graze",
      stateElapsed: 0,
      stateDuration: walking ? 7 + random() * 8 : 7 + random() * 10,
      route: null,
      routeDistance: 0,
      speed: gaitGroundSpeed * walkRate,
      walkRate,
      gaitGroundSpeed,
      modelScale: scale,
      bodyOffset: new THREE.Vector3(),
      feet,
      walkWeight: walking ? 1 : 0,
      targetWalkWeight: walking ? 1 : 0,
      blendStartWeight: walking ? 1 : 0,
      blendElapsed: CROSSFADE_SECONDS,
      blendDuration: CROSSFADE_SECONDS,
      blockedTime: 0,
      yieldAfter: 1.4 + random() * 1.8,
      grazeAction,
      walkAction,
      mixer,
      lastUpdate: performance.now() / 1000,
      lastFrameDt: 0,
      frameOffset: Math.floor(random() * 3),
      rng: random,
      up: new THREE.Vector3(),
      hologram: {
        materials: phaseMaterials,
        uniforms: phaseUniforms,
        shadow: shadowMaterial,
        shadowOpacity,
        delay: 0,
        duration: COW_PHASE_DURATION_SECONDS,
        progress: 0,
        settled: false,
      },
    };
    grazeAction.setEffectiveWeight(walking ? 0 : 1);
    walkAction.setEffectiveWeight(walking ? 1 : 0);
    setCowTransform(cow, toVec3, surface);
    cow.route = chooseRoute(cow);
    if (walking && cow.route) {
      timeWalkingRoute(cow);
      // Initial placement can face its first route directly; subsequent turns
      // always use the rate-limited steering update below.
      const first = sampleRoute(cow.route, 0);
      cow.heading = Math.atan2(
        -first.dLng * Math.max(0.1, Math.cos(cow.lat * Math.PI / 180)),
        first.dLat
      );
      setCowTransform(cow, toVec3, surface);
    } else {
      cow.state = "graze";
      cow.walkWeight = 0;
      cow.targetWalkWeight = 0;
      cow.blendStartWeight = 0;
    }
    return cow;
  });

  let latMin = Infinity;
  let latMax = -Infinity;
  for (const cow of cows) {
    latMin = Math.min(latMin, cow.lat);
    latMax = Math.max(latMax, cow.lat);
  }
  const latSpan = Math.max(1e-6, latMax - latMin);
  cows.forEach((cow, index) => {
    // A small deterministic jitter keeps the sweep organic without consuming
    // the behavior RNG or changing any cow's established route timing.
    const jitter = (index % 4) * 0.035;
    cow.hologram.delay = ((latMax - cow.lat) / latSpan) * COW_PHASE_STAGGER_SECONDS + jitter;
    updateCowHologram(cow, 0);
    cow.obj.visible = false;
  });

  let revealStart: number | null = null;
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const toCamera = new THREE.Vector3();
  const update = (now: number, camera: THREE.Camera, camDist: number) => {
    const entranceStart = revealStart ?? now;
    revealStart = entranceStart;
    camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    const distant = camDist > 4.2;
    const veryDistant = camDist > 5.2;
    for (const cow of cows) {
      const phase = THREE.MathUtils.clamp(
        (now - entranceStart - cow.hologram.delay) / cow.hologram.duration,
        0,
        1
      );
      updateCowHologram(cow, phase);
      toCamera.copy(camera.position).sub(cow.obj.position);
      const onScreen = cow.up.dot(toCamera) > 0 && frustum.containsPoint(cow.obj.position);
      const rankLimit = veryDistant ? 1 : distant ? 3 : Number.POSITIVE_INFINITY;
      const inView = onScreen && cow.rank < rankLimit;
      cow.obj.visible = inView && phase > 0;
      if (!inView) {
        cow.lastUpdate = now;
        continue;
      }
      const minInterval = distant ? 1 / 20 : 0;
      if (now - cow.lastUpdate < minInterval) continue;
      // Preserve real behavior intervals on slow devices. The cap only prevents
      // a large catch-up jump after the whole browser tab has been suspended.
      const dt = Math.min(2, Math.max(0, now - cow.lastUpdate));
      cow.lastUpdate = now;
      cow.lastFrameDt = dt;
      if (dt <= 0) continue;

      cow.stateElapsed += dt;

      if (cow.state === "graze" && cow.stateElapsed >= cow.stateDuration) {
        const route = chooseRoute(cow);
        if (route) {
          beginCowWalk(cow, route);
        } else {
          cow.stateElapsed = 0;
          cow.stateDuration = 7 + cow.rng() * 10;
        }
      }

      if (cow.state === "walk" && cow.route) {
        // Begin braking before the destination. Pose and translation then share
        // the same ease-out instead of the body stopping while the legs fade.
        const remaining = cow.route.length - cow.routeDistance;
        const brakingDistance = cow.speed * CROSSFADE_SECONDS * 0.5;
        if (remaining <= brakingDistance) beginCowGraze(cow);
      }
      setCowWalkTarget(cow, cow.state === "walk" && cow.blockedTime === 0 ? 1 : 0);
      updateCowCrossfade(cow, dt);
      const locomotion = cow.walkWeight;
      // A stationary or braking cow cannot keep cycling its legs. Playback and
      // ground travel use the same locomotion factor and measured stride rate.
      cow.walkAction.timeScale = cow.walkRate * locomotion;
      cow.model.position.copy(cow.bodyOffset);

      // Keep following the route throughout deceleration. A grazing cow whose
      // fade has completed has zero locomotion and therefore remains in place.
      if (cow.route && locomotion > 0) {
        const nextDistance = Math.min(
          cow.route.length,
          cow.routeDistance + cow.speed * locomotion * dt
        );
        const sample = sampleRoute(cow.route, nextDistance);
        const intendedDistance = Math.min(
          cow.route.length,
          cow.routeDistance + cow.speed * dt
        );
        const intended = sampleRoute(cow.route, intendedDistance);
        // Check both the blend-adjusted candidate and the full intended step.
        // Otherwise a nearly stopped cow could repeatedly reset its yield timer
        // with a tiny clear step while the full-speed path remained blocked.
        const clear = separatedFromHerd(cow, sample, cows) &&
          (intendedDistance === nextDistance || separatedFromHerd(cow, intended, cows));
        // Sequential candidate checks preserve the spawn-time separation even
        // when two routes cross: a later cow cannot enter a position already
        // occupied by a cow updated earlier in this frame.
        if (clear) {
          cow.blockedTime = 0;
          cow.routeDistance = nextDistance;
          cow.lng = sample.lng;
          cow.lat = sample.lat;
          cow.cellKey = cellKeyAtPoint(cow.patch, cow) ?? cow.cellKey;
          setCowTransform(cow, toVec3, surface, sample.dLng, sample.dLat, dt);
          if (cow.routeDistance >= cow.route.length - 1e-6) {
            cow.cellKey = cow.route.endCell;
            beginCowGraze(cow);
          }
        } else {
          cow.blockedTime += dt;
          if (cow.blockedTime >= cow.yieldAfter) {
            // Do not walk in place or push through a grazing neighbor. Pause
            // here, then independently pick a new destination after grazing.
            beginCowGraze(cow);
            cow.route = null;
            cow.routeDistance = 0;
            cow.blockedTime = 0;
          }
        }
      }
      cow.mixer.update(dt);
      updateFootLocks(cow, surface, dt);
    }
  };

  return {
    group,
    cows,
    update,
    dispose: () => {
      for (const cow of cows) {
        cow.mixer.stopAllAction();
        for (const record of cow.hologram.materials) record.material.dispose();
        cow.obj.traverse((o) => {
          if (o.name !== "Cow contact shadow") return;
          const mesh = o as THREE.Mesh;
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        });
      }
    },
  };
};
