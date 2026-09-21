"""Closed-loop inverted-pendulum leg on a laterally moving platform."""
from __future__ import annotations
import csv
from math import sin, cos
from pathlib import Path

M, L, G, DAMPING = 18.0, .72, 9.80665, .55
I = M * L * L
DT, END, MAX_TORQUE = .002, 12.0, 130.0
# State feedback [angle, angular rate, platform displacement, platform velocity].
K = (520.0, 145.0, 90.0, 72.0)

def platform(t: float) -> tuple[float, float, float]:
    """Conveyor/skateboard motion: displacement, velocity, acceleration."""
    a, w = .10, 2.4
    return a*sin(w*t), a*w*cos(w*t), -a*w*w*sin(w*t)

def main() -> None:
    theta, omega, rows = .09, 0.0, []
    for n in range(int(END / DT)):
        t=n*DT; x, v, a=platform(t)
        torque=max(-MAX_TORQUE, min(MAX_TORQUE, -(K[0]*theta+K[1]*omega+K[2]*x+K[3]*v)))
        # Nonlinear pendulum with horizontal base acceleration disturbance.
        alpha=(M*G*L*sin(theta)-M*L*a*cos(theta)-DAMPING*omega+torque)/I
        omega += alpha*DT; theta += omega*DT
        if n % 10 == 0: rows.append({"time_s":round(t,3),"angle_deg":round(theta*57.2958,3),"platform_mm":round(x*1000,2),"torque_Nm":round(torque,2),"angular_rate_rads":round(omega,3)})
    out=Path(__file__).with_name("balance_response.csv")
    with out.open("w",newline="") as f: w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
    peak=max(abs(r["angle_deg"]) for r in rows)
    print(f"Wrote {out.name}. Peak balance error: {peak:.2f} degrees.")

if __name__ == "__main__": main()
