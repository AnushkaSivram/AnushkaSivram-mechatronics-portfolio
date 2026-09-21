"""Transparent, simulation-only 2-DOF quarter-car model."""
from __future__ import annotations
import csv
from math import sin, pi
from pathlib import Path

MS, MU, KS, CS, KT = 300.0, 42.0, 28000.0, 2200.0, 210000.0
DT, END = 0.0005, 4.0

def road(t: float) -> float:
    return .05 * sin(pi * (t-.5)/.15) if .5 <= t <= .65 else 0.0

def main() -> None:
    zs = zus = vs = vus = 0.0; rows=[]
    for n in range(int(END/DT)):
        t=n*DT; zr=road(t); fs=KS*(zs-zus)+CS*(vs-vus); ft=KT*(zus-zr)
        accs=-fs/MS; accu=(fs-ft)/MU
        vs += accs*DT; vus += accu*DT; zs += vs*DT; zus += vus*DT
        if n % 10 == 0: rows.append({"time_s":round(t,4),"road_mm":round(zr*1000,2),"body_mm":round(zs*1000,3),"wheel_mm":round(zus*1000,3),"body_accel_mps2":round(accs,3),"tire_force_N":round(ft,1)})
    out=Path(__file__).with_name("suspension_response.csv")
    with out.open("w",newline="") as f: w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
    print(f"Wrote {out.name}. Peak body acceleration: {max(abs(r['body_accel_mps2']) for r in rows):.2f} m/s²")

if __name__ == "__main__": main()
