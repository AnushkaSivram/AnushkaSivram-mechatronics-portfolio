import React from "react";
import { MONO, COLORS } from "../styles/theme.js";

export default function Readout({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
      <span style={{ color: COLORS.textDim }}>{label}</span>
      <span style={{ fontFamily: MONO }}>{value}</span>
    </div>
  );
}
