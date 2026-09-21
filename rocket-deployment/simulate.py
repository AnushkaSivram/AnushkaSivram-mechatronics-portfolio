"""Low-energy door deployment dynamics for a conceptual payload enclosure."""
from __future__ import annotations
import csv
from pathlib import Path

INERTIA, SPRING_K, PRELOAD, HINGE_DAMPING = .018, .30, .75, .028
OPPOSING_LOAD_NM, OPEN_ANGLE_RAD, DT = .11, 1.57, .001

def main() -> None:
    theta=omega=t=0.; rows=[]
    while t < 2.0 and theta < OPEN_ANGLE_RAD:
        torque=max(0., PRELOAD-SPRING_K*theta)-HINGE_DAMPING*omega-OPPOSING_LOAD_NM
        alpha=torque/INERTIA; omega=max(0.,omega+alpha*DT); theta+=omega*DT; t+=DT
        if int(t*1000)%10==0: rows.append({"time_s":round(t,3),"door_angle_deg":round(theta*57.2958,2),"angular_velocity_rads":round(omega,3),"net_torque_Nm":round(torque,3)})
    out=Path(__file__).with_name("deployment_response.csv")
    with out.open("w",newline="") as f: w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
    print(f"Wrote {out.name}. {'Opened' if theta >= OPEN_ANGLE_RAD else 'Did not open'} in {t:.3f} s.")

if __name__ == "__main__": main()
