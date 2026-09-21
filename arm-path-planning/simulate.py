"""Dependency-free RRT* task-space planner with moving-obstacle prediction."""
from __future__ import annotations
import csv, math, random
from dataclasses import dataclass
from pathlib import Path

random.seed(7); START=(-.75,-.55,.25); GOAL=(.75,.65,.70); STEP=.16; CLEAR=.10
@dataclass
class Node: p: tuple[float,float,float]; parent: int; cost: float
OBSTACLES=[((0.,0.,.42),(.06,.02,0.),.18), ((.28,.18,.62),(-.04,.00,0.),.14)]
def d(a,b): return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))
def add(a,b,s):
    q=d(a,b); return tuple(x+(y-x)*min(1,s/q) for x,y in zip(a,b))
def blocked(a,b):
    for center,vel,r in OBSTACLES:
        # Conservative prediction over the 1 s local horizon.
        c=tuple(center[i]+vel[i] for i in range(3)); ab=d(a,b)
        for k in range(9):
            p=add(a,b,ab*k/8)
            if d(p,c) < r+CLEAR: return True
    return False
def main() -> None:
    nodes=[Node(START,-1,0.)]; goal_i=None
    for iteration in range(3500):
        target=GOAL if iteration%8==0 else tuple(random.uniform(-.9,.9) for _ in range(3))
        nearest=min(range(len(nodes)),key=lambda i:d(nodes[i].p,target)); point=add(nodes[nearest].p,target,STEP)
        if blocked(nodes[nearest].p,point): continue
        near=[i for i,n in enumerate(nodes) if d(n.p,point)<.35 and not blocked(n.p,point)]
        parent=min(near+[nearest],key=lambda i:nodes[i].cost+d(nodes[i].p,point)); ni=len(nodes)
        nodes.append(Node(point,parent,nodes[parent].cost+d(nodes[parent].p,point)))
        for i in near:
            proposed=nodes[ni].cost+d(nodes[ni].p,nodes[i].p)
            if proposed<nodes[i].cost: nodes[i].parent=ni; nodes[i].cost=proposed
        if d(point,GOAL)<STEP and not blocked(point,GOAL): nodes.append(Node(GOAL,ni,nodes[ni].cost+d(point,GOAL)));goal_i=len(nodes)-1;break
    if goal_i is None: raise RuntimeError("No collision-free path; increase samples or workspace.")
    path=[]
    while goal_i>=0: path.append(nodes[goal_i].p); goal_i=nodes[goal_i].parent
    path.reverse(); out=Path(__file__).with_name("planned_path.csv")
    with out.open("w",newline="") as f:
        w=csv.DictWriter(f,fieldnames=("waypoint","x_m","y_m","z_m"));w.writeheader();w.writerows({"waypoint":i,"x_m":round(p[0],4),"y_m":round(p[1],4),"z_m":round(p[2],4)} for i,p in enumerate(path))
    print(f"Wrote {out.name}. {len(path)} waypoints; path length {sum(d(a,b) for a,b in zip(path,path[1:])):.2f} m.")

if __name__ == "__main__": main()
