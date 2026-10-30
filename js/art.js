// Procedural, original pixel art. Everything is drawn into small canvases and cached.
import { T } from "./world.js";

const cache = new Map();
export function mk(w,h){ const c=document.createElement("canvas"); c.width=w; c.height=h; const x=c.getContext("2d"); x.imageSmoothingEnabled=false; return [c,x]; }
function hash(x,y,s){ let h = (x*374761393 + y*668265263 + s*1442695041)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967296; }
export function shade(hex, f){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=n>>8&255,b=n&255;
  if (f<0){ r*=1+f; g*=1+f; b*=1+f; } else { r+=(255-r)*f; g+=(255-g)*f; b+=(255-b)*f; }
  return "#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join(""); }
function px(x,c,X,Y,w=1,h=1){ x.fillStyle=c; x.fillRect(X,Y,w,h); }
function outline(c, col="#1a1420"){ // 1px dark outline around opaque pixels
  const w=c.width,h=c.height, x=c.getContext("2d"), d=x.getImageData(0,0,w,h), o=new Uint8ClampedArray(d.data);
  const r=parseInt(col.slice(1,3),16),g=parseInt(col.slice(3,5),16),b=parseInt(col.slice(5,7),16);
  for (let j=0;j<h;j++) for (let i=0;i<w;i++){ const k=(j*w+i)*4; if (d.data[k+3]>0) continue;
    let near=false; for (const [a,bb] of [[1,0],[-1,0],[0,1],[0,-1]]){ const ii=i+a,jj=j+bb; if(ii>=0&&jj>=0&&ii<w&&jj<h&&d.data[(jj*w+ii)*4+3]>128){near=true;break;} }
    if (near){ o[k]=r;o[k+1]=g;o[k+2]=b;o[k+3]=255; } }
  x.putImageData(new ImageData(o,w,h),0,0); return c; }

// ---------------- Tiles ----------------
export function tile(reg, id, frame=0, n=0){
  const key = "t"+reg.id+"_"+id+"_"+frame; if (cache.has(key)) return cache.get(key);
  const p=reg.pal, [c,x]=mk(16,16), s=id*31+frame;
  const noise=(base,cols,dens)=>{ px(x,base,0,0,16,16); for(let j=0;j<16;j++)for(let i=0;i<16;i++){ const r=hash(i,j,s+7); if(r<dens) px(x,cols[Math.floor(hash(i,j,s)*cols.length)],i,j);} };
  const snow = reg.ground==="snow";
  switch(id){
    case T.GRASS: case T.TREE: case T.BUSH: case T.ROCK: case T.HOUSE: case T.FENCE:
      noise(p.g1,[p.g2,p.g3],0.18);
      if (!snow && reg.ground!=="cave") for(let k=0;k<5;k++){ const i=Math.floor(hash(k,1,s)*15), j=Math.floor(hash(k,2,s)*14); px(x,p.g3,i,j); px(x,p.g2,i,j+1); }
      break;
    case T.FLOWER: noise(p.g1,[p.g2,p.g3],0.18);
      for(let k=0;k<3;k++){ const i=2+Math.floor(hash(k,3,s+n)*11), j=2+Math.floor(hash(k,4,s+n)*11); const fc=[ "#f4e06a","#f0a0c0","#ffffff","#a0c8ff",p.accent][k%5];
        px(x,fc,i,j); px(x,fc,i+1,j); px(x,fc,i,j+1); px(x,fc,i+1,j+1); px(x,shade(fc,-0.3),i+1,j+1); px(x,p.g2,i,j+2); } break;
    case T.TALL: noise(p.g2,[p.g1],0.2); for(let k=0;k<7;k++){ const i=Math.floor(hash(k,5,s)*15); const sw=frame%2; for(let j=4;j<15;j++) px(x, j<8?p.g3:p.g1, i+(j<8?sw:0), j); } break;
    case T.PATH: noise(p.path,[shade(p.path,-0.1),shade(p.path,0.1)],0.25); for(let k=0;k<3;k++){ const i=Math.floor(hash(k,6,s)*14),j=Math.floor(hash(k,7,s)*14); px(x,shade(p.path,-0.25),i,j,2,1);} break;
    case T.SAND: noise(p.sand,[p.sand2,shade(p.sand,0.15)],0.25); break;
    case T.SNOW: noise(shade(p.g3,0.05),["#ffffff","#dce6f0"],0.3); px(x,"#c8d4e4",2,12,6,1); px(x,"#c8d4e4",9,6,5,1); break;
    case T.MUD: noise("#6a5038",["#5a4028","#7a6048"],0.3); px(x,"#8a7058",4+frame%3,5,2,2); px(x,"#4a3020",10,10,3,2); break;
    case T.SHALLOW: { noise(p.sh,[shade(p.sh,0.08)],0.1); const o=frame*2; for(let j=2;j<16;j+=5) for(let i=0;i<16;i++) if(((i+o+j)%8)<3) px(x,shade(p.sh,0.25),i,j); break; }
    case T.DEEP: case T.LAKE: { const b = id===T.LAKE?p.deep2:p.deep; noise(b,[shade(b,-0.08)],0.12); const o=frame*2;
      for(let j=3;j<16;j+=6) for(let i=0;i<16;i++) if(((i+o+j*2)%10)<3) px(x,shade(b,0.22),i,j);
      if (id===T.LAKE){ px(x,"#ffffff",(frame*4)%16,8,1,1); px(x,shade(b,0.4),0,0,16,1); } break; }
    case T.BRIDGE: case T.PLANK: { const base = id===T.BRIDGE? "#8a6038" : "#9a7448"; px(x,base,0,0,16,16);
      for(let j=0;j<16;j+=4){ px(x,shade(base,-0.3),0,j+3,16,1); px(x,shade(base,0.15),0,j,16,1); }
      px(x,shade(base,-0.4),3,1,1,1); px(x,shade(base,-0.4),11,9,1,1); if(id===T.BRIDGE){ px(x,"#5a3a20",0,0,1,16); px(x,"#5a3a20",15,0,1,16);} break; }
    case T.ICE: noise("#bfe4f4",["#d8f0fa","#a8d4ec"],0.2); px(x,"#ffffff",3,4,5,1); px(x,"#ffffff",8,11,4,1); px(x,"#90c0dc",1,14,14,1); break;
    case T.FLOOR: noise(p.g1,[p.g2,p.g3],0.25); if (hash(1,1,s+n)<0.5) { px(x,p.accent,Math.floor(hash(2,2,s)*14),Math.floor(hash(3,3,s)*14)); } break;
    case T.WALL: noise(p.cliff,[p.cliff2,shade(p.cliff,0.1)],0.3); break;
    case T.CLIFF: { px(x,p.cliff,0,0,16,16); px(x,shade(p.cliff,0.2),0,0,16,4); for(let j=5;j<16;j+=3) px(x,p.cliff2,0,j,16,1); for(let i=2;i<16;i+=5) px(x,p.cliff2,i,4,1,12); break; }
    case T.VOID: { const g=x.createLinearGradient(0,0,0,16); g.addColorStop(0,reg.ground==="cave"?"#0a0810":shade(p.sky1,-0.3)); g.addColorStop(1,reg.ground==="cave"?"#000":shade(p.sky1,-0.1)); x.fillStyle=g; x.fillRect(0,0,16,16);
      if (reg.ground!=="cave") { px(x,"#ffffff22",(n*5)%14,(n*3)%14,3,1); } break; }
    default: px(x,"#f0f",0,0,16,16);
  }
  cache.set(key,c); return c;
}

// tall props (drawn y-sorted): trees, rocks, bushes, walls, cliffs-as-blocks
export function prop(reg, id, n=0, frame=0){
  const v = n%50, family=v%3, form=v%10, tint=(Math.floor(v/10)-2)*0.055; const key="p"+reg.id+"_"+id+"_"+v+"_"+frame; if (cache.has(key)) return cache.get(key);
  const p=reg.pal; let c,x;
  if (id===T.TREE){ [c,x]=mk(22,30);
    const snow=reg.ground==="snow", sway = frame%2;
    px(x,p.trunk,9,20,4,9); px(x,shade(p.trunk,-0.3),12,20,1,9); px(x,shade(p.trunk,0.2),9,20,1,9);
    if (snow || reg.id==="mirror" && family===1) { // conifer
      for (let k=0;k<4;k++){ const w=6+k*3, y=2+k*5; px(x,p.tree,11-w/2|0,y,w,6); px(x,p.tree2,11-w/2|0,y,Math.max(2,w/2|0),2); if(snow) px(x,"#ffffff",11-w/2|0,y,w,1); }
    } else if (reg.ground==="cave") { // mushroom tree
      px(x,"#d0c0e0",9,12,4,16); const g=p.tree; for(let j=0;j<10;j++){ const w=20-Math.abs(j-4)*2; px(x, j<3?p.tree2:g, 11-w/2, 2+j, w,1);} px(x,p.accent,6,6,2,2); px(x,p.accent,14,5,2,2);
    } else {
      const cx=11+(form%3-1)+sway*(family===0?1:0), canopyH=16+form%5, radius=7.5+form%4, leafLight=shade(p.tree2,tint), leafDark=shade(p.tree,tint/2);
      for (let j=0;j<canopyH;j++){ const w=Math.round(Math.sqrt(Math.max(0,radius*radius-(j-canopyH/2)**2))*2.1); px(x,j<canopyH*0.34?leafLight:(j>canopyH*0.78?shade(leafDark,-0.2):leafDark),cx-w/2|0,j+1,w,1); }
      for (let k=0;k<3+form%5;k++) px(x,shade(leafLight,0.15),cx-6+Math.floor(hash(k,v,9)*12),3+Math.floor(hash(k,v,3)*(canopyH-5)),2,1);
      if (reg.id==="ember") { px(x,"#f0c050",cx-4,6,2,2); px(x,"#f0c050",cx+3,10,2,2); }
      if (reg.id==="woods" && family===2) { px(x,"#f0f0d0",cx-3,12,1,1); }
    }
    outline(c,"#14201a");
  } else if (id===T.ROCK){ [c,x]=mk(18,16);
    const col = reg.ground==="snow"?p.rock:p.rock;
    for (let j=0;j<12;j++){ const w=Math.round(Math.sqrt(Math.max(0,36-(j-6)**2))*2.4); px(x, j<4?shade(col,0.2):(j>8?p.rock2:col), 9-w/2|0, 3+j, w,1); }
    px(x,shade(col,0.35),5,5,3,1); if (reg.ground==="snow") px(x,"#ffffff",5,3,8,2); if(reg.ground==="forest"||reg.ground==="marsh") px(x,"#5a8a4a",4,12,4,2);
    outline(c);
  } else if (id===T.BUSH){ [c,x]=mk(18,16);
    for (let j=0;j<11;j++){ const w=Math.round(Math.sqrt(Math.max(0,30-(j-5.5)**2))*2.6); px(x, j<4?p.tree2:p.tree, 9-w/2|0, 4+j, w,1); }
    if (v===1) { px(x,"#e05060",6,7,2,2); px(x,"#e05060",11,10,2,2); } if (reg.ground==="snow") px(x,"#fff",4,4,10,2);
    outline(c,"#14201a");
  } else if (id===T.WALL || id===T.CLIFF){ [c,x]=mk(16,16+ (id===T.WALL?12:8));
    const top = id===T.WALL?p.cliff:p.cliff, h=c.height;
    px(x,shade(top,0.15),0,0,16,16); for(let k=0;k<6;k++) px(x,shade(top,0.28),Math.floor(hash(k,n,1)*14),Math.floor(hash(k,n,2)*14),2,1);
    px(x,p.cliff2,0,16,16,h-16); for(let j=17;j<h;j+=3) px(x,shade(p.cliff2,-0.2),0,j,16,1); for (let i=3;i<16;i+=6) px(x,shade(p.cliff2,-0.3),i+(n%2),16,1,h-16);
    if (reg.ground==="cave" && v===0) { px(x,p.accent,4,20,1,3); px(x,p.accent,10,22,1,2); }
    if (reg.ground==="snow") px(x,"#ffffff",0,0,16,3);
  } else if (id===T.FENCE){ [c,x]=mk(16,12); px(x,"#7a5a38",1,2,2,10); px(x,"#7a5a38",13,2,2,10); px(x,"#9a7a50",0,4,16,2); px(x,"#9a7a50",0,8,16,2); outline(c); }
  else { [c,x]=mk(16,16); }
  cache.set(key,c); return c;
}

// ---------------- Characters ----------------
const BASE_DOWN = [
"....HHHH....","...HHHHHH...","..HHHHHHHH..","..HSSSSSSH..","..SSESSESS..","..SSSSSSSS..","...SSmSSS...",
"..CCCCCCCC..",".SCCCCCCCCS.",".SCCccCCCCS.","..CCCCCCCC..","..cccccccc..","...PP..PP...","...PP..PP...","...BB..BB...","............"];
const BASE_UP = [
"....HHHH....","...HHHHHH...","..HHHHHHHH..","..HHHHHHHH..","..HHHHHHHH..","..SHHHHHHS..","...SSSSSS...",
"..CCCCCCCC..",".SCCCCCCCCS.",".SCCCCCCCCS.","..CCCCCCCC..","..cccccccc..","...PP..PP...","...PP..PP...","...BB..BB...","............"];
const BASE_SIDE = [
"....HHHH....","...HHHHHH...","...HHHHHHH..","...HHSSSSS..","...HSSSESS..","...SSSSSSS..","....SSSSm...",
"...CCCCCC...","...CCCCCCS..","...CcCCCCS..","...CCCCCC...","...cccccc...","....PPPP....","....PP.PP...","....BB.BB...","............"];
function animalHuman(look,dir){
  const key="animal"+look.animal+dir;if(cache.has(key))return cache.get(key);
  const [c,x]=mk(24,22),id=Number((look.animal.match(/\d+$/)||["1"])[0]);
  if(typeof Image!=="undefined"){
    const img=new Image();img.onload=()=>{x.clearRect(0,0,24,22);if(dir==="left"){x.save();x.translate(24,0);x.scale(-1,1);}if(dir==="up"){x.save();x.translate(0,22);x.scale(1,-1);}x.drawImage(img,0,0,24,22);if(dir==="left"||dir==="up")x.restore();};img.src="img/animals/animal-"+String(id).padStart(3,"0")+".png";
  }
  cache.set(key,c);return c;
}
export function human(look, dir, frame, opts={}){
  if(look.animal)return animalHuman(look,dir);
  const key="h"+JSON.stringify(look)+dir+frame+(opts.act||""); if (cache.has(key)) return cache.get(key);
  const [c,x]=mk(14,18); const tpl = dir==="up"?BASE_UP:(dir==="down"?BASE_DOWN:BASE_SIDE);
  const col = { H:look.hair, S:look.skin, E:"#201820", m:shade(look.skin,-0.25), C:look.coat, c:shade(look.coat,-0.3), P:look.pants||"#4a3a3a", B:look.boots||"#5a3a22" };
  const rows = tpl.map(r=>r.split(""));
  // walking frames lift a foot
  if (frame===1){ rows[14]=rows[14].map((ch,i)=>i<6&&ch==="B"?".":ch); rows[13]=rows[13].map((ch,i)=>i<6&&ch==="P"?"B":ch); }
  if (frame===3){ rows[14]=rows[14].map((ch,i)=>i>=6&&ch==="B"?".":ch); rows[13]=rows[13].map((ch,i)=>i>=6&&ch==="P"?"B":ch); }
  if (look.style==="long") { for (let j=3;j<9;j++){ if(dir!=="right"&&dir!=="left"){ rows[j][2]="H"; rows[j][9]="H"; } else { rows[j][3]="H"; } } if (dir==="up") for (let j=5;j<9;j++) for (let i=3;i<9;i++) rows[j][i]="H"; }
  if (look.style==="tied") { if (dir==="up"||dir==="down"){ rows[1][10]="H"; rows[2][10]="H"; rows[2][11]="H"; } else { rows[2][2]="H"; rows[3][2]="H"; rows[4][1]="H"; } }
  if (look.style==="short" && dir==="down") { rows[3][2]="S"; rows[3][9]="S"; }
  if (look.small) { rows.splice(9,1); rows.unshift("............".split("")); }
  for (let j=0;j<16;j++) for (let i=0;i<12;i++){ const ch=rows[j][i]; if (ch!=="."&&col[ch]) px(x,col[ch],i+1,j+1+(frame%2?0:0)); }
  if (look.hat) { const hy = look.small?2:1; px(x,look.hat,3,hy,8,2); px(x,shade(look.hat,-0.25),2,hy+2,10,1); }
  if (look.scarf) { px(x,look.scarf,3,8,8,1); }
  if (dir==="left") { const [c2,x2]=mk(14,18); x2.translate(14,0); x2.scale(-1,1); x2.drawImage(c,0,0); outline(c2); cache.set(key,c2); return c2; }
  outline(c); cache.set(key,c); return c;
}

// ---------------- Creatures ----------------
export function creature(type, def, frame, dir=1){
  const key="c"+type+frame+dir; if (cache.has(key)) return cache.get(key);
  const [c,x]=mk(18,16); const a=def.col, b=def.col2, f=frame%2;
  const ell=(cx,cy,rx,ry,col)=>{ for(let j=-ry;j<=ry;j++){ const w=Math.round(rx*Math.sqrt(Math.max(0,1-(j/ry)**2))); px(x,col,cx-w,cy+j,w*2+1,1);} };
  switch(type){
    case "skipper": ell(9,10,6,3,a); ell(9,9,4,2,shade(a,0.3)); px(x,b,3,11-f,2,3); px(x,b,13,11-f,2,3); px(x,"#102030",11,8,1,1); px(x,"#102030",7,8,1,1); px(x,"#ffffff",9,6-f,1,2); break;
    case "mouse": ell(9,10,5,4,a); for(let i=0;i<5;i++) px(x,b,5+i*2,5+(i%2),1,2); ell(13,8,2,2,shade(a,0.2)); px(x,"#f0c0c0",14,6,2,2); px(x,"#101010",14,8,1,1); px(x,b,3,12,3,1); px(x,b,6,14-f,2,1); px(x,b,11,14-(1-f),2,1); break;
    case "wisp": ell(9,8,4,4,a); px(x,shade(a,0.4),8,6,2,2); for(let i=0;i<4;i++){ px(x,b,4+i*3,12+((i+f)%2),1,3);} px(x,"#203010",7,8,1,1); px(x,"#203010",11,8,1,1); px(x,"#e0ffa0",2,4+f,1,1); px(x,"#e0ffa0",15,5-f,1,1); break;
    case "lantern": ell(9,9,5,6,a); ell(9,8,3,3,"#fff4c0"); px(x,b,5,14,8,2); px(x,b,8,1,2,2); px(x,"#402010",7,9,1,1); px(x,"#402010",11,9,1,1); break;
    case "gustling": for(let k=0;k<3;k++) ell(9+(k-1)*(f?2:-2)|0,7+k*2,5-k,2,k%2?b:a); px(x,"#304060",7,6,1,1); px(x,"#304060",11,6,1,1); px(x,"#ffffff",3,4,2,1); px(x,"#ffffff",13,12,2,1); break;
    case "tortoise": ell(9,9,7,4,b); ell(9,8,6,3,a); for(let i=0;i<3;i++) px(x,shade(b,0.3),5+i*3,7,2,2); ell(15,10,2,2,"#7a6a50"); px(x,"#101010",16,9,1,1); px(x,"#5a4a3a",4,13-f,2,2); px(x,"#5a4a3a",12,13-(1-f),2,2); break;
    case "hare": ell(9,10,5,4,a); px(x,a,11,2,2,6); px(x,a,13,3,2,5); px(x,"#f0c0d0",12,3,1,4); ell(13,8,3,2,a); px(x,"#203040",14,8,1,1); px(x,b,5,13,3,1+f); px(x,"#ffffff",3,9,2,2); break;
    case "carp": ell(8,9,6,3,a); ell(8,8,4,1,shade(a,0.3)); px(x,b,1,7-f,3,5); px(x,b,8,5,3,2); px(x,"#ffffff",12,8,1,1); px(x,"#102040",12,8,1,1); for(let i=0;i<3;i++) px(x,shade(a,-0.2),5+i*2,10,1,1); break;
    case "sentinel": ell(9,9,6,6,a); px(x,shade(a,-0.3),3,4,12,2); for(let i=0;i<4;i++) px(x,shade(a,-0.35),4+i*3,12,1,4); px(x,b,6,8,2,2); px(x,b,11,8,2,2); px(x,"#4a3a5a",3,2+f,2,4); px(x,"#4a3a5a",13,2+(1-f),2,4); break;
    case "frostmite": ell(9,9,5,5,a); for(let k=0;k<8;k++){ const an=k/8*Math.PI*2+f*0.3; px(x,b,9+Math.round(Math.cos(an)*6),9+Math.round(Math.sin(an)*6),1,1);} px(x,"#203040",7,8,1,1); px(x,"#203040",11,8,1,1); break;
    case "heron": ell(9,10,4,3,"#b0b8c0"); px(x,"#b0b8c0",9,2,2,8); px(x,"#e0e4e8",10,2,4,2); px(x,"#e0b040",14,3,3,1); px(x,"#202020",12,2,1,1); px(x,"#7a7a70",8,13,1,3); px(x,"#7a7a70",11,13,1,3-f); break;
    case "gull": ell(9,10,5,3,"#f0f0f0"); px(x,"#9aa0a8",4,9,4,2); px(x,"#9aa0a8",10,9,4,2); ell(13,7,2,2,"#ffffff"); px(x,"#f0a020",15,7,2,1); px(x,"#202020",13,6,1,1); break;
    case "traveler": return human({hair:"#6a4a3a",coat:"#8a7a5a",skin:"#d8a880"},"down",frame);
  }
  if (dir<0){ const [c2,x2]=mk(18,16); x2.translate(18,0); x2.scale(-1,1); x2.drawImage(c,0,0); outline(c2); cache.set(key,c2); return c2; }
  outline(c); cache.set(key,c); return c;
}

// ---------------- Guardians (large) ----------------
export const GUARDIANS = {
  kelpback:  { name:"The Inlet Warden", a:"#d07050", b:"#5a8a5a", hp:90, pats:["spray","charge","ring"], calm:"tide stones", desc:"An ancient crab draped in kelp." },
  stag:      { name:"Heartfern Stag", a:"#8a6a4a", b:"#4aa050", hp:110, pats:["charge","zones","ring"], calm:"heartferns", restraint:true, desc:"Its antlers are living ferns." },
  toad:      { name:"Basin Elder", a:"#6a8a5a", b:"#c0b060", hp:130, pats:["zones","spray","ring"], calm:"lily stones", desc:"A toad as wide as a pond." },
  ram:       { name:"Skyward Ram", a:"#e8ecf0", b:"#8a7a6a", hp:150, pats:["charge","gust","ring"], calm:"cloud stones", desc:"Its fleece is made of cloud." },
  salamander:{ name:"Hearth Salamander", a:"#e0703a", b:"#f0c050", hp:170, pats:["spray","zones","charge"], calm:"cinder stones", desc:"It glows like a banked hearth." },
  elk:       { name:"Icecrown Elk", a:"#a0b0c8", b:"#e0f4ff", hp:190, pats:["charge","ring","spray"], calm:"thaw stones", terrain:true, desc:"Its antlers are icicles." },
  swan:      { name:"Twin-Sky Swan", a:"#f8f8ff", b:"#8ab0e0", hp:200, pats:["mirror","ring","zones"], calm:"mirror stones", reflect:true, desc:"Two swans, one in air, one in water." },
  wyrm:      { name:"Mosswyrm", a:"#5a8a5a", b:"#a0f0c0", hp:220, pats:["zones","spray","charge","ring"], calm:"spring stones", desc:"A great worm furred with moss." },
};
export function guardian(g, frame, mood=0){
  const key="g"+g+frame+mood; if (cache.has(key)) return cache.get(key);
  const G=GUARDIANS[g], [c,x]=mk(48,44), a=G.a, b=G.b, f=frame%2;
  const ell=(cx,cy,rx,ry,col)=>{ for(let j=-ry;j<=ry;j++){ const w=Math.round(rx*Math.sqrt(Math.max(0,1-(j/ry)**2))); px(x,col,cx-w,cy+j,w*2+1,1);} };
  const eye=(X,Y)=>{ px(x,"#ffffff",X,Y,3,3); px(x, mood>0?"#2a6a4a":"#201010",X+1,Y+1,1,1+(mood>0?0:1)); };
  switch(g){
    case "kelpback": ell(24,28,18,10,a); ell(24,25,15,6,shade(a,0.2)); for(let i=0;i<4;i++){ px(x,shade(a,-0.3),6+i*3,36,2,6-f); px(x,shade(a,-0.3),34+i*3,36,2,6-(1-f)); }
      ell(6,18-f*2,5,4,a); ell(42,18-(1-f)*2,5,4,a); px(x,b,10,20,28,3); px(x,b,14,18,3,8); px(x,b,30,17,3,9); eye(18,16); eye(27,16); break;
    case "stag": ell(24,30,16,8,a); ell(36,20,6,6,a); px(x,shade(a,-0.3),12,36,3,7-f); px(x,shade(a,-0.3),20,36,3,7); px(x,shade(a,-0.3),28,36,3,7-(1-f)); px(x,shade(a,-0.3),34,36,3,7);
      for(let k=0;k<5;k++){ px(x,b,30+k*2,4+k,2,10-k); px(x,shade(b,0.3),40-k*2,3+k,2,9-k); } px(x,shade(b,0.2),28,8,14,2); eye(37,18); px(x,"#ffffff",14,28,2,2); break;
    case "toad": ell(24,30,20,12,a); ell(24,34,14,6,b); ell(14,18,5,5,a); ell(34,18,5,5,a); eye(12,16); eye(32,16); px(x,shade(a,-0.4),12,28+f,24,1); for(let i=0;i<6;i++) px(x,shade(a,0.2),8+i*6,24+(i%2)*3,2,2); break;
    case "ram": ell(24,28,18,11,a); for(let i=0;i<8;i++) ell(10+i*4,22+(i%2)*2,3,3,shade(a,0.06)); ell(24,18,7,6,b); px(x,shade(b,-0.3),12,36,3,7-f); px(x,shade(b,-0.3),33,36,3,7-(1-f));
      for(let k=0;k<8;k++){ const an=k/8*Math.PI*1.5; px(x,"#c0a070",14+Math.round(Math.cos(an)*5),14+Math.round(Math.sin(an)*5),2,2); px(x,"#c0a070",34-Math.round(Math.cos(an)*5),14+Math.round(Math.sin(an)*5),2,2);} eye(20,16); eye(26,16); break;
    case "salamander": ell(24,28,18,7,a); ell(24,26,14,4,shade(a,0.25)); ell(40,24,6,5,a); px(x,shade(a,-0.3),2,28,8,3); for(let i=0;i<5;i++) px(x,b,10+i*6,22-f,3,3); px(x,shade(a,-0.4),12,34,3,6-f); px(x,shade(a,-0.4),32,34,3,6-(1-f)); eye(40,21); break;
    case "elk": ell(22,30,16,8,a); ell(36,20,6,7,a); px(x,shade(a,-0.3),10,36,3,7-f); px(x,shade(a,-0.3),18,36,3,7); px(x,shade(a,-0.3),28,36,3,7-(1-f));
      for(let k=0;k<6;k++){ px(x,b,28+k*3,1+(k%2)*3,2,12-(k%3)*2); } px(x,"#ffffff",26,10,20,2); eye(37,18); break;
    case "swan": ell(22,28,16,8,a); ell(18,26,10,5,shade(a,-0.05)); px(x,a,34,8,4,18); ell(37,9,4,3,a); px(x,"#f0a040",40,9,6,2); px(x,"#202020",41,10,4,1); eye(36,7);
      px(x,b,6,36+f,32,2); px(x,shade(b,0.3),10,39,24,1); break;
    case "wyrm": for(let k=0;k<7;k++){ ell(6+k*6,30-Math.round(Math.sin(k*0.9+f)*5),6,6,k%2?a:shade(a,0.1)); px(x,b,4+k*6,24-Math.round(Math.sin(k*0.9+f)*5),3,2);} ell(42,18,6,6,a); eye(40,15); px(x,b,44,22,4,2); break;
  }
  outline(c,"#140c18"); cache.set(key,c); return c;
}

// ---------------- Objects & landmarks ----------------
const LAND = {
  tree:["leaning_tree","chime_tree","copper_tree","ash_tree","whitebark","inverted_tree","buried_tree","heartfern","glow_grove","fern_arch"],
  lighthouse:["lighthouse"], stone:["rock_arch","stone_post","goat_rock","frost_post","mirror_stone","signpost","waystone","summit_stone","echo_stone","storm_stones","heron_stones","whistle_stones","pulse_pillar","ice_arch","pass","crossroads"],
  cairn:["cairn_small","cairns","ridge_cairn"], hut:["workshop","herb_camp","stilt_house","camp","boathouse","shelter_frame","shelter_door","seed_vault","orchard_cart","quarry_crane","hamlet_well"],
  kiln:["kiln","hollow_home"], bell:["hollow_bell","lantern_posts","kite_post","channel_posts","foxfire","net_post"], door:["root_door","soot_gate","root_wall","stream_grate","sluice"],
  pool:["tidepools","steam_pool","warm_spring","spring","pools","inlet","basin","twin_sky","eye","confluence","rootheart","mushroom_ring"],
  nest:["nest","eagle_nest","burrow_mound","driftwood_pile","great_log","shelter_site"], bridge:["squirrel_bridge","ice_bridge","boardwalk","broken_bridge","dock","homeboat"], crystal:["ice_crown"],
};
const LAND_OF = {}; for (const k in LAND) for (const s of LAND[k]) LAND_OF[s]=k;
export function landmark(reg, sub, frame=0, state=0){
  const key="L"+reg.id+sub+frame+state; if (cache.has(key)) return cache.get(key);
  const p=reg.pal, kind=LAND_OF[sub]||"stone"; let [c,x]=mk(36,44);
  const ell=(cx,cy,rx,ry,col)=>{ for(let j=-ry;j<=ry;j++){ const w=Math.round(rx*Math.sqrt(Math.max(0,1-(j/ry)**2))); px(x,col,cx-w,cy+j,w*2+1,1);} };
  const lit = state>0;
  switch(kind){
    case "tree": { const lean = sub==="leaning_tree"?1:0;
      for (let j=0;j<22;j++) px(x,p.trunk,15+(lean?Math.round((22-j)*0.5):0)-(j>18?2:0),20+j*0.9|0,6,2);
      const cc = sub==="ash_tree"?"#4a4040":sub==="whitebark"?"#e8e8e0":sub==="copper_tree"?"#e07a30":sub==="glow_grove"||sub==="mushroom_ring"?p.tree2:p.tree;
      const cx = lean?26:18; ell(cx,13,15,11,cc); ell(cx-3,9,9,6,shade(cc,0.2));
      if (sub==="chime_tree"){ for(let i=0;i<4;i++){ px(x,"#c0c8d0",8+i*6,24,1,6+i%2*2); } }
      if (sub==="heartfern"){ for(let i=0;i<6;i++) px(x,"#8af08a",8+i*4,4+Math.round(Math.sin(i+frame)*1),2,8); }
      if (sub==="inverted_tree"){ c=null; [c,x]=mk(36,44); ell(18,32,14,8,p.tree); px(x,p.trunk,16,6,5,22); for(let i=0;i<5;i++) px(x,p.trunk,8+i*5,2+i%2*2,2,6); if (lit) ell(18,32,10,5,"#fff0a0"); }
      if (lit && sub!=="inverted_tree") { ell(cx,13,4,3,"#fff4b0"); }
      break; }
    case "lighthouse": px(x,"#e8e0d0",12,10,12,32); for(let j=14;j<42;j+=8) px(x,"#c04030",12,j,12,3); px(x,"#3a3a4a",10,4,16,7); px(x, lit?"#fff080":"#405060",13,5,10,5); px(x,"#3a3a4a",16,0,4,4);
      px(x,p.tree,8,34,4,8); px(x,p.trunk,10,38,18,2); px(x,p.trunk,24,30,2,10); if (lit) { x.fillStyle="#fff08040"; x.fillRect(0,4,36,6);} break;
    case "stone": px(x,p.rock,11,10,14,32); px(x,shade(p.rock,0.2),11,10,5,32); px(x,shade(p.rock,-0.25),20,10,5,32); ell(18,10,7,3,shade(p.rock,0.15));
      for(let i=0;i<4;i++) px(x, lit?p.accent:shade(p.rock,-0.4), 15, 16+i*6, 6,1); if (sub==="rock_arch"||sub==="ice_arch"||sub==="pass") { px(x,p.rock,2,8,8,34); px(x,p.rock,26,8,8,34); px(x,p.rock,2,4,32,8);} break;
    case "cairn": for(let k=0;k<4;k++) ell(18,38-k*7,10-k*2,4,k%2?p.rock:shade(p.rock,0.15)); if (lit) px(x,p.accent,17,10,2,2); break;
    case "hut": { const roof = sub==="stilt_house"||sub==="boathouse"?"#4a6a7a":sub==="seed_vault"?"#6a5a7a":"#a05a3a";
      px(x,"#c8a878",4,20,28,20); px(x,shade("#c8a878",-0.2),4,36,28,4); for(let j=0;j<12;j++) px(x,j<2?shade(roof,0.25):roof,2+(j<6?6-j:0),8+j,32-(j<6?(6-j)*2:0),1);
      px(x,"#5a3a2a",15,28,7,12); px(x, lit||sub==="camp"?"#ffd070":"#405060",7,24,5,5); px(x,"#ffd070",25,24,5,5); if(sub==="stilt_house"||sub==="boathouse"){ px(x,"#5a4030",6,40,2,4); px(x,"#5a4030",28,40,2,4);} 
      if (sub==="camp") { c=null; [c,x]=mk(36,44); px(x,"#c09060",4,22,28,2); for(let j=0;j<16;j++) px(x,"#d8b880",18-j,22+j*0,1,1); for(let j=0;j<18;j++){ px(x,"#e0c890",18-j,22+j,j*2+1,1);} px(x,"#6a4a30",17,22,2,18); }
      if (sub==="hamlet_well") { c=null; [c,x]=mk(36,44); ell(18,34,10,5,"#8a8a90"); ell(18,33,7,3,"#30506a"); px(x,"#6a4a30",8,14,2,20); px(x,"#6a4a30",26,14,2,20); px(x,"#a05a3a",5,10,26,5);} 
      break; }
    case "kiln": ell(18,32,14,10,"#a06040"); ell(18,26,10,8,"#b87050"); px(x,"#3a2018",13,30,10,8); if (lit){ px(x,"#ff9030",14,32,8,6); px(x,"#ffe080",16,34,4,3);} px(x,"#7a4a30",15,10,6,10); break;
    case "bell": px(x,"#6a4a30",6,6,3,36); px(x,"#6a4a30",27,6,3,36); px(x,"#6a4a30",4,4,28,4); ell(18,18,6,8, lit?"#e0c060":"#7a7a80"); px(x,lit?"#e0c060":"#7a7a80",11,24,14,2); px(x,"#4a3a20",17,26,2,3);
      if (sub==="foxfire"||sub==="lantern_posts") { c=null; [c,x]=mk(36,44); for(let i=0;i<3;i++){ px(x,"#6a4a30",6+i*11,14,2,28); ell(7+i*11,12,3,3, lit?"#a0ffb0":"#506050"); } }
      if (sub==="kite_post") { px(x,"#e05a6a",22,0,10,8); px(x,"#f0e060",2,2,8,8); }
      break;
    case "door": px(x,p.cliff2,2,6,32,38); ell(18,22,11,14, lit?"#2a1a10":p.trunk); for(let i=0;i<5;i++) px(x, lit?p.accent:shade(p.trunk,0.25),9+i*4,10,2,26); break;
    case "pool": ell(18,32,16,9,shade(p.rock,-0.1)); ell(18,31,13,7, sub==="steam_pool"||sub==="warm_spring"?"#7ac0c8":p.deep2); px(x,"#ffffff",10+frame%6,30,4,1);
      if (sub==="steam_pool"||sub==="warm_spring") for(let i=0;i<3;i++) px(x,"#ffffff60",10+i*7,16+((frame+i)%3)*3,3,4);
      if (sub==="rootheart") { ell(18,24,6,6,"#e08a5a"); ell(18,24,3,3,"#ffd0a0"); }
      if (sub==="mushroom_ring") for(let i=0;i<6;i++){ const an=i/6*Math.PI*2; ell(18+Math.round(Math.cos(an)*13),31+Math.round(Math.sin(an)*7),2,2,p.accent);} break;
    case "nest": ell(18,34,15,7,"#8a6a40"); ell(18,32,11,4,"#5a4028"); for(let i=0;i<3;i++) ell(13+i*5,31,2,2,"#f0f0e0");
      if (sub==="great_log") { c=null; [c,x]=mk(36,44); ell(18,30,17,8,p.trunk); ell(4,30,3,7,shade(p.trunk,0.3)); px(x,p.tree2,8,20,6,3);} 
      if (sub==="driftwood_pile"||sub==="shelter_site") { c=null; [c,x]=mk(36,44); for(let i=0;i<5;i++) px(x,shade("#a08a6a",i%2?-0.15:0.1),3+i*2,24+i*3,28-i*3,3); } break;
    case "bridge": px(x,"#8a6038",0,26,36,10); for(let i=0;i<36;i+=5) px(x,"#5a3a20",i,26,1,10); px(x,"#5a3a20",0,22,36,2); px(x,"#5a3a20",2,22,2,16); px(x,"#5a3a20",32,22,2,16);
      if (sub==="homeboat") { c=null; [c,x]=mk(36,44); ell(18,34,15,5,"#b04030"); px(x,"#e0d0b0",4,30,28,2); px(x,"#6a4a30",17,10,2,22); px(x,"#f0f0e0",19,12,10,14); } break;
    case "crystal": for(let i=0;i<5;i++){ px(x,"#c0e8ff",6+i*6,14+Math.abs(2-i)*4,4,30-Math.abs(2-i)*4); px(x,"#ffffff",6+i*6,14+Math.abs(2-i)*4,1,26-Math.abs(2-i)*4);} break;
  }
  outline(c); cache.set(key,c); return c;
}

export function objSprite(reg, o, frame){
  const p=reg.pal; const key="o"+reg.id+o.kind+(o.sub||"")+(o.on?1:0)+(o.open?1:0)+(o.dir??"")+(o.m||"")+(o.rot??"")+(o.item||"")+frame+(o.filled?1:0)+(o.wet?1:0)+(o.flash>0?1:0)+(o.glow?1:0)+(o.phaseState||0)+(o.tilled?1:0)+(o.crop?Math.floor(o.crop.growth*4)+o.crop.item:"")+(o.saved?1:0)+(o.done?1:0)+(o.dirs?o.dirs.join(""):"");
  if (cache.has(key)) return cache.get(key);
  let [c,x]=mk(16,20);
  const ell=(cx,cy,rx,ry,col)=>{ for(let j=-ry;j<=ry;j++){ const w=Math.round(rx*Math.sqrt(Math.max(0,1-(j/ry)**2))); px(x,col,cx-w,cy+j,w*2+1,1);} };
  const f=frame%2;
  switch(o.kind){
    case "chest": case "cache": if (o.open){ px(x,"#5a3a20",2,10,12,8); px(x,"#3a2010",3,9,10,2); } else { px(x,"#8a5a30",2,8,12,10); px(x,"#a87040",2,8,12,3); px(x,"#e0c060",7,11,2,3); } break;
    case "sign": px(x,"#6a4a30",7,10,2,9); px(x,"#a88050",1,4,14,7); px(x,"#6a4a30",3,6,9,1); px(x,"#6a4a30",3,8,7,1); break;
    case "pickup": { const it=o.item; const col = { shell:"#f0e0d0", driftwood:"#b09070", reed:"#c0c060", glowseed:"#f0f080", fiber:"#a07050", foxglove:"#c060c0", lily:"#f0a0d0", fruit:"#e04040", copperleaf:"#e08030", charcoal:"#303030", pinewood:"#7a5a3a", seed:"#c0a060", chime:"#c0c8d0", kite:"#e05a6a", berry:"#d03060", clay:"#a0a0a8", stone:"#8e9499", quartz:"#e8e3d9", mica:"#a9b4b0", river_pebble:"#708b91", mushroom:"#9ff0d0", blackberry:"#44304e", blueberry:"#5067ad", wild_strawberry:"#d84d64", raspberry:"#ba4052", serviceberry:"#645a9c", pawpaw:"#a7b957", prickly_pear:"#cf6a83", wild_plum:"#775078", cranberry:"#a73b59", wild_grape:"#6a4975", huckleberry:"#4d426f", cattail_shoot:"#83a750", dandelion_greens:"#83a75a", wild_onion:"#b1a56b", fiddlehead:"#67a455", nettle_tea:"#6f9b60", rosehip:"#c64d69", acorn:"#906b3e", morel:"#8a644a", chanterelle:"#d9a340", oyster_mushroom:"#d5d1c3", chicken_mushroom:"#de9854", puffball:"#eee7d9", lion_mane:"#e5d1aa", river_fish:"#739ab4", cooked_fish:"#bf8454", roasted_berry:"#bd4758", axe:"#835d40", shovel:"#8c704a", fishing_pole:"#a88750" }[it] || "#e0c060";
      if (it&&it.startsWith("w:")) { px(x,"#a08060",3,14-f,11,2); px(x,"#7a5a40",12,13-f,3,3); }
      else if(it==="river_fish"||it==="cooked_fish"){ell(7,12-f,5,2,col);px(x,col,11,11-f,4,1);px(x,col,3,12-f,2,2);px(x,"#ffffff",9,11-f,1,1);if(it==="cooked_fish")px(x,"#f2d09b",5,12-f,5,1);}
      else if(it==="axe"){px(x,"#79533a",7,6-f,2,11);px(x,"#bac4c5",5,4-f,6,3);px(x,"#eef0e8",5,4-f,3,1);}
      else if(it==="shovel"){px(x,"#79533a",7,7-f,2,10);px(x,"#b8b8aa",4,4-f,8,3);px(x,"#deded0",5,3-f,6,2);}
      else if(it==="fishing_pole"){px(x,"#8b653d",7,2-f,1,15);px(x,"#e8dec0",8,2-f,5,1);px(x,"#d7e9ed",12,3-f,1,4);}
      else if (it==="kite") { px(x,col,4,4-f,8,8); px(x,"#f0e060",7,4-f,2,8); px(x,"#ffffff",8,12-f,1,6); }
      else { ell(8,13-f,4,3,col); ell(7,12-f,2,1,shade(col,0.4)); if (it==="glowseed"||it==="mushroom") { x.fillStyle=col+"40"; x.fillRect(1,6-f,14,13);} }
      px(x,"#ffffff",12,6-f*2,1,1); break; }
    case "hole": ell(8,15,7,4,"#46372a");ell(8,14,5,2,"#211d19");px(x,"#8a7256",2,16,12,2);break;
    case "collectible": ell(8,12,5,6,"#927744");ell(8,11,3,4,"#f2d78b");px(x,"#fff4c7",7,6,3,3);px(x,"#fff4c7",6,10,1,2);break;
    case "secret": ell(8,14,3,2,"#e0c060"); px(x,"#ffffff",8,9+f,1,3); px(x,"#ffffff",7,10+f,3,1); break;
    case "lever": case "tlever": px(x,"#6a6a70",3,15,10,4); px(x,"#4a4a50",3,18,10,1); if (o.on){ px(x,"#8a6a40",9,6,2,10); ell(11,6,2,2,"#d04030"); } else { px(x,"#8a6a40",5,6,2,10); ell(5,6,2,2,"#40a040"); } break;
    case "gate": if (!o.open) { for(let i=0;i<4;i++) px(x,"#6a4a30",1+i*4,2,2,18); px(x,"#8a6a40",0,6,16,2); px(x,"#8a6a40",0,13,16,2); px(x,"#3a8a3a",2,4,3,2); px(x,"#3a8a3a",10,15,4,2); } break;
    case "twall": if (o.solid) { px(x,"#7a5a3a",1,0,14,20); px(x,"#9a7a50",1,0,14,3); for(let j=4;j<20;j+=4) px(x,"#5a3a20",1,j,14,1); px(x,"#e8d8b0",5,6,6,8); } else { px(x,"#7a5a3a40",1,16,14,4); } break;
    case "act": { const s=o.sub;
      if (s==="snag") { if(!o.on){ for(let i=0;i<5;i++){ px(x,"#c0b090",2+i*3,6,1,12); px(x,"#c0b090",1,8+i*2,14,1);} } else px(x,"#c0b09060",2,16,12,2); }
      else if (s==="lever") { px(x,"#6a6a70",3,15,10,4); px(x,"#8a6a40",o.on?9:5,6,2,10); ell(o.on?11:5,6,2,2,o.on?"#40a0d0":"#d0a040"); }
      else if (s==="marker"||s==="carving"||s==="stormmark"||s==="inscription") { px(x,p.rock,2,4,12,15); px(x,shade(p.rock,0.2),2,4,4,15); px(x,o.on?p.accent:shade(p.rock,-0.4),5,8,6,1); px(x,o.on?p.accent:shade(p.rock,-0.4),7,8,1,7); px(x,o.on?p.accent:shade(p.rock,-0.4),5,12,5,1); }
      else if (s==="lantern_plant"||s==="glowcap") { px(x,"#3a6a3a",7,10,2,9); ell(8,8,4,4,o.on?"#c0ffa0":"#4a6a4a"); if(o.on){ ell(8,8,2,2,"#ffffff"); } }
      else if (s==="vine") { for(let j=0;j<20;j+=3) { px(x,"#3a8a3a",7+((j/3)%2?1:-1),j,2,3); px(x,"#5ab05a",4+((j/3)%2)*7,j+1,3,2);} if(o.on) px(x,"#ffe080",6,0,4,2); }
      else if (s==="mound") { if (!o.on) ell(8,15,7,4,"#6a5a40"); else { ell(8,16,6,2,"#4a7a4a"); px(x,"#f0a0c0",6,14,2,2);} }
      else if (s==="branch") { if (!o.on) { px(x,"#5a3a28",0,12,16,3); px(x,"#5a3a28",4,8,2,5); px(x,"#5a3a28",11,9,2,4); px(x,"#7a5a38",0,12,16,1);} else { px(x,"#5a3a2860",2,16,6,2); } }
      else if (s==="root_lock") { ell(8,12,6,7,o.on?"#a0f0c0":"#4a3a5a"); px(x,"#2a1a3a",7,9,2,6); }
      break; }
    case "target": if (o.sub==="gull") return creature("gull",{},frame); if (o.sub==="shelter"||o.sub==="door") { px(x,o.open?"#2a1a10":"#6a4a30",2,4,12,16); px(x,"#4a3a20",2,4,12,2); } break;
    case "seq": { const lit=o.flash>0; if (o.sub==="chime") { px(x,"#6a4a30",7,0,2,4); for(let i=0;i<3;i++) px(x, lit?"#fff0a0":"#b0b8c0", 3+i*4, 4+i%2*2, 2, 10-i%2*2); }
      else { ell(8,12,7,7, lit?"#c0e8ff":p.rock); ell(6,9,2,2,shade(p.rock,0.3)); } px(x,"#ffffff",1,1,2,2); break; }
    case "dial": { ell(8,14,7,4,p.rock2); ell(8,10,6,4,p.rock); ell(8,6,4,3,shade(p.rock,0.15)); const d=[[0,-1],[1,0],[0,1],[-1,0]][o.dir]; px(x,"#1a1420",8+d[0]*3-1,7+d[1]*2-1,3,3); px(x,p.accent,8+d[0]*3,7+d[1]*2,1,1); break; }
    case "mark": { const d=[[0,-1],[1,0],[0,1],[-1,0]][o.dir]; x.fillStyle="#00000050"; for(let k=0;k<5;k++) x.fillRect(7+d[0]*k,10+d[1]*k,2,2); x.fillRect(7+d[0]*5-1+(d[1]?-1:0),10+d[1]*5-1+(d[0]?-1:0), d[0]?2:4, d[1]?2:4); break; }
    case "pipe": { px(x,shade(p.rock,-0.1),0,4,16,16); px(x,shade(p.rock,0.1),0,4,16,1); const ds=o.dirs||[];
      const wc = o.wet?"#60c0f0":"#5a4a3a"; px(x,wc,6,10,4,4); for (const d of ds){ if(d===0) px(x,wc,6,4,4,8); if(d===1) px(x,wc,8,10,8,4); if(d===2) px(x,wc,6,12,4,8); if(d===3) px(x,wc,0,10,8,4);} break; }
    case "source": ell(8,12,7,6,"#60c0f0"); ell(8,11,3,2,"#ffffff"); px(x,p.rock,0,16,16,4); break;
    case "field": if(o.wet){ for(let i=0;i<4;i++) px(x,"#5ab05a",2+i*4,8,2,10);} else { px(x,"#a08a5a",0,8,16,12); px(x,"#7a6a3a",3,12,10,1);} break;
    case "emitter": ell(8,12,6,6,"#f0d060"); ell(8,12,3,3,"#ffffff"); px(x,p.rock,2,16,12,4); break;
    case "mirror": px(x,p.rock,3,15,10,5); if (o.m==="F") for(let i=0;i<12;i++) px(x,"#d0f0ff",2+i,14-i,2,2); else for(let i=0;i<12;i++) px(x,"#d0f0ff",2+i,3+i,2,2); break;
    case "darktree": ell(8,8,7,7,o.on?"#80c070":"#2a3a3a"); px(x,p.trunk,7,12,3,8); if(o.on) ell(8,6,3,2,"#fff0a0"); break;
    case "socket": ell(8,14,6,3,o.filled?p.accent:"#3a3020"); ell(8,14,4,2,o.filled?"#ffffff":"#20180f"); break;
    case "pushable": if (o.sub==="puff") { ell(8,10,5,5,"#f8f8f0"); for(let k=0;k<6;k++){ const an=k/6*Math.PI*2; px(x,"#ffffff",8+Math.round(Math.cos(an)*6),10+Math.round(Math.sin(an)*6),1,1);} } else { ell(8,10,5,5,"#ffe880"); ell(8,10,3,3,"#ffffff"); } px(x,"#00000040",4,17,8,2); break;
    case "resetstone": ell(8,14,6,5,p.rock); px(x,"#ffffff",5,12,6,1); px(x,"#ffffff",10,10,1,3); break;
    case "site": if (o.sub==="bridge") { if(!o.done){ px(x,"#8a6038",2,12,12,3); px(x,"#5a3a20",4,10,1,6); } } else if(!o.done) { px(x,"#7a5a3a",2,4,2,16); px(x,"#7a5a3a",12,4,2,16); px(x,"#7a5a3a",1,4,14,2);} else { [c,x]=mk(32,28); for(let j=0;j<10;j++) px(x,"#a05a3a",14-j,2+j,4+j*2,1); px(x,"#7a5a3a",4,12,2,16); px(x,"#7a5a3a",26,12,2,16); px(x,"#ff9030",14,22,4,4); } break;
    case "garden_plot": {
      px(x,o.tilled?"#78553a":"#597446",1,12,14,6);px(x,o.tilled?"#9a7048":"#6f8a50",2,13,12,3);
      if(o.wet){px(x,"#78b5c4",2,15,12,2);}
      if(o.crop){const h=5+Math.floor(o.crop.growth*6);px(x,"#488548",7,12-h,2,h);px(x,"#65aa58",4,12-h+2,4,2);px(x,"#78b85c",8,12-h+3,4,2);if(o.crop.growth>=1){const col=o.crop.item.includes("mushroom")||["morel","chanterelle","oyster_mushroom"].includes(o.crop.item)?"#e5cfad":"#d54d68";ell(8,12-h,3,3,col);}}
      break;
    }
    case "portal":px(x,"#786246",2,4,2,16);px(x,"#786246",12,4,2,16);px(x,"#a58b61",3,3,10,2);px(x,"#d5c58d",4,7,8,1);px(x,"#6da0aa",5,9,6,7);px(x,"#b7e2db",6,10,4,4);break;
    case "campfire": px(x,"#6b4930",3,14,10,3);px(x,"#8f6844",4,12,8,2);px(x,"#8a8f96",5,14,6,1);px(x,"#e06438",7,6+f,3,7-f);px(x,"#ffc45e",8,9+f,2,4-f);px(x,"#fff0a0",9,7+f,1,2);break;
    case "workbench": px(x,"#68492f",1,8,14,4);px(x,"#b18a59",2,6,12,3);px(x,"#5a3b2a",3,12,2,7);px(x,"#5a3b2a",11,12,2,7);px(x,"#d7c28f",6,4,4,2);break;
    case "cistern": px(x,"#6d543b",2,7,12,11);px(x,"#9a7955",2,6,12,2);px(x,"#5d8ba0",4,10,8,4);px(x,"#b39367",3,17,10,2);break;
    case "meditate": ell(8,15,7,4,"#665642");ell(8,13,5,3,"#b6c99a");px(x,"#f6df93",7,5+f,2,4);break;
    case "rest": px(x,"#6a4a30",2,16,12,2); px(x,"#5a3a20",4,14,8,2); px(x,"#ff9030",5,8+f,6,7-f); px(x,"#ffe080",7,11+f,2,4-f); break;
    case "checkpoint": ell(8,16,7,3,o.on?"#c0e0ff":p.rock); ell(8,15,5,2,shade(p.rock,0.2)); break;
    case "scenic": ell(8,15,6,3,"#8a6a4a"); px(x,"#f0e080",7,6+f,2,2); px(x,"#ffffff",6,8+f,1,1); break;
    case "vent": ell(8,15,6,3, o.phaseState===1?"#f0c080":"#5a4a3a"); ell(8,15,3,2,"#2a1a10"); break;
    case "pulse": px(x,p.rock,3,2,10,18); px(x,shade(p.rock,0.2),3,2,3,18); px(x, o.glow?"#a0f0d0":"#3a3a50",6,6,4,4); break;
    case "nest": [c,x]=mk(28,20); ell(14,12,12,6,"#8a6a40"); ell(14,11,9,3,"#5a4028"); for(let i=0;i<4;i++) ell(8+i*4,10,2,2,"#f0f0e0"); for(let i=0;i<5;i++) px(x,"#9070c0",2+i*6,2,2,6); break;
    case "foxfire": ell(8,8+f,3,3,"#a0ffb0"); ell(8,8+f,1,1,"#ffffff"); break;
    case "stranded": if (o.saved) break; return human({hair:"#4a3a2a", coat:"#a06a4a", skin:"#d8a880", hat:"#7a7a50"},"down",0);
    case "shelterstones": for(let i=0;i<3;i++) px(x,p.rock,1+i*5,8+(i%2)*2,4,10); px(x,"#ffd070",6,4+f,4,2); break;
    case "calmstone": ell(8,14,6,4,o.on?"#a0f0c0":p.rock); ell(8,12,4,3,o.on?"#e0fff0":shade(p.rock,0.2)); px(x,"#ffffff",7,4+f,2,2); break;
    case "bed": ell(8,15,7,3,"#5a4028"); if (o.on) { px(x,"#5ab05a",7,8,2,7); ell(8,8,3,2,"#7ad07a"); } break;
    case "water_edge": px(x,"#ffffff80",0,14+f,16,2); break;
    case "heron": return creature("heron",{},frame);
  }
  if (o.kind!=="mark"&&o.kind!=="foxfire"&&o.kind!=="water_edge"&&o.kind!=="twall") outline(c);
  cache.set(key,c); return c;
}
