"""Lumped electro-thermal BLDC + gearbox digital twin."""
from __future__ import annotations
import csv
from pathlib import Path

KT, KE, R = .085, .085, .18      # Nm/A, V/(rad/s), ohm
RATIO, ETA, THERMAL_R, THERMAL_C = 35., .80, 1.9, 190.
AMBIENT, BUS_VOLTAGE, DT, END = 25., 48., .05, 600.

def command(t: float) -> tuple[float,float]:
    """Output torque and speed demand: repeat heavy 20 s / light 40 s cycle."""
    phase=t%60
    return (16.0, 3.2) if phase < 20 else (4.0, 1.0)

def main() -> None:
    temp=AMBIENT; rows=[]
    for n in range(int(END/DT)):
        t=n*DT; out_torque, out_speed=command(t); motor_speed=out_speed*RATIO
        motor_torque=out_torque/(RATIO*ETA); current=motor_torque/KT
        back_emf=KE*motor_speed; voltage=back_emf+current*R
        copper=current*current*R; mechanical=max(0., motor_torque*motor_speed); gearbox_loss=mechanical*(1-ETA)
        heat=copper+gearbox_loss; temp += ((heat-(temp-AMBIENT)/THERMAL_R)/THERMAL_C)*DT
        if n%10==0: rows.append({"time_s":round(t,1),"output_torque_Nm":out_torque,"motor_current_A":round(current,2),"estimated_voltage_V":round(voltage,2),"bus_margin_V":round(BUS_VOLTAGE-voltage,2),"heat_W":round(heat,1),"winding_temp_C":round(temp,2)})
    out=Path(__file__).with_name("thermal_twin.csv")
    with out.open("w",newline="") as f: w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
    print(f"Wrote {out.name}. Peak modeled winding temperature: {max(r['winding_temp_C'] for r in rows):.1f} °C.")

if __name__ == "__main__": main()
