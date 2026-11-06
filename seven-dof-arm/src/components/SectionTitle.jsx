import React from "react";
import { MONO, COLORS } from "../styles/theme.js";

export default function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 0.8, color: COLORS.textDim, fontFamily: MONO, margin: "0 0 10px" }}>
      {children.toString().toUpperCase()}
    </div>
  );
}
