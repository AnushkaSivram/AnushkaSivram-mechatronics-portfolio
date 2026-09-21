# Virtual Self-Balancing Robot Leg

Simulates an inverted pendulum (a leg/body) on a moving platform. A state-feedback controller acts through a torque-controlled hip joint and counteracts platform motion and gravity. The implementation is dependency-free; swap the plant layer for PyBullet or MuJoCo later while keeping the controller interface.

Run `python3 simulate.py` to generate `balance_response.csv`. The controller gains are deliberately exposed near the top of the script for tuning experiments.
