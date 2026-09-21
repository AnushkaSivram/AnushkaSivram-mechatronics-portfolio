"""Cycloidal actuator concept trade study; substitute catalog motor values as needed."""
from __future__ import annotations
import csv
from pathlib import Path

CONTINUOUS_TORQUE, PEAK_TORQUE, MOTOR_INERTIA = 0.42, 1.25, 8.0e-5
EFFICIENCY, MESH_STIFFNESS = 0.82, 1.8e4

def main() -> None:
    rows = []
    for ratio in range(11, 82, 5):
        for rpm in range(500, 6001, 500):
            torque = CONTINUOUS_TORQUE * ratio * EFFICIENCY
            rows.append({"reduction": ratio, "motor_rpm": rpm, "output_rpm": round(rpm / ratio, 1), "continuous_output_Nm": round(torque, 2), "peak_output_Nm": round(PEAK_TORQUE * ratio * EFFICIENCY, 2), "reflected_inertia_kgm2": f"{MOTOR_INERTIA * ratio * ratio:.5f}", "torsional_twist_deg": round(torque / MESH_STIFFNESS * 57.2958, 3)})
    out = Path(__file__).with_name("actuator_map.csv")
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
    print(f"Wrote {out.name}; {len(rows)} operating points.")

if __name__ == "__main__": main()
