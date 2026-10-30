// Builds a playable tile map for each level from its data entry.
import { LEVELS } from "./levels.js";
import { REGIONS } from "./data.js";
import { AMBIENT_NPCS } from "./villagers.js";

export const T = { GRASS:0, FLOWER:1, PATH:2, SAND:3, SHALLOW:4, DEEP:5, TREE:6, ROCK:7, CLIFF:8, BRIDGE:9,
  PLANK:10, SNOW:11, ICE:12, MUD:13, TALL:14, BUSH:15, FLOOR:16, WALL:17, LAKE:18, VOID:19, HOUSE:20, FENCE:21 };
export const SOLID = new Set([T.DEEP,T.TREE,T.ROCK,T.CLIFF,T.BUSH,T.WALL,T.VOID,T.HOUSE,T.FENCE,T.LAKE]);
export const HEIGHT = { [T.TREE]:2.2, [T.ROCK]:0.8, [T.CLIFF]:1.4, [T.BUSH]:0.6, [T.WALL]:1.8, [T.HOUSE]:1.6, [T.FENCE]:0.5 };

function rng(seed){ let a = seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

export function regionOf(n){ return REGIONS[Math.floor((n-1)/9)]; }

class Map {
  constructor(W,H,fill){ this.W=W; this.H=H; this.t=new Uint8Array(W*H).fill(fill); this.mask=new Uint8Array(W*H); this.objs=[]; this.zones=[]; }
  in(x,y){ return x>=0&&y>=0&&x<this.W&&y<this.H; }
  get(x,y){ return this.in(x,y)?this.t[y*this.W+x]:T.CLIFF; }
  set(x,y,v){ if(this.in(x,y)) this.t[y*this.W+x]=v; }
  m(x,y){ return this.in(x,y)?this.mask[y*this.W+x]:0; }
  mark(x,y,v=1){ if(this.in(x,y)) this.mask[y*this.W+x]|=v; }
  rect(x0,y0,w,h,v){ for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++) this.set(x,y,v); }
  circle(cx,cy,r,v,keepMask){ for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++) if((x-cx)**2+(y-cy)**2<=r*r){ if(keepMask&&this.m(x,y)&1) continue; this.set(x,y,v); this.mark(x,y,2);} }
}
// mask bits: 1=path 2=clearing 4=reserved(feature) 8=no-decor

function groundFor(reg){ return reg.ground==="cave" ? T.FLOOR : T.GRASS; }
function blockerFor(reg){ return ({coast:T.TREE, forest:T.TREE, marsh:T.BUSH, high:T.ROCK, autumn:T.TREE, snow:T.TREE, lake:T.TREE, cave:T.WALL, meadow:T.TREE})[reg.ground]; }

export function buildLevel(n){
  const L = LEVELS[n-1], reg = regionOf(n), R = rng(n*7919+13);
  const ri = (a,b)=>a+Math.floor(R()*(b-a+1));
  const cave = reg.ground==="cave" || ["cave","vault","hall","chamber"].includes(L.style);
  let W = 80, H = 48;
  if (L.style==="arena") { W=56; H=44; }
  if (L.style==="village") { W=68; H=44; }
  if (["shelf","jetty","switchback","crevasse"].includes(L.style)) { W=88; H=40; }
  const ground = cave ? T.FLOOR : groundFor(reg);
  const M = new Map(W,H, cave ? T.WALL : ground);
  M.n=n; M.L=L; M.reg=reg; M.cave=cave;
  const B = cave ? T.WALL : blockerFor(reg);

  // ----- path control points -----
  const ey = ri(6,H-7), xy = ri(6,H-7);
  let pts = [[0,ey]];
  const segs = L.style==="arena"||L.style==="village" ? 2 : 4;
  for (let i=1;i<segs;i++) pts.push([Math.round(i*W/segs)+ri(-2,2), ri(4,H-6)]);
  pts.push([W-1,xy]);
  if (L.style==="arena") pts=[[0,Math.floor(H/2)],[Math.floor(W/2),Math.floor(H/2)],[W-1,Math.floor(H/2)]];
  if (["shelf","jetty","crevasse"].includes(L.style)) pts = pts.map(p=>[p[0], Math.max(4,Math.min(8,p[1]))]);
  if(L.style==="shore"||L.style==="mirrorshore"){const routeMax=L.style==="mirrorshore"?Math.floor(H/2)-1:H-11;pts=pts.map(p=>[p[0],Math.max(4,Math.min(routeMax,p[1]))]);}
  M.entry = {x:1, y:pts[0][1]}; M.exit = {x:W-2, y:pts[pts.length-1][1]};
  M.pts = pts;

  // ----- border -----
  if (!cave) { for(let x=0;x<W;x++){ M.set(x,0,B); M.set(x,1,B); M.set(x,H-1,B); M.set(x,H-2,B);} for(let y=0;y<H;y++){ M.set(0,y,B); M.set(W-1,y,B);} }

  // ----- style features (before path) -----
  const S = L.style;
  if (S==="shore"||S==="jetty"||S==="island") {
    const sea = S==="jetty" ? H-9 : H-7;
    for (let x=0;x<W;x++){ const w = Math.round(Math.sin(x*0.4+n)*1.2);
      for (let y=sea+w;y<H;y++) M.set(x,y, y<sea+w+2 ? T.SHALLOW : T.DEEP);
      for (let y=sea+w-3;y<sea+w;y++) M.set(x,y,T.SAND);
      for (let y=sea+w;y<H;y++) M.mark(x,y,4); }
    M.sea = sea;
    if (S==="jetty") { for (let x=0;x<W;x++) for (let y=2;y<sea-3;y++) if (y<4 || y>sea-5) {} }
  }
  if (S==="jetty") { // the whole middle is water; the jetty is a plank path
    for (let x=3;x<W-3;x++) for (let y=2;y<H-2;y++){ M.set(x,y,T.DEEP); M.mark(x,y,4); }
  }
  if (S==="river"||S==="channels") {
    const rx = Math.floor(W/2)+ri(-3,3); M.river=rx;
    for (let y=0;y<H;y++){ const off=Math.round(Math.sin(y*0.5+n)*1.5);
      for (let x=rx-2+off;x<=rx+2+off;x++){ M.set(x,y, Math.abs(x-rx-off)<=1 ? T.DEEP : T.SHALLOW); M.mark(x,y,4);} }
  }
  if (S==="marsh"||S==="fen"||S==="pools") {
    const k = S==="pools"?6:9;
    for (let i=0;i<k;i++){ const cx=ri(4,W-5), cy=ri(3,H-4), r=ri(2,4)+(S==="pools"?1:0);
      M.circle(cx,cy,r,T.SHALLOW); if (r>=3 && S==="pools") M.circle(cx,cy,r-2,T.DEEP); }
    for (let i=0;i<6;i++) M.circle(ri(3,W-4),ri(3,H-4),ri(1,2),T.MUD);
  }
  if (S==="lake"||S==="islets"||S==="channel"||S==="mirrorshore") {
    if (S==="mirrorshore") { const ax=Math.floor(H/2)+3; M.axis=ax; for(let x=1;x<W-1;x++) for(let y=ax-1;y<=ax+1;y++){ M.set(x,y,T.DEEP); M.mark(x,y,4);} for(let x=1;x<W-1;x++) for(let y=ax+2;y<H-1;y++){ M.set(x,y,T.VOID); M.mark(x,y,4);} }
    else {
      const x0 = S==="channel"?6:10, x1 = S==="channel"?W-7:W-11;
      for (let x=x0;x<=x1;x++) for (let y=2;y<H-2;y++){ M.set(x,y,T.LAKE); M.mark(x,y,4); }
      M.lakeX=[x0,x1];
      if (S==="islets") { M.islets=[]; for (let i=0;i<4;i++){ const cx = x0+3+Math.floor(i*(x1-x0-5)/3), cy = i%2? 5 : H-6; M.circle(cx,cy,2.2,ground); M.islets.push([cx,cy]); } }
      if (S==="channel") { for (let x=x0;x<=x1;x+=3) { const y=ri(3,H-4); M.set(x,y,T.ROCK);} }
    }
  }
  if (S==="switchback"||S==="ridge"||S==="shelf"||S==="summit") {
    const bands = S==="shelf" ? 0 : 2;
    for (let b=0;b<bands;b++){ const y=Math.floor(H*(b+1)/(bands+1)); for (let x=2;x<W-2;x++){ M.set(x,y,T.CLIFF); } }
    if (S==="shelf") for (let x=1;x<W-1;x++) for (let y=11;y<H-1;y++){ M.set(x,y,T.VOID); M.mark(x,y,4); }
  }
  if (S==="crevasse") { for (let x=1;x<W-1;x++){ for(let y=2;y<4;y++) M.set(x,y,T.CLIFF); for (let y=11;y<H-1;y++){ M.set(x,y,T.VOID); M.mark(x,y,4);} } }
  if (S==="hollow") { M.circle(W/2,H/2,9,ground); }
  if (S==="icefield") { for (let x=8;x<W-8;x++) for (let y=2;y<H-2;y++){ M.set(x,y,T.ICE); M.mark(x,y,4|8);} M.iceX=[8,W-9]; }
  if (S==="maze") { for (let x=2;x<W-2;x++) for (let y=2;y<H-2;y++) M.set(x,y,B); }
  if (S==="quarry") { M.circle(W/2,H/2,7,T.SAND); for (let i=0;i<8;i++) M.set(ri(W/2-6,W/2+6),ri(H/2-5,H/2+5),T.ROCK); }
  if (S==="stones") { const x0=12,x1=W-13; M.stonesX=[x0,x1]; for (let x=x0;x<=x1;x++) for (let y=2;y<H-2;y++){ M.set(x,y,T.DEEP); M.mark(x,y,4);} }

  // ----- carve path -----
  const pathTile = cave ? T.FLOOR : (S==="marsh"||S==="fen" ? T.PLANK : (reg.ground==="snow"?T.PATH:T.PATH));
  const carve = (x,y)=>{ if(!M.in(x,y)) return; let cur=M.get(x,y);
    let v = pathTile;
    if (cur===T.DEEP||cur===T.SHALLOW) v = (S==="jetty"? T.PLANK : T.BRIDGE);
    if (cur===T.LAKE) { M.mark(x,y,1); return; }            // lake stays lake (boat)
    if (cur===T.ICE) { M.mark(x,y,1); return; }
    if (S==="stones" && x>=M.stonesX[0] && x<=M.stonesX[1]) { M.mark(x,y,1); return; }
    if (cur===T.VOID) return;
    M.set(x,y,v); M.mark(x,y,1); };
  for (let i=0;i<pts.length-1;i++){
    let [x0,y0]=pts[i],[x1,y1]=pts[i+1]; const midx = Math.round((x0+x1)/2);
    const line=(ax,ay,bx,by)=>{ const dx=Math.sign(bx-ax),dy=Math.sign(by-ay); let x=ax,y=ay; carve(x,y); carve(x,y+1); while(x!==bx||y!==by){ if(x!==bx)x+=dx; else y+=dy; carve(x,y); carve(x,y+1); carve(x+1,y);} };
    line(x0,y0,midx,y0); line(midx,y0,midx,y1); line(midx,y1,x1,y1);
  }
  // cliff bands: path crossings become stairs (path)
  // clearings at interior control points
  M.clearings = pts.slice(1,-1).map(([x,y])=>({x,y}));
  if (S!=="maze"&&S!=="shelf"&&S!=="jetty"&&S!=="crevasse"&&S!=="stones"&&S!=="icefield")
    for (const c of M.clearings){ const r = (S==="arena")?9:(S==="clearing"||S==="garden"||S==="orchard"||S==="village"||S==="meadow")?5:3;
      for (let y=c.y-r;y<=c.y+r;y++) for (let x=c.x-r;x<=c.x+r;x++) if ((x-c.x)**2+(y-c.y)**2<=r*r && x>1&&y>1&&x<W-2&&y<H-2 && !(M.m(x,y)&4) && !(M.m(x,y)&1)) { M.set(x,y, cave?T.FLOOR:ground); M.mark(x,y,2); } }
  if (S==="arena") { const cx=W/2, cy=H/2; for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++){ const d=Math.hypot((x-cx)/1.25,y-cy); if (d<8.5){ if(!(M.m(x,y)&1)) M.set(x,y,cave?T.FLOOR:ground); M.mark(x,y,2);} else if (!(M.m(x,y)&1)) M.set(x,y,B); } M.arena={x:cx,y:cy}; }
  if (S==="village") { const c=M.clearings[0]||{x:W/2,y:H/2}; M.circle(c.x,c.y,7,ground); }

  // ----- decor -----
  const dens = { forest:0.22, coast:0.08, marsh:0.08, high:0.07, autumn:0.16, snow:0.12, lake:0.1, cave:0.05, meadow:0.1 }[reg.ground] || 0.1;
  const near1 = (x,y)=>{ for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++) if(M.m(x+i,y+j)&3) return true; return false; };
  for (let y=2;y<H-2;y++) for (let x=1;x<W-1;x++){
    const v=M.get(x,y), mk=M.m(x,y);
    if (mk&(1|2|4|8)) continue;
    if (cave) { if (v===T.FLOOR && !near1(x,y) && R()<0.12) M.set(x,y,T.ROCK); continue; }
    if (v!==ground) continue;
    const r=R();
    if (!near1(x,y) && r<dens) M.set(x,y, (reg.ground==="high"&&R()<0.6)?T.ROCK:B===T.BUSH?T.BUSH:T.TREE);
    else if (r<dens+0.04 && !near1(x,y)) M.set(x,y,T.BUSH);
    else if (r<dens+0.1) M.set(x,y,T.FLOWER);
    else if (r<dens+0.17) M.set(x,y,T.TALL);
  }
  if (S==="orchard") for (const c of M.clearings) for (let i=-4;i<=4;i+=2) for (let j=-3;j<=3;j+=3) { const x=c.x+i,y=c.y+j; if(!(M.m(x,y)&1)) M.set(x,y,T.TREE); }

  // ----- hazards: terrain-based -----
  if (L.hz.includes("snow")) for (let y=2;y<H-2;y++) for (let x=1;x<W-1;x++) if ((M.get(x,y)===ground||M.get(x,y)===T.TALL) && !(M.m(x,y)&1) && R()<0.75) M.set(x,y,T.SNOW);
  if (L.hz.includes("shallow")) for (let y=2;y<H-2;y++) for (let x=2;x<W-2;x++) if (M.get(x,y)===ground && R()<0.35 && !(M.m(x,y)&1)) M.set(x,y,T.SHALLOW);

  M.state = { done:false, count:0, flags:{} };
  M.explored = new Uint8Array(W*H);
  placeMechanics(M, L, R, ri);
  // Mineral finds sit on open ground away from paths and puzzle objects.
  for(let i=0;i<3;i++){const s=freeSpot(M,R,{offPath:true,minEntry:4});if(s)addObj(M,{kind:"pickup",item:["stone","quartz","mica"][i],x:s[0],y:s[1],solid:false,forage:true,label:["Flint Stone","Milky Quartz","Mica Shard"][i]});}
  const keepsake=freeSpot(M,R,{offPath:true,minEntry:5})||freeSpot(M,R,{minEntry:5});if(keepsake)addObj(M,{kind:"collectible",mapId:n,label:L.name+" Keepsake",x:keepsake[0],y:keepsake[1],solid:false});
  const guide=freeSpot(M,R,{offPath:true,minEntry:5})||freeSpot(M,R,{minEntry:3}),affirmationChest=freeSpot(M,R,{offPath:true,minEntry:5})||freeSpot(M,R,{minEntry:3}),checkin=freeSpot(M,R,{offPath:true,minEntry:5})||freeSpot(M,R,{minEntry:3}),reassurer=freeSpot(M,R,{offPath:true,minEntry:5})||freeSpot(M,R,{minEntry:3});if(guide)addObj(M,{id:"guru_"+n,kind:"npc",npc:"guide_"+n,guru:true,mapId:n,x:guide[0],y:guide[1],solid:false,label:L.name+" meditation guide"});if(affirmationChest)addObj(M,{id:"affirmation_chest_"+n,kind:"chest",affirmation:true,x:affirmationChest[0],y:affirmationChest[1],solid:true,label:"Affirmation chest"});if(checkin)addObj(M,{id:"checkin_"+n,kind:"npc",npc:"checkin_"+n,checkin:true,mapId:n,x:checkin[0],y:checkin[1],solid:false,label:L.name+" listener"});if(reassurer)addObj(M,{id:"reassurer_"+n,kind:"npc",npc:"reassure_"+n,reassurer:true,mapId:n,x:reassurer[0],y:reassurer[1],solid:false,label:"Kind voice of "+L.name});
  const reachable=reach(M,{openAll:true,boat:["lake","islets","channel"].includes(M.L.style),stones:true});for(const o of M.objs.filter(o=>o.kind==="npc")){let near=false;for(const[dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const x=o.tx+dx,y=o.ty+dy;if(M.in(x,y)&&reachable[y*W+x])near=true;}if(near)continue;let best=null,bestD=Infinity;for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){if(!reachable[y*W+x]||SOLID.has(M.get(x,y))||M.objs.some(q=>q!==o&&q.tx===x&&q.ty===y))continue;const d=(x-o.tx)**2+(y-o.ty)**2;if(d<bestD){best=[x,y];bestD=d;}}if(best){o.tx=best[0];o.ty=best[1];o.x=best[0]+.5;o.y=best[1]+.5;}}
  return M;
}

export function buildMeetGuides(){
  const W=360,H=270,R=rng(4903127),M=new Map(W,H,T.GRASS),ri=(a,b)=>a+Math.floor(R()*(b-a+1));
  M.n=1;M.reg=REGIONS[1];M.cave=false;M.L={n:1,name:"Whisperwild",style:"meet",mech:"meet",wx:"mist",hz:[],en:[],npcs:[],p:{},obj:"Find the guides scattered throughout the forest.",jr:"A vast woodland of quiet groves, mountain valleys, and lakeside trails.",scenic:"The forest opens into a long green valley, with mountains beyond the water."};
  M.entry={x:8,y:14};M.exit={x:W-8,y:H-14};M.clearings=[];

  // Broad, irregular forest belts leave pockets of meadow between the trees.
  for(let y=3;y<H-3;y++)for(let x=3;x<W-3;x++){
    const waves=(Math.sin(x*.047)+Math.sin(y*.063)+Math.sin((x+y)*.027))/3;
    const density=.13+Math.max(0,waves)*.28;
    const n=R();
    if(n<density)M.set(x,y,n<density*.8?T.TREE:T.BUSH);
    else if(n<density+.035)M.set(x,y,T.FLOWER);
    else if(n<density+.07)M.set(x,y,T.TALL);
  }

  // Three broken ridges frame the forest; passes keep the high valleys connected.
  for(let x=18;x<260;x++){
    const crest=27+Math.sin(x*.035)*7+Math.sin(x*.091)*3;
    const width=5+Math.sin(x*.052+1)*2;
    for(let y=Math.floor(crest-width);y<=Math.ceil(crest+width);y++)if(M.in(x,y)){
      const d=Math.abs(y-crest)/width,roll=R();
      M.set(x,y,d<.26?T.CLIFF:roll<.72?T.ROCK:T.SNOW);
    }
  }
  for(let y=56;y<204;y++){
    const crest=316+Math.sin(y*.037)*9;
    for(let x=Math.floor(crest-7);x<=Math.ceil(crest+7);x++)if(M.in(x,y)){
      const d=Math.abs(x-crest)/7,roll=R();M.set(x,y,d<.3?T.CLIFF:roll<.76?T.ROCK:T.SNOW);
    }
  }
  for(let x=10;x<150;x++){
    const crest=230+Math.sin(x*.043+1.4)*8;
    for(let y=Math.floor(crest-6);y<=Math.ceil(crest+6);y++)if(M.in(x,y)){
      const d=Math.abs(y-crest)/6,roll=R();M.set(x,y,d<.3?T.CLIFF:roll<.72?T.ROCK:T.SNOW);
    }
  }
  for(const [cx,cy,rx,ry] of [[60,59,9,6],[176,95,9,6],[292,149,9,6],[118,203,9,6],[234,221,9,6]]){
    for(let y=cy-ry-2;y<=cy+ry+2;y++)for(let x=cx-rx-2;x<=cx+rx+2;x++){
      const d=((x-cx)/rx)**2+((y-cy)/ry)**2;
      if(d<=1.28)M.set(x,y,d<=.84?T.LAKE:T.SHALLOW);
    }
  }

  const path=(x,y)=>{for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    const tx=x+ox,ty=y+oy;if(!M.in(tx,ty))continue;
    const v=M.get(tx,ty);M.set(tx,ty,v===T.LAKE||v===T.SHALLOW?T.BRIDGE:T.PATH);M.mark(tx,ty,1);
  }};
  // Winding valley trails and occasional lake crossings form a connected route network.
  for(let x=3;x<W-3;x++){
    const y=Math.round(131+Math.sin(x*.022)*17+Math.sin(x*.061)*5);path(x,y);
    if(x%3===0)path(x,Math.round(54+Math.sin(x*.018)*5));
  }
  for(const xBase of [35,112,190,264,335])for(let y=4;y<H-4;y++){
    const x=Math.round(xBase+Math.sin(y*.026+xBase)*7);path(x,y);
  }

  M.entry={x:8,y:14};M.exit={x:W-8,y:H-14};
  const groves=[];
  for(let id=1;id<=LEVELS.length;id++){
    const index=id-1,col=index%12,row=Math.floor(index/12),x=17+col*29,y=14+row*18;
    groves.push({id,x,y});M.clearings.push({x,y});
    for(let ty=y-4;ty<=y+4;ty++)for(let tx=x-6;tx<=x+6;tx++)if(M.in(tx,ty)){
      const v=M.get(tx,ty);if(v!==T.LAKE&&v!==T.SHALLOW){M.set(tx,ty,(Math.abs(tx-x)<2&&Math.abs(ty-y)<2)?T.PATH:T.GRASS);M.mark(tx,ty,2);}
    }
  }
  for(const {x,y} of groves){
    const trunk=[35,112,190,264,335].reduce((best,n)=>Math.abs(n-x)<Math.abs(best-x)?n:best,35);
    const step=x<=trunk?1:-1;
    for(let tx=x;tx!==trunk+step;tx+=step)path(tx,y);
  }
  for(let x=5;x<=35;x++)path(x,14);
  for(const {id,x,y} of groves){
    const coords=[[x-3,y],[x,y],[x+3,y]];
    for(let i=0;i<3;i++){
      const [gx,gy]=coords[i],type=i===0?"guide":i===1?"checkin":"reassure",flags=i===0?{guru:true}:i===1?{checkin:true}:{reassurer:true};
      addObj(M,{id:"meet_"+type+"_"+id,kind:"npc",npc:type+"_"+id,...flags,mapId:id,x:gx,y:gy,solid:false,roamer:true,roam:{x0:gx-1.1,x1:gx+1.1,y0:gy-1.1,y1:gy+1.1},walkWait:R()*3,anim:0});
    }
  }
  M.state={done:false,count:0,flags:{}};M.explored=new Uint8Array(W*H);M.spawns=[];M.enemies=[];M.zones=[];return M;
}

export function buildSandbox(mode,room=0){
  const garden=mode==="garden",hearth=mode==="hearth",reg=REGIONS[9],R=rng((garden?74019:hearth?51000+room*7919:82019)>>>0),ri=(a,b)=>a+Math.floor(R()*(b-a+1));
  const W=hearth?68:garden?128:176,H=hearth?48:garden?96:128,ground=hearth?T.FLOOR:T.GRASS,M=new Map(W,H,ground);
  M.n=1;M.reg=hearth?REGIONS[7]:reg;M.cave=hearth;M.L={n:1,name:hearth?"Quiet Hearth · Room "+(room+1):garden?"Forest Garden":"Oldgrowth Forest",style:hearth?"hearth":garden?"garden":"forest",mech:"sandbox",p:{},hz:[],en:[],npcs:[],wx:"mist",obj:garden?"Prepare beds, plant seeds, water them and harvest when ripe.":hearth?"A gentle room for reflection and conversation.":"Forage woodland foods, gather materials and craft what you need. G to meditate and tend your garden.",jr:"A place to wander at your own pace.",scenic:"The old forest reaches far beyond the water."};
  if(hearth)for(let x=0;x<W;x++)for(let y=0;y<H;y++)if(y===0||y===H-1||x===0||x===W-1)M.set(x,y,T.WALL);
  for(let x=0;x<W;x++)for(let y=0;y<H;y++)if(x<2||y<2||x>=W-2||y>=H-2)M.set(x,y,T.TREE);
  M.entry={x:hearth?3:garden?8:Math.floor(W/2),y:hearth?Math.floor(H/2):garden?H-8:Math.floor(H/2)}; M.exit={x:W-3,y:M.entry.y};
  if(hearth){const variant=((Math.abs(room)%50)+50)%50,residents=["valley_001","valley_024","valley_057","valley_092","valley_131"];M.roomVariant=variant;const rugW=8+variant%7,rugH=4+Math.floor(variant/7)%5;for(let x=Math.floor(W/2-rugW);x<=W/2+rugW;x++)for(let y=Math.floor(H/2-rugH);y<=H/2+rugH;y++)if(M.in(x,y)&&M.get(x,y)===T.FLOOR)M.set(x,y,(x+y+variant)%5===0?T.PATH:T.FLOOR);for(let x=8+(variant%6)*4;x<W-8;x+=11)if(x>2&&x<W-3&&x!==Math.floor(W/2))M.set(x,3+(variant%2),T.FENCE);addObj(M,{kind:"npc",npc:"quiet_keeper",x:W/2,y:H/2-5,solid:false,label:"Hearth keeper"});addObj(M,{kind:"npc",npc:residents[variant%residents.length],x:W/2+6,y:H/2+3,solid:false,label:"Visiting neighbor"});addObj(M,{kind:"rest",x:W/2-7,y:H/2+5,solid:false,label:"Window seat"});addObj(M,{kind:"workbench",x:W/2+10,y:H/2+5,solid:false,label:"Tea table"});if(variant%2===0)addObj(M,{kind:"campfire",x:W/2-12,y:H/2-2,solid:false,label:"Hearth fire"});addObj(M,{kind:"portal",x:W/2,y:H-5,solid:false,label:"Nature door"});for(const x of [0,1,2,W-3,W-2,W-1])M.set(x,M.entry.y,T.FLOOR);}
  if(garden){
    for(let x=5;x<W-5;x++)for(let y=5;y<H-5;y++)M.mark(x,y,2);
    for(let y=10;y<H-8;y+=7)for(let x=14;x<W-10;x+=7)addObj(M,{kind:"garden_plot",x,y,solid:false,tilled:false,crop:null,wet:false});
    addObj(M,{kind:"cistern",x:10,y:12,solid:true,label:"Garden cistern"});
    addObj(M,{kind:"workbench",x:11,y:16,solid:false,label:"Garden workbench"});
    addObj(M,{kind:"rest",x:11,y:20,solid:false,label:"Garden rest bench"});
    for(let i=0;i<72;i++) addObj(M,{kind:"pickup",item:"seed",x:7+i%8*14,y:7+Math.floor(i/8)*10,solid:false,forage:true});
    for(let i=0;i<64;i++)addObj(M,{kind:"pickup",item:["blackberry","blueberry","wild_strawberry","raspberry","serviceberry","pawpaw","cranberry","wild_grape"][i%8],x:8+(i*17)%(W-16),y:8+(i*23)%(H-16),solid:false,forage:true});
    for(let y=3;y<H-3;y++)for(let x=3;x<W-3;x++){const outside=x<12||x>W-13||y<9||y>H-10;if(outside&&Math.hypot(x-M.entry.x,y-M.entry.y)>10&&!M.objs.some(o=>o.tx===x&&o.ty===y)){const q=R();if(q<.30)M.set(x,y,T.TREE);else if(q<.37)M.set(x,y,q<.33?T.BUSH:T.TALL);}}
    for(let i=0;i<48;i++){let x=ri(3,W-4),y=ri(3,H-4),tries=0;while((Math.hypot(x-M.entry.x,y-M.entry.y)<10||SOLID.has(M.get(x,y))||M.objs.some(o=>o.kind==="pickup"&&Math.hypot(o.tx-x,o.ty-y)<2.2))&&tries++<50){x=ri(3,W-4);y=ri(3,H-4);}if(!SOLID.has(M.get(x,y))&&Math.hypot(x-M.entry.x,y-M.entry.y)>=10)addObj(M,{kind:"pickup",item:["seed","seed","berry","wood","plant_fiber","stone","acorn"][i%7],x,y,solid:false,forage:true});}
    M.spawns=[];for(let i=0;i<22;i++){let x=ri(3,W-4),y=ri(3,H-4),tries=0;while((Math.hypot(x-M.entry.x,y-M.entry.y)<10||SOLID.has(M.get(x,y))||!(x<12||x>W-13||y<9||y>H-10))&&tries++<40){x=ri(3,W-4);y=ri(3,H-4);}if(!SOLID.has(M.get(x,y))&&(x<12||x>W-13||y<9||y>H-10))M.spawns.push({type:i%3===0?"tortoise":"hare",x:x+.5,y:y+.5});}
  }else if(!hearth){
    const path=(x,y)=>{if(!M.in(x,y))return; for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){M.set(x+ox,y+oy,T.PATH);M.mark(x+ox,y+oy,1);}};
    for(let x=3;x<W-3;x++){const y=Math.floor(H/2+Math.sin(x*.105)*7);path(x,y);if(x%13===0)for(let k=1;k<10;k++)path(x,y+(x%2?1:-1)*k);}
    for(let y=4;y<H-4;y++){const x=Math.floor(W/2+Math.sin(y*.13)*10);path(x,y);}
    for(let y=3;y<H-3;y++)for(let x=3;x<W-3;x++){
      const d=Math.hypot(x-M.entry.x,y-M.entry.y), v=R();
      if(d>8&&!(M.m(x,y)&1)&&v<.3)M.set(x,y,T.TREE);
      else if(v<.045)M.set(x,y,T.FLOWER); else if(v<.09)M.set(x,y,T.TALL);
    }
    for(let i=0;i<104;i++){
      let x=ri(4,W-5),y=ri(4,H-5),tries=0;while((SOLID.has(M.get(x,y))||Math.hypot(x-M.entry.x,y-M.entry.y)<5||M.objs.some(o=>o.kind==="pickup"&&Math.hypot(o.tx-x,o.ty-y)<4))&&tries++<30){x=ri(4,W-5);y=ri(4,H-5);}
      const foods=["blackberry","blueberry","wild_strawberry","raspberry","serviceberry","pawpaw","prickly_pear","wild_plum","cranberry","wild_grape","huckleberry","cattail_shoot","dandelion_greens","wild_onion","fiddlehead","nettle_tea","rosehip","morel","chanterelle","oyster_mushroom","chicken_mushroom","puffball","lion_mane"];
      if(!SOLID.has(M.get(x,y))&&Math.hypot(x-M.entry.x,y-M.entry.y)>=5&&!M.objs.some(o=>o.kind==="pickup"&&Math.hypot(o.tx-x,o.ty-y)<4))addObj(M,{kind:"pickup",item:foods[i%foods.length],x,y,solid:false,forage:true});
    }
    for(let i=0;i<136;i++){let x=ri(4,W-5),y=ri(4,H-5),tries=0;while((SOLID.has(M.get(x,y))||M.objs.some(o=>o.kind==="pickup"&&Math.hypot(o.tx-x,o.ty-y)<2.5))&&tries++<20){x=ri(4,W-5);y=ri(4,H-5);}if(!SOLID.has(M.get(x,y))&&!M.objs.some(o=>o.kind==="pickup"&&Math.hypot(o.tx-x,o.ty-y)<2.5))addObj(M,{kind:"pickup",item:["seed","wood","plant_fiber","stone","clay","acorn"][i%6],x,y,solid:false,forage:true});}
    for(let i=0;i<96;i++){let x=ri(4,W-5),y=ri(4,H-5),tries=0;while((SOLID.has(M.get(x,y))||(M.m(x,y)&1)||M.objs.some(o=>Math.hypot(o.tx-x,o.ty-y)<3))&&tries++<30){x=ri(4,W-5);y=ri(4,H-5);}if(!SOLID.has(M.get(x,y))&&!(M.m(x,y)&1))addObj(M,{kind:"pickup",item:["stone","quartz","mica","river_pebble"][i%4],x,y,solid:false,forage:true});}
    addObj(M,{kind:"meditate",x:M.entry.x+2,y:M.entry.y+2,solid:false,label:"Meditate"});
  }
  M.state={done:false,count:0,flags:{}};M.explored=new Uint8Array(W*H);M.spawns=M.spawns||[];M.enemies=[];M.clearings=[];M.zones=[];
  return M;
}

const FIBONACCI=(()=>{const a=[1,1];for(let i=2;i<50;i++)a.push(a[i-1]+a[i-2]);return a;})();
export const WALK_BIOMES=["road","forest","beach","riverside","lake","field","desert"];
export function buildWalk(biome="forest",seed=1){
  if(!WALK_BIOMES.includes(biome)&&biome!=="nature")biome="forest";
  const W=176,H=120,variant=((Math.abs(Math.trunc(seed))%50)+50)%50,pattern=variant%10,ecology=Math.floor(variant/10),R=rng((seed^0x51f15e)>>>0),ri=(a,b)=>a+Math.floor(R()*(b-a+1));
  const fib=(i)=>FIBONACCI[((i%50)+50)%50],A=fib(variant),B=fib(variant+11),C=fib(variant+23),reg=biome==="forest"?REGIONS[1]:biome==="beach"?REGIONS[0]:biome==="lake"?REGIONS[6]:biome==="desert"?REGIONS[4]:REGIONS[8];
  const ground=biome==="beach"||biome==="desert"?T.SAND:T.GRASS,M=new Map(W,H,ground),routeMid=Math.floor(H*0.51),amp=3+(A%6),phase=(B%31)/10;
  const routeY=x=>{const u=x/(W-1),s=Math.sin(u*(1+pattern%5)*Math.PI+phase);switch(pattern){case 0:return routeMid;case 1:return routeMid+Math.round(s*amp);case 2:return routeMid+Math.round((Math.sin(u*Math.PI*2+phase)>0?1:-1)*amp*.65);case 3:return routeMid+Math.round(Math.sin(u*Math.PI*3+phase)*amp*.45+Math.sin(u*Math.PI+phase)*amp*.45);case 4:return routeMid+Math.round(Math.sin(u*Math.PI*5+phase)*amp*.3);case 5:return routeMid+Math.round(Math.sin(u*Math.PI*.5+phase)*amp);case 6:return routeMid+Math.round(Math.sin(u*Math.PI*7+phase)*amp*.35);case 7:return routeMid+Math.round(Math.cos(u*Math.PI*2+phase)*amp*.75);case 8:return routeMid+Math.round(Math.sin(u*Math.PI*2+phase)*amp*.25+Math.cos(u*Math.PI*5+phase)*amp*.4);default:return routeMid+Math.round(Math.sin(u*Math.PI*4+phase)*amp*.6);}};
  M.n=1;M.reg=reg;M.cave=false;M.walkBiome=biome;M.fibonacci={sequence:FIBONACCI[variant],variant,pattern,ecology};
  const names={road:"Pine Road",forest:"Fern Path",beach:"Saltwind Beach",riverside:"Willow Riverwalk",lake:"Stillwater Shore",field:"Meadow Lane",desert:"Suncairn Track",nature:"Fibonacci Nature Reserve"};
  M.L={n:1,name:biome==="nature"?names.nature:names[biome],style:"walk",mech:"walk",wx:biome==="beach"?"clear":biome==="forest"||biome==="nature"?"mist":"clear",hz:[],en:[],npcs:[],p:{},walkBiome:biome,fibonacci:M.fibonacci,obj:"Follow the path, meet neighbors, forage, craft, fish and rest at a campfire.",jr:"A walk that takes a different shape each time.",scenic:"The path opens into a small, quiet view."};
  for(let x=0;x<W;x++)for(let y=0;y<H;y++)if(x<2||x>=W-2||y<2||y>=H-2)M.set(x,y,biome==="desert"?T.ROCK:T.TREE);
  const routeWidth=biome==="road"?2:1;
  for(let x=2;x<W-2;x++){const y=routeY(x);for(let dy=-routeWidth;dy<=routeWidth;dy++)if(y+dy>2&&y+dy<H-2){M.set(x,y+dy,biome==="beach"?T.SAND:T.PATH);M.mark(x,y+dy,1);}}
  if(biome==="beach"){const shore=Math.floor(H*.64);for(let x=1;x<W-1;x++)for(let y=shore;y<H-1;y++){M.set(x,y,y<shore+2?T.SHALLOW:T.DEEP);M.mark(x,y,4);}for(let x=1;x<W-1;x++)for(let y=shore-2;y<shore;y++)if(M.get(x,y)!==T.SAND)M.set(x,y,T.SAND);M.shore=shore;}
  if(biome==="riverside"||biome==="nature"){const riverX=Math.floor(W*(biome==="nature" ? 0.24 : 0.66));M.river=riverX;for(let y=3;y<H-3;y++){const cx=riverX+Math.round(Math.sin(y*.14+phase)*3);for(let dx=-2;dx<=2;dx++){const x=cx+dx;if(M.in(x,y)){M.set(x,y,(M.m(x,y)&1)?T.BRIDGE:Math.abs(dx)<=1?T.DEEP:T.SHALLOW);M.mark(x,y,4);}}}}
  if(biome==="lake"||biome==="nature"){const cx=Math.floor(W*(biome==="nature" ? 0.73 : 0.66)),cy=Math.floor(H*(biome==="nature"?.32:.43)),rx=biome==="nature"?9:13,ry=biome==="nature"?7:10;M.lake={x:cx,y:cy,rx,ry};for(let y=cy-ry-2;y<=cy+ry+2;y++)for(let x=cx-rx-2;x<=cx+rx+2;x++){const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d<=1.22)M.set(x,y,(M.m(x,y)&1)?T.BRIDGE:d<=.88?T.LAKE:T.SHALLOW);}}
  if(biome==="forest"||biome==="nature"){const density=.13+(ecology%3)*.035;for(let y=3;y<H-3;y++)for(let x=3;x<W-3;x++)if(!(M.m(x,y)&1)&&M.get(x,y)===T.GRASS&&R()<density)M.set(x,y,R()<.8?T.TREE:T.BUSH);}
  if(biome==="field"||biome==="road"||biome==="riverside"||biome==="nature"){const density=.07+(B%5)*.012;for(let y=3;y<H-3;y++)for(let x=3;x<W-3;x++)if(!(M.m(x,y)&1)&&M.get(x,y)===T.GRASS&&R()<density)M.set(x,y,R()<.58?T.FLOWER:T.TALL);}
  if(biome==="desert"){for(let i=0;i<120;i++){const x=ri(4,W-5),y=ri(4,H-5);if(!(M.m(x,y)&1)&&M.get(x,y)===T.SAND&&R()<.68)M.set(x,y,R()<.72?T.ROCK:T.BUSH);}for(let x=6;x<W-6;x+=12)for(let y=8;y<H-8;y+=15)if(M.get(x,y)===T.SAND)M.set(x,y,T.TALL);}
  M.entry={x:3,y:routeY(3)};M.exit={x:W-4,y:routeY(W-4)};M.pts=[[2,M.entry.y],[W/2,routeY(W/2)],[W-2,M.exit.y]];M.clearings=[{x:Math.floor(W/3),y:routeY(W/3)},{x:Math.floor(W*2/3),y:routeY(W*2/3)}];
  const open=(x,y)=>M.in(x,y)&&!SOLID.has(M.get(x,y))&&M.get(x,y)!==T.DEEP&&M.get(x,y)!==T.LAKE&&!(M.m(x,y)&1)&&!M.objs.some(o=>Math.hypot(o.tx-x,o.ty-y)<2.2);
  const spot=(nearRoute=true)=>{for(let tries=0;tries<250;tries++){const x=ri(4,W-5),y=nearRoute?Math.max(3,Math.min(H-4,routeY(x)+ri(-8,8))):ri(4,H-5);if(open(x,y))return[x,y];}return null;};
  for(let i=0;i<104;i++){const s=spot(false);if(s)addObj(M,{kind:"pickup",item:["wood","stone","plant_fiber","seed",biome==="desert"?"quartz":biome==="beach"?"shell":"berry"][i%5],x:s[0],y:s[1],solid:false,forage:true});}
  for(let i=0;i<8;i++){const s=spot();if(s){const id="walk_"+variant+"_"+i,looks=["#785a46","#d19a62","#49475b","#a66458","#587263"];addObj(M,{kind:"npc",npc:id,walkNpc:true,npcData:{id,name:["Moss","Ari","Juniper","Sol","Robin"][((i+variant)%5)],role:["trail tender","bird watcher","shore keeper","wildflower guide","wayfinder"][((i+ecology)%5)],look:{hair:looks[(i+variant)%5],coat:looks[(i+2)%5],skin:["#f0c8a0","#c89060","#a06a40","#e0b090"][i%4],style:["short","long","tied"][variant%3]}},walkBiome:biome,solid:false,x:s[0],y:s[1]});}}
  for(let i=0;i<4;i++){const s=spot();if(s)addObj(M,{kind:"campfire",x:s[0],y:s[1],solid:false,label:"Trail campfire"});}
  const work=spot();if(work)addObj(M,{kind:"workbench",x:work[0],y:work[1],solid:false,label:"Trail workbench"});
  const scenic=spot();if(scenic)addObj(M,{kind:"scenic",x:scenic[0],y:scenic[1],solid:false,label:"Lookout"});if(biome==="nature"){const door=spot();if(door){M.naturePortal={x:door[0],y:door[1]};addObj(M,{kind:"portal",x:door[0],y:door[1],solid:false,label:"Return to Quiet Rooms"});}}
  M.state={done:false,count:0,flags:{}};M.explored=new Uint8Array(W*H);M.spawns=[];M.enemies=[];M.zones=[];return M;
}

// find walkable tiles reachable from entry
export function walkable(M,x,y,opts={}){ const v=M.get(x,y); if (v===T.LAKE) return !!opts.boat; return !SOLID.has(v); }
export function reach(M, opts={}){
  const seen=new Uint8Array(M.W*M.H), q=[[M.entry.x,M.entry.y]]; seen[M.entry.y*M.W+M.entry.x]=1;
  const block = new Set(); for (const o of M.objs) if (o.solid && (opts.ignoreGates? !o.gate : true) && !(opts.openAll&&o.gate)) block.add(o.ty*M.W+o.tx);
  while(q.length){ const [x,y]=q.pop(); for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if(!M.in(nx,ny)) continue; const k=ny*M.W+nx; if(seen[k]) continue; if(!walkable(M,nx,ny,opts)) { if(!(opts.stones && M.stonesX && nx>=M.stonesX[0]&&nx<=M.stonesX[1] && (M.m(nx,ny)&1))) continue; } if (block.has(k)) continue; seen[k]=1; q.push([nx,ny]); } }
  return seen;
}

function addObj(M,o){ o.tx = Math.floor(o.x); o.ty=Math.floor(o.y); o.x = o.tx+0.5; o.y=o.ty+0.5; o.id = o.id || (o.kind+"_"+M.objs.length); M.objs.push(o); return o; }

function freeSpot(M,R,opts={}){
  const seen = reach(M,{boat:opts.boat, stones:true});
  const cands=[];
  for (let y=2;y<M.H-2;y++) for (let x=2;x<M.W-2;x++){
    const k=y*M.W+x; if(!seen[k]) continue; const v=M.get(x,y);
    if (v===T.LAKE||v===T.BRIDGE||v===T.ICE||v===T.DEEP) continue;
    if (M.stonesX && x>=M.stonesX[0]-1 && x<=M.stonesX[1]+1) continue;
    if (opts.offPath && (M.m(x,y)&1)) continue;
    if (opts.onPath && !(M.m(x,y)&1)) continue;
    if (Math.abs(x-M.entry.x)+Math.abs(y-M.entry.y) < (opts.minEntry??4)) continue;
    if (Math.abs(x-M.exit.x)+Math.abs(y-M.exit.y) < 3) continue;
    if (opts.xmin!=null && x<opts.xmin) continue; if (opts.xmax!=null && x>opts.xmax) continue;
    if (M.objs.some(o=>Math.abs(o.tx-x)<=1&&Math.abs(o.ty-y)<=1)) continue;
    // keep the path itself free of blocking things
    cands.push([x,y, opts.far? Math.abs(x-M.entry.x)+Math.abs(y-(M.H/2)) : 0]);
  }
  if (!cands.length) return null;
  if (opts.far) { cands.sort((a,b)=>b[2]-a[2]); return cands[Math.floor(R()*Math.min(6,cands.length))]; }
  return cands[Math.floor(R()*cands.length)];
}
function spread(M,R,n,opts={}){ // n spots spread across x
  const out=[]; for (let i=0;i<n;i++){ const span=(M.W-6)/n; const s=freeSpot(M,R,{...opts, xmin:3+Math.floor(i*span), xmax:3+Math.floor((i+1)*span)}) || freeSpot(M,R,opts); if (s) out.push(s); } return out; }

function placeMechanics(M,L,R,ri){
  const W=M.W,H=M.H, p=L.p||{}, mech=L.mech;
  const gate = ()=>addObj(M,{kind:"gate", x:M.exit.x, y:M.exit.y, solid:true, gate:true, label:"Closed way"});
  const gate2 = ()=>addObj(M,{kind:"gate", x:M.exit.x, y:M.exit.y+1, solid:true, gate:true, label:"Closed way"});
  const needsGate = !["reach","calm","hub","ending"].includes(mech);
  // landmark near middle clearing
  const lc = M.clearings[Math.floor(M.clearings.length/2)] || {x:W/2,y:H/2};
  const landSpot = freeSpot(M,R,{offPath:true, xmin:lc.x-6, xmax:lc.x+6}) || [lc.x+2,lc.y-2];
  const land = addObj(M,{kind:"landmark", sub:L.land, x:landSpot[0], y:landSpot[1], solid:true, label:L.land.replace(/_/g," ")});
  if (L.land==="leaning_tree") { land.x = 4.5; land.y = M.entry.y-1.5; land.tx=4; land.ty=M.entry.y-2; }

  // Optional: cache + scenic
  const cs = freeSpot(M,R,{offPath:true, far:true}); if (cs) addObj(M,{kind:"cache", x:cs[0], y:cs[1], solid:true, label:"Cache"});
  const ss = freeSpot(M,R,{offPath:true}); if (ss) addObj(M,{kind:"scenic", x:ss[0], y:ss[1], solid:false, label:"Look out"});
  if (L.rest) { const r=freeSpot(M,R,{xmax:Math.floor(W*0.4)+4, minEntry:3}); if(r) addObj(M,{kind:"rest", x:r[0], y:r[1], solid:true, label:"Rest"}); }
  if (L.checkpoints) for (const [x,y] of spread(M,R,3,{onPath:true})) addObj(M,{kind:"checkpoint", x, y, solid:false, label:"Flat stone"});
  if (L.secret) { const s=freeSpot(M,R,{offPath:true, far:true}); if (s) addObj(M,{kind:"secret", item:L.secret, x:s[0], y:s[1], solid:false, label:"Something glints"}); }

  // Story characters and the 160 residents are spread along the route.
  for (const id of L.npcs) { if (id==="comp") continue; const s = freeSpot(M,R,{xmin:Math.floor(W*0.15), xmax:Math.floor(W*0.65), minEntry:5}); if(s)addObj(M,{kind:"npc",npc:id,x:s[0],y:s[1],solid:false}); }
  const residentStart = M.n<=79 ? (M.n-1)*2 : 158+(M.n-80), residentCount = M.n<=79 ? 2 : M.n<=81 ? 1 : 0;
  for (let i=residentStart;i<residentStart+residentCount;i++) {
    const resident = AMBIENT_NPCS[i];
    const left = i%2===0, boat = ["lake","islets","channel"].includes(M.L.style);
    const bounds = {xmin:Math.floor(W*(left?0.18:0.5)), xmax:Math.floor(W*(left?0.44:0.78)), minEntry:3, boat};
    const s = freeSpot(M,R,bounds) || freeSpot(M,R,{minEntry:3, boat}) || freeSpot(M,R,{minEntry:1, boat});
    if (s) addObj(M,{kind:"npc", npc:resident.id, solid:false, x:s[0], y:s[1]});
  }

  // hazards (zones)
  const midX = Math.floor(W/2);
  if (L.hz.includes("tide")) { const x0=Math.floor(W*0.35), x1=x0+6; M.zones.push({type:"tide", x0, x1, y0:2, y1:H-2, period:8, safe:[]});
    for (let i=0;i<3;i++){ const x=x0+1+i*2, y=M.pts[2]?M.pts[2][1]-2+i*2:H/2; M.zones[M.zones.length-1].safe.push([x, Math.floor(y)]); } }
  if (L.hz.includes("gusts")) { const k = L.style==="jetty"?4:3; for (let i=0;i<k;i++){ const x0=Math.floor(W*(0.2+i*0.6/k)); M.zones.push({type:"gust", x0, x1:x0+3, y0:2, y1:H-2, dir:[-1,0], period:5+i*0.7, phase:i*1.3}); } }
  if (L.hz.includes("wind")) { for (let i=0;i<3;i++){ const x0=Math.floor(W*(0.15+i*0.27)); M.zones.push({type:"wind", x0, x1:x0+4, y0:2, y1:H-2, dir:[0, i%2?-1:1]}); } }
  if (L.hz.includes("vents")) { for (const [x,y] of spread(M,R,6,{onPath:true})) addObj(M,{kind:"vent", x, y, solid:false, phase:R()*4, label:"Steam vent"}); }
  if (L.hz.includes("pulse")) { for (const [x,y] of spread(M,R,4,{offPath:true})) addObj(M,{kind:"pulse", x, y, solid:true, phase:R()*5, label:"Pulse pillar"}); }
  if (L.hz.includes("currents")) { M.zones.push({type:"current", x0:M.lakeX[0], x1:Math.floor((M.lakeX[0]+M.lakeX[1])/2), y0:2, y1:Math.floor(H/2), dir:[0,1]}); M.zones.push({type:"current", x0:Math.floor((M.lakeX[0]+M.lakeX[1])/2), x1:M.lakeX[1], y0:Math.floor(H/2), y1:H-2, dir:[0,-1]}); }
  if (L.hz.includes("ice")) for (let x=M.iceX[0];x<=M.iceX[1];x+=4){ const y=ri(4,H-5); M.set(x,y,T.ROCK); }
  if (L.hz.includes("stones")||L.style==="stones") {
    const [x0,x1]=M.stonesX; const stones=[];
    for (let x=x0;x<=x1;x++) for (let y=0;y<H;y++) if (M.m(x,y)&1) stones.push({x,y,g:Math.floor((x-x0)/2)%2});
    M.stones = stones; M.zones.push({type:"stones", x0, x1, period:6});
  }
  if (L.mech==="storm") { for (let i=0;i<4;i++){ const x0=Math.floor(W*(0.15+i*0.2)); M.zones.push({type:"gust", x0, x1:x0+3, y0:2, y1:H-2, dir:[i%2?1:-1,0].map((v,j)=>j===0?-1:0), period:4.5+i*0.5, phase:i}); } }

  // mechanics
  const st = M.state;
  switch (mech) {
    case "intro": {
      addObj(M,{kind:"chest", x:6, y:M.entry.y+2, solid:true, label:"Supply crate", give:{berry:3, tea:1, stormstone:1}});
      addObj(M,{kind:"sign", x:9, y:M.entry.y-1, solid:true, text:"Carved on driftwood: 'MOVE with arrows or WASD. Press SPACE near things to use them.'"});
      addObj(M,{kind:"sign", x:16, y:M.pts[1][1]-2, solid:true, text:"Scratched on a rock: 'J strikes. K uses a technique. SHIFT steps aside. TAB for your bag, M for the map.'"});
      for (const [x,y] of spread(M,R,2,{offPath:true})) addObj(M,{kind:"pickup", item:"driftwood", x, y});
      gate(); gate2(); break; }
    case "craft": {
      for (const [x,y] of spread(M,R,(p.n||3)+1,{offPath:true})) addObj(M,{kind:"pickup", item:p.item||"reed", x, y, quest:true});
      gate(); gate2(); break; }
    case "gather": {
      for (const [x,y] of spread(M,R,p.n+1,{offPath:true, boat:L.style==="islets"})) addObj(M,{kind:"pickup", item:p.item, x, y, quest:true});
      if (L.style==="islets") { M.objs.filter(o=>o.kind==="pickup"&&o.quest).forEach((o,i)=>{ const isl=M.islets[i%4]; o.x=isl[0]+0.5; o.y=isl[1]+0.5; o.tx=isl[0]; o.ty=isl[1]; }); }
      if (p.then==="lamp"||p.then==="bell"||p.then==="kiln"||p.then==="beds") { land.use=p.then; }
      if (p.then==="kiln") { for (const [x,y] of spread(M,R,2,{offPath:true})) addObj(M,{kind:"lever", sub:"vent", x, y, solid:true, label:"Kiln vent"}); }
      if (p.then==="beds") { for (const [x,y] of spread(M,R,3,{offPath:true})) addObj(M,{kind:"bed", x, y, solid:false, label:"Empty bed"}); }
      gate(); gate2(); break; }
    case "activate": {
      const kinds = p.kind;
      for (const [x,y] of spread(M,R,p.n,{offPath:true})) addObj(M,{kind:"act", sub:kinds, x, y, solid:kinds!=="inscription"&&kinds!=="mound"&&kinds!=="lantern_plant"&&kinds!=="glowcap", label:kinds.replace(/_/g," ")});
      if (p.pre==="staff") { addObj(M,{kind:"pickup", item:"w:staff", x:6, y:M.entry.y, label:"Driftwood Staff"}); }
      if (p.target) { const s=freeSpot(M,R,{offPath:true, xmin:Math.floor(W*0.55)}); if (s) addObj(M,{kind:"target", sub:p.target, x:s[0], y:s[1], solid:true, label:p.target}); }
      gate(); gate2(); break; }
    case "sequence": {
      const c = M.clearings[1]||lc; const order=[]; const ids=[...Array(p.n).keys()];
      for (let i=0;i<p.n;i++){ const a=i/p.n*Math.PI*2; const x=Math.round(c.x+Math.cos(a)*3), y=Math.round(c.y+Math.sin(a)*2.5);
        for (let j=-1;j<=1;j++) for (let k=-1;k<=1;k++){ const v=M.get(x+k,y+j); if (SOLID.has(v) && v!==T.VOID && x+k>0&&y+j>1&&x+k<M.W-1&&y+j<M.H-2) M.set(x+k,y+j, M.cave?T.FLOOR:T.GRASS); } addObj(M,{kind:"seq", sub:p.kind, idx:i, x, y, solid:true, label:p.kind==="echo"?"Echo stone":"Wind chime"}); }
      for (let i=ids.length-1;i>0;i--){ const j=Math.floor(R()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
      st.order=ids; st.input=[]; st.center=c; gate(); gate2(); break; }
    case "dials": {
      const c = M.clearings[1]||lc; st.targets=[];
      for (let i=0;i<p.n;i++){ const x=c.x-3+i*3, y=c.y; M.set(x,y,T.GRASS); M.set(x,y+1,T.GRASS);
        const tgt = Math.floor(R()*4); let cur=(tgt+1+Math.floor(R()*3))%4;
        addObj(M,{kind:"dial", idx:i, dir:cur, target:tgt, x, y, solid:true, label:"Cairn"});
        addObj(M,{kind:"mark", dir:tgt, x, y:y+1, solid:false, label:"Shadow-mark"}); }
      gate(); gate2(); break; }
    case "pipes": buildPipes(M,R,lc); if (p.also==="push") buildPush(M,R,2,true); gate(); gate2(); break;
    case "beam": buildBeam(M,R,lc); gate(); gate2(); break;
    case "push": buildPush(M,R,p.n,p.wind); gate(); gate2(); break;
    case "toggles": buildToggles(M,R); break;
    case "build": {
      for (const [x,y] of spread(M,R,p.n+1,{offPath:true})) addObj(M,{kind:"pickup", item:p.item, x, y, quest:true});
      if (p.site==="bridge") { const rx=M.river; const ys=[]; for (let y=0;y<H;y++) for (let x=rx-3;x<=rx+3;x++) if (M.get(x,y)===T.BRIDGE){ ys.push([x,y]); M.set(x,y,T.DEEP);} M.bridgeTiles=ys;
        const bx = Math.min(...ys.map(a=>a[0]))-1, by = ys.length? ys[0][1] : H/2; addObj(M,{kind:"site", sub:"bridge", x:bx, y:by, solid:false, label:"Broken bridge"}); }
      else { const s=freeSpot(M,R,{offPath:true, xmin:Math.floor(W*0.3), xmax:Math.floor(W*0.7)}); addObj(M,{kind:"site", sub:p.site, x:s[0], y:s[1], solid:true, label:"Building site"}); gate(); gate2(); }
      break; }
    case "talk": case "hub": gate(); gate2(); if (p.then==="calm") st.calmNeed=p.n; if (mech==="hub") M.objs.filter(o=>o.gate).forEach(o=>o.open=false); break;
    case "protect": { const c = M.clearings[1]||lc; addObj(M,{kind:"nest", x:c.x, y:c.y, solid:true, label:"Nests"}); st.time=p.time; gate(); gate2(); break; }
    case "guide": { // a maze with foxfire waypoints along the path
      const cells=[]; for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (M.m(x,y)&1) cells.push([x,y]);
      // dead-end side branches
      for (let i=0;i<6;i++){ const [x,y]=cells[Math.floor(R()*cells.length)]; const d=[[0,1],[0,-1]][i%2]; for (let k=1;k<6;k++){ const nx=x+(i%3===0?k:0), ny=y+d[1]*k; if(M.in(nx,ny)&&nx>1&&ny>1&&nx<W-2&&ny<H-2){ M.set(nx,ny,T.PATH);} } }
      const wps = []; let last=null; for (const c of cells){ if (!last || Math.abs(c[0]-last[0])+Math.abs(c[1]-last[1])>=5){ wps.push(c); last=c; } }
      st.wps = wps; st.wi = 0; addObj(M,{kind:"foxfire", x:wps[0][0], y:wps[0][1], solid:false, label:"Foxfire"});
      gate(); gate2(); break; }
    case "mirror": {
      const ax=M.axis; st.plates=[];
      for(let i=0;i<2;i++){const s=freeSpot(M,R,{offPath:true,xmin:6+i*14,xmax:16+i*14})||freeSpot(M,R,{offPath:true})||[M.entry.x+1,M.entry.y-2];const gx=M.W-1-s[0],gy=2*ax-s[1];st.plates.push({x:gx+0.5,y:gy+0.5,on:false,px:s[0],py:s[1]});}
      gate(); gate2(); break; }
    case "boat": gate(); gate2(); M.objs.filter(o=>o.gate).forEach(o=>{o.solid=false; o.open=true;}); break;
    case "storm": {
      for (const [x,y] of spread(M,R,p.n,{offPath:true, xmin:8})) addObj(M,{kind:"stranded", x, y, solid:true, label:"Stranded traveler"});
      const s = freeSpot(M,R,{xmin:W-12, xmax:W-5}) || [W-6,M.exit.y-2]; addObj(M,{kind:"shelterstones", x:s[0], y:s[1], solid:false, label:"Shelter stones"});
      st.need=p.n; gate(); gate2(); break; }
    case "companions": { const s=freeSpot(M,R,{xmin:12, xmax:22}); addObj(M,{kind:"npc", npc:"comp", x:s[0], y:s[1], solid:true}); gate(); gate2(); break; }
    case "guardian": { const a=M.arena; st.g=p.g; st.choice=p.choice;
      for (let i=0;i<3;i++){ const ang=i/3*Math.PI*2+0.5; addObj(M,{kind:"calmstone", idx:i, x:Math.round(a.x+Math.cos(ang)*6.5), y:Math.round(a.y+Math.sin(ang)*5.5), solid:false, label:"Calming stone"}); }
      gate(); gate2(); break; }
    case "calm": { const s=freeSpot(M,R,{xmin:Math.floor(W*0.4), xmax:Math.floor(W*0.7), offPath:true}); if (s) addObj(M,{kind:"heron", x:s[0], y:s[1], solid:true, label:"Great Heron", calm:0}); break; }
    case "ending": addObj(M,{kind:"water_edge", x:M.W-6, y:M.exit.y, solid:false, label:"The water's edge"}); break;
  }
  // enemies
  M.spawns=[];
  for (const e of L.en) { const [type,c]=e.split(":"); for (let i=0;i<+c;i++){ const s=freeSpot(M,R,{minEntry:8}); if (s) M.spawns.push({type, x:s[0]+0.5, y:s[1]+0.5}); } }
}

function buildPipes(M,R,c){
  // a 6x4 grid of rotatable channel pieces east of center; source on left, field on right
  const gw=6, gh=4, ox=Math.min(M.W-12, Math.max(6, Math.floor(c.x-3))), oy=Math.max(3,Math.min(M.H-8, Math.floor(c.y-1)));
  for (let y=oy-2;y<oy+gh+2;y++) for (let x=ox-3;x<ox+gw+3;x++) if (M.in(x,y)&&x>1&&x<M.W-2&&y>1&&y<M.H-2){ M.set(x,y, M.cave?T.FLOOR:T.GRASS); M.mark(x,y,8); }
  // random monotone path from (0,sy) to (gw-1,ty)
  const sy=Math.floor(R()*gh), ty=Math.floor(R()*gh); const path=[]; let x=0,y=sy; path.push([x,y]);
  while (x<gw-1){ if (R()<0.45 && y!==ty){ y+=Math.sign(ty-y); } else x++; path.push([x,y]); }
  while (y!==ty){ y+=Math.sign(ty-y); path.push([x,y]); }
  const conn = {}; // key -> set of dirs (0=N,1=E,2=S,3=W)
  const key=(x,y)=>x+","+y; const add=(x,y,d)=>{ (conn[key(x,y)]=conn[key(x,y)]||new Set()).add(d); };
  add(0,sy,3); add(gw-1,ty,1);
  for (let i=0;i<path.length-1;i++){ const [ax,ay]=path[i],[bx,by]=path[i+1]; const d = bx>ax?1:bx<ax?3:by>ay?2:0; add(ax,ay,d); add(bx,by,(d+2)%4); }
  M.pipes = { ox, oy, gw, gh, sy, ty, cells:[] };
  for (let j=0;j<gh;j++) for (let i=0;i<gw;i++){
    let set = conn[key(i,j)]; let shape, rot;
    if (set) { const ds=[...set].sort(); if (ds.length===2 && (ds[1]-ds[0])===2) { shape="I"; rot=ds[0]; } else if (ds.length===2) { shape="L"; rot = (ds[0]===0&&ds[1]===3)?3:ds[0]; } else { shape="T"; rot=0; } }
    else { shape = R()<0.5?"I":"L"; rot=0; }
    const solRot = rot; const r = (solRot + 1 + Math.floor(R()*3)) % 4;
    const o = addObj(M,{kind:"pipe", shape, rot:r, sol:solRot, onPath:!!set, x:ox+i, y:oy+j, solid:false, label:"Channel gate"});
    M.pipes.cells.push(o);
  }
  addObj(M,{kind:"source", x:ox-1, y:oy+sy, solid:true, label:"Spring"});
  addObj(M,{kind:"field", x:ox+gw, y:oy+ty, solid:true, label:"Dry field"});
}
export function pipeDirs(o){ const base = o.shape==="I"?[0,2]:o.shape==="L"?[0,1]:[0,1,3]; return base.map(d=>(d+o.rot)%4); }

function buildBeam(M,R,c){
  // mirrors: "B" = backslash (E->S, S->E, W->N, N->W), "F" = slash (E->N, N->E, W->S, S->W)
  const ox=Math.max(4,Math.min(M.W-14, Math.floor(c.x-5))), oy=Math.max(3,Math.min(M.H-9, Math.floor(c.y-3)));
  for (let y=oy-1;y<=oy+5;y++) for (let x=ox-1;x<=ox+11;x++) if (x>1&&x<M.W-2&&y>1&&y<M.H-2){ if(!(M.m(x,y)&1)) M.set(x,y,M.cave?T.FLOOR:T.GRASS); M.mark(x,y,8); }
  addObj(M,{kind:"emitter", x:ox, y:oy, solid:true, label:"Sunstone"});
  const mk=(dx,dy,start,sol)=>addObj(M,{kind:"mirror", x:ox+dx, y:oy+dy, m:start, sol, solid:true, label:"Mirror stone"});
  mk(4,0,"F","B"); mk(4,4,"F","B"); mk(9,4,"B","F"); mk(2,3,"F",null);
  addObj(M,{kind:"darktree", x:ox+9, y:oy, solid:true, label:"Shadowed tree"});
  M.beam={ox,oy};
}

function buildPush(M,R,n,wind){
  const c = M.clearings[M.clearings.length-1] || {x:M.W/2,y:M.H/2};
  const ox=Math.max(4,Math.min(M.W-14,c.x-5)), oy=Math.max(3,Math.min(M.H-10,c.y-3));
  for (let y=oy;y<oy+7;y++) for (let x=ox;x<ox+10;x++) if (x>1&&x<M.W-2&&y>1&&y<M.H-2){ const v=M.get(x,y); if (SOLID.has(v)||v===T.SHALLOW) M.set(x,y, M.cave?T.FLOOR:T.GRASS); M.mark(x,y,8); }
  for (let i=0;i<n;i++){ const sx=ox+2+i*5, sy=oy+1; addObj(M,{kind:"socket", x:sx, y:sy, solid:false, label: wind?"Stone hole":"Reed cradle", filled:false});
    addObj(M,{kind:"pushable", sub: wind?"puff":"light", x:sx, y:sy+3, hx:sx, hy:sy+3, solid:true, label: wind?"Seed-puff":"Floating light"}); }
  addObj(M,{kind:"resetstone", x:ox, y:oy+6, solid:true, label:"Reset stone"});
}

function buildToggles(M,R){
  const a = Math.floor(M.W*0.38), b = Math.floor(M.W*0.62); const solidT = M.cave?T.WALL:T.CLIFF;
  M.toggle = { state:0 };
  for (const [col,set] of [[a,"A"],[b,"B"]]) {
    for (let y=1;y<M.H-1;y++){ if (M.m(col,y)&1) { addObj(M,{kind:"twall", set, x:col, y, solid:true, label:"Screen"}); M.set(col,y, M.cave?T.FLOOR:T.PATH); } else M.set(col,y,solidT); }
  }
  // levers on the path just before each wall
  const pathYAt = col=>{ for (let y=0;y<M.H;y++) if (M.m(col,y)&1) return y; return M.H/2; };
  const l1x=a-2, l1y=pathYAt(a-2)-1, l2x=b-2, l2y=pathYAt(b-2)-1;
  for (const [x,y] of [[l1x,l1y],[l2x,l2y]]) { if (SOLID.has(M.get(x,y))) M.set(x,y, M.cave?T.FLOOR:T.GRASS); addObj(M,{kind:"tlever", x, y, solid:true, label:"Turning lever"}); }
  M.objs.filter(o=>o.kind==="twall").forEach(o=>{ o.solid = o.set==="A"; });
}
