// Renders the shared simulation in either Classic Top-Down or 2.5D perspective.
import { TS, VIEW_W as VW, VIEW_H as VH } from "./config.js";
import { T, SOLID, HEIGHT } from "./world.js";
import { tile, prop, human, creature, guardian, landmark, objSprite, mk, shade } from "./art.js";
import { ENEMIES } from "./data.js";

const PROPS = new Set([T.TREE,T.ROCK,T.BUSH,T.WALL,T.CLIFF,T.FENCE]);
const HOR = 42;
let cam = { x:0, y:0 }, modeBlend = 0;
let dark, darkX; const parts = [];

export function heroLook(h){ return h.look; }

export function render(ctx, g, st, time){
  const M=g.M, p=g.p, reg=g.reg, pal=reg.pal, L=g.L, mode25 = st.mode==="2.5d",zoom=Math.max(0.55,Math.min(1.8,st.zoom||1));
  const tgtX = p.x, tgtY = p.y; const k = st.reduceMotion?1:0.15;
  if (Math.abs(cam.x-tgtX)>8||Math.abs(cam.y-tgtY)>8) { cam.x=tgtX; cam.y=tgtY; }
  cam.x += (tgtX-cam.x)*k; cam.y += (tgtY-cam.y)*k;
  const halfW = VW/TS/(2*zoom), halfH = VH/TS/(2*zoom);
  let cx = mode25 ? Math.max(halfW-1, Math.min(M.W-halfW+1, cam.x)) : Math.max(halfW, Math.min(M.W-halfW, cam.x));
  let cy = mode25 ? cam.y : Math.max(halfH, Math.min(M.H-halfH, cam.y));
  if (M.W < halfW*2) cx = M.W/2;
  if (!mode25 && M.H < halfH*2) cy = M.H/2;
  let shx=0, shy=0; if (g.shake>0 && !st.reduceMotion) { shx=(Math.random()-0.5)*3; shy=(Math.random()-0.5)*3; } g.shake=Math.max(0,(g.shake||0)-0.016);
  const frame = Math.floor(time*3)%4, f2 = Math.floor(time*2.5)%2;

  // projection
  const P = mode25 ? (wx,wy,h=0)=>{ const depth=Math.max(0.6,wy-(cy-20)); const s=0.48+depth*0.052; const y=HOR+depth*2.7+depth*depth*0.16-h*TS*s*0.85; return { x:VW/2+(wx-cx)*TS*s+shx, y:y+shy, s, z:depth }; }
                   : (wx,wy,h=0)=>({ x:(wx-cx)*TS+VW/2+shx, y:(wy-cy)*TS+VH/2 - h*TS + shy, s:1, z:9 });
  g._P = P; g._view = {cx,cy,mode25,zoom};
  ctx.imageSmoothingEnabled=false;ctx.save();ctx.translate(VW/2,VH/2);ctx.scale(zoom,zoom);ctx.translate(-VW/2,-VH/2);

  // ---- background ----
  if (mode25) {
    const gr=ctx.createLinearGradient(0,0,0,VH*0.58); gr.addColorStop(0,pal.sky1); gr.addColorStop(0.72,pal.sky2); gr.addColorStop(1,shade(pal.fog,0.16)); ctx.fillStyle=gr; ctx.fillRect(0,0,VW,VH);
    const glow=ctx.createRadialGradient(VW*0.72, HOR+4, 2, VW*0.72, HOR+4, VW*0.52); glow.addColorStop(0,pal.accent+"38"); glow.addColorStop(1,pal.accent+"00"); ctx.fillStyle=glow; ctx.fillRect(0,0,VW,VH*0.62);
    // Layered ridgelines add distance without changing the pixel-art palette.
    for (let layer=0;layer<4;layer++){ const par=0.1+layer*0.11, base=HOR-16+layer*11, col=shade(pal.fog,-0.1-layer*0.1);
      ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(0,VH);
      for (let x=0;x<=VW;x+=3){ const wx=x+cx*TS*par; const y=base+Math.sin(wx*0.013+layer*2)*8+Math.sin(wx*0.031+layer)*4; ctx.lineTo(x, y); }
      ctx.lineTo(VW,VH); ctx.fill(); }
    if (reg.ground==="cave") { ctx.fillStyle="#0c0a14"; ctx.fillRect(0,0,VW,VH); }
  } else { ctx.fillStyle = reg.ground==="cave"?"#0c0a14":pal.deep; ctx.fillRect(0,0,VW,VH); }

  // ---- ground ----
  const bottomScreen=VH/2+VH/(2*zoom),farDepth=Math.max(0.6,(-2.7+Math.sqrt(7.29+0.64*Math.max(0,bottomScreen-HOR)))/0.32);const y0=mode25?Math.floor(cy-20):Math.floor(cy-halfH-1),y1=mode25?Math.ceil(cy-20+farDepth+1):Math.ceil(cy+halfH+1);
  const xspan = mode25 ? Math.ceil(21/zoom) : halfW+2;
  const groundBase = M.cave?T.FLOOR:T.GRASS;
  for (let ty=Math.max(0,y0); ty<=Math.min(M.H-1,y1); ty++) {
    const a=P(0,ty), b=P(0,ty+1); if (b.y < 0 || a.y > VH+4) { continue; }
    for (let tx=Math.max(0,Math.floor(cx-xspan)); tx<=Math.min(M.W-1,Math.ceil(cx+xspan)); tx++) {
      let v=M.get(tx,ty); let gv = PROPS.has(v) ? (v===T.CLIFF||v===T.WALL? (M.cave?T.WALL:T.CLIFF) : groundBase) : v;
      if (v===T.HOUSE) gv=groundBase;
      if (M.stones && M.stonesX && tx>=M.stonesX[0] && tx<=M.stonesX[1]) { gv=T.DEEP; }
      const fr = (gv===T.DEEP||gv===T.SHALLOW||gv===T.LAKE||gv===T.MUD) ? (st.reduceMotion?0:frame) : (gv===T.TALL? (st.reduceMotion?0:f2) : 0);
      const img = tile(reg, gv, fr, (tx*7+ty*13)%5);
      const pa=P(tx,ty), pb=P(tx+1,ty+1);
      const w = mode25 ? (P(tx+1,ty+0.5).x - P(tx,ty+0.5).x) : TS; const x0 = mode25 ? P(tx,ty+0.5).x : pa.x;
      const tileX=Math.floor(x0), tileY=Math.floor(pa.y), tileW=Math.ceil(w)+1, tileH=Math.ceil(pb.y-pa.y)+1;
      ctx.drawImage(img, tileX, tileY, tileW, tileH);
      if (mode25) { const depth=Math.max(0.6,ty-(cy-20)), haze=Math.max(0,(10-depth)/10)*0.16; if(haze>0){ ctx.globalAlpha=haze; ctx.fillStyle=pal.fog; ctx.fillRect(tileX,tileY,tileW,tileH); ctx.globalAlpha=1; } }
      if (v===T.FLOWER && gv===T.FLOWER) {}
    }
  }
  // Selected tiles remain outlined until another tile is inspected.
  if(g.selectedTile&&M.in(g.selectedTile.x,g.selectedTile.y)){const q=P(g.selectedTile.x+0.5,g.selectedTile.y+0.5),s=q.s;ctx.strokeStyle="#fff2a0";ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(q.x,q.y,TS*s*0.48,TS*s*0.35,0,0,Math.PI*2);ctx.stroke();}
  // stepping stones
  if (M.stones) for (const s of M.stones) { if(s.x<cx-xspan-1||s.x>cx+xspan+1||s.y<y0-2||s.y>y1+2)continue;const q=P(s.x+0.5,s.y+0.5); if (s.up) { ctx.fillStyle=pal.rock; ell(ctx,q.x,q.y,7*q.s,5*q.s*(mode25?0.75:1)); ctx.fillStyle=shade(pal.rock,0.25); ell(ctx,q.x-1*q.s,q.y-1*q.s,4*q.s,2.5*q.s); }
    if (s.tele) { ctx.strokeStyle="#ffffff"; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(q.x,q.y,8*q.s,5*q.s,0,0,Math.PI*2); ctx.stroke(); } }
  // ice arrows (safe lines)
  if (L.hz.includes("ice")) for (let ty=Math.max(0,y0);ty<=Math.min(M.H-1,y1);ty++) for (let tx=Math.max(0,Math.floor(cx-xspan));tx<=Math.min(M.W-1,Math.ceil(cx+xspan));tx++) if ((M.m(tx,ty)&1) && M.get(tx,ty)===T.ICE && (tx%3===0)) { const q=P(tx+0.5,ty+0.5); ctx.fillStyle="#3a7ab0"; tri(ctx,q.x,q.y,4*q.s); }
  // zones
  for (const z of M.zones) {
    if (z.type==="tide" && (z.active||z.tele)) { for (let ty=z.y0;ty<z.y1;ty++) for (let tx=z.x0;tx<=z.x1;tx++){ if (z.safe.some(([sx,sy])=>sx===tx&&sy===ty)) continue; const a=P(tx,ty), b=P(tx+1,ty+1);
        if (z.active) { ctx.fillStyle=pal.sh+"cc"; ctx.fillRect(a.x,a.y,b.x-a.x+1,b.y-a.y+1); } else if (tx===z.x1) { ctx.fillStyle="#ffffff"; ctx.fillRect(b.x-2,a.y,2,b.y-a.y); } }
      for (const [sx,sy] of z.safe) { const q=P(sx+0.5,sy+0.5); ctx.fillStyle=pal.rock; ell(ctx,q.x,q.y,8*q.s,6*q.s); ctx.fillStyle="#ffffff"; ctx.fillRect(q.x-1,q.y-1,2,2); } }
    else if (z.type==="tide") for (const [sx,sy] of z.safe) { const q=P(sx+0.5,sy+0.5); ctx.fillStyle=pal.rock; ell(ctx,q.x,q.y,8*q.s,6*q.s); }
    if ((z.type==="gust" && (z.tele||z.active)) || z.type==="wind" || z.type==="current") { ctx.strokeStyle = z.active?"#ffffff":"#ffffffaa"; ctx.lineWidth=1;
      const n = z.type==="gust"?14:8; for (let i=0;i<n;i++){ const ph=(time*(z.type==="gust"?3:1)+i*0.37)%1; const wx=z.x0+((i*1.7)%(z.x1-z.x0+1)), wy=(z.y0??0)+((i*3.3+ph*(z.type==="wind"?10:0))%((z.y1??M.H)-(z.y0??0)));
        const q=P(wx+(z.type!=="wind"?-ph*3*(z.dir[0]||0):0), wy + (z.type==="current"? ph*2*z.dir[1]:0)); const L2=(z.active?10:5)*q.s;
        ctx.beginPath(); ctx.moveTo(q.x,q.y); ctx.lineTo(q.x+z.dir[0]*L2+(z.dir[1]?0:0), q.y+z.dir[1]*L2*0.8); ctx.stroke();
        if (i%3===0) { ctx.fillStyle="#ffffffaa"; arrowHead(ctx, q.x+z.dir[0]*L2, q.y+z.dir[1]*L2*0.8, z.dir, 2*q.s); } } }
  }
  // puddles
  for (const q0 of g.puddles) { const q=P(q0.x,q0.y); ctx.fillStyle="#5a4a30aa"; ell(ctx,q.x,q.y,q0.r*TS*q.s,q0.r*TS*q.s*0.6); }
  // beam
  if (M.beamPath) { ctx.strokeStyle="#fff2a0"; ctx.lineWidth=2; ctx.beginPath(); const e=P(M.beam.ox+0.5,M.beam.oy+0.5,0.4); ctx.moveTo(e.x,e.y); for (const [x,y] of M.beamPath){ const q=P(x+0.5,y+0.5,0.4); ctx.lineTo(q.x,q.y);} ctx.stroke(); }
  // guardian telegraphs (ground)
  const G=g.G; if (G && !G.done) drawGuardianTele(ctx,G,P,g,time);
  // mirror world: reflection + plates
  if (L.mech==="mirror" && M.state.ghost) { for (const pl of M.state.plates){ const q=P(pl.x,pl.y); ctx.fillStyle=pl.on?"#c0f0ff":"#405070"; ell(ctx,q.x,q.y,7*q.s,4*q.s); ctx.strokeStyle="#fff"; ctx.beginPath(); ctx.ellipse(q.x,q.y,7*q.s,4*q.s,0,0,Math.PI*2); ctx.stroke(); }
    const gh=M.state.ghost, q=P(gh.x,gh.y); const img=human(g.h.look, flipDir(p.dir), p.moving?Math.floor(p.anim)%4:0); ctx.globalAlpha=0.55; ctx.save(); ctx.translate(q.x, q.y); ctx.scale(q.s,-q.s); ctx.drawImage(img,-7,-16); ctx.restore(); ctx.globalAlpha=1; }

  // ---- y-sorted drawables ----
  const list = [];
  const relief = mode25 && st.relief ? 1.35 : 1;
  for (let ty=Math.max(0,y0); ty<=Math.min(M.H-1,y1); ty++) for (let tx=Math.max(0,Math.floor(cx-xspan)); tx<=Math.min(M.W-1,Math.ceil(cx+xspan)); tx++){
    const v=M.get(tx,ty); if (PROPS.has(v)) { if (v===T.CLIFF && !mode25 && false) continue; list.push({y:ty+0.95, kind:"prop", v, tx, ty}); } }
  for(const o of M.objs){if(o.kind==="gone"||o.x<cx-xspan-3||o.x>cx+xspan+3||o.y<y0-4||o.y>y1+4)continue;list.push({y:o.y+(o.kind==="landmark"?0.4:0.2),kind:"obj",o});}
  for(const e of M.enemies)if(!e.gone&&e.x>=cx-xspan-3&&e.x<=cx+xspan+3&&e.y>=y0-3&&e.y<=y1+3)list.push({y:e.y,kind:"enemy",e});
  if (G) list.push({y:G.y+0.5, kind:"guardian"});
  list.push({y:p.y, kind:"hero"});
  list.sort((a,b)=>a.y-b.y);
  const drawSpr = (img, wx, wy, ox=0, oy=0, alpha=1, hscale=1)=>{ const q=P(wx,wy); const w=img.width*q.s, hh=img.height*q.s*hscale; if (q.x+w<-20||q.x-w>VW+20||q.y<-60||q.y-hh>VH+40) return q; ctx.globalAlpha=alpha; ctx.drawImage(img, Math.round(q.x-w/2+ox*q.s), Math.round(q.y-hh+oy*q.s), Math.round(w), Math.round(hh)); ctx.globalAlpha=1; return q; };
  const shadow=(wx,wy,r)=>{ const q=P(wx,wy); ctx.fillStyle="#00000040"; ell(ctx,q.x,q.y,r*q.s,r*0.45*q.s); };
  for (const d of list) {
    if (d.kind==="prop") { const img=prop(reg,d.v,d.tx*3+d.ty*5, (d.v===T.TREE&&!st.reduceMotion)?f2:0);
      const chop=g.chop?.tx===d.tx&&g.chop?.ty===d.ty?g.chop:null;
      if(chop){const q=P(d.tx+0.5,d.ty+1),s=q.s,fall=Math.max(0,Math.min(1,(chop.t-0.78)/0.47)),hit=chop.t>0.25&&chop.t<0.43||chop.t>0.62&&chop.t<0.8;
        ctx.save();ctx.translate(Math.round(q.x),Math.round(q.y));ctx.rotate((fall*fall*1.35+(hit&&!st.reduceMotion?Math.sin(chop.t*100)*0.09:0))*(p.x<d.tx+0.5?1:-1));ctx.drawImage(img,Math.round(-img.width*s/2),Math.round(-img.height*s),Math.round(img.width*s),Math.round(img.height*s));ctx.restore();
      }else drawSpr(img, d.tx+0.5, d.ty+1, 0, 0, 1, (d.v===T.WALL||d.v===T.CLIFF)?relief:1); }
    else if (d.kind==="obj") { const o=d.o;
      if (o.kind==="landmark") { const img=landmark(reg,o.sub,st.reduceMotion?0:frame,o.lit?1:0); shadow(o.x,o.y+0.4,14); drawSpr(img,o.x,o.y+0.5); }
      else if (o.kind==="npc") { const N=g.npcDef(o.npc); if (N) { shadow(o.x,o.y+0.4,6); const walking=o.roamer&&o.moving,img=N.creature?creature("hare",ENEMIES.hare,f2):human(N.look,walking?(o.dir||faceTo(o,p)):faceTo(o,p),walking?Math.floor(o.anim)%4:0);drawSpr(img,o.x,o.y+0.5,0,walking?0:Math.sin(time*2+o.x)*0.5); } }
      else if (o.kind==="stranded" && o.following) { const img=human({hair:"#4a3a2a", coat:"#a06a4a", skin:"#d8a880", hat:"#7a7a50"}, faceTo(o,p), Math.floor(time*6)%4); drawSpr(img,o.x,o.y+0.5); }
      else if (o.kind==="savedtraveler") { const img=human({hair:"#4a3a2a", coat:"#a06a4a", skin:"#d8a880", hat:"#7a7a50"}, "down", 0); drawSpr(img,o.x,o.y+0.5); }
      else if (o.kind==="pulse" && o.ring>0) { drawSpr(objSprite(reg,o,f2),o.x,o.y+0.5); const q=P(o.x,o.y); ctx.strokeStyle="#a0f0d0"; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(q.x,q.y,o.ring*TS*q.s,o.ring*TS*q.s*(mode25?0.6:1),0,0,Math.PI*2); ctx.stroke(); }
      else if (o.kind==="twall" && !o.solid) { const img=objSprite(reg,o,0); drawSpr(img,o.x,o.y+0.5); }
      else { const img=objSprite(reg,o,f2); if (o.kind==="pickup"||o.kind==="secret"||o.kind==="collectible") { shadow(o.x,o.y+0.35,4); } drawSpr(img,o.x,o.y+0.5);
        if (o.kind==="vent" && o.phaseState) { const q=P(o.x,o.y,0.4); ctx.fillStyle = o.phaseState===2?"#ffffffcc":"#ffffff66"; for(let i=0;i<(o.phaseState===2?6:3);i++) ell(ctx,q.x+Math.sin(time*9+i)*5*q.s, q.y-(o.phaseState===2?i*5:i*2)*q.s, 3*q.s, 2*q.s); } }
      if (o.kind==="pipe" && st.highContrast) {} }
    else if (d.kind==="enemy") { const e=d.e; const img=creature(e.type,e.d,Math.floor(e.anim)%2, e.face); shadow(e.x,e.y+0.3,6); if(e.state==="aim"){const a=P(e.x,e.y),b=P(p.x,p.y);ctx.strokeStyle="#ffcf7a";ctx.lineWidth=1.5;ctx.setLineDash([3,2]);ctx.beginPath();ctx.moveTo(a.x,a.y-9*a.s);ctx.lineTo(b.x,b.y-5*b.s);ctx.stroke();ctx.setLineDash([]);}
      const alpha = e.leaving? Math.max(0,1-e.leaving/1.6) : 1; const q=drawSpr(img,e.x,e.y+0.4,0, e.state==="tele"?Math.sin(time*40)*0.6:0, alpha);
      if (e.hitT>0) { ctx.globalCompositeOperation="lighter"; drawSpr(img,e.x,e.y+0.4,0,0,0.6); ctx.globalCompositeOperation="source-over"; }
      if (!e.leaving) { if (e.state==="tele") { ctx.fillStyle="#fff"; ctx.font="bold 10px monospace"; ctx.textAlign="center"; ctx.fillText("!", q.x, q.y-18*q.s); ctx.fillStyle="#e03030"; ctx.fillText("!", q.x+1, q.y-18*q.s+1); }
        if (e.vuln>0) { ctx.fillStyle="#fff8a0"; for (let i=0;i<3;i++){ const an=time*5+i*2.1; ctx.fillRect(q.x+Math.cos(an)*7*q.s, q.y-17*q.s+Math.sin(an)*2, 2,2);} }
        if (e.hp<e.max || e.calm>0) bar(ctx,q.x-8*q.s,q.y-15*q.s,16*q.s,e.hp/e.max,"#e05050", Math.min(1,e.calm/(e.d.calmNeed*(1+g.run.lv/162))),"#80e0c0");
        if (e.state==="tele" && (e.d.beh==="dart"||e.d.beh==="lunge"||e.d.beh==="burrow")) { const a=P(e.x,e.y), b=P(e.x+e.tx*3,e.y+e.ty*3); ctx.strokeStyle="#ff6060"; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.setLineDash([]); }
        if (e.state==="tele" && (e.d.beh==="tortoise"||e.d.beh==="sentinel")) { const a=P(e.x,e.y); ctx.strokeStyle="#ff8050"; ctx.setLineDash([2,3]); ctx.beginPath(); ctx.ellipse(a.x,a.y,1.8*TS*a.s,1.8*TS*a.s*(mode25?0.6:1),0,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
        if (e.state==="tele" && e.d.beh==="push") { const a=P(e.x,e.y), b=P(e.x+e.tx*4,e.y+e.ty*4); ctx.strokeStyle="#ffffff"; ctx.setLineDash([4,2]); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.setLineDash([]); arrowHead(ctx,b.x,b.y,[e.tx,e.ty],3); } } }
    else if (d.kind==="guardian") { const G=g.G; const img=guardian(G.g, Math.floor(G.anim)%2, G.calm>60||G.done?1:0); shadow(G.x,G.y+0.6,20);
      const alpha = G.done ? 0.95 : 1; let ox=0; if (G.state==="tele" && !st.reduceMotion) ox=Math.sin(time*30)*1;
      const q=drawSpr(img, G.x, G.y+0.8, ox, 0, alpha); if (G.hitT>0) { ctx.globalCompositeOperation="lighter"; drawSpr(img,G.x,G.y+0.8,0,0,0.5); ctx.globalCompositeOperation="source-over"; }
      if (G.state==="rest"||G.state==="stun") { ctx.fillStyle="#e0fff0"; ctx.font="8px monospace"; ctx.textAlign="center"; ctx.fillText(G.state==="stun"?"✦ dazed ✦":"…pause…", q.x, q.y-46*q.s); } }
    else if (d.kind==="hero") { const h=g.h; const fr = p.moving ? Math.floor(p.anim)%4 : 0; shadow(p.x,p.y+0.3,6);
      if (p.boat) { const q=P(p.x,p.y+0.3); ctx.fillStyle="#a07a40"; ell(ctx,q.x,q.y,10*q.s,4*q.s); ctx.fillStyle="#c09a60"; ell(ctx,q.x,q.y-1,8*q.s,2.5*q.s); }
      const img=human(h.look, p.dir, fr); const blink = p.inv>0 && Math.floor(time*20)%2 && p.dodge<=0;
      drawSpr(img, p.x, p.y+0.45, 0, p.boat?-2:0, blink?0.4:(p.dodge>0?0.6:1));
      if(h.selectedItem&&h.selectedItem!=="axe"&&((h.inv[h.selectedItem]||0)>0||g.run.tools.has(h.selectedItem))){const held=objSprite(reg,{kind:"pickup",item:h.selectedItem},f2),hand=P(p.x,p.y+0.45),side=p.dir==="left"?-1:1,phase=g.dig?.t||0,arc=h.selectedItem==="shovel"&&g.dig?Math.sin(Math.min(1,phase/0.9)*Math.PI)*1.25:0;ctx.save();ctx.translate(Math.round(hand.x+side*6*hand.s),Math.round(hand.y-8*hand.s));ctx.rotate(side*(0.18-arc));ctx.drawImage(held,Math.round(-held.width*hand.s/2),Math.round(-held.height*hand.s+4*hand.s),Math.round(held.width*hand.s),Math.round(held.height*hand.s));ctx.restore();}
      if(g.run.tools.has("axe")&&(h.selectedItem==="axe"||g.chop)){const q=P(p.x,p.y+0.45),axe=objSprite(reg,{kind:"pickup",item:"axe"},0),side=p.dir==="left"?-1:1,phase=g.chop?g.chop.t:0,swung=g.chop&&phase<0.78,arc=swung?Math.sin((phase%0.39)/0.39*Math.PI)*1.5:0;
        ctx.save();ctx.translate(Math.round(q.x+side*6*q.s),Math.round(q.y-8*q.s));ctx.rotate(side*(0.25-arc));ctx.drawImage(axe,Math.round(-axe.width*q.s/2),Math.round(-axe.height*q.s+4*q.s),Math.round(axe.width*q.s),Math.round(axe.height*q.s));ctx.restore();}
      // weapon
      if (p.atk>0 && h.weapon && h.weapon!=="bow") { const q=P(p.x+p.fx*0.7,p.y+p.fy*0.7, 0.5); ctx.fillStyle="#c8a878"; ctx.fillRect(q.x-2,q.y-2,4*q.s,4*q.s); }
      if (p.guardT>0) { const q=P(p.x,p.y); ctx.strokeStyle="#e0c080"; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(q.x,q.y-6*q.s,9*q.s,11*q.s,0,0,Math.PI*2); ctx.stroke(); }
    }
  }
  for (const o of g.followers||[]) {}
  // projectiles
  for (const q0 of g.proj) { const q=P(q0.x,q0.y,0.5); if (q0.kind==="arrow") { ctx.fillStyle="#f0e0b0"; ctx.fillRect(q.x-2,q.y-1,4,2); } else if (q0.kind==="wind") { ctx.strokeStyle="#e0f8ff"; ctx.beginPath(); ctx.arc(q.x,q.y,4*q.s,0,Math.PI*2); ctx.stroke(); }
    else if (q0.kind==="orb") { ctx.fillStyle=q0.friendly?"#a0ffe0":"#c0d8ff"; ell(ctx,q.x,q.y,4*q.s,4*q.s); ctx.fillStyle="#fff"; ell(ctx,q.x,q.y,1.5*q.s,1.5*q.s); }
    else { ctx.fillStyle="#ffffffcc"; ell(ctx,q.x,q.y,3*q.s,3*q.s); ctx.strokeStyle=reg.id==="ember"?"#ff9a50":"#80c0ff"; ctx.beginPath(); ctx.arc(q.x,q.y,3*q.s,0,Math.PI*2); ctx.stroke(); } }
  // effects
  for (const f of g.fx) { const k=f.t/f.dur; const fx=f.follow?p.x:f.x, fy=f.follow?p.y:f.y; const q=P(fx,fy);
    if (f.kind==="swing") { ctx.strokeStyle="#ffffffcc"; ctx.lineWidth=2; const a=Math.atan2(f.fy,f.fx); ctx.beginPath(); ctx.ellipse(q.x,q.y-6*q.s,f.reach*TS*q.s,f.reach*TS*q.s*(mode25?0.65:1),0,a-f.arc/2+k*0.3,a+f.arc/2); ctx.stroke(); ctx.lineWidth=1; }
    if (f.kind==="ring") { ctx.strokeStyle=f.col||"#fff"; ctx.globalAlpha=1-k; ctx.beginPath(); ctx.ellipse(q.x,q.y,f.r*TS*q.s*(f.follow?1:(0.3+k*0.7)),f.r*TS*q.s*(mode25?0.6:1)*(f.follow?1:(0.3+k*0.7)),0,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
    if (f.kind==="rain") { ctx.fillStyle="#a0e0ff"; for(let i=0;i<8;i++) ctx.fillRect(q.x-8+i*2, q.y-20+((k*30+i*7)%20), 1, 3); }
    if (f.kind==="chips") { for(let i=0;i<7;i++){const dir=i*2.4,spread=k*14*q.s;ctx.fillStyle=i%2?"#b58954":"#e4bd78";ctx.fillRect(Math.round(q.x+Math.cos(dir)*spread),Math.round(q.y-10*q.s+Math.sin(dir)*spread+k*k*12*q.s),Math.max(1,2*q.s),Math.max(1,2*q.s));} }
    if (f.kind==="leaf") { ctx.fillStyle="#c0f090"; for(let i=0;i<4;i++) ctx.fillRect(q.x-10+k*20+i*3, q.y-12+Math.sin(k*6+i)*4, 2,1); }
    if (f.kind==="after") { ctx.globalAlpha=0.3*(1-k); drawSpr(human(g.h.look,p.dir,0),f.x,f.y+0.45); ctx.globalAlpha=1; }
    if (f.kind==="gustline") { const b=P(f.x+f.fx*5,f.y+f.fy*5); ctx.strokeStyle="#ffffffaa"; for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(q.x+i*3,q.y+i*3); ctx.lineTo(b.x+i*3,b.y+i*3); ctx.stroke(); } }
  }
  // fog by depth in 2.5D
  if (mode25) { const gr=ctx.createLinearGradient(0,0,0,VH*0.55); gr.addColorStop(0, pal.fog+"ee"); gr.addColorStop(0.45, pal.fog+"55"); gr.addColorStop(1, pal.fog+"00"); ctx.fillStyle=gr; ctx.fillRect(0,0,VW,VH*0.55);
    // foreground layer: soft leaves/grass silhouettes near the bottom edge
    ctx.fillStyle = shade(reg.ground==="cave"?pal.cliff2:pal.tree,-0.35)+"cc"; for (let i=0;i<9;i++){ const x=((i*53 - cx*TS*1.3)%(VW+60)+VW+60)%(VW+60)-30; ell(ctx,x,VH+4,26,10+((i*7)%6)); }
  }

  // ---- lighting / weather ----
  drawWeather(ctx,g,st,time,P,{cx,xspan,y0,y1});
  if (g.hoverTile && g.M.in(g.hoverTile.x,g.hoverTile.y)) { const q=P(g.hoverTile.x+0.5,g.hoverTile.y+0.5); ctx.fillStyle="#f8e7a52a"; ell(ctx,q.x,q.y,TS*q.s*0.52,TS*q.s*(mode25?0.22:0.52)); ctx.strokeStyle="#fff1beaa"; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(q.x,q.y,TS*q.s*0.52,TS*q.s*(mode25?0.22:0.52),0,0,Math.PI*2); ctx.stroke(); }
  // floating text
  ctx.textAlign="center"; ctx.font="8px monospace";
  for (const f of g.floats) { const q=P(f.x,f.y,0.5); ctx.globalAlpha=Math.min(1,f.life*2); ctx.fillStyle="#000"; ctx.fillText(f.t,q.x+1,q.y+1); ctx.fillStyle=f.c; ctx.fillText(f.t,q.x,q.y); ctx.globalAlpha=1; }
  // interaction prompt
  if (g.prompt && !g.chop && !g.ui.busy()) { const b=g.prompt; const tgt = b.e||b.o||g.G||{x:b.resource.tx+0.5,y:b.resource.ty+0.5}; const q=P(tgt.x,tgt.y,1.4); const txt=g.promptText(); const key=st.keyLabel;
    ctx.font="8px monospace"; const w=ctx.measureText(key+" "+txt).width+8; ctx.fillStyle="#1a1420dd"; ctx.fillRect(q.x-w/2,q.y-20,w,11); ctx.strokeStyle="#f2e6c4"; ctx.strokeRect(q.x-w/2+0.5,q.y-19.5,w-1,10);
    ctx.fillStyle="#ffe680"; ctx.fillText(key, q.x-w/2+4+ctx.measureText(key).width/2, q.y-12); ctx.fillStyle="#fff"; ctx.fillText(txt, q.x+ctx.measureText(key).width/2+2, q.y-12); }
}

function drawGuardianTele(ctx,G,P,g,time){ const p=g.p;
  if (G.state==="tele") {
    if (G.cur==="charge") { const a=P(G.x,G.y), b=P(G.x+(G.tx-G.x)*3,G.y+(G.ty-G.y)*3); ctx.strokeStyle="#ff6050"; ctx.lineWidth=3; ctx.setLineDash([6,4]); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth=1; }
    if (G.cur==="ring") { const a=P(G.x,G.y); const r=(1-G.t)*2+1; ctx.strokeStyle="#ffd0a0"; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.ellipse(a.x,a.y,r*16*a.s,r*16*a.s*0.7,0,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
    if (G.cur==="zones" && G.zones) for (const z of G.zones){ const a=P(z.x,z.y); ctx.strokeStyle="#ffb070"; ctx.beginPath(); ctx.ellipse(a.x,a.y,19*a.s,19*a.s*0.7,0,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(a.x-5,a.y-4); ctx.lineTo(a.x+5,a.y+4); ctx.moveTo(a.x+5,a.y-4); ctx.lineTo(a.x-5,a.y+4); ctx.stroke(); }
    if (G.cur==="spray"||G.cur==="mirror") { const a=P(G.x,G.y,1.5); ctx.fillStyle="#ffffff"; for(let i=0;i<5;i++){ const an=time*4+i*1.25; ctx.fillRect(a.x+Math.cos(an)*14*a.s,a.y+Math.sin(an)*8*a.s,2,2);} }
    if (G.cur==="gust") { const a=P(G.x,G.y); ctx.strokeStyle="#ffffff"; for (let i=0;i<8;i++){ const an=i/8*Math.PI*2; ctx.beginPath(); ctx.moveTo(a.x+Math.cos(an)*20,a.y+Math.sin(an)*12); ctx.lineTo(a.x+Math.cos(an)*30,a.y+Math.sin(an)*18); ctx.stroke(); } }
  }
  if (G.state==="act" && G.cur==="ring") { const a=P(G.x,G.y); ctx.strokeStyle="#ffffff"; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(a.x,a.y,G.ringR*16*a.s,G.ringR*16*a.s*0.7,0,0,Math.PI*2); ctx.stroke(); ctx.lineWidth=1; }
}

function drawWeather(ctx,g,st,time,P,view){
  const L=g.L,reg=g.reg,pal=reg.pal,wx=L.wx,rm=st.reduceMotion,{cx,xspan,y0,y1}=view;
  // tint
  const tint = { dusk:"#ff9a5030", night:"#10184888", dawn:"#ffd0a028", storm:"#20284050", cave:"#0a081840", mist:"#ffffff10" }[wx];
  if (tint) { ctx.fillStyle=tint; ctx.fillRect(0,0,VW,VH); }
  // darkness with lights
  const isDark = L.hz.includes("dark") || wx==="night";
  if (isDark) {
    if (!dark) { [dark,darkX]=mk(VW,VH); }
    darkX.globalCompositeOperation="source-over"; darkX.clearRect(0,0,VW,VH); darkX.fillStyle = L.hz.includes("dark") ? "#05040cf0" : "#08102ab0"; darkX.fillRect(0,0,VW,VH);
    darkX.globalCompositeOperation="destination-out";
    const light=(wx,wy,r)=>{ const q=P(wx,wy); const rr=r*16*q.s; const gr=darkX.createRadialGradient(q.x,q.y-6,0,q.x,q.y-6,rr); gr.addColorStop(0,"rgba(0,0,0,1)"); gr.addColorStop(0.6,"rgba(0,0,0,0.7)"); gr.addColorStop(1,"rgba(0,0,0,0)"); darkX.fillStyle=gr; darkX.fillRect(q.x-rr,q.y-6-rr,rr*2,rr*2); };
    light(g.p.x,g.p.y, 3.2*(g.charm("light")||1));
    for (const o of g.M.objs) { if ((o.kind==="act" && o.on && (o.sub==="lantern_plant"||o.sub==="glowcap"||o.sub==="root_lock")) ) light(o.x,o.y,4); if (o.kind==="rest"||o.kind==="foxfire") light(o.x,o.y,o.kind==="foxfire"?2.6:4); if (o.kind==="act"&&!o.on) light(o.x,o.y,0.9); if (o.kind==="landmark" && (o.lit||g.reg.ground==="cave")) light(o.x,o.y,2.5); if (o.kind==="pickup"&&(o.item==="glowseed"||o.item==="mushroom"||o.item==="seed")) light(o.x,o.y,1.2); if (o.kind==="pulse"&&o.glow) light(o.x,o.y,2); }
    for (const e of g.M.enemies) if (!e.gone && (e.type==="lantern"||e.type==="wisp")) light(e.x,e.y,1.6);
    if(g.reg.ground==="cave")for(let i=Math.max(0,Math.ceil((cx-xspan)/6)*6);i<Math.min(g.M.W,cx+xspan);i+=6)for(let j=Math.max(0,Math.ceil(y0/6)*6);j<Math.min(g.M.H,y1);j+=6)if(g.M.explored[j*g.M.W+i])light(i+((i*7+j)%5),j+((i+j*3)%5),1.2);
    ctx.drawImage(dark,0,0);
  }
  // particles
  const n = { storm:110, rain:70, snow:60, mist:0, wind:24, spores:30, cave:30 }[wx] ?? (reg.id==="ember"?14:0);
  const count = rm ? Math.floor(n/3) : n; const sp = rm?0.35:1;
  for (let i=0;i<count;i++){ const seed=i*97.13;
    if (wx==="rain"||wx==="storm") { const x=((seed*13 + time*60*sp*(wx==="storm"?2:1)) % (VW+40))-20, y=((seed*7 + time*300*sp)%(VH+20))-10; ctx.fillStyle="#c8d8f0aa"; ctx.fillRect(x,y,1,wx==="storm"?6:4); }
    else if (wx==="snow") { const x=((seed*11 + Math.sin(time+i)*12 + time*10*sp)%VW+VW)%VW, y=((seed*5 + time*24*sp)%VH); ctx.fillStyle="#ffffff"; ctx.fillRect(x,y,i%3?1:2,i%3?1:2); }
    else if (wx==="wind") { const x=((seed*9 + time*160*sp)%(VW+60))-30, y=(seed*3)%VH; ctx.fillStyle="#ffffff66"; ctx.fillRect(x,y,8,1); }
    else if (wx==="cave"||wx==="spores") { const x=((seed*11 + Math.sin(time*0.5+i)*20)%VW+VW)%VW, y=((seed*5 - time*6*sp)%VH+VH)%VH; ctx.fillStyle=pal.accent+"aa"; ctx.fillRect(x,y,1,1); }
    else if (reg.id==="ember") { const x=((seed*11 + time*20*sp)%VW), y=((seed*5 + time*18*sp)%VH); ctx.fillStyle=i%2?"#e07030":"#f0c050"; ctx.fillRect(x,y,2,1); }
  }
  if (wx==="mist" || wx==="dawn") { ctx.fillStyle="#ffffff"; for (let i=0;i<4;i++){ ctx.globalAlpha=0.06; const y=40+i*45 + Math.sin(time*0.3+i)*6; ctx.fillRect(0,y,VW,18); } ctx.globalAlpha=1; }
  if (wx==="storm" && !st.reduceFlash) { const fl = (Math.sin(time*0.7)*Math.sin(time*2.3)); if (fl>0.97) { ctx.fillStyle="#ffffff40"; ctx.fillRect(0,0,VW,VH); } }
  ctx.restore();
}

function ell(ctx,x,y,rx,ry){ ctx.beginPath(); ctx.ellipse(x,y,Math.max(0.5,rx),Math.max(0.5,ry),0,0,Math.PI*2); ctx.fill(); }
function tri(ctx,x,y,s){ ctx.beginPath(); ctx.moveTo(x+s,y); ctx.lineTo(x-s,y-s*0.7); ctx.lineTo(x-s,y+s*0.7); ctx.fill(); }
function arrowHead(ctx,x,y,d,s){ ctx.beginPath(); const a=Math.atan2(d[1],d[0]); ctx.moveTo(x+Math.cos(a)*s*2,y+Math.sin(a)*s*2); ctx.lineTo(x+Math.cos(a+2.4)*s*2,y+Math.sin(a+2.4)*s*2); ctx.lineTo(x+Math.cos(a-2.4)*s*2,y+Math.sin(a-2.4)*s*2); ctx.fill(); }
function bar(ctx,x,y,w,v,c,v2,c2){ ctx.fillStyle="#000a"; ctx.fillRect(x-1,y-1,w+2,v2>0?6:4); ctx.fillStyle=c; ctx.fillRect(x,y,w*Math.max(0,v),2); if (v2>0){ ctx.fillStyle=c2; ctx.fillRect(x,y+3,w*v2,2);} }
function faceTo(o,p){ const dx=p.x-o.x, dy=p.y-o.y; if (Math.hypot(dx,dy)>4) return "down"; return Math.abs(dx)>Math.abs(dy)? (dx>0?"right":"left") : (dy>0?"down":"up"); }
function flipDir(d){ return d==="up"?"down":d==="down"?"up":d==="left"?"right":"left"; }

// Minimap: explored tiles only
export function drawMinimap(c, g){ const M=g.M, x=c.getContext("2d"); const s = Math.min(c.width/M.W, c.height/M.H);
  x.fillStyle="#0e0c16"; x.fillRect(0,0,c.width,c.height); const ox=Math.floor((c.width-M.W*s)/2), oy=Math.floor((c.height-M.H*s)/2); const pal=g.reg.pal;
  for (let j=0;j<M.H;j++) for (let i=0;i<M.W;i++){ if (!M.explored[j*M.W+i]) continue; const v=M.get(i,j);
    x.fillStyle = (M.m(i,j)&1) && !SOLID.has(v) ? pal.path : v===T.DEEP||v===T.LAKE? pal.deep : v===T.SHALLOW? pal.sh : v===T.VOID?"#000": SOLID.has(v)? shade(pal.tree,-0.3) : pal.g1; x.fillRect(ox+i*s,oy+j*s,s,s); }
  for (const o of M.objs){ if (!M.explored[o.ty*M.W+o.tx]) continue; if (o.kind==="rest") { x.fillStyle="#ff9030"; x.fillRect(ox+o.tx*s-1,oy+o.ty*s-1,s+2,s+2); } if (o.kind==="gate") { x.fillStyle=o.open?"#80ff80":"#ff8060"; x.fillRect(ox+o.tx*s,oy+o.ty*s,s,s); } if (o.kind==="npc") { x.fillStyle="#80c0ff"; x.fillRect(ox+o.tx*s,oy+o.ty*s,s,s);} }
  x.fillStyle="#ffffff"; x.fillRect(ox+Math.floor(g.p.x)*s-1,oy+Math.floor(g.p.y)*s-1,s+2,s+2);
}
