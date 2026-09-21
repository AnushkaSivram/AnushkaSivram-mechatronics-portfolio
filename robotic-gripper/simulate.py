"""Early sizing model for a parallel-jaw robotic gripper."""
from __future__ import annotations
import csv
from pathlib import Path

MOTOR_TORQUE_NM, GEAR_RATIO, EFFICIENCY = 1.1, 20.0, 0.78
PINION_RADIUS_M, FRICTION, SAFETY_FACTOR = 0.009, 0.55, 2.0
FINGER_LENGTH_M, FINGER_SECTION_MODULUS_M3 = 0.070, 1.6e-8

def main() -> None:
    output = Path(__file__).with_name("gripper_sweep.csv")
    actuator_force = MOTOR_TORQUE_NM * GEAR_RATIO * EFFICIENCY / PINION_RADIUS_M
    rows = []
    for opening_mm in range(20, 101, 5):
        transmission = 0.50 + 0.42 * (1 - (opening_mm - 20) / 80)
        normal_per_jaw = actuator_force * transmission / 2
        payload_kg = 2 * normal_per_jaw * FRICTION / (9.80665 * SAFETY_FACTOR)
        stress = normal_per_jaw * FINGER_LENGTH_M / FINGER_SECTION_MODULUS_M3 / 1e6
        rows.append({"opening_mm": opening_mm, "normal_force_per_jaw_N": round(normal_per_jaw, 1), "safe_payload_kg": round(payload_kg, 2), "finger_stress_MPa": round(stress, 1)})
    with output.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys()); writer.writeheader(); writer.writerows(rows)
    best = max(rows, key=lambda r: r["safe_payload_kg"])
    print(f"Wrote {output.name}. Peak modeled payload: {best['safe_payload_kg']} kg at {best['opening_mm']} mm.")

if __name__ == "__main__": main()
