import React from "react";
import { COLORS, MONO } from "../styles/theme.js";

export default function GlobalStyle() {
  return (
    <style>{`
      @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      @keyframes scan-move { 0% { background-position: 0 0; } 100% { background-position: 0 480px; } }
      .bg-scan {
        position: absolute; inset: 0; pointer-events: none; z-index: 0;
        background-image: repeating-linear-gradient(rgba(94,200,216,0.035) 0px, rgba(94,200,216,0.035) 1px, transparent 1px, transparent 3px);
        animation: scan-move 14s linear infinite;
        opacity: 0.5;
      }
      .status-chip {
        display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 10px;
        border: 1px solid; border-radius: 999px; background: rgba(255,255,255,0.03);
      }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; animation: pulse-dot 1.6s ease-in-out infinite; }
      .panel {
        background: ${COLORS.panel}; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        border: 1px solid ${COLORS.panelBorder}; border-radius: 12px; padding: 18px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.25); position: relative; overflow: hidden;
        transition: border-color 0.25s ease;
      }
      .panel:hover { border-color: rgba(255,255,255,0.28); }
      .panel::before {
        content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
        background: var(--accent, ${COLORS.cyan}); opacity: 0.7;
      }
      .viewport-frame {
        position: relative; border-radius: 12px; overflow: hidden;
        background: ${COLORS.panel}; border: 1px solid ${COLORS.panelBorder};
        box-shadow: 0 0 0 1px rgba(94,200,216,0.05), 0 20px 60px rgba(0,0,0,0.35);
      }
      .viewport-label {
        position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
        font-family: ${MONO}; font-size: 10px; letter-spacing: 1.5px; color: ${COLORS.textDim};
        background: rgba(7,13,22,0.55); padding: 3px 10px; border-radius: 999px; z-index: 2;
        border: 1px solid rgba(255,255,255,0.08); pointer-events: none;
      }
      .corner { position: absolute; width: 22px; height: 22px; z-index: 2; opacity: 0.8; pointer-events: none; }
      .corner.tl { top: 10px; left: 10px; border-top: 2px solid ${COLORS.cyan}; border-left: 2px solid ${COLORS.cyan}; }
      .corner.tr { top: 10px; right: 10px; border-top: 2px solid ${COLORS.cyan}; border-right: 2px solid ${COLORS.cyan}; }
      .corner.bl { bottom: 10px; left: 10px; border-bottom: 2px solid ${COLORS.cyan}; border-left: 2px solid ${COLORS.cyan}; }
      .corner.br { bottom: 10px; right: 10px; border-bottom: 2px solid ${COLORS.cyan}; border-right: 2px solid ${COLORS.cyan}; }
      input[type="range"] {
        -webkit-appearance: none; height: 4px; border-radius: 3px; background: rgba(255,255,255,0.12);
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
        background: currentColor; border: 2px solid rgba(7,13,22,0.9); cursor: pointer;
        box-shadow: 0 0 8px currentColor; transition: transform 0.15s ease;
      }
      input[type="range"]:hover::-webkit-slider-thumb { transform: scale(1.2); }
      input[type="range"]:disabled::-webkit-slider-thumb { box-shadow: none; }
      .preset-btn { transition: all 0.18s ease; cursor: pointer; }
      .preset-btn:not(:disabled):hover {
        background: rgba(255,180,84,0.1) !important; border-color: ${COLORS.accent} !important;
        color: ${COLORS.accent} !important; box-shadow: 0 0 14px rgba(255,180,84,0.15);
      }
      .icon-btn { background: none; border: none; color: ${COLORS.textDim}; cursor: pointer; font-size: 14px; padding: 0 4px; transition: color 0.15s ease; }
      .icon-btn:not(:disabled):hover { color: #ff8080; }
      .waypoint-row {
        display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px;
        background: rgba(255,255,255,0.02); border: 1px solid ${COLORS.panelBorder}; font-size: 12.5px;
        transition: all 0.2s ease;
      }
      .waypoint-active { background: rgba(255,180,84,0.12); border-color: ${COLORS.accent}; }
      .waypoint-index { font-family: ${MONO}; font-size: 10px; color: ${COLORS.textDim}; letter-spacing: 1px; }
    `}</style>
  );
}
