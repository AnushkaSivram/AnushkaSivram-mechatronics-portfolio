# 7-DOF Arm Dynamic Obstacle-Avoidance Planner

This project uses a compact 3D RRT* implementation to plan an end-effector path around spherical obstacles. Obstacles are predicted forward to a planning horizon, then the tree is rewired for lower-cost routes. The model works in task space; a production 7-DOF implementation would feed the waypoints to inverse kinematics and perform link-level collision checks.

Run `python3 simulate.py` to write `planned_path.csv`. It is deterministic via a fixed random seed, making its result easy to review in version control.
