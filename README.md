# Mechatronics Portfolio Suite

Eight standalone, simulation-first portfolio projects. Each folder contains its own runnable Python model and README. Parameters live at the top of each script and results are written as CSV.

```bash
cd <project-folder>
python3 simulate.py
```

Projects: robotic gripper, high-torque actuator, quarter-car suspension, non-pyrotechnic deployment mechanism, balancing leg, motor thermal twin, robotic wrist stress screen, and dynamic obstacle-avoiding arm planner.

## Deploy each simulator

Every project folder includes a standalone `index.html`. On Netlify, import this GitHub repository, create a site per simulator, set the site's **Base directory** to its folder (for example `balancing-leg`), leave the build command blank, and publish `.`. The sites use no build tools or server code.

These are engineering prototypes, not certified hardware designs. Validate physical designs with qualified review, measured material data, and appropriate safety procedures before fabrication or use.
