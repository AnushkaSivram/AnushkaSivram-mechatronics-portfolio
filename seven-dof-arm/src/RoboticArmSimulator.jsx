import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

import { COLORS, MONO } from "./styles/theme.js";
import {
  DEG,
  JOINT_LIMITS_DEG,
  JOINT_LABELS,
  HOME_POSE_DEG,
  buildChain,
  applyThetas,
  getEndEffectorPose,
  solveIK_CCD,
  shortestDelta,
  easeInOut,
  sleep,
} from "./lib/kinematics.js";

import GlobalStyle from "./components/GlobalStyle.jsx";
import Panel from "./components/Panel.jsx";
import SectionTitle from "./components/SectionTitle.jsx";
import Slider from "./components/Slider.jsx";
import PresetButton from "./components/PresetButton.jsx";
import Readout from "./components/Readout.jsx";
import ResearchNotes from "./components/ResearchNotes.jsx";

// Concept-level mechanics model. Stiffness values are deliberately exposed so
// they can be replaced with measured or manufacturer-provided joint data.
const JOINT_STIFFNESS_NM_PER_DEG = [165, 120, 115, 92, 52, 36, 25];
const EFFECTIVE_LOAD_ARMS_M = [0.0, 0.56, 0.48, 0.33, 0.20, 0.12, 0.06];
const SAG_DIRECTIONS = [0, -1, 0, 1, 0, -1, 0];

function payloadEffects(commandedDeg, payloadKg) {
  let cumulativeAngle = 0;
  let maxTorqueNm = 0;
  let tipSagMm = 0;
  const sagDeg = commandedDeg.map((theta, i) => {
    cumulativeAngle += theta * DEG;
    const gravityTorque = payloadKg * 9.80665 * EFFECTIVE_LOAD_ARMS_M[i] * Math.abs(Math.cos(cumulativeAngle));
    maxTorqueNm = Math.max(maxTorqueNm, gravityTorque);
    const deflection = Math.min(4.5, gravityTorque / JOINT_STIFFNESS_NM_PER_DEG[i]);
    tipSagMm += Math.abs(deflection) * (i < 4 ? 2.8 : 1.1);
    return SAG_DIRECTIONS[i] * deflection;
  });
  return { sagDeg, maxTorqueNm, tipSagMm };
}

function applyToleranceModel(model, desired, enabled, now) {
  if (!enabled) {
    model.position = desired.slice();
    model.velocity.fill(0);
    model.target = desired.slice();
    model.lastTime = now;
    return desired;
  }
  const dt = Math.min(0.04, Math.max(0.001, (now - model.lastTime) / 1000 || 0.016));
  model.lastTime = now;
  return desired.map((target, i) => {
    const direction = Math.sign(target - model.target[i]);
    if (Math.abs(target - model.target[i]) > 0.03) {
      if (direction && model.direction[i] && direction !== model.direction[i]) {
        // Reversal crosses a small gearbox deadband before teeth re-engage.
        model.backlash[i] = -model.direction[i] * (0.08 + Math.random() * 0.16);
      }
      model.direction[i] = direction || model.direction[i];
      model.target[i] = target;
    }
    const setpoint = model.target[i] + model.backlash[i];
    const acceleration = 95 * (setpoint - model.position[i]) - 15 * model.velocity[i];
    model.velocity[i] += acceleration * dt;
    model.position[i] += model.velocity[i] * dt;
    if (Math.abs(setpoint - model.position[i]) < 0.006 && Math.abs(model.velocity[i]) < 0.01) {
      model.backlash[i] *= 0.82;
    }
    return model.position[i];
  });
}

export default function RoboticArmSimulator() {
  const mountRef = useRef(null);
  const visualChainRef = useRef(null);
  const solverChainRef = useRef(null);
  const thetasRef = useRef(HOME_POSE_DEG.slice());
  const orbitRef = useRef({ theta: 0.9, phi: 1.05, radius: 1800, dragging: false, lastX: 0, lastY: 0, moved: 0 });
  const sceneApiRef = useRef(null);
  const animCtrlRef = useRef({ cancel: false });
  const runningRef = useRef(false);
  const reachFractionRef = useRef(0.8);
  const payloadMassRef = useRef(0);
  const toleranceEnabledRef = useRef(false);
  const toleranceModelRef = useRef({
    position: HOME_POSE_DEG.slice(), velocity: Array(7).fill(0), target: HOME_POSE_DEG.slice(),
    direction: Array(7).fill(0), backlash: Array(7).fill(0), lastTime: performance.now(),
  });

  const [thetas, setThetasState] = useState(HOME_POSE_DEG.slice());
  const [reachFraction, setReachFraction] = useState(0.8);
  const [program, setProgram] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeWaypoint, setActiveWaypoint] = useState(-1);
  const [activeJoint, setActiveJoint] = useState(-1);
  const [pose, setPose] = useState({ pos: new THREE.Vector3(), roll: 0, pitch: 0, yaw: 0 });
  const [solving, setSolving] = useState(false);
  const [payloadMass, setPayloadMass] = useState(0);
  const [toleranceEnabled, setToleranceEnabled] = useState(false);
  const [physicsReadout, setPhysicsReadout] = useState({ maxTorqueNm: 0, tipSagMm: 0 });

  useEffect(() => {
    thetasRef.current = thetas;
  }, [thetas]);
  useEffect(() => {
    reachFractionRef.current = reachFraction;
  }, [reachFraction]);
  useEffect(() => {
    payloadMassRef.current = payloadMass;
  }, [payloadMass]);
  useEffect(() => {
    toleranceEnabledRef.current = toleranceEnabled;
  }, [toleranceEnabled]);

  function setTheta(i, val) {
    setThetasState((prev) => {
      const next = prev.slice();
      next[i] = val;
      return next;
    });
  }

  // ---- one-time three.js setup ----
  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    scene.fog = new THREE.Fog(COLORS.bg, 1800, 3400);

    const camera = new THREE.PerspectiveCamera(42, 1, 1, 8000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(700, 1000, 500);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb8ff, 0.4);
    fill.position.set(-700, 400, -500);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x5ec8d8, 0.3);
    rim.position.set(0, 300, -900);
    scene.add(rim);

    scene.add(new THREE.GridHelper(1600, 32, COLORS.gridCenter, COLORS.grid));

    const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.body, roughness: 0.42, metalness: 0.1 });
    const visualChain = buildChain(bodyMat);
    scene.add(visualChain.wrapper);
    visualChainRef.current = visualChain;

    const solverChain = buildChain(null);
    solverChainRef.current = solverChain;

    // ---- reach hemisphere: faint reference at true max reach, brighter clickable shell ----
    const shoulderY = 333;
    const rMaxReal = 850;
    const wsGeo = new THREE.SphereGeometry(1, 40, 22, 0, Math.PI * 2, 0, Math.PI / 2);
    const wsOuter = new THREE.Mesh(wsGeo, new THREE.MeshBasicMaterial({ color: COLORS.workspace, wireframe: true, transparent: true, opacity: 0.06 }));
    wsOuter.scale.setScalar(rMaxReal);
    wsOuter.position.set(0, shoulderY, 0);
    scene.add(wsOuter);
    const wsMesh = new THREE.Mesh(wsGeo, new THREE.MeshBasicMaterial({ color: COLORS.waypoint, wireframe: true, transparent: true, opacity: 0.22 }));
    scene.add(wsMesh);
    const wsHitMesh = new THREE.Mesh(wsGeo, new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(wsHitMesh);

    const markerMeshes = [];
    function syncWaypointMarkers(points) {
      while (markerMeshes.length < points.length) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), new THREE.MeshBasicMaterial({ color: COLORS.waypoint }));
        scene.add(m);
        markerMeshes.push(m);
      }
      while (markerMeshes.length > points.length) scene.remove(markerMeshes.pop());
      points.forEach((p, i) => {
        markerMeshes[i].position.set(p.x, p.y, p.z);
        markerMeshes[i].scale.setScalar(p.reachable === false ? 9 : 7);
        markerMeshes[i].material.color.set(p.reachable === false ? 0xff6b6b : COLORS.waypoint);
      });
    }

    let raf;
    let frameCount = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      const effects = payloadEffects(thetasRef.current, payloadMassRef.current);
      const loadAdjusted = thetasRef.current.map((theta, i) => theta + effects.sagDeg[i]);
      const renderedThetas = applyToleranceModel(toleranceModelRef.current, loadAdjusted, toleranceEnabledRef.current, performance.now());
      applyThetas(visualChain, renderedThetas);

      const rTarget = rMaxReal * reachFractionRef.current;
      wsMesh.scale.setScalar(rTarget);
      wsHitMesh.scale.setScalar(rTarget);
      wsMesh.position.set(0, shoulderY, 0);
      wsHitMesh.position.set(0, shoulderY, 0);

      frameCount++;
      if (frameCount % 6 === 0) {
        setPose(getEndEffectorPose(visualChain));
        setPhysicsReadout({ maxTorqueNm: effects.maxTorqueNm, tipSagMm: effects.tipSagMm });
      }

      const o = orbitRef.current;
      const target = new THREE.Vector3(0, 400, 0);
      camera.position.set(
        target.x + o.radius * Math.sin(o.phi) * Math.cos(o.theta),
        target.y + o.radius * Math.cos(o.phi),
        target.z + o.radius * Math.sin(o.phi) * Math.sin(o.theta)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    }
    animate();

    function resize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const raycaster = new THREE.Raycaster();
    function pointerPos(e) {
      const p = e.touches ? e.touches[0] : e;
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        clientX: p.clientX,
        clientY: p.clientY,
        nx: ((p.clientX - rect.left) / rect.width) * 2 - 1,
        ny: -((p.clientY - rect.top) / rect.height) * 2 + 1,
      };
    }
    function onDown(e) {
      const p = pointerPos(e);
      orbitRef.current.dragging = true;
      orbitRef.current.lastX = p.clientX;
      orbitRef.current.lastY = p.clientY;
      orbitRef.current.moved = 0;
    }
    function onMove(e) {
      if (!orbitRef.current.dragging) return;
      const p = pointerPos(e);
      const dx = p.clientX - orbitRef.current.lastX;
      const dy = p.clientY - orbitRef.current.lastY;
      orbitRef.current.moved += Math.abs(dx) + Math.abs(dy);
      orbitRef.current.lastX = p.clientX;
      orbitRef.current.lastY = p.clientY;
      orbitRef.current.theta -= dx * 0.006;
      orbitRef.current.phi = Math.min(Math.max(orbitRef.current.phi - dy * 0.006, 0.15), Math.PI - 0.15);
    }
    function onUp(e) {
      orbitRef.current.dragging = false;
      if (orbitRef.current.moved < 6 && !runningRef.current) {
        const p = pointerPos(e);
        raycaster.setFromCamera({ x: p.nx, y: p.ny }, camera);
        const hits = raycaster.intersectObject(wsHitMesh, false);
        if (hits.length) sceneApiRef.current && sceneApiRef.current.onHemisphereClick(hits[0].point);
      }
    }
    function onWheel(e) {
      e.preventDefault();
      // Zoom range in "mm" units — the real arm is roughly 850mm at full reach,
      // so this needs to allow the camera much farther out than the old
      // simplified small-scale model did. (This was the bug: it used to cap
      // out at 1100, which is barely past the arm itself.)
      orbitRef.current.radius = Math.min(Math.max(orbitRef.current.radius + e.deltaY * 1.5, 350), 4500);
    }
    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    dom.addEventListener("touchstart", onDown, { passive: true });
    dom.addEventListener("touchmove", onMove, { passive: true });
    dom.addEventListener("touchend", onUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    sceneApiRef.current = { syncWaypointMarkers, onHemisphereClick: null };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      dom.removeEventListener("touchstart", onDown);
      dom.removeEventListener("touchmove", onMove);
      dom.removeEventListener("touchend", onUp);
      dom.removeEventListener("wheel", onWheel);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sceneApiRef.current) return;
    sceneApiRef.current.onHemisphereClick = (point) => {
      const solver = solverChainRef.current;
      if (!solver) return;
      setSolving(true);
      const sol = solveIK_CCD(solver, point, thetasRef.current, 60);
      setProgram((prev) => [
        ...prev,
        { id: Date.now() + Math.random(), x: point.x, y: point.y, z: point.z, thetasDeg: sol.thetasDeg, reachable: sol.reachable },
      ]);
      setTimeout(() => setSolving(false), 260);
    };
  });

  useEffect(() => {
    sceneApiRef.current && sceneApiRef.current.syncWaypointMarkers(program);
  }, [program]);

  function animateJointTo(index, from, to, duration) {
    return new Promise((resolve) => {
      const delta = shortestDelta(from, to);
      const target = from + delta;
      const start = performance.now();
      const loadScaledDuration = duration * (1 + payloadMassRef.current * 0.035);
      function step(now) {
        if (animCtrlRef.current.cancel) {
          resolve();
          return;
        }
        const t = Math.min((now - start) / loadScaledDuration, 1);
        setTheta(index, from + delta * easeInOut(t));
        if (t < 1) requestAnimationFrame(step);
        else {
          setTheta(index, target);
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  const runProgram = useCallback(async () => {
    if (isRunning || program.length === 0) return;
    animCtrlRef.current.cancel = false;
    runningRef.current = true;
    setIsRunning(true);
    for (let w = 0; w < program.length; w++) {
      if (animCtrlRef.current.cancel) break;
      setActiveWaypoint(w);
      const targets = program[w].thetasDeg;
      for (let j = 0; j < 7; j++) {
        if (animCtrlRef.current.cancel) break;
        setActiveJoint(j);
        await animateJointTo(j, thetasRef.current[j], targets[j], 380);
        await sleep(90);
      }
    }
    setActiveJoint(-1);
    setActiveWaypoint(-1);
    setIsRunning(false);
    runningRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, program]);

  function stopProgram() {
    animCtrlRef.current.cancel = true;
  }
  function clearProgram() {
    if (!isRunning) setProgram([]);
  }
  function removeWaypoint(id) {
    if (!isRunning) setProgram((prev) => prev.filter((w) => w.id !== id));
  }

  const statusText = isRunning
    ? `EXECUTING · TARGET ${activeWaypoint + 1}/${program.length}`
    : solving
    ? "SOLVING IK…"
    : "READY";
  const statusColor = isRunning ? COLORS.accent : solving ? COLORS.cyan : "#6ee7b7";

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif", position: "relative", overflow: "hidden" }}>
      <GlobalStyle />
      <div className="bg-scan" />

      <header style={{ position: "relative", padding: "26px 32px 14px", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11.5, letterSpacing: 2, color: COLORS.textDim, fontFamily: MONO, marginBottom: 6 }}>
              ANUSHKA SIVRAM· ROBOTIC ARM SIMULATOR· BASED ON FRANKA ERIKA
            </div>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 650, letterSpacing: -0.3, textShadow: "0 0 24px rgba(94,200,216,0.25)" }}>
              7-DOF Robotic Arm Pose Visualizer &amp; Point-to-Point Programmer
            </h1>
          </div>
          <div className="status-chip" style={{ borderColor: statusColor, color: statusColor }}>
            <span className="status-dot" style={{ background: statusColor, boxShadow: `0 0 10px ${statusColor}` }} />
            <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1 }}>{statusText}</span>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", color: COLORS.textDim, maxWidth: 760, lineHeight: 1.5, fontSize: 14 }}>
          Real joint geometry and meshes from Franka Emika's official, Apache-2.0-licensed{" "}
          <code style={{ fontFamily: MONO, color: COLORS.cyan }}>franka_description</code> repository. Drag to
          orbit, scroll to zoom, move the sliders, or click the dome to teach a target.
        </p>
      </header>

      <div style={{ position: "relative", flex: 1, display: "flex", flexWrap: "wrap-reverse", gap: 20, padding: 20 }}>
        <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel accent={COLORS.accent}>
            <SectionTitle>Joint angles</SectionTitle>
            {JOINT_LABELS.map((label, i) => (
              <Slider
                key={label}
                label={label}
                value={thetas[i]}
                min={JOINT_LIMITS_DEG[i][0]}
                max={JOINT_LIMITS_DEG[i][1]}
                onChange={(v) => setTheta(i, v)}
                color={COLORS.jointColors[i]}
                disabled={isRunning}
                active={isRunning && activeJoint === i}
              />
            ))}
            <PresetButton onClick={() => setThetasState(HOME_POSE_DEG.slice())} disabled={isRunning}>
              ⌂ Home — Franka's real ready pose
            </PresetButton>
          </Panel>

          <Panel accent={COLORS.cyan}>
            <SectionTitle>Reality model</SectionTitle>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.5 }}>
              A simplified quasi-static payload model adds gravity torque and elastic joint deflection to the rendered arm.
            </p>
            <Slider
              label="Payload mass"
              value={payloadMass}
              min={0}
              max={12}
              onChange={setPayloadMass}
              color={COLORS.cyan}
              unit="kg"
              disabled={isRunning}
            />
            <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: isRunning ? "not-allowed" : "pointer", fontSize: 12.5, lineHeight: 1.45, color: COLORS.textDim }}>
              <input
                type="checkbox"
                checked={toleranceEnabled}
                disabled={isRunning}
                onChange={(event) => setToleranceEnabled(event.target.checked)}
                style={{ marginTop: 3, accentColor: COLORS.cyan }}
              />
              <span><strong style={{ color: COLORS.text }}>Simulate real-world tolerances</strong><br />Backlash deadband, damping, and settling are applied to the visual joints.</span>
            </label>
            <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.panelBorder}`, paddingTop: 8 }}>
              <Readout label="Peak gravity torque" value={`${physicsReadout.maxTorqueNm.toFixed(1)} Nm`} />
              <Readout label="Estimated tip sag" value={`${physicsReadout.tipSagMm.toFixed(1)} mm`} />
            </div>
          </Panel>

          <Panel accent={COLORS.cyan}>
            <SectionTitle>End effector (flange)</SectionTitle>
            <Readout label="X" value={`${pose.pos.x.toFixed(1)} mm`} />
            <Readout label="Y (height)" value={`${pose.pos.y.toFixed(1)} mm`} />
            <Readout label="Z" value={`${pose.pos.z.toFixed(1)} mm`} />
            <Readout label="Roll" value={`${pose.roll.toFixed(1)}°`} />
            <Readout label="Pitch" value={`${pose.pitch.toFixed(1)}°`} />
            <Readout label="Yaw" value={`${pose.yaw.toFixed(1)}°`} />
          </Panel>
        </div>

          <div className="viewport-frame" style={{ flex: "1 1 480px", minWidth: 320, minHeight: 480 }}>
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
          <div className="viewport-label">LIVE VIEWPORT · DRAG TO ORBIT · SCROLL TO ZOOM · PAYLOAD-AWARE</div>
          <div ref={mountRef} style={{ width: "100%", height: "100%", minHeight: 480 }} />
        </div>

        <div style={{ width: 280, flexShrink: 0 }}>
          <Panel accent={COLORS.waypoint}>
            <SectionTitle>Motion program</SectionTitle>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.5 }}>
              Click the bright inner shell to add a target. A numerical solver finds joint angles
              that reach it, sweeping through the real arm's redundancy the way its own
              controller would.
            </p>

            <Slider
              label="Target shell depth"
              value={reachFraction * 100}
              min={30}
              max={98}
              onChange={(v) => setReachFraction(v / 100)}
              color={COLORS.waypoint}
              unit="% of max reach"
              disabled={isRunning}
            />

            {program.length === 0 && (
              <div style={{ fontSize: 12.5, color: COLORS.textDim, fontStyle: "italic", padding: "8px 0" }}>
                No targets yet — click the dome.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {program.map((wp, i) => (
                <div key={wp.id} className={`waypoint-row${activeWaypoint === i ? " waypoint-active" : ""}`}>
                  <span className="waypoint-index">{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontFamily: MONO, flex: 1 }}>
                    ({wp.x.toFixed(0)}, {wp.y.toFixed(0)}, {wp.z.toFixed(0)})
                    {wp.reachable === false && <span style={{ color: "#ff8080" }}> ⚠</span>}
                  </span>
                  <button onClick={() => removeWaypoint(wp.id)} disabled={isRunning} className="icon-btn">
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {!isRunning ? (
                <PresetButton onClick={runProgram} disabled={program.length === 0} primary>
                  Run program
                </PresetButton>
              ) : (
                <PresetButton onClick={stopProgram}>Stop</PresetButton>
              )}
              <PresetButton onClick={clearProgram} disabled={isRunning || program.length === 0}>
                Clear
              </PresetButton>
            </div>

            {isRunning && activeWaypoint >= 0 && (
              <div style={{ fontSize: 12.5, fontFamily: MONO, color: COLORS.accent, lineHeight: 1.6 }}>
                Target #{activeWaypoint + 1} of {program.length}
                <br />
                Rotating: {activeJoint >= 0 ? JOINT_LABELS[activeJoint] : "—"}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <footer style={{ position: "relative", padding: "16px 32px 28px", borderTop: `1px solid ${COLORS.panelBorder}` }}>
        <div style={{ fontSize: 11.5, letterSpacing: 1.5, color: COLORS.textDim, fontFamily: MONO, marginBottom: 8 }}>
          ▸ WHY THIS NEEDED A DIFFERENT SOLVER
        </div>
        <p style={{ margin: 0, color: COLORS.textDim, fontSize: 13.5, lineHeight: 1.6, maxWidth: 840 }}>
          The earlier version of this arm was a simplified 5-joint planar-plus-yaw model, which has
          a clean closed-form (law-of-cosines) inverse kinematics solution. The real Franka chain
          isn't planar. Instead joints 2, 4, and 6 twist the arm out of any single plane so there's no
          simple formula for "which angles reach this point." Instead this uses Cyclic Coordinate
          Descent: starting from the wrist and working back to the base, it repeatedly swings one
          joint at a time to nudge the end effector closer to the target, converging over about
          sixty passes. It's a real, standard numerical inverse-kinematics method, just simple
          enough to run instantly for every click.
          The optional reality model is a transparent, educational approximation: it estimates gravity-induced joint torque and deflection from payload mass, then models gearbox reversal deadband and damped settling. It is not a substitute for measured stiffness, motor data, or finite-element analysis.
        </p>
      </footer>
         <ResearchNotes />
    </div>
  );
}
