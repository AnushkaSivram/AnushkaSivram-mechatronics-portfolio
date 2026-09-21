"""Analytical stress-screening model for a wrist-yoke load path."""
from __future__ import annotations
import csv
from pathlib import Path

LOAD_N, ARM_M, WIDTH_M, HEIGHT_M = 222.4, .115, .042, .018
YIELD_MPA, N = 275., 31

def main() -> None:
    # Rectangular yoke section: sigma = M*y/I; include a simple 1.8 notch factor at root.
    inertia=WIDTH_M*HEIGHT_M**3/12; rows=[]
    for ix in range(N):
        x=ARM_M*ix/(N-1); moment=LOAD_N*(ARM_M-x)
        for iy in range(N):
            y=-HEIGHT_M/2+HEIGHT_M*iy/(N-1)
            notch=1.8 if x < .018 and abs(y) > .006 else 1.0
            stress=abs(moment*y/inertia)*notch/1e6
            rows.append({"x_mm":round(x*1000,2),"y_mm":round(y*1000,2),"von_mises_proxy_MPa":round(stress,2),"yield_safety_factor":round(YIELD_MPA/max(stress,.001),2),"topology_keep":int(stress > YIELD_MPA/6)})
    out=Path(__file__).with_name("wrist_stress_field.csv")
    with out.open("w",newline="") as f: w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
    peak=max(r['von_mises_proxy_MPa'] for r in rows)
    print(f"Wrote {out.name}. Peak screening stress: {peak:.1f} MPa; yield factor: {YIELD_MPA/peak:.2f}.")

if __name__ == "__main__": main()
