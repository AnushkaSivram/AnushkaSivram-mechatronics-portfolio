import React from "react";
import { MONO, COLORS } from "../styles/theme.js";

export default function Slider({ label, value, min, max, onChange, color, unit, disabled, active }) {
  return (
    <div style={{ marginBottom: 10, opacity: disabled && !active ? 0.5 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
        <span style={{ color: active ? "#fff" : undefined, fontWeight: active ? 600 : 400 }}>{label}</span>
        <span style={{ fontFamily: MONO, color }}>
          {value.toFixed(0)}
          {unit ? ` ${unit}` : "°"}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", color, outline: active ? `2px solid ${COLORS.accent}` : "none", borderRadius: 4 }}
      />
    </div>
  );
}
