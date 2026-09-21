# 3-DOF Robotic Wrist Stress Screening

Creates a simulation-ready load case for a 3-DOF wrist under a 50 lbf (222 N) tip load. This project is an analytical beam-stress *screening model*, not a replacement for validated finite-element analysis. It exports a stress field CSV that can be compared against a SimScale or CalculiX mesh result.

Run `python3 simulate.py` to create `wrist_stress_field.csv`. The most important portfolio extension is to import a CAD bracket to an FEA solver, use the identical load case, and document mesh convergence against this conservative calculation.
