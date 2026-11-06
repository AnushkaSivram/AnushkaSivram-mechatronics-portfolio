import * as THREE from "three";
import { MESH_DATA } from "../data/meshData.js";

export const DEG = Math.PI / 180;

export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}
export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
export function shortestDelta(from, to) {
  return ((to - from + 540) % 360) - 180;
}
export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
export function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ---------------------------------------------------------------------------
// Real Franka Emika "FER" research-arm kinematics, read directly out of the
// official franka_description kinematics.yaml / joint_limits.yaml (Apache-2.0):
// https://github.com/frankaemika/franka_description
// Distances converted from meters to millimeters to match this scene's units.
// ---------------------------------------------------------------------------
export const JOINT_OFFSETS = [
  { t: [0, 0, 333], rx: 0 },
  { t: [0, 0, 0], rx: -Math.PI / 2 },
  { t: [0, -316, 0], rx: Math.PI / 2 },
  { t: [82.5, 0, 0], rx: Math.PI / 2 },
  { t: [-82.5, 384, 0], rx: -Math.PI / 2 },
  { t: [0, 0, 0], rx: Math.PI / 2 },
  { t: [88, 0, 0], rx: Math.PI / 2 },
];
export const FLANGE_OFFSET = [0, 0, 107];
export const JOINT_LIMITS_DEG = [
  [-166, 166],
  [-101, 101],
  [-166, 166],
  [-176, -4],
  [-166, 166],
  [-1, 215],
  [-166, 166],
];
export const HOME_POSE_DEG = [0, -45, 0, -135, 0, 90, 45]; // Franka's documented "ready" pose
export const LINK_NAMES = ["link1", "link2", "link3", "link4", "link5", "link6", "link7"];
export const JOINT_LABELS = [
  "θ1 · Base rotation",
  "θ2 · Shoulder",
  "θ3 · Upper-arm roll",
  "θ4 · Elbow",
  "θ5 · Forearm roll",
  "θ6 · Wrist pitch",
  "θ7 · Wrist roll",
];

export function makeGeometry(name) {
  const data = MESH_DATA[name];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(data.v, 3));
  geo.setIndex(data.i);
  geo.computeVertexNormals();
  return geo;
}

// Builds the real 7-joint chain. `material` is optional — omit it to get a lightweight,
// mesh-free chain used purely for math (inverse kinematics, live readouts) without
// touching anything visible. The wrapper's -90° X rotation converts Franka's native
// Z-up convention into the Y-up convention this scene (and its floor grid) uses, so
// every coordinate read from this chain is already in the same space as mouse clicks.
export function buildChain(material) {
  const wrapper = new THREE.Object3D();
  wrapper.rotation.x = -Math.PI / 2;
  const root = new THREE.Object3D();
  wrapper.add(root);

  const meshes = [];
  if (material) {
    const link0 = new THREE.Mesh(makeGeometry("link0"), material);
    root.add(link0);
    meshes.push(link0);
  }

  let parent = root;
  const rotGroups = [];
  for (let i = 0; i < 7; i++) {
    const off = new THREE.Object3D();
    off.position.set(...JOINT_OFFSETS[i].t);
    off.rotation.x = JOINT_OFFSETS[i].rx;
    parent.add(off);
    const rot = new THREE.Object3D();
    off.add(rot);
    rotGroups.push(rot);
    if (material) {
      const m = new THREE.Mesh(makeGeometry(LINK_NAMES[i]), material);
      if (i === 6) m.rotation.z = Math.PI / 4; // link7's own mesh has a 45° offset in the real URDF
      rot.add(m);
      meshes.push(m);
    }
    parent = rot;
  }

  const flange = new THREE.Object3D();
  flange.position.set(...FLANGE_OFFSET);
  parent.add(flange);
  if (material) {
    const hand = new THREE.Mesh(makeGeometry("hand"), material);
    hand.rotation.z = -Math.PI / 4;
    flange.add(hand);
    meshes.push(hand);
    flange.add(new THREE.AxesHelper(55));
  }

  return { wrapper, root, rotGroups, flange, meshes };
}

export function applyThetas(chain, thetasDeg) {
  for (let i = 0; i < 7; i++) chain.rotGroups[i].rotation.z = thetasDeg[i] * DEG;
  chain.wrapper.updateMatrixWorld(true);
}

export function getEndEffectorPose(chain) {
  const pos = new THREE.Vector3();
  chain.flange.getWorldPosition(pos);
  const quat = new THREE.Quaternion();
  chain.flange.getWorldQuaternion(quat);
  const euler = new THREE.Euler().setFromQuaternion(quat, "ZYX");
  return { pos, roll: toDeg(euler.x), pitch: toDeg(euler.y), yaw: toDeg(euler.z) };
}

// Cyclic Coordinate Descent inverse kinematics: sweep from the wrist back to the base,
// each pass nudging one joint to swing the end effector a little closer to the target.
// This is a standard, simple numerical IK method — well suited to a 7-joint redundant
// chain like this one, where (unlike a 2-link/3-link arm) there's no clean closed-form
// solution. `chain` here should always be a detached, mesh-free solving chain, never the
// visible one, so the arm doesn't visibly twitch while this converges.
export function solveIK_CCD(chain, target, initialDeg, iterations = 60) {
  const thetas = initialDeg.map((d) => d * DEG);
  const axisZ = new THREE.Vector3(0, 0, 1);
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 6; i >= 0; i--) {
      for (let k = 0; k < 7; k++) chain.rotGroups[k].rotation.z = thetas[k];
      chain.wrapper.updateMatrixWorld(true);

      const jointPos = new THREE.Vector3();
      chain.rotGroups[i].getWorldPosition(jointPos);
      const jointQuat = new THREE.Quaternion();
      chain.rotGroups[i].getWorldQuaternion(jointQuat);
      const jointAxis = axisZ.clone().applyQuaternion(jointQuat).normalize();

      const endPos = new THREE.Vector3();
      chain.flange.getWorldPosition(endPos);

      const toEnd = endPos.clone().sub(jointPos);
      const toTarget = target.clone().sub(jointPos);
      const projEnd = toEnd.clone().sub(jointAxis.clone().multiplyScalar(toEnd.dot(jointAxis)));
      const projTar = toTarget.clone().sub(jointAxis.clone().multiplyScalar(toTarget.dot(jointAxis)));
      const lenE = projEnd.length();
      const lenT = projTar.length();
      if (lenE < 1e-5 || lenT < 1e-5) continue;
      projEnd.multiplyScalar(1 / lenE);
      projTar.multiplyScalar(1 / lenT);

      let angle = Math.acos(clamp(projEnd.dot(projTar), -1, 1));
      const cross = new THREE.Vector3().crossVectors(projEnd, projTar);
      if (cross.dot(jointAxis) < 0) angle = -angle;

      const lim = JOINT_LIMITS_DEG[i];
      thetas[i] = clamp(thetas[i] + angle, lim[0] * DEG, lim[1] * DEG);
    }
  }
  for (let k = 0; k < 7; k++) chain.rotGroups[k].rotation.z = thetas[k];
  chain.wrapper.updateMatrixWorld(true);
  const finalPos = new THREE.Vector3();
  chain.flange.getWorldPosition(finalPos);
  const reachable = finalPos.distanceTo(target) < 20; // mm tolerance
  return { thetasDeg: thetas.map(toDeg), reachable };
}
