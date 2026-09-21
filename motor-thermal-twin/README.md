# BLDC + Cycloidal Gearbox Thermal Digital Twin

Models a torque-controlled BLDC motor driving a gearbox through a duty cycle. It computes back-EMF, current, copper loss, gearbox loss, and a lumped winding temperature. Substitute a real motor's `KT`, `KE`, resistance, and thermal values to turn this into a data-sheet-backed study.

Run `python3 simulate.py` to generate `thermal_twin.csv`.
