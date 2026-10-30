
import { buildLevel, buildMeetGuides, reach, T } from "../js/world.js";
import { LEVELS } from "../js/levels.js";
let bad=[];
for (let n=1;n<=LEVELS.length;n++){
  let M; try { M = buildLevel(n); } catch(e){ bad.push(n+": THROW "+e.message+" "+e.stack.split("\n")[1]); continue; }
  const boat = ["lake","islets","channel"].includes(M.L.style);
  if(M.objs.filter(o=>o.guru).length!==1||M.objs.filter(o=>o.affirmation).length!==1||M.objs.filter(o=>o.checkin).length!==1||M.objs.filter(o=>o.reassurer).length!==1)bad.push(n+" "+M.L.name+": missing or duplicate guide/check-in/reassurance/chest");
  // toggles: treat twalls as open
  const saved = M.objs.map(o=>o.solid); M.objs.forEach(o=>{ if(o.kind==="twall") o.solid=false; });
  const seen = reach(M,{openAll:true, boat, stones:true});
  M.objs.forEach((o,i)=>o.solid=saved[i]);
  const ex = seen[M.exit.y*M.W+M.exit.x+1] || seen[M.exit.y*M.W+M.exit.x];
  // every interactable must be adjacent to a reachable tile
  const unreached = M.objs.filter(o=>!["gate","twall","landmark"].includes(o.kind)).filter(o=>{
    for (const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) { const x=o.tx+dx,y=o.ty+dy; if (M.in(x,y)&&seen[y*M.W+x]) return false; } return true; });
  if (!ex || unreached.length) bad.push(n+" "+M.L.name+": exit="+!!ex+" unreached="+unreached.map(o=>o.kind+(o.sub?":"+o.sub:"")+"@"+o.tx+","+o.ty).join(" "));
}
const hall=buildMeetGuides(),hallSeen=reach(hall);for(const kind of ["guru","checkin","reassurer"])if(hall.objs.filter(o=>o[kind]).length!==162)bad.push("Meet the Gurus: expected 162 "+kind+" NPCs");if(hall.objs.filter(o=>o.roamer).length!==486)bad.push("Meet the Gurus: all 486 guides should wander");if(hall.objs.some(o=>!hallSeen[o.ty*hall.W+o.tx]))bad.push("Meet the Gurus: an NPC is unreachable");
console.log(bad.length? bad.join("\n") : "ALL OK");
