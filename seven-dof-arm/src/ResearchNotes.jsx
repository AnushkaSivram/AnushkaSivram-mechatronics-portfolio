import React from "react";
import { COLORS, MONO, SANS } from "../styles/theme.js";

// A longer-form "what I actually learned" writeup, meant to sit below the
// simulator. Styled to match the rest of the site but laid out for reading
// (narrower column, normal paragraph rhythm) rather than as a control panel.
export default function ResearchNotes() {
  return (
    <section
      style={{
        position: "relative",
        maxWidth: 860,
        margin: "0 auto",
        padding: "40px 32px 80px",
        color: COLORS.text,
        fontFamily: SANS,
        lineHeight: 1.7,
      }}
    >
      <div style={{ fontSize: 11.5, letterSpacing: 2, color: COLORS.textDim, fontFamily: MONO, marginBottom: 10 }}>
        TECHNICAL NOTES
      </div>
      <h2 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 650 }}>
        What building this actually required understanding
      </h2>
      <p style={{ color: COLORS.textDim, fontSize: 14.5, marginBottom: 32 }}>
        This project started as a flat, planar arm sketch and grew into a simulator driven by the
        real 7-joint kinematics of the Franka Emika research arm. Getting there meant working
        through several core robotics and computational-geometry concepts, summarized below.
      </p>

      <Note title="Degrees of freedom, precisely">
        A rigid object's pose in 3D space has exactly six independent quantities: three for
        position (X, Y, Z) and three for orientation (roll, pitch, yaw which is rotation about each of
        three axes). To place a tool at <em>any</em> position with <em>any</em> orientation, an
        arm needs at least six independently actuated joints where one degree of freedom is not
        interchangeable with another; you cannot substitute an extra position joint for a missing
        orientation joint. The Franka arm this project models has <strong>seven</strong> joints —
        one more than the strict minimum. That seventh joint doesn't add new reachable poses; it
        adds <em>redundancy</em>, discussed below.
      </Note>

      <Note title="Forward kinematics: why the arm isn't flat">
        Forward kinematics means computing where the end effector ends up, given a set of joint
        angles. It works by chaining together rigid transformations — one per joint — from the
        base out to the tool. Each link in this arm is defined by a fixed offset <em>and a fixed
        twist</em> relative to the joint before it, taken directly from Franka's own published
        kinematic parameters. Joints 2, 4, and 6 each introduce a 90° twist. That twisting is the
        entire reason the arm curls through three dimensions the way it does — an earlier version
        of this project modeled the arm as flat (every joint bending in the same plane, plus one
        rotation at the base), which is mechanically much simpler but cannot reproduce this motion
        at all. The twists are what let seven simple hinges reach a genuinely three-dimensional
        volume of positions and orientations instead of a single flat fan of motion.
      </Note>

      <Note title="Inverse kinematics: the harder direction">
        The reverse problem — given a target position, what joint angles reach it — is
        substantially harder, and it's where this project's approach changed the most.
        <br />
        <br />
        For a simple 2-link planar arm, this has a clean closed-form answer via the law of
        cosines: knowing the two link lengths and the distance to the target fully determines the
        elbow angle, and the base angle follows from there. This is exact, fast, and was the first
        solver this project used.
        <br />
        <br />
        A spatial 7-joint chain has no equivalent clean formula in general — the equations for each
        joint's contribution are coupled together through the twists mentioned above, and solving
        them simultaneously in closed form is only tractable for specific arm geometries designed
        to make it possible (this arm's real controller does have one, but it's beyond the math
        appropriate here). Instead, this project uses{" "}
        <strong>Cyclic Coordinate Descent (CCD)</strong>, a standard numerical method: starting
        from the wrist and sweeping back to the base, it repeatedly asks one joint, "if I could
        only rotate you, how far would that close the gap to the target?" — computes that angle
        using vector projection onto the plane the joint can actually rotate within, applies it,
        and moves to the next joint. Repeated over roughly sixty passes, this converges to a
        solution quickly enough to run instantly on every click.
      </Note>

      <Note title="Redundancy and why more joints isn't just 'more precise'">
        With seven joints solving for a six-number target (position + orientation), there's one
        leftover degree of freedom — meaning, in general, infinitely many joint configurations
        reach the exact same end-effector pose. Physically, you can watch this by fixing your hand
        in place and moving your elbow around in a circle without your hand moving at all; a human
        arm has the same redundancy for the same reason (seven major joints — shoulder, elbow,
        wrist — controlling a six-number hand pose). Real robot controllers exploit this "self
        motion" deliberately, using the spare freedom to dodge obstacles or avoid awkward
        configurations while keeping the tool exactly where it needs to be. The CCD solver used
        here doesn't optimize across that whole family of solutions — it just finds one — which is
        an honest simplification worth stating rather than glossing over.
      </Note>

      <Note title="Joint limits and singular configurations">
        Every joint's range of motion in this simulator is taken directly from Franka's published
        specifications, not invented — for example, the elbow joint can only travel from about
        -176° to -4°, reflecting the physical geometry of the real motor housing. Respecting these
        limits matters beyond realism: it's also what keeps the arm out of{" "}
        <strong>singular configurations</strong> — poses (like being fully outstretched) where the
        arm temporarily loses a degree of freedom because two or more joints end up rotating around
        effectively the same axis. An earlier version of this project always drove the arm to full
        extension to reach its targets, which is precisely a singularity; switching to targets
        within the arm's interior volume, rather than its outer boundary, was what let the elbow
        bend naturally instead of locking straight.
      </Note>

      <Note title="A computational-geometry lesson, unexpectedly">
        Incorporating Franka's real 3D mesh files surfaced a separate, non-kinematic problem:
        the source files stored every triangle with its own private vertices, even where surfaces
        touched, so nothing was recognized as connected. Simplifying meshes like that produces
        garbage — decimation collapses points based on raw distance with no sense of which
        triangles actually belong to the same surface. The fix was to weld coincident vertices
        first (reconstructing the mesh's real topology), discard small disconnected fragments
        (screws, decals) that don't matter at this scale, and only then simplify. It's a detail
        that has nothing to do with robotics specifically, but everything to do with why 3D
        assets exported from one tool don't always behave in another without a cleanup pass.
      </Note>

      <p style={{ color: COLORS.textDim, fontSize: 13, marginTop: 40, paddingTop: 20, borderTop: `1px solid ${COLORS.panelBorder}` }}>
        Kinematic parameters and mesh geometry sourced from Franka Emika's official,
        Apache-2.0-licensed <code style={{ fontFamily: MONO, color: COLORS.cyan }}>franka_description</code> repository.
      </p>
    </section>
  );
}

function Note({ title, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          margin: "0 0 8px",
          paddingLeft: 12,
          borderLeft: `3px solid ${COLORS.accent}`,
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, color: COLORS.text, fontSize: 14.5 }}>{children}</p>
    </div>
  );
}
