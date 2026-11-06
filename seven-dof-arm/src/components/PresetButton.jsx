import React from "react";
import { SANS, COLORS } from "../styles/theme.js";

export default function PresetButton({ onClick, children, disabled, primary }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="preset-btn"
      style={{
        padding: "7px 12px",
        borderRadius: 6,
        border: `1px solid ${primary ? COLORS.accent : COLORS.panelBorder}`,
        background: primary ? "rgba(255,180,84,0.14)" : "transparent",
        color: disabled ? COLORS.textDim : primary ? COLORS.accent : COLORS.textDim,
        fontSize: 12.5,
        fontFamily: SANS,
        opacity: disabled ? 0.5 : 1,
        flex: 1,
        marginTop: 6,
      }}
    >
      {children}
    </button>
  );
}
