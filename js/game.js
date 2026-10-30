// Core simulation. Holds the in-memory run. Nothing is persisted anywhere.
import { LEVELS } from "./levels.js";
import { REGIONS, WEAPONS, CHARMS, TECHS, TECH_ORDER, ENEMIES, ITEMS, RECIPES, PRONOUNS } from "./data.js";
import { NPCS, COMPANIONS } from "./npcs.js";
import { buildLevel, buildSandbox, buildWalk, buildMeetGuides, T, SOLID, regionOf, pipeDirs } from "./world.js";
import { GUARDIANS } from "./art.js";
import * as A from "./audio.js";
import * as I from "./input.js";
import { nextNPCConversation, nextAffirmation, nextCheckInConversation, nextReassuranceConversation } from "./dialogue.js";

const DIRV = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const objectCells=new WeakMap();
function objectsByCell(M){let index=objectCells.get(M);if(!index||index.length!==M.objs.length){const cells=new Array(M.W*M.H);for(const o of M.objs){if(!M.in(o.tx,o.ty))continue;const k=o.ty*M.W+o.tx;(cells[k]||(cells[k]=[])).push(o);}index={length:M.objs.length,cells};objectCells.set(M,index);}return index.cells;}
function updateObjectCell(M,o,oldTx,oldTy){const index=objectCells.get(M);if(!index||index.length!==M.objs.length)return;const oldKey=oldTy*M.W+oldTx,newKey=o.ty*M.W+o.tx;if(oldKey===newKey)return;const previous=index.cells[oldKey],at=previous?.indexOf(o)??-1;if(at>=0)previous.splice(at,1);(index.cells[newKey]||(index.cells[newKey]=[])).push(o);}

export class Game {
  constructor(ui){ this.ui = ui; this.run = null; }

  // ---------- run lifecycle ----------
  saveJSON(settings={}){const pack=v=>JSON.stringify(v,(k,x)=>x instanceof Set?{__riverType:"Set",values:[...x]}:ArrayBuffer.isView(x)?Array.from(x):x);return JSON.stringify({format:"river-turns-save",version:1,run:JSON.parse(pack(this.run)),player:this.p,checkpoint:this.checkpoint,settings});}
  loadJSON(text,settings){let s;try{if(typeof text!=="string"||text.length>40000000)return false;s=JSON.parse(text);}catch{return false;}if(s?.format!=="river-turns-save"||s.version!==1||!s.run?.hero||!s.run.maps||!Number.isInteger(s.run.lv)||s.run.lv<1||s.run.lv>LEVELS.length||!s.player||!Number.isFinite(s.player.x)||!Number.isFinite(s.player.y)||!(["story","forest","garden","hearth","walk","nature","meet"].includes(s.run.mode)))return false;
    const restore=v=>{if(Array.isArray(v))return v;if(v&&typeof v==="object"){if(v.__riverType==="Set")return new Set(v.values||[]);for(const k of Object.keys(v))v[k]=restore(v[k]);}return v;};try{restore(s.run);for(const [key,saved]of Object.entries(s.run.maps)){if(!(key==="forest"||key==="garden"||key==="hearth"||key==="walk"||key==="nature"||key==="meet"||/^\d+$/.test(key)&&+key>=1&&+key<=LEVELS.length))return false;if(!saved||!Number.isInteger(saved.W)||!Number.isInteger(saved.H)||saved.W<8||saved.W>400||saved.H<8||saved.H>300||!Array.isArray(saved.t)||saved.t.length!==saved.W*saved.H)return false;const base=key==="forest"||key==="garden"?buildSandbox(key):key==="hearth"?buildSandbox("hearth",s.run.hearthRoom||0):key==="walk"?buildWalk(s.run.walkBiome||"forest",s.run.walkSeed||1):key==="nature"?buildWalk("nature",s.run.natureSeed||2):key==="meet"?buildMeetGuides():buildLevel(+key);for(const field of ["t","mask","explored"])if(Array.isArray(saved[field]))saved[field]=Uint8Array.from(saved[field]);const mapExtras=base.objs.filter(o=>o.kind==="collectible"||o.guru||o.affirmation||o.checkin||o.reassurer);Object.assign(base,saved);for(const extra of mapExtras)if(!base.objs.some(o=>o.id===extra.id))base.objs.push(extra);for(const e of base.enemies||[])e.d=ENEMIES[e.type]||e.d;s.run.maps[key]=base;}
      const current=s.run.mode==="story"?s.run.maps[s.run.lv]:s.run.maps[s.run.mode];if(!current||s.player.x<0||s.player.y<0||s.player.x>=current.W||s.player.y>=current.H)return false;if(!(s.run.completed instanceof Set)||!(s.run.visited instanceof Set)||!(s.run.hero.weapons instanceof Set))return false;
      this.run=s.run;this.run.tools.add("axe");this.run.tools.add("shovel");this.run.mapFinds??=new Set();this.run.friendly=!!this.run.friendly;this.p=s.player;this.chop=null;this.dig=null;this.checkpoint=s.checkpoint||{x:this.p.x,y:this.p.y};if(settings&&s.settings&&typeof s.settings==="object")for(const k of Object.keys(settings))if(Object.prototype.hasOwnProperty.call(s.settings,k)&&typeof s.settings[k]===typeof settings[k]&&(k!=="mode"||["top","2.5d"].includes(s.settings[k])))settings[k]=s.settings[k];this.fx=[];this.proj=[];this.floats=[];this.puddles=[];this._walkPath=null;this.prompt=null;this.chop=null;this.dig=null;this.G=null;A.setRegion(this.reg);A.setWeather(this.L.wx);return true;}catch{return false;}}
  beginIntroDemo(){this._introDemo={x:this.p.x,y:this.p.y,dir:this.p.dir,elapsed:0};this.p.vx=this.p.vy=0;}
  updateIntroDemo(dt){const d=this._introDemo;if(!d)return;d.elapsed+=dt;const p=this.p,phase=d.elapsed%7,targetX=d.x+(phase<4?7:3),dx=targetX-p.x;if(Math.abs(dx)>0.08){p.dir=dx>0?"right":"left";p.fx=Math.sign(dx);p.fy=0;p.moving=this.moveEnt(p,Math.sign(dx)*Math.min(Math.abs(dx),2.2*dt),0,0.3);p.anim+=dt*7;}else{p.moving=false;p.anim+=dt*1.5;}}
  endIntroDemo(){const d=this._introDemo;if(!d)return;this.p.x=d.x;this.p.y=d.y;this.p.dir=d.dir;this.p.fx=d.dir==="left"?-1:1;this.p.fy=0;this.p.vx=this.p.vy=0;this.p.moving=false;this._introDemo=null;}
  // ---------- run lifecycle ----------
  newRun(cfg){
    const look = cfg.look;
    this.run = {
      hero:{ name:cfg.name, pres:cfg.pres, pron:cfg.pron, look, npcId:cfg.npc||null,
        lvl:1, xp:0, gp:0, alloc:{power:0,guard:0,att:0,poise:0},
        vit:30, br:20, weapon:null, weapons:new Set(), charms:[null,null], charmsOwned:new Set(), techs:new Set(), tech:0, inv:{}, selectedItem:null },
      lv:1, mode:"story", maps:{}, completed:new Set(), visited:new Set(), mapFinds:new Set(), friendly:!!cfg.friendly, maxLv:1, flags:{}, rest:null, bestiary:new Set(), log:[], time:0,
      caches:0, scenic:0, harmed:{}, calmed:0, defeated:0, tools:new Set(["axe","shovel"]), sandboxPos:{}, gardenHarvests:0,journalText:"",
    };
    this.p = { x:2, y:2, vx:0, vy:0, dir:"right", fx:1, fy:0, atk:0, atkCD:0, dodge:0, inv:0, hurt:0, stun:0, cds:{}, guardT:0, lastAtk:-99, still:0, anim:0, push:{x:0,y:0}, boat:false, moving:false };
    this.fx = []; this.proj = []; this.floats = []; this.puddles = []; this.chop = null; this.dig = null;
    this.enterLevel(1, "entry");
  }
  startSandbox(cfg,mode,walkBiome="forest"){
    this.newRun(cfg); this.run.mode=mode; this.run.walkBiome=walkBiome;this.run.walkSeed=Date.now()+Math.floor(Math.random()*100000);this.run.natureSeed=this.run.walkSeed+7919;this.run.maps={forest:buildSandbox("forest"),garden:buildSandbox("garden"),hearth:buildSandbox("hearth",0),walk:buildWalk(walkBiome,this.run.walkSeed),nature:buildWalk("nature",this.run.natureSeed)};this.run.hearthRoom=0;for(const map of Object.values(this.run.maps))this.spawnAll(map);
    this.h.inv={wood:5,plant_fiber:4,stone:1,clay:2,seed:8};
    this.run.sandboxPos={forest:{x:this.run.maps.forest.entry.x,y:this.run.maps.forest.entry.y},garden:{x:this.run.maps.garden.entry.x,y:this.run.maps.garden.entry.y},hearth:{x:this.run.maps.hearth.entry.x,y:this.run.maps.hearth.entry.y},walk:{x:this.run.maps.walk.entry.x,y:this.run.maps.walk.entry.y},nature:{x:this.run.maps.nature.entry.x,y:this.run.maps.nature.entry.y}};
    const at=this.run.sandboxPos[mode];this.p.x=at.x;this.p.y=at.y;this.p.vx=this.p.vy=0;this.p.boat=false;
    this.visitedMode=mode;A.setRegion(this.reg);A.setWeather(this.L.wx);this.ui.startSandbox(mode);
  }
  startMeetGuides(cfg){this.newRun(cfg);this.run.mode="meet";this.run.maps={meet:buildMeetGuides()};this.run.visited.clear();this.run.completed.clear();const M=this.M;this.p.x=M.entry.x;this.p.y=M.entry.y;this.p.vx=this.p.vy=0;this.p.boat=false;this.prompt=null;this.spawnAll(M);A.setRegion(this.reg);A.setWeather(this.L.wx);this.ui.startMeetGuides();}
  toggleMeditation(){
    if(!this.run||this.run.mode==="story"||this.run.mode==="meet")return;
    const modes=["forest","garden","hearth","walk","nature"];this.run.sandboxPos[this.run.mode]={x:this.p.x,y:this.p.y};this.run.mode=modes[(modes.indexOf(this.run.mode)+1)%modes.length];
    const at=this.run.sandboxPos[this.run.mode];this.p.x=at.x;this.p.y=at.y;this.p.vx=this.p.vy=0;this.p.push={x:0,y:0};
    this.prompt=null;this.chop=null;this.dig=null;this.G=null;A.setRegion(this.reg);A.setWeather(this.L.wx);this.ui.sandboxModeChanged(this.run.mode);
  }
  get h(){ return this.run.hero; }
  beginCooking(raw,out,seconds){if(this.run.cooking){this.ui.toast("Something is already cooking.");return false;}if(!this.h.inv[raw]){this.ui.toast("You need that ingredient first.");return false;}this.take(raw,1);this.run.cooking={raw,out,remaining:seconds,total:seconds};this.ui.toast("Cooking started. Stay by the fire for "+seconds+" seconds.",true);A.sfx("open");return true;}
  updateCooking(dt){const c=this.run?.cooking;if(!c)return;c.remaining=Math.max(0,c.remaining-dt);this.ui.cookingTimer?.(c.remaining,c.total);if(c.remaining===0){this.run.cooking=null;this.give(c.out,1);this.ui.toast(ITEMS[c.out].name+" is ready by the fire.",true);A.sfx("done");}}
  get M(){ return this.run.mode==="story"?this.run.maps[this.run.lv]:this.run.maps[this.run.mode]; }
  get L(){ return this.run.mode==="story"?LEVELS[this.run.lv-1]:this.M.L; }
  get reg(){ return this.M?.reg||regionOf(this.run.lv); }

  // ---------- derived stats ----------
  stat(k){ const h=this.h; let v = { power:3, guard:1, att:3, poise:3 }[k] + h.alloc[k];
    for (const c of h.charms) if (c && CHARMS[c][k==="att"?"att":k]) v += CHARMS[c][k==="att"?"att":k]; return v; }
  vitMax(){ const h=this.h; let v = 30 + Math.floor(h.lvl/3)*6 + h.lvl*1; for (const c of h.charms) if (c&&CHARMS[c].vit) v+=CHARMS[c].vit; return v; }
  brMax(){ const h=this.h; return 20 + Math.floor(h.lvl/3)*3; }
  charm(k){ let v=0; for (const c of this.h.charms) if (c&&CHARMS[c][k]) v = v ? v*CHARMS[c][k] : CHARMS[c][k]; return v; }
  weapon(){ return this.h.weapon ? WEAPONS[this.h.weapon] : { name:"Bare hands", dmg:1.5, reach:0.9, arc:1.2, cd:0.35, stagger:0.4, calm:1.2 }; }
  xpNeed(){ return 30 + this.h.lvl*14; }

  // ---------- API given to dialogue scripts ----------
  api(){ const g=this, r=this.run; return {
    flag:k=>r.flags[k], set:(k,v)=>{ r.flags[k]=v; },
    give:(k,n=1)=>g.give(k,n), has:(k,n=1)=>(g.h.inv[k]||0)>=n, take:(k,n=1)=>g.take(k,n),
    xp:n=>g.gainXP(n), learn:t=>g.learn(t), objDone:()=>g.objDone(), giveCharm:c=>g.giveCharm(c), giveWeapon:w=>g.giveWeapon(w),
    craft:w=>g.ui.openCraft(w), respec:()=>g.ui.openRespec(), rest:()=>g.restHere(), shop:()=>g.ui.openShop(), toast:t=>g.ui.toast(t),
    pick:arr=>arr[Math.floor(Math.random()*arr.length)], lv:()=>r.lv, heal:n=>g.heal(n),
  }; }
  fill(text){ const h=this.h, P=PRONOUNS[h.pron]||PRONOUNS.they;
    return text.replace(/\{name\}/g,h.name).replace(/\{sub\}/g,P.sub).replace(/\{Sub\}/g,P.sub[0].toUpperCase()+P.sub.slice(1)).replace(/\{obj\}/g,P.obj).replace(/\{pos\}/g,P.pos).replace(/\{word\}/g,P.word); }

  // ---------- inventory ----------
  give(k,n=1){ if (!ITEMS[k]) return; const extra = (ITEMS[k].cat==="materials" && this.charm("gather")) ? this.charm("gather") : 0; const tot=n+(n>0&&extra&&!this._noBonus?extra:0);
    this.h.inv[k]=(this.h.inv[k]||0)+tot; this.ui.toast("+"+tot+" "+ITEMS[k].name); A.sfx("pickup"); }
  take(k,n=1){ this.h.inv[k]=Math.max(0,(this.h.inv[k]||0)-n); if(!this.h.inv[k]) delete this.h.inv[k]; }
  giveCharm(c){ if (this.h.charmsOwned.has(c)) return; this.h.charmsOwned.add(c); this.ui.toast("New charm: "+CHARMS[c].name); A.sfx("level");
    const free=this.h.charms.indexOf(null); if (free>=0) { this.h.charms[free]=c; } }
  giveWeapon(w){ if (this.h.weapons.has(w)) return; this.h.weapons.add(w); this.ui.toast("New weapon: "+WEAPONS[w].name); A.sfx("level"); if (!this.h.weapon) this.h.weapon=w; }
  learn(t){ if (this.h.techs.has(t)) return; this.h.techs.add(t); this.ui.toast("Technique learned: "+TECHS[t].name, true); A.sfx("level");
    const list=this.techList(); const i=list.indexOf(t); if (i>=0 && t!=="still_step") this.h.tech=i; this.log("Learned "+TECHS[t].name+"."); }
  techList(){ return TECH_ORDER.filter(t=>this.h.techs.has(t)); }
  activeTech(){ const l=this.techList(); return l.length? l[this.h.tech % l.length] : null; }
  useFood(k){ const it=ITEMS[k]; if (!it || !(this.h.inv[k]>0) || it.cat!=="food") return false; const m=1+(this.charm("food")||0);
    if (it.heal) this.heal(Math.round(it.heal*m)); if (it.breath) this.h.br=Math.min(this.brMax(), this.h.br+it.breath); this.take(k,1); A.sfx("heal"); return true; }
  heal(n){ const h=this.h; h.vit=Math.min(this.vitMax(), h.vit+n); this.float("+"+n, this.p.x, this.p.y-1, "#8f8"); }

  craft(rid){ const r=RECIPES.find(x=>x.id===rid); if(!r) return false; for (const k in r.need) if ((this.h.inv[k]||0)<r.need[k]) return false;
    if (r.out.charm && this.h.charmsOwned.has(r.out.charm)) return false; if (r.out.weapon && this.h.weapons.has(r.out.weapon)) return false; if (r.out.tool && this.run.tools.has(r.out.tool)) return false;
    for (const k in r.need) this.take(k,r.need[k]);
    this._noBonus=true; if (r.out.charm) this.giveCharm(r.out.charm); if (r.out.weapon) this.giveWeapon(r.out.weapon); if (r.out.item) this.give(r.out.item, r.out.n||1); if(r.out.tool){this.run.tools.add(r.out.tool);this.ui.toast("Tool crafted: "+ITEMS[r.out.tool].name,true);} this._noBonus=false;
    this.run.flags["crafted_"+rid]=1; this.gainXP(8); A.sfx("done"); this.ui.toast("Crafted "+r.label, true);
    if (this.L.mech==="craft" && this.L.p.recipe===rid) this.objDone();
    return true; }
  respec(){ const h=this.h; const tot = Object.values(h.alloc).reduce((a,b)=>a+b,0); h.alloc={power:0,guard:0,att:0,poise:0}; h.gp += tot; this.ui.toast("Growth points returned: "+h.gp); }
  allocate(k){ const h=this.h; if (h.gp<=0) return; h.gp--; h.alloc[k]++; A.sfx("menu"); }

  gainXP(n){ const h=this.h; h.xp += n; this.float("+"+n+" xp", this.p.x, this.p.y-1.4, "#ffe680");
    while (h.xp >= this.xpNeed()) { h.xp -= this.xpNeed(); h.lvl++; h.gp++;
      h.vit = this.vitMax(); h.br = this.brMax(); A.sfx("level");
      const ms = h.lvl%3===0 ? " Vitality and Breath grow." : "";
      this.ui.toast("Level up! Now level "+h.lvl+". +1 growth point."+ms, true); this.log("Reached hero level "+h.lvl+".");
      if (h.lvl>=6) this.learn("rooted_guard");
    } }
  log(t){ this.run.log.push(t); if (this.run.log.length>60) this.run.log.shift(); this.ui.combatLog && this.ui.combatLog(t); }
  float(t,x,y,c="#fff"){ this.floats.push({t,x,y,c,life:1.1}); }

  // ---------- levels ----------
  enterLevel(n, from){
    const r=this.run; n = clamp(n,1,LEVELS.length);
    if (!r.maps[n]) { r.maps[n] = buildLevel(n); this.spawnAll(r.maps[n]); }
    r.lv = n; r.visited.add(n); r.maxLv=Math.max(r.maxLv,n);
    const M=r.maps[n], L=this.L;
    const at = from==="exit" ? {x:M.exit.x-0.5, y:M.exit.y+1} : from==="rest" ? this.restSpot(M) : {x:M.entry.x+1, y:M.entry.y+1};
    this.p.x=at.x; this.p.y=at.y; this.p.vx=this.p.vy=0; this.p.boat=false; this.checkpoint={x:at.x,y:at.y};
    this.proj=[]; this.fx=[]; this.puddles=[]; this.followers=[]; this.G=null; this.prompt=null;
    for (const e of M.enemies) if (!e.gone) { e.x=e.hx; e.y=e.hy; e.state="idle"; e.t=0; e.hp=e.max; }
    if (L.mech==="guardian" && !M.state.done) this.setupGuardian(M);
    A.setRegion(this.reg); A.setWeather(L.wx);
    if (n===2) this.learn("still_step");
    if (n>=37 && !this.h.techs.has("rooted_guard") && this.h.lvl<6) this.learn("rooted_guard");
    if (L.rest && !this.run.rest) {}
    this.ui.levelBanner(n);
    if (this.ui.state === "play" && this.ui.levelIntro) this.ui.levelIntro(n);
    if (L.mech==="talk" && L.p.then==="calm") M.state.calmNeed = L.p.n;
  }
  restSpot(M){ const o=M.objs.find(o=>o.kind==="rest"); return o? {x:o.x+1.2, y:o.y+0.2} : {x:M.entry.x+1,y:M.entry.y+1}; }
  spawnAll(M){ M.enemies = M.spawns.map((s,i)=>this.makeEnemy(s.type,s.x,s.y,i)); }
  makeEnemy(type,x,y,i){ const d=ENEMIES[type], tier = 1 + Math.floor((this.run.lv-1)/9)*0.28;
    return { id:type+i, type, d, x, y, hx:x, hy:y, max:Math.round(d.hp*tier), hp:Math.round(d.hp*tier), dmg:d.dmg*(1+(tier-1)*0.8), calm:0, state:"idle", t:Math.random()*2, vx:0, vy:0, face:1, hitT:0, aggro:false, hist:[], vuln:0, anim:Math.random()*3 }; }

  objDone(){ const M=this.M; if (M.state.done) return; M.state.done=true; for (const o of M.objs) if (o.gate) { o.open=true; o.solid=false; }
    const n=this.run.lv; this.run.completed.add(n); this.gainXP(15+Math.floor(n/2)); A.sfx("done");
    this.ui.toast("Level "+n+" complete — the way onward opens.", true); this.log("Completed Level "+n+": "+this.L.name+".");
    this.ui.completeCue && this.ui.completeCue(n); }

  restHere(){ const h=this.h; h.vit=this.vitMax(); h.br=this.brMax(); const o=this.M.objs.find(o=>o.kind==="rest");
    this.run.rest = { lv:this.run.lv }; A.sfx("heal"); this.ui.toast("Rested. Vitality and Breath restored. This is your rest place now.", true);
    for (const e of this.M.enemies) if (!e.gone) e.hp=e.max; }
  defeat(){ const r=this.run; this.ui.toast("You stumble, and the world goes soft and grey...", true); this.log("Fell in Level "+r.lv+". Woke at a rest place.");
    const target=r.rest?r.rest.lv:r.lv,recover=()=>{if(target===r.lv){const s=this.r_spot();this.p.x=s.x;this.p.y=s.y;if(this.L.mech==="guardian"&&!this.M.state.done)this.setupGuardian(this.M);}this.h.vit=Math.round(this.vitMax()*0.7);this.h.br=this.brMax();this.p.inv=2;};
    if(target!==r.lv)this.changeLevel(target,"rest",recover);else this.ui.fade(recover); }
  r_spot(){ return this.run.rest && this.run.rest.lv===this.run.lv ? this.restSpot(this.M) : {x:this.M.entry.x+1, y:this.M.entry.y+1}; }
  changeLevel(n,from,after){const previous=this.run.lv,enter=()=>{this.enterLevel(n,from);after?.();};if(previous!==n&&this.ui.levelTransition)this.ui.levelTransition(previous,n,enter);else this.ui.fade(enter);}
  travel(n){ if (!this.run.visited.has(n)) return; this.changeLevel(n,this.run.completed.has(n)&&LEVELS[n-1].rest?"rest":"entry"); }

  // ---------- collision ----------
  solidAt(x,y){ const M=this.M; const tx=Math.floor(x), ty=Math.floor(y); const v=M.get(tx,ty);
    if (v===T.LAKE) return !this.run.flags.has_boat; if (SOLID.has(v)) { if (M.stones && v===T.DEEP) { const s=M.stones.find(s=>s.x===tx&&s.y===ty); if (s) return !s.up; } return true; }
    if (M.stones && v!==T.DEEP && tx>=M.stonesX[0] && tx<=M.stonesX[1] && (M.m(tx,ty)&1)) { const s=M.stones.find(s=>s.x===tx&&s.y===ty); if (s && !s.up) return true; }
    const objects=objectsByCell(M)[ty*M.W+tx];if(objects)for(const o of objects)if(o.solid&&!(o.gate&&o.open))return true;
    return false; }
  boxFree(x,y,r=0.3){ return !this.solidAt(x-r,y-r) && !this.solidAt(x+r,y-r) && !this.solidAt(x-r,y+r*0.9) && !this.solidAt(x+r,y+r*0.9); }
  moveEnt(e,dx,dy,r=0.3){ let moved=false; if (dx && this.boxFree(e.x+dx,e.y,r)) { e.x+=dx; moved=true; } if (dy && this.boxFree(e.x,e.y+dy,r)) { e.y+=dy; moved=true; } return moved; }
  tileAt(x,y){ return this.M.get(Math.floor(x),Math.floor(y)); }
  setDestination(tx,ty){const M=this.M;if(!M.in(tx,ty)||this.solidAt(tx+0.5,ty+0.5)){this.ui.toast("That tile is blocked.");return false;}const sx=Math.floor(this.p.x),sy=Math.floor(this.p.y),q=[[sx,sy]],prev=new Map([[sy*M.W+sx,-1]]),goal=ty*M.W+tx;while(q.length){const [x,y]=q.shift(),k=y*M.W+x;if(k===goal)break;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=ny*M.W+nx;if(!M.in(nx,ny)||prev.has(nk)||this.solidAt(nx+0.5,ny+0.5))continue;prev.set(nk,k);q.push([nx,ny]);}}if(!prev.has(goal)){this.ui.toast("No clear path to that tile.");return false;}const path=[];for(let k=goal;k!==-1&&k!==sy*M.W+sx;k=prev.get(k))path.push({x:k%M.W+0.5,y:Math.floor(k/M.W)+0.5});path.reverse();this._walkPath=path;return true;}
  inspectTile(tx,ty){const M=this.M;if(!M.in(tx,ty)){this.ui.inspect("Map edge","The trail ends at the boundary of this place.");return;}const TILES={0:["Forest floor","Leaf litter, grasses and soil sustain a busy woodland food web."],1:["Wildflowers","Flowers provide nectar and pollen to insects and other visitors."],2:["Footpath","A well-traveled route through the valley."],3:["Sand","Loose mineral grains deposited by water and weather."],4:["Shallow water","Sunlit shallows shelter small aquatic animals and plants."],5:["Deep water","Cooler water offers refuge from the changing shore."],6:["Tree","Trees provide food, shelter and nesting places; bark and leaves vary by species."],7:["Rock","Weathered bedrock exposes minerals and creates shelter for small life."],8:["Cliff","Exposed stone shaped by erosion and freeze-thaw cycles."],9:["Bridge","A crossing built to connect both sides of the water."],10:["Wooden walkway","A raised path keeps feet above soft or wet ground."],11:["Snow","Snow insulates soil and preserves tracks of passing wildlife."],12:["Ice","A frozen surface formed where water loses heat."],13:["Mud","Waterlogged soil rich in fine sediment and decomposing leaves."],14:["Tall grass","Seeds and dense cover make this useful habitat for small animals."],15:["Bush","Woody cover offers berries and shelter."],16:["Stone floor","Bedrock sheltered from the weather."],17:["Stone wall","A built or natural barrier of rock."],18:["Lake","A broad body of still water."],19:["Open air","A gap beyond the safe trail."],20:["Building","A place made for shelter and gathering."],21:["Fence","A boundary marking a cared-for place."]};const terrain=TILES[M.get(tx,ty)]||["Unknown ground","A small part of the wider valley ecosystem."],o=M.objs.find(q=>q.tx===tx&&q.ty===ty&&q.kind!=="gone"),creature=M.enemies.find(q=>!q.gone&&Math.floor(q.x)===tx&&Math.floor(q.y)===ty);if(creature){this.ui.inspect(terrain[0]+" · "+creature.d.name,terrain[1]+" "+creature.d.note);return;}if(this.G&&!this.G.done&&Math.floor(this.G.x)===tx&&Math.floor(this.G.y)===ty){this.ui.inspect(terrain[0]+" · "+this.G.def.name,terrain[1]+" "+this.G.def.desc);return;}if(o?.kind==="pickup"){const it=ITEMS[o.item];this.ui.inspect(terrain[0]+" · "+(it?.name||o.label||o.item),terrain[1]+" "+(it?.desc||"A find gathered from this place."));return;}if(o?.kind==="npc"){const n=this.npcDef(o.npc);this.ui.inspect(terrain[0]+" · "+(n?.name||"Valley neighbor"),terrain[1]+" "+(n?.fact||n?.role+"; a resident with a story to share."));return;}if(o?.kind==="landmark"){this.ui.inspect(terrain[0]+" · "+(o.label||o.sub.replace(/_/g," ")),terrain[1]+" A distinctive landmark shaped by the region and its weather.");return;}if(o){const details={chest:"A washed-up supply crate with provisions for the journey.",cache:"A small hidden cache of useful valley goods.",sign:o.text,scenic:this.L.scenic,workbench:"A sturdy place for crafting useful tools and food.",cistern:"A rain-fed reservoir for filling a watering can.",garden_plot:"A tended bed for planting seeds, watering and harvesting.",rest:"A safe place to sit, recover and gather your thoughts.",act:"An environmental object connected to this area's sidequest.",stranded:"A traveler needs help finding shelter.",target:"A creature or object connected to the current objective."};this.ui.inspect(terrain[0]+" · "+(o.label||o.kind.replace(/_/g," ")),terrain[1]+" "+(details[o.kind]||"Move close and use the interact control to learn more."));return;}this.ui.inspect(terrain[0],terrain[1]);}

  // ---------- main update ----------
  update(dt){
    const r=this.run, M=this.M, p=this.p, h=this.h, L=this.L; if (!r) return;
    r.time += dt; this.t = (this.t||0)+dt;
    for (const k in p.cds) p.cds[k]=Math.max(0,p.cds[k]-dt);
    p.atk=Math.max(0,p.atk-dt); p.atkCD=Math.max(0,p.atkCD-dt); p.inv=Math.max(0,p.inv-dt); p.hurt=Math.max(0,p.hurt-dt); p.stun=Math.max(0,p.stun-dt); p.guardT=Math.max(0,p.guardT-dt); p.dodge=Math.max(0,p.dodge-dt);
    this.inCombat = M.enemies.some(e=>!e.gone && e.aggro && dist(e,p)<8) || (this.G && !this.G.done);
    h.br = Math.min(this.brMax(), h.br + dt*(this.inCombat?0.9:2.2)*(1+(this.charm("breathRegen")||0)));
    if (!this.inCombat) h.vit = Math.min(this.vitMax(), h.vit + dt*0.25);

    // --- movement ---
    const ax = I.axis();
    if(Math.hypot(ax.x,ax.y)>0.15){this._walkPath=null;this._clickTalk=null;}
    if(this._walkPath?.length){const q=this._walkPath[0],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);if(d<0.18)this._walkPath.shift();else{ax.x=dx/d;ax.y=dy/d;}}
    let spd = 4.4*(1+(this.charm("speed")||0));
    const tile = this.tileAt(p.x,p.y+0.2);
    if (tile===T.SHALLOW||tile===T.MUD) spd*=0.62; if (tile===T.SNOW) spd*=0.55; if (tile===T.TALL) spd*=0.9;
    if (this.puddles.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<q.r)) spd*=0.5;
    if (p.stun>0 || this.chop || this.dig) { ax.x=0; ax.y=0; this._walkPath=null; }
    const moving = Math.hypot(ax.x,ax.y)>0.15; p.moving=moving;
    if (moving) { if (Math.abs(ax.x)>Math.abs(ax.y)) p.dir = ax.x>0?"right":"left"; else p.dir = ax.y>0?"down":"up"; const d=DIRV[p.dir]; p.fx=d[0]; p.fy=d[1]; p.still=0; p.anim+=dt*8; }
    else p.still += dt;
    let tvx = ax.x*spd, tvy = ax.y*spd;
    if (p.dodge>0) { tvx = p.dvx; tvy = p.dvy; }
    const onIce = tile===T.ICE && p.dodge<=0;
    const k = onIce ? 1.6 : 22; p.vx += (tvx-p.vx)*Math.min(1,k*dt); p.vy += (tvy-p.vy)*Math.min(1,k*dt);
    if (onIce && !moving) { p.vx*=Math.pow(0.6,dt); p.vy*=Math.pow(0.6,dt); }
    // zones
    this.updateZones(dt);
    let mx = (p.vx + p.push.x)*dt, my = (p.vy + p.push.y)*dt; p.push.x*=Math.pow(0.02,dt); p.push.y*=Math.pow(0.02,dt);
    const steps = Math.ceil(Math.max(Math.abs(mx),Math.abs(my))/0.2);
    for (let i=0;i<steps;i++){ const okx=this.moveEnt(p,mx/steps,0), oky=this.moveEnt(p,0,my/steps); if(!okx&&onIce) p.vx=0; if(!oky&&onIce) p.vy=0; }
    p.boat = this.tileAt(p.x,p.y)===T.LAKE;
    if (moving && Math.floor(this.t*3.2)!==this._stepT) { this._stepT=Math.floor(this.t*3.2); A.sfx("step"); }

    // --- explored ---
    const R=6; for (let y=Math.floor(p.y-R);y<=p.y+R;y++) for (let x=Math.floor(p.x-R-2);x<=p.x+R+2;x++) if (M.in(x,y)) M.explored[y*M.W+x]=1;

    // --- actions ---
    if (this.chop) this.updateChop(dt);
    if (this.dig) this.updateDig(dt);
    if (I.consume("attack") && !this.chop && !this.dig) this.attack();
    if (I.consume("tech")) this.useTech();
    if (I.consume("dodge")) this.dodgeAct(ax);
    if (I.consume("cycle")) { const l=this.techList(); if (l.length) { h.tech=(h.tech+1)%l.length; this.ui.toast("Technique: "+TECHS[this.activeTech()].name); A.sfx("menu"); } }
    if (I.consume("interact") && !this.chop && !this.dig) this.interact();
    if (I.consume("meditate")) this.toggleMeditation();
    this.updateCooking(dt);

    this.updateEnemies(dt);if(this.run.mode==="meet")this.updateMeetNPCs(dt);this.updateProj(dt);this.updateMech(dt); if (this.G) this.updateGuardian(dt); if(this.run.mode==="garden") this.updateGarden(dt);
    for (const f of this.floats) { f.life-=dt; f.y-=dt*0.8; } this.floats=this.floats.filter(f=>f.life>0);
    for (const f of this.fx) f.t+=dt; this.fx=this.fx.filter(f=>f.t<f.dur);
    for (const q of this.puddles) q.life-=dt; this.puddles=this.puddles.filter(q=>q.life>0);
    for (const o of M.objs) if (o.flash>0) o.flash-=dt;
    if (h.vit<=0 && !this._downing) { this._downing=true; this.defeat(); setTimeout(()=>this._downing=false, 1500); }

    // --- transitions ---
    if(r.mode==="hearth"&&(p.x>M.W-1.25||p.x<1.25)){const direction=p.x>M.W/2?1:-1;this.run.hearthRoom=Math.max(0,(this.run.hearthRoom||0)+direction);this.run.maps.hearth=buildSandbox("hearth",this.run.hearthRoom);this.p.x=direction>0?2.5:M.W-3.5;this.p.y=this.M.entry.y;this.p.vx=this.p.vy=0;this.ui.toast("Quiet Hearth · Room "+(this.run.hearthRoom+1));}
    if (r.mode==="story" && p.x > M.W-1.25) { const g = M.objs.find(o=>o.gate); if (!g || g.open) { if (!M.state.done && ["reach","calm","toggles","boat"].includes(L.mech)) this.objDone(); if (r.lv<LEVELS.length) this.changeLevel(r.lv+1,"entry"); else p.x = M.W-1.4; } else p.x = M.W-1.3; }
    if (r.mode==="story" && p.x < 0.7 && r.lv>1) this.changeLevel(r.lv-1,"exit");
    else if (r.mode==="story" && p.x < 0.7) p.x = 0.75;
    // A direct click on a forageable gathers it as soon as the player reaches it.
    if(this._directPickup){const o=M.objs.find(q=>q.id===this._directPickup&&(q.kind==="pickup"||q.kind==="collectible"));if(!o||Math.hypot(o.x-p.x,o.y-p.y)<1.05){if(o){p.fx=Math.sign(o.x-p.x)||p.fx;p.fy=Math.sign(o.y-p.y)||p.fy;const b=this.findInteract();if(b?.o===o){this.prompt=b;this.interact();}}this._directPickup=null;}}
    if(this._clickTalk){const target=M.objs.find(o=>o.kind==="npc"&&o.npc===this._clickTalk);if(!target||Math.hypot(target.x-p.x,target.y-p.y)<1.45){if(target){p.fx=Math.sign(target.x-p.x)||p.fx;p.fy=Math.sign(target.y-p.y)||p.fy;this.prompt={o:target};this._clickTalk=null;this.interact();}else this._clickTalk=null;}}
    // nearby prompt
    this.prompt = this.findInteract();
  }

  // ---------- zones / hazards ----------
  updateZones(dt){
    const M=this.M, p=this.p, t=this.t; const gustRes = this.charm("gust")||1, hz = this.charm("hazard")||1;
    for (const z of M.zones) {
      const inside = p.x>=z.x0 && p.x<=z.x1+1 && p.y>=(z.y0??0) && p.y<=(z.y1??M.H);
      if (z.type==="wind" && inside) { p.push.x += z.dir[0]*dt*5*gustRes; p.push.y += z.dir[1]*dt*5*gustRes; }
      if (z.type==="current" && inside && p.boat) { p.push.x += z.dir[0]*dt*7; p.push.y += z.dir[1]*dt*7; }
      if (z.type==="gust") { const ph = ((t+(z.phase||0)) % z.period); z.tele = ph > z.period-1.2 && ph < z.period-0.3; z.active = ph >= z.period-0.3;
        if (z.active && inside && p.inv<=0) { if (!z.hit) { p.push.x = z.dir[0]*9*gustRes; p.push.y = z.dir[1]*9*gustRes; this.hurt(1*hz, true); z.hit=true; A.sfx("gust"); } } else if (!z.active) z.hit=false; }
      if (z.type==="tide") { const ph = t % z.period; z.tele = ph>4.6 && ph<5.6; z.active = ph>=5.6;
        if (z.active && inside && !z.safe.some(([sx,sy])=>Math.abs(sx+0.5-p.x)<1.1&&Math.abs(sy+0.5-p.y)<1.1) && p.inv<=0) { p.x = z.x0-0.8; if (!this.boxFree(p.x,p.y)) { p.x=this.checkpoint.x; p.y=this.checkpoint.y; } this.hurt(2*hz,true); this.ui.toast("The tide carries you back. Wait for it to pull out."); } }
      if (z.type==="stones") { const ph = t % z.period;
        for (const s of M.stones) { const up = s.g===0 ? ph<3.2 : (ph>=3 || ph<0.2); s.tele = s.g===0 ? (ph>2.4&&ph<3.2) : (ph>5.2); s.up = up; }
        const tx=Math.floor(p.x), ty=Math.floor(p.y); const s=M.stones.find(s=>s.x===tx&&s.y===ty);
        if (s && !s.up) { p.x=this.checkpoint.x; p.y=this.checkpoint.y; this.hurt(1*hz,true); this.ui.toast("Splash! Back to the bank. Stones shimmer just before they sink."); } }
    }
    // checkpoint: the bank before hazards
    const tx=Math.floor(p.x), ty=Math.floor(p.y);
    if (M.zones.length && (M.m(tx,ty)&1) && !M.zones.some(z=>p.x>=z.x0-1&&p.x<=z.x1+2) && this.boxFree(p.x,p.y)) { if (!this.checkpoint || Math.abs(this.checkpoint.x-p.x)>3) this.checkpoint={x:p.x,y:p.y}; }
    // object hazards
    for (const o of M.objs) {
      if (o.kind==="vent") { const ph=(t+o.phase)%4; o.phaseState = ph>2.6&&ph<3.3?1 : ph>=3.3?2 : 0;
        if (o.phaseState===2 && Math.hypot(o.x-p.x,o.y-p.y)<1.1 && p.inv<=0) { const a=Math.atan2(p.y-o.y,p.x-o.x); p.push.x=Math.cos(a)*7; p.push.y=Math.sin(a)*7; this.hurt(2*hz,true); } }
      if (o.kind==="pulse") { const ph=(t+o.phase)%5; o.glow = ph>2.5&&ph<3.5; o.ring = ph>=3.5 ? (ph-3.5)*2.6 : 0;
        if (o.ring>0 && Math.abs(Math.hypot(o.x-p.x,o.y-p.y)-o.ring)<0.45 && p.inv<=0) { const a=Math.atan2(p.y-o.y,p.x-o.x); p.push.x=Math.cos(a)*6; p.push.y=Math.sin(a)*6; this.hurt(3*hz,true); } }
      if (o.kind==="checkpoint" && Math.hypot(o.x-p.x,o.y-p.y)<1 && !o.on) { o.on=true; this.checkpoint={x:o.x,y:o.y}; this.ui.toast("Checkpoint: a flat stone to rest on."); this.heal(6); }
    }
  }

  hurt(n, env){ const p=this.p, h=this.h; if (p.inv>0 || p.dodge>0) return; let d = n;
    if (!env) d = d * (1 - Math.min(0.6, this.stat("guard")*0.035));
    if (p.guardT>0) d*=0.35; d = Math.max(1, Math.round(d)); h.vit -= d; p.inv = 0.8; p.hurt=0.3; p.stun = Math.max(0, 0.25 - this.stat("poise")*0.02);
    this.float("-"+d, p.x, p.y-1, "#ff8a8a"); A.sfx("hurt"); this.shake = 0.25; if (!env) this.log("You take "+d+" harm."); }

  // ---------- player actions ----------
  attack(){ const p=this.p, h=this.h, W=this.weapon(); if (p.atkCD>0 || p.stun>0) return;
    p.atkCD = W.cd*(1-Math.min(0.3,this.stat("poise")*0.015)); p.atk = 0.18; p.lastAtk=this.t; A.sfx("swing");
    const dmg = W.dmg + this.stat("power")*0.8;
    if (W.ranged) { if (h.br < W.breath) { this.ui.toast("Not enough Breath to draw the bow."); return; } h.br-=W.breath; this.proj.push({x:p.x+p.fx*0.5,y:p.y+p.fy*0.5,vx:p.fx*11,vy:p.fy*11,life:0.65,dmg,kind:"arrow",friendly:true,stagger:W.stagger}); return; }
    this.fx.push({kind:"swing", x:p.x, y:p.y, fx:p.fx, fy:p.fy, reach:W.reach, arc:W.arc, t:0, dur:0.18});
    this.strikeArea(p.x+p.fx*0.4, p.y+p.fy*0.4, W.reach, W.arc, dmg, W.stagger);
  }
  strikeArea(x,y,reach,arc,dmg,stagger,all){ const p=this.p; const ang=Math.atan2(p.fy,p.fx);
    const inArc=(e,rr)=>{ const d=Math.hypot(e.x-x,e.y-y); if (d>reach+rr) return false; if (all) return true; let a=Math.atan2(e.y-y,e.x-x)-ang; a=Math.atan2(Math.sin(a),Math.cos(a)); return Math.abs(a)<=arc/2+0.35 || d<0.6; };
    for (const e of this.M.enemies) if (!e.gone && !e.leaving && inArc(e,0.4)) this.damageEnemy(e,dmg,stagger);
    if (this.G && !this.G.done && inArc(this.G,1.3)) this.damageGuardian(dmg);
    for (const q of this.proj) if (q.orb && !q.friendly && Math.hypot(q.x-x,q.y-y)<reach+0.5) { q.vx=-q.vx*1.3; q.vy=-q.vy*1.3; q.friendly=true; q.reflected=true; A.sfx("chime",2); this.float("Reflected!", q.x,q.y-0.5,"#cfe"); }
    for (const o of this.M.objs) if (o.kind==="pushable" && inArc(o,0.3)) this.pushObj(o, p.fx, p.fy);
  }
  damageEnemy(e,dmg,stagger=1){ if(this.run.friendly)return; const armor = e.d.armor||0; let d = Math.max(1, dmg - armor); if (e.vuln>0) d*=1.6; d=Math.round(d);
    e.hp -= d; e.hitT=0.18; e.aggro=true; if (e.type==="tortoise") e.angry=true; if (e.type==="hare") { this.run.harmed.hare=true; }
    const kb = 0.35*stagger; const a=Math.atan2(e.y-this.p.y,e.x-this.p.x); this.moveEnt(e,Math.cos(a)*kb,Math.sin(a)*kb,0.3);
    if (stagger>=1 && e.state==="tele") { e.state="idle"; e.t=0.6; }
    this.float(""+d, e.x, e.y-0.8, "#fff"); A.sfx("hit"); this.addBest(e.type);
    if (e.hp<=0) this.enemyLeave(e,false); }
  calmEnemy(e, amt){ if (e.gone||e.leaving) return; e.calm += amt; this.addBest(e.type); this.float("~", e.x, e.y-0.9, "#bfe"); if (e.calm>=e.d.calmNeed*(1+(this.run.lv/LEVELS.length))) this.enemyLeave(e,true); }
  enemyLeave(e, calmed){ e.leaving=1; e.calmed=calmed; e.aggro=false;
    const xp = Math.round(e.d.xp*(1+this.run.lv/30)*(calmed?1.1:1)); this.gainXP(xp);
    if (calmed) { this.run.calmed++; this.log(e.d.name+" is calmed and wanders off."); A.sfx("calm"); if (e.type==="hare") this.run.flags.hares_calmed=(this.run.flags.hares_calmed||0)+1; }
    else { this.run.defeated++; this.log(e.d.name+" retreats into the "+(this.reg.ground==="cave"?"dark":"brush")+"."); }
    const M=this.M; if (M.state.calmNeed && calmed && e.type==="lantern" && this.run.flags.learned_listening_palm) { M.state.count=(M.state.count||0)+1; if (M.state.count>=M.state.calmNeed) this.objDone(); else this.ui.toast("Calmed "+M.state.count+" of "+M.state.calmNeed); }
    if (Math.random()<0.35) { const drop = ["berry","reed","fiber","glowseed","mushroom","fruit","copperleaf","pinewood","seed"][Math.floor(this.run.lv/9)] ; this.give(drop==="seed"?"mushroom":drop,1); } }
  addBest(t){ if (!this.run.bestiary.has(t)) { this.run.bestiary.add(t); this.ui.toast("Journal: "+ENEMIES[t].name+" noted."); } }

  dodgeAct(ax){ const p=this.p, h=this.h; if (!h.techs.has("still_step")) return; if (p.cds.still_step>0 || p.stun>0) return; const cost = TECHS.still_step.cost*(this.charm("techCost")||1); if (h.br<cost) { this.ui.toast("Out of Breath."); return; }
    h.br-=cost; let dx=ax.x, dy=ax.y; if (Math.hypot(dx,dy)<0.2){ dx=p.fx; dy=p.fy; } const l=Math.hypot(dx,dy)||1; p.dvx=dx/l*11; p.dvy=dy/l*11; p.dodge=0.2; p.inv=Math.max(p.inv,0.32);
    p.cds.still_step = Math.max(0.3, TECHS.still_step.cd - this.stat("poise")*0.04); A.sfx("dodge"); this.fx.push({kind:"after", x:p.x, y:p.y, t:0, dur:0.3}); }

  useTech(){ const t=this.activeTech(), p=this.p, h=this.h; if (!t) { this.ui.toast("No technique learned yet."); return; } const T_=TECHS[t];
    if (p.cds[t]>0) { this.ui.toast(T_.name+" is recovering."); return; }
    let cost = T_.cost*(this.charm("techCost")||1); if (t==="rain_mend" && !this.inCombat) cost = 2;
    if (h.br<cost) { this.ui.toast("Not enough Breath."); A.sfx("wrong"); return; }
    h.br-=cost; p.cds[t]=T_.cd; A.sfx("tech"); const att=this.stat("att");
    switch(t){
      case "ripple_arc": this.fx.push({kind:"ring", x:p.x, y:p.y, r:2, t:0, dur:0.35, col:"#bfefff"}); this.strikeArea(p.x,p.y,1.9,7,4+att*1.1+this.stat("power")*0.4,1.2,true); break;
      case "wind_thread": this.proj.push({x:p.x,y:p.y,vx:p.fx*10,vy:p.fy*10,life:0.8,dmg:3+att*0.9,kind:"wind",friendly:true,stagger:1.5}); break;
      case "listening_palm": { h.br=Math.min(this.brMax(), h.br+6+att*0.5); this.fx.push({kind:"ring", x:p.x, y:p.y, r:3.5, t:0, dur:0.8, col:"#d0ffe0"}); A.sfx("calm");
        const amt = (8+att*1.6)*this.weapon().calm; for (const e of this.M.enemies) if (!e.gone && !e.leaving && dist(e,p)<3.6) this.calmEnemy(e, amt);
        if (this.G && !this.G.done && dist(this.G,p)<4.5) this.calmGuardian(this.G.state==="rest"? 10+att : 4+att*0.5, "palm");
        const her = this.M.objs.find(o=>o.kind==="heron"); if (her && dist(her,p)<4) this.calmHeron(her, 30);
        break; }
      case "rooted_guard": p.guardT = 4 + this.stat("poise")*0.2; this.fx.push({kind:"ring", x:p.x, y:p.y, r:1, t:0, dur:4, col:"#c8a060", follow:true}); this.ui.toast("Rooted Guard: harm greatly reduced."); break;
      case "rain_mend": { const amt = this.inCombat ? 5+att : 14+att*2; this.heal(Math.round(amt)); this.fx.push({kind:"rain", x:p.x, y:p.y, t:0, dur:0.8}); break; }
    } }

  // gentle approach: interacting with a creature
  gentle(e){ const p=this.p; const gentle = (this.t - p.lastAtk) > 3; let amt = (2.2 + this.stat("att")*0.55)*this.weapon().calm*(gentle?2:0.6);
    if (e.type==="mouse" && dist(e,{x:e.hx,y:e.hy})<1.5 && p.still>0.4) amt*=1.5;
    if (e.type==="carp" && p.still>1) amt*=1.6; if (e.vuln>0) amt*=1.6; if (e.type==="tortoise" && !e.angry) amt*=2;
    if (e.state==="act") { this.ui.toast("It's too wound up right now. Wait for a pause."); return; }
    this.calmEnemy(e, amt); A.sfx("calm"); if (!gentle) this.ui.toast("Your recent strikes make it wary. Calming works best when you hold back."); }

  resolveEnemyDecision(e,choice){if(!e||e.gone||e.state!=="aim")return;const d=e.d?.beh||"lunge";if(choice==="observe"){e.aggro=false;e.observing=0;e.state="idle";this.ui.toast("You choose to observe. The creature comes close, then wanders away.",true);return;}e.state="act";e.aggro=true;e.t=({dart:0.35,burrow:0.25,lunge:0.42,push:0.5,tortoise:0.2,sentinel:0.25})[d]||0.45;if(d==="push")this.fx.push({kind:"gustline",x:e.x,y:e.y,fx:e.tx,fy:e.ty,t:0,dur:0.5});if(d==="tortoise"||d==="sentinel"){this.fx.push({kind:"ring",x:e.x,y:e.y,r:1.8,t:0,dur:0.3,col:d==="tortoise"?"#ff9a50":"#c0a0ff"});if(dist(e,this.p)<(d==="tortoise"?1.8:1.9))this.hurt(e.dmg);}}
  // ---------- creatures ----------
  updateEnemies(dt){ const p=this.p, M=this.M;
    for (const e of M.enemies) { if (e.gone) continue; e.anim+=dt*6; e.hitT=Math.max(0,e.hitT-dt); e.vuln=Math.max(0,e.vuln-dt);
      if (e.leaving) { e.leaving+=dt; e.y-=dt*0.6; if (e.leaving>1.6) e.gone=true; continue; }
      const d=dist(e,p), dx=(p.x-e.x)/(d||1), dy=(p.y-e.y)/(d||1); e.t-=dt; const sp=e.d.speed;
      const go=(vx,vy)=>{ this.moveEnt(e,vx*dt,vy*dt,0.3); if (Math.abs(vx)>0.05) e.face=vx>0?1:-1; };
      if(this.run.friendly){e.aggro=false;e.state="friendly";if(d>1.05)go(dx*sp*1.35,dy*sp*1.35);else go(Math.sin(e.anim*.7)*.12,Math.cos(e.anim*.55)*.12);if(d<1.3&&!e.affirmed){const words=["You belong here!","You've got this!","Your curiosity is wonderful!","One step at a time!","You make the trail brighter!"];const id=String(e.id),seed=[...id].reduce((sum,ch)=>sum+ch.charCodeAt(0),0);e.affirmed=true;this.float(words[seed%words.length],e.x,e.y-0.8,"#c0ffe2");}continue;}
      if(e.state==="idle"&&((e.d.beh==="drift"&&d<1.15&&e.t<=0)||(e.d.beh==="mirror"&&d<0.95&&p.moving))){e.state="tele";e.t=0.65;e.tx=dx;e.ty=dy;}
      if(e.state==="tele"){if(e.t<=0){e.state="aim";e.tx=dx;e.ty=dy;e.aggro=false;this.ui.enemyAim?.(e);}continue;}
      if(e.state==="aim")continue;
      if(e.observing!==undefined){e.observing+=dt;if(e.observing<0.9){if(d>0.62)go(dx*sp*1.25,dy*sp*1.25);else e.observing=0.9;}else{const edgeX=e.x<M.W/2?-1:1,edgeY=e.y<M.H/2?-1:1;go(edgeX*sp*2.2,edgeY*sp*1.5);if(e.x<0||e.y<0||e.x>M.W||e.y>M.H||e.observing>5)e.gone=true;}continue;}
      const contact=(mult=1)=>{ if (d<0.75 && p.inv<=0) { this.hurt(e.dmg*mult); const a=Math.atan2(dy,dx); p.push.x=Math.cos(a)*5; p.push.y=Math.sin(a)*5; } };
      if (d<6) { e.aggro = e.aggro || (e.type!=="tortoise" && e.type!=="hare"); }
      switch(e.d.beh){
        case "dart": // tide skipper
          if (e.state==="idle") { go(Math.sin(e.anim*0.3)*0.6, Math.cos(e.anim*0.23)*0.6); if (d<5 && e.t<=0) { e.state="tele"; e.t=0.55; e.tx=dx; e.ty=dy; } }
          else if (e.state==="tele") { if (e.t<=0) { e.state="act"; e.t=0.35; } }
          else if (e.state==="act") { go(e.tx*sp*3.2, e.ty*sp*3.2); contact(); if (e.t<=0) { e.state="back"; e.t=0.9; } }
          else if (e.state==="back") { go(-dx*sp, -dy*sp); if (e.t<=0) { e.state="idle"; e.t=1.2+Math.random(); e.vuln=0; } }
          break;
        case "burrow": { const hd = Math.hypot(e.x-e.hx,e.y-e.hy), pd=Math.hypot(p.x-e.hx,p.y-e.hy);
          if (pd>4.5) { if (hd>0.3) go((e.hx-e.x)/hd*sp,(e.hy-e.y)/hd*sp); e.state="idle"; e.calm+=dt*0.5; }
          else if (e.state==="idle") { if (d<2.6 && e.t<=0) { e.state="tele"; e.t=0.6; e.tx=dx; e.ty=dy; } else if (d>1.5) go(dx*sp*0.5,dy*sp*0.5); }
          else if (e.state==="tele") { if (e.t<=0) { e.state="act"; e.t=0.25; } }
          else if (e.state==="act") { go(e.tx*sp*2.6,e.ty*sp*2.6); contact(); if (e.t<=0) { e.state="idle"; e.t=1.3; } }
          break; }
        case "lunge":
          if (e.state==="idle") { if (d<7) { if (d>3) go(dx*sp,dy*sp); else if (e.t<=0) { e.state="tele"; e.t=0.8; e.tx=dx; e.ty=dy; } } else go(Math.sin(e.anim*0.2)*0.4,0); }
          else if (e.state==="tele") { if (e.t<=0) { e.state="act"; e.t=0.42; } }
          else if (e.state==="act") { go(e.tx*7,e.ty*7); contact(1.1); if (e.t<=0) { e.state="idle"; e.t=1.5; e.vuln=1.3; } }
          break;
        case "drift":
          if(e.state==="act"){go(e.tx*sp*1.4,e.ty*sp*1.4);contact(0.8);if(e.t<=0){e.state="idle";e.t=3.2;this.puddles.push({x:e.x,y:e.y,r:1.1,life:4.5});}}else if(d<8)go(dx*sp,dy*sp);
          break;
        case "push": {
          if (e.state==="idle") { const want = d<3?-1:d>4.5?1:0; go(dx*sp*want + -dy*0.6, dy*sp*want + dx*0.6); if (d<6.5 && e.t<=0) { e.state="tele"; e.t=0.75; e.tx=dx; e.ty=dy; } }
          else if (e.state==="tele") { if (e.t<=0) { e.state="act"; e.t=0.5; this.fx.push({kind:"gustline", x:e.x,y:e.y, fx:e.tx, fy:e.ty, t:0, dur:0.5}); } }
          else if (e.state==="act") { if (this.clearLine(e,p) && d<6.5) { const along = (p.x-e.x)*e.tx+(p.y-e.y)*e.ty, perp=Math.abs((p.x-e.x)*e.ty-(p.y-e.y)*e.tx);
              if (along>0 && perp<1.2) { const g=this.charm("gust")||1; p.push.x += e.tx*dt*26*g; p.push.y += e.ty*dt*26*g; if (!e.hitOnce) { this.hurt(e.dmg); e.hitOnce=true; } } }
            if (e.t<=0) { e.state="idle"; e.t=2.6; e.hitOnce=false; e.vuln=1.0; } }
          break; }
        case "tortoise":
          if (!e.angry) { go(Math.sin(e.anim*0.1)*0.2, 0); e.aggro=false; break; }
          if (e.state==="idle") { if (d>1.4) go(dx*sp,dy*sp); if (d<2 && e.t<=0) { e.state="tele"; e.t=1.0; } }
          else if (e.state==="tele") { if (e.t<=0) { e.state="act"; e.t=0.2; this.fx.push({kind:"ring", x:e.x,y:e.y,r:1.7,t:0,dur:0.3,col:"#ff9a50"}); if (d<1.8) this.hurt(e.dmg); } }
          else { if (e.t<=0) { e.state="idle"; e.t=2; e.vuln=1.2; } }
          break;
        case "flee": if (d<4.5) go(-dx*sp,-dy*sp); else go(Math.sin(e.anim*0.4)*0.4,0); e.aggro=false; break;
        case "mirror": {
          e.hist.push([p.vx,p.vy]); if (e.hist.length>36) { const [vx,vy]=e.hist.shift(); go(vx*0.9, vy*0.9); }
          if (p.still>1.5) e.calm += dt*1.5;
          if(e.state==="act"){contact(0.9);if(e.t<=0){e.state="idle";e.t=1.2;}}else if (d>9) go(dx*sp*0.5,dy*sp*0.5);
          break; }
        case "sentinel":
          if (e.state==="idle") { const hd=Math.hypot(e.x-e.hx,e.y-e.hy); if (hd>0.3) go((e.hx-e.x)/hd*sp,(e.hy-e.y)/hd*sp); if (d<2.4 && e.t<=0) { e.state="tele"; e.t=1.0; } }
          else if (e.state==="tele") { if (e.t<=0) { e.state="act"; e.t=0.25; this.fx.push({kind:"ring", x:e.x,y:e.y,r:1.8,t:0,dur:0.3,col:"#c0a0ff"}); if (d<1.9) this.hurt(e.dmg); } }
          else { if (e.t<=0) { e.state="idle"; e.t=1.8; e.vuln=1.4; } }
          break;
      }
    }
  }
  clearLine(a,b){ const n=Math.ceil(dist(a,b)*3); for (let i=1;i<n;i++){ const x=a.x+(b.x-a.x)*i/n, y=a.y+(b.y-a.y)*i/n; const v=this.tileAt(x,y); if (v===T.ROCK||v===T.TREE||v===T.CLIFF||v===T.WALL||v===T.HOUSE) return false; } return true; }

  updateProj(dt){ const p=this.p, M=this.M;
    for (const q of this.proj) { q.x+=q.vx*dt; q.y+=q.vy*dt; q.life-=dt;
      const tv=this.tileAt(q.x,q.y); if (!q.orb && (tv===T.TREE||tv===T.ROCK||tv===T.CLIFF||tv===T.WALL)) q.life=0;
      if (q.friendly) {
        for (const e of M.enemies) if (!e.gone && !e.leaving && Math.hypot(e.x-q.x,e.y-q.y)<0.6) { if (q.kind==="wind"){ e.calm += 1; this.moveEnt(e,q.vx*0.08,q.vy*0.08); } this.damageEnemy(e,q.dmg,q.stagger); q.life=0; break; }
        if (this.G && !this.G.done && Math.hypot(this.G.x-q.x,this.G.y-q.y)<1.5) { if (q.reflected) { this.damageGuardian(12); this.calmGuardian(14,"reflect"); this.ui.toast("The light returns to its source."); } else this.damageGuardian(q.dmg); q.life=0; }
        if (q.kind==="wind") for (const o of M.objs) if (o.kind==="pushable" && Math.hypot(o.x-q.x,o.y-q.y)<0.7) { this.pushObj(o, Math.sign(q.vx), Math.sign(q.vy)); q.life=0; }
      } else if (Math.hypot(p.x-q.x,p.y-q.y)<0.55 && p.inv<=0 && p.dodge<=0) { this.hurt(q.dmg); q.life=0; }
    }
    this.proj=this.proj.filter(q=>q.life>0);
  }

  // ---------- guardians ----------
  setupGuardian(M){ const st=M.state, G=GUARDIANS[st.g], a=M.arena; const tier=1+Math.floor((this.run.lv-1)/9);
    this.G = { g:st.g, def:G, x:a.x+3, y:a.y-1, hp:G.hp, max:G.hp, calm:0, state:"rest", t:2.5, pat:0, phase:1, done:false, since:0, dmg:2+tier*1.3, face:-1, anim:0, intro:true };
    for (const o of M.objs) if (o.kind==="calmstone") o.on=false;
    this.ui.toast(G.name+" — "+G.desc, true); }
  damageGuardian(d){ const G=this.G; if (this.run.friendly||G.done) return; const m = G.state==="rest"||G.state==="stun" ? 1.5 : 1; d=Math.round(d*m); G.hp-=d; G.since=0; G.hitT=0.15; this.float(""+d,G.x,G.y-2,"#fff"); A.sfx("hit"); if (G.hp<=0) this.resolveGuardian(false); }
  calmGuardian(n, why){ const G=this.G; if (G.done) return; G.calm=Math.min(100,G.calm+n); this.float("~ calm", G.x, G.y-2.2, "#bfe"); if (G.calm>=100) this.resolveGuardian(true); }
  resolveGuardian(soothed){ const G=this.G, M=this.M; G.done=true; G.state="settled"; this.proj=this.proj.filter(q=>q.friendly);
    this.run.flags["g_"+G.g] = soothed?"soothed":"fought";
    this.ui.toast(soothed? G.def.name+" settles. The air goes still and kind." : G.def.name+" bows its great head and withdraws to rest.", true);
    this.log((soothed?"Soothed ":"Stood against ")+G.def.name+".");
    this.gainXP(50+this.run.lv*2);
    const rewards = { kelpback:()=>this.give("shell",2), stag:()=>this.giveWeapon("branch"), toad:()=>this.give("lily",2), ram:()=>this.give("fiber",2), salamander:()=>this.give("charcoal",2), elk:()=>this.give("icecrystal",2), swan:()=>this.give("feather",1), wyrm:()=>this.giveCharm("lantern_bead") };
    rewards[G.g] && rewards[G.g]();
    const lines = {
      kelpback:["|The Warden backs slowly into the inlet, until only its eyes show. Then not even those.","|The water in the inlet clears. A path opens north along the rocks."],
      stag:["|The stag lowers its fern-crown, sniffs your sleeve, and walks into the deep green.","|Where it stood lies a pale, smooth branch. It feels quiet in your hand."],
      toad:["|The Basin Elder sinks until it is only a hill of moss in the water. The basin drains, gently, to the east."],
      ram:["|The Skyward Ram steps aside. Beyond it the pass splits in two.",{choice:[
        {t:"Open the sunlit path.", do:g=>g.set("ram_path","sun"), next:["|You roll the cloud-stone aside on the bright side. Warm air spills down toward the foothills."]},
        {t:"Open the shaded path.", do:g=>g.set("ram_path","shade"), next:["|You open the shaded way. Cool mist will follow you down; the trees there will thank it."]}]}],
      salamander:["|The salamander curls back into its hollow. Its walls glow, unbroken. The hills around it can breathe again."],
      elk:["|The elk's crown drips, then thaws. It shakes its head, lighter, and trots into the melt."],
      swan:["|The two swans become one, then two again, and both fly. The lake keeps one sky for a moment, then gives back the other."],
      wyrm:["|The Mosswyrm drinks from the clear spring, and coils down to sleep. The cave smells of rain."],
    }[G.g] || [];
    this.ui.dialog([...lines, {do:()=>this.objDone()}]);
  }
  updateGuardian(dt){ const G=this.G, p=this.p, M=this.M; if (!G) return; G.anim+=dt*4; G.hitT=Math.max(0,(G.hitT||0)-dt);
    if (G.done) { G.y -= 0; return; }
    if(this.run.friendly){const d=dist(G,p);G.state="friendly";if(d>1.25){const step=Math.min(d-1.25,dt*2);this.moveEnt(G,(p.x-G.x)/(d||1)*step,(p.y-G.y)/(d||1)*step,0.5);}else if(!G.affirmed){G.affirmed=true;this.float("You are stronger than you know!",G.x,G.y-1.2,"#c0ffe2");}return;}
    const d=dist(G,p); if (d>14) return; // player left arena
    G.since += dt; if (G.def.restraint && G.since>6 && d<9) this.calmGuardian(dt*3.2,"restraint");
    if (G.phase===1 && (G.hp<G.max*0.5 || G.calm>=50)) { G.phase=2; this.ui.toast(G.def.name+" shifts — its movements change."); }
    const speed = G.phase===2?1.25:1;
    G.t -= dt*speed; const pats = G.def.pats.slice(0, G.phase===2 ? G.def.pats.length : 2);
    const a=M.arena;
    if (G.state==="rest") { const hx=a.x-G.x, hy=a.y-G.y; if (Math.hypot(hx,hy)>2) { G.x+=hx*dt*0.5; G.y+=hy*dt*0.5; }
      if (G.t<=0) { G.cur = pats[G.pat++ % pats.length]; G.state="tele"; G.t = G.cur==="zones"?1.3:1.0; G.tx=p.x; G.ty=p.y;
        if (G.cur==="zones") G.zones=[0,1,2,3].map(i=>({x:p.x+(i?Math.cos(i*2.1)*2.2:0), y:p.y+(i?Math.sin(i*2.1)*1.8:0)})); } }
    else if (G.state==="tele") { if (G.t<=0) { G.state="act"; G.t = {charge:1.3, ring:1.6, spray:0.5, zones:0.4, gust:1.2, mirror:0.6}[G.cur];
        if (G.cur==="spray") { const base=Math.atan2(p.y-G.y,p.x-G.x); for (let i=-3;i<=3;i++){ const an=base+i*0.28; this.proj.push({x:G.x,y:G.y,vx:Math.cos(an)*3.6,vy:Math.sin(an)*3.6,life:3.5,dmg:G.dmg,kind:"bubble",friendly:false}); } }
        if (G.cur==="mirror") { const base=Math.atan2(p.y-G.y,p.x-G.x); for (let i=-1;i<=1;i++){ const an=base+i*0.4; this.proj.push({x:G.x,y:G.y,vx:Math.cos(an)*3,vy:Math.sin(an)*3,life:4.5,dmg:G.dmg,kind:"orb",orb:true,friendly:false}); } }
        if (G.cur==="charge") { const l=Math.hypot(G.tx-G.x,G.ty-G.y)||1; G.cx=(G.tx-G.x)/l; G.cy=(G.ty-G.y)/l; }
        if (G.cur==="zones") { for (const z of G.zones) if (Math.hypot(z.x-p.x,z.y-p.y)<1.2) this.hurt(G.dmg); this.fx.push(...G.zones.map(z=>({kind:"ring",x:z.x,y:z.y,r:1.2,t:0,dur:0.3,col:"#ffd0a0"}))); if (G.g==="toad") for (const z of G.zones) this.puddles.push({x:z.x,y:z.y,r:1.1,life:5}); }
        G.ringR = 0; } }
    else if (G.state==="act") {
      if (G.cur==="charge") { const nx=G.x+G.cx*9*dt, ny=G.y+G.cy*9*dt; const v=M.get(Math.floor(nx+G.cx),Math.floor(ny+G.cy));
        if (SOLID.has(v)) { G.state="stun"; G.t = G.def.terrain?3.2:1.6; this.shake=0.3; this.ui.toast(G.def.terrain?"It struck the snowbank and stands dazed!":"It stumbles against the arena edge."); if (G.def.terrain) this.calmGuardian(8,"terrain"); }
        else { G.x=nx; G.y=ny; G.face=G.cx>0?1:-1; } if (d<1.4) this.hurt(G.dmg*1.2); }
      if (G.cur==="ring") { G.ringR += dt*5; if (Math.abs(d-G.ringR)<0.55) this.hurt(G.dmg); }
      if (G.cur==="gust") { const l=d||1; p.push.x += (p.x-G.x)/l*dt*14*(this.charm("gust")||1); p.push.y += (p.y-G.y)/l*dt*14*(this.charm("gust")||1); }
      if (G.t<=0 && G.state==="act") { G.state="rest"; G.t=1.8; } }
    else if (G.state==="stun") { if (G.t<=0) { G.state="rest"; G.t=1.2; } }
    if (d<1.3 && G.state!=="act" && p.inv<=0) { const l=d||1; p.push.x=(p.x-G.x)/l*5; p.push.y=(p.y-G.y)/l*5; }
  }

  // ---------- puzzles & objectives ----------
  pushObj(o,dx,dy){ if (o.moving) return; if (Math.abs(dx)>=Math.abs(dy)) { dx=Math.sign(dx); dy=0; } else { dy=Math.sign(dy); dx=0; }
    const nx=o.tx+dx, ny=o.ty+dy; const v=this.M.get(nx,ny); if (SOLID.has(v)||this.M.objs.some(q=>q!==o&&q.solid&&q.tx===nx&&q.ty===ny)) { A.sfx("wrong"); return; }
    if (Math.floor(this.p.x)===nx && Math.floor(this.p.y)===ny) return;
    objectCells.delete(this.M);o.tx=nx;o.ty=ny;o.x=nx+0.5;o.y=ny+0.5;A.sfx("gust");
    const s=this.M.objs.find(q=>q.kind==="socket"&&q.tx===nx&&q.ty===ny&&!q.filled); if (s) { s.filled=true; o.solid=false; o.kind="pushdone"; A.sfx("open"); this.ui.toast(o.sub==="puff"?"The stone hole whistles.":"The light settles into its cradle.");
      const left=this.M.objs.filter(q=>q.kind==="socket"&&!q.filled).length; if (!left) { if (this.L.mech==="push" || (this.M.state.pipesOK)) this.objDone(); else this.ui.toast("The seed-puffs are home. Now the channels."); } } }
  pipeFlow(){ const M=this.M, P=M.pipes; if (!P) return false; for (const c of P.cells){ c.dirs=pipeDirs(c); c.wet=false; }
    const at=(i,j)=>P.cells[j*P.gw+i]; const opp=d=>(d+2)%4; const D=[[0,-1],[1,0],[0,1],[-1,0]];
    let q=[[0,P.sy,3]], ok=false; const seen=new Set();
    while(q.length){ const [i,j,from]=q.pop(); if (i<0||j<0||i>=P.gw||j>=P.gh) continue; const c=at(i,j); if (!c.dirs.includes(from)) continue; const k=i+","+j; if (seen.has(k)) continue; seen.add(k); c.wet=true;
      for (const d of c.dirs){ if (d===from) continue; if (i===P.gw-1&&j===P.ty&&d===1) ok=true; q.push([i+D[d][0], j+D[d][1], opp(d)]); } }
    const f=M.objs.find(o=>o.kind==="field"); if (f) f.wet=ok; return ok; }
  beamTrace(){ const M=this.M, B=M.beam; if (!B) return; let x=B.ox, y=B.oy, dx=1, dy=0; const path=[]; let hit=false;
    for (let s=0;s<40;s++){ x+=dx; y+=dy; path.push([x,y]); const o=M.objs.find(o=>o.tx===x&&o.ty===y&&o.solid);
      if (o){ if (o.kind==="mirror"){ if (o.m==="B"){ [dx,dy]=[dy,dx]; } else { [dx,dy]=[-dy,-dx]; } continue; } if (o.kind==="darktree"){ hit=true; o.on=true; } break; }
      if (SOLID.has(M.get(x,y))) break; }
    M.beamPath=path; return hit; }

  updateMeetNPCs(dt){const M=this.M;for(const o of M.objs){if(!o.roamer)continue;if(!o.walkTarget){o.walkWait-=dt;if(o.walkWait>0)continue;const b=o.roam;o.walkTarget={x:b.x0+Math.random()*(b.x1-b.x0),y:b.y0+Math.random()*(b.y1-b.y0)};o.moving=true;}const dx=o.walkTarget.x-o.x,dy=o.walkTarget.y-o.y,d=Math.hypot(dx,dy);if(d<0.1){o.walkTarget=null;o.moving=false;o.walkWait=.8+Math.random()*2.5;continue;}o.dir=Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":dy>0?"down":"up";o.anim+=dt*7;const oldTx=o.tx,oldTy=o.ty;this.moveEnt(o,dx/d*Math.min(d,0.72*dt),dy/d*Math.min(d,0.72*dt),0.22);o.tx=Math.floor(o.x);o.ty=Math.floor(o.y);updateObjectCell(M,o,oldTx,oldTy);}}
  updateGarden(dt){ for(const o of this.M.objs)if(o.kind==="garden_plot"&&o.crop&&o.wet&&o.crop.growth<1){o.crop.growth=Math.min(1,o.crop.growth+dt/75);if(o.crop.growth>=1){o.wet=false;this.ui.toast("A crop is ripe and ready to harvest.",true);A.sfx("done");}} }
  updateMech(dt){ const M=this.M, L=this.L, st=M.state, p=this.p;
    if (L.p && L.p.multi && !st.done) { const F=this.run.flags; if (L.p.multi.every(k=>F[k]||F["talk_"+k])) this.objDone(); }
    if (L.mech==="sequence" && !st.done) { st.demoT=(st.demoT||0)-dt; if (dist(p,st.center)<8 && st.demoT<=0 && !st.input.length) { st.demoT=9; st.demoI=0; st.demoNext=0.6; }
      if (st.demoI!=null && st.demoI<st.order.length) { st.demoNext-=dt; if (st.demoNext<=0) { const o=M.objs.find(o=>o.kind==="seq"&&o.idx===st.order[st.demoI]); o.flash=0.7; A.sfx("chime",o.idx); this.fx.push({kind:L.p.kind==="echo"?"ring":"leaf", x:o.x,y:o.y,r:1.4,t:0,dur:0.7,col:"#cfe8ff"}); st.demoI++; st.demoNext=0.9; } } }
    if (L.mech==="pipes" && !st.pipesOK) { if (this.pipeFlow()) { st.pipesOK=true; A.sfx("done"); this.ui.toast("Water runs through to the field!", true); if (!L.p || L.p.also!=="push" || !M.objs.some(q=>q.kind==="socket"&&!q.filled)) this.objDone(); } }
    if (L.mech==="beam" && !st.done) { if (this.beamTrace()) { this.ui.toast("Light reaches the shadowed tree. It turns its leaves to drink.", true); this.objDone(); } }
    if (L.mech==="protect" && !st.done) { const nest=M.objs.find(o=>o.kind==="nest");
      if (!st.started && dist(p,nest)<6) { st.started=true; st.left=st.time; this.ui.toast("A squall is coming! Keep the gustlings away from the nests.", true); }
      if (st.started) { st.left-=dt; st.spawnT=(st.spawnT||0)-dt; if (st.spawnT<=0) { st.spawnT=4.5; const side=Math.random()<0.5; const e=this.makeEnemy("gustling", side?3:M.W-4, nest.y+(Math.random()*6-3), M.enemies.length); e.target=nest; e.aggro=true; M.enemies.push(e); }
        for (const e of M.enemies) if (e.target && !e.gone && !e.leaving) { const dd=dist(e,nest); if (dd>1.4) this.moveEnt(e,(nest.x-e.x)/dd*dt*1.2,(nest.y-e.y)/dd*dt*1.2); else { e.leaving=1; st.left+=4; this.ui.toast("A gust ruffles the nests. Hold on a little longer."); } }
        if (st.left<=0) { for (const e of M.enemies) if (e.target && !e.gone) e.leaving=1; this.ui.toast("The squall passes. The nests are safe.", true); this.run.flags.nests_safe=1; this.objDone(); } } }
    if (L.mech==="guide" && !st.done) { const ff=M.objs.find(o=>o.kind==="foxfire"); if (ff && dist(p,ff)<2.2) { st.wi++; if (st.wi>=st.wps.length) { ff.kind="gone"; this.objDone(); } else { const w=st.wps[st.wi]; ff.x=w[0]+0.5; ff.y=w[1]+0.5; ff.tx=w[0]; ff.ty=w[1]; A.sfx("chime",st.wi); } } }
    if (L.mech==="mirror" && !st.done) { const gx=M.W-p.x, gy=2*M.axis+1-p.y; st.ghost={x:gx,y:gy}; let all=true;
      for (const pl of st.plates){ if (!pl.on && Math.hypot(pl.x-gx,pl.y-gy)<0.7) { pl.on=true; A.sfx("chime",3); this.ui.toast("Your reflection steps onto a plate. It glows."); } if (!pl.on) all=false; }
      if (all) this.objDone(); }
    if (L.mech==="storm" && !st.done) { for (const f of this.followers) { const dd=dist(f,p); if (dd>1.2) this.moveEnt(f,(p.x-f.x)/dd*dt*3.6,(p.y-f.y)/dd*dt*3.6); f.x=Math.max(1,f.x); f.tx=Math.floor(f.x); f.ty=Math.floor(f.y);
        const sh=M.objs.find(o=>o.kind==="shelterstones"); if (dist(f,sh)<2.2) { f.saved=true; f.kind="savedtraveler"; st.count=(st.count||0)+1; this.ui.toast("Safe at the shelter stones! ("+st.count+"/"+st.need+")", true); this.gainXP(12); } }
      this.followers=this.followers.filter(f=>!f.saved); if ((st.count||0)>=st.need) { this.run.flags.storm_helped=1; this.objDone(); } }
  }

  enterNaturePortal(){if(this.run.mode==="hearth"){this.run.hearthReturnRoom=this.run.hearthRoom||0;this.run.sandboxPos.hearth={x:this.p.x,y:this.p.y};this.run.mode="nature";const m=this.M,door=m.objs.find(o=>o.kind==="portal");let spot=null;if(door){for(const[dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])if(m.in(door.tx+dx,door.ty+dy)&&!this.solidAt(door.tx+dx+.5,door.ty+dy+.5)){spot={x:door.tx+dx+.5,y:door.ty+dy+.5};break;}}const at=spot||m.entry;this.p.x=at.x;this.p.y=at.y;}else if(this.run.mode==="nature"){this.run.hearthRoom=this.run.hearthReturnRoom||0;this.run.maps.hearth=buildSandbox("hearth",this.run.hearthRoom);this.run.mode="hearth";const at=this.run.sandboxPos.hearth||this.run.maps.hearth.entry;this.p.x=at.x;this.p.y=at.y;}else return;this.p.vx=this.p.vy=0;this.run.sandboxPos[this.run.mode]={x:this.p.x,y:this.p.y};A.setRegion(this.reg);A.setWeather(this.L.wx);this.ui.sandboxModeChanged(this.run.mode);}
  npcDef(id){if(id==="comp")return{name:"Friends",look:{hair:"#3a2a22",coat:"#c87a5a",skin:"#e8b890",hat:"#e0d0b0"}};const match=id?.match(/^(guide|checkin|reassure)_(\d+)$/);if(match){const level=LEVELS[+match[2]-1],pal=regionOf(+match[2]).pal,type=match[1],name=type==="guide"?"Guide of "+level.name:type==="checkin"?"Listener of "+level.name:"Kind voice of "+level.name;return{name,role:type==="guide"?"map meditation guide":type==="checkin"?"trail listener":"reassuring neighbor",look:{hair:pal.trunk,coat:type==="checkin"?pal.g2:type==="reassure"?pal.accent:pal.path,skin:"#c89070",hat:pal.tree2,scarf:pal.path}};}const walk=this.M?.objs.find(o=>o.kind==="npc"&&o.npc===id&&o.walkNpc);return walk?.npcData||NPCS[id];}
  guidedMeditation(o){const n=this.npcDef(o.npc),L=LEVELS[+o.npc.slice(6)-1],seen=this.run.guruMeditations||(this.run.guruMeditations={}),spoken=seen[o.npc]||(seen[o.npc]=[]),available=Array.from({length:15},(_,i)=>i).filter(i=>!spoken.includes(i));if(!available.length){this.ui.toast("You have heard all 15 meditations from this guide.");return;}const i=available[Math.floor(Math.random()*available.length)],land=L.land.replace(/_/g," "),guides=["Settle your attention on one quiet detail of {land}. Let the rest of the map wait outside this breath.","Breathe in slowly. As you breathe out, imagine setting down one thing you do not need to carry right now.","Notice where your body meets the ground. Let that steady contact remind you that you are supported.","Picture the path through {name}. You do not need to see the whole way; the next small step is enough.","Listen for the nearest sound, then the farthest. Let both belong without needing to follow either.","Soften your jaw and shoulders. You are allowed to be here without fixing anything.","Imagine a warm light resting beside {land}. With each breath, let it spread a little gentleness through you.","Think of someone who has shown you care. Let their kindness be something you can receive, not only give.","Notice a thought passing through your mind. You can see it without having to climb aboard.","Breathe in room for what is. Breathe out the demand that everything be different at once.","Picture the changing weather over {name}. Even a difficult sky keeps moving.","Let your attention rest on your hands. Remember one helpful thing they have done, however small.","Imagine placing a worry beside the trail for a moment. You may pick it up later if you choose.","Take three gentle breaths. Nothing needs to be achieved during them.","As this pause ends, carry one kind word with you: you are allowed to begin where you are."];this.ui.dialog([n.name+"|Let us pause together.","|"+guides[i].replaceAll("{land}",land).replaceAll("{name}",L.name),"|When you are ready, return to the path at your own pace."],n);spoken.push(i);}
  walkConversation(o){const n=o.npcData,b=this.M.walkBiome,v=this.M.fibonacci.variant,historyKey="walk_talk_"+o.npc,seen=this.run.flags[historyKey]||0,places={road:["the old mile markers","a shaded bend in the road","the sound of wheels far away"],forest:["fern curls and damp leaf litter","a thrush calling under the canopy","the rings in a fallen log"],beach:["small shorebirds feeding at the tide line","shells sorted by the waves","the wind changing with the tide"],riverside:["willow roots holding the riverbank","a mayfly hovering above the current","the water rising after yesterday's rain"],lake:["ripples crossing the sheltered cove","a heron standing very still","the pale stones beneath the shallows"],field:["bees working the clover","seed heads bending in the breeze","the line where meadow meets woodland"],desert:["lichen on the north face of a rock","a pocket of shade beneath the stones","tracks crossing the dry wash"],nature:["three habitats meeting along one trail","a tiny flower beside the water","birdsong carrying between the trees"]},notes=places[b]||places.forest,observation=notes[(v+seen)%notes.length],choices=["Ask about the path","Ask what wildlife they noticed","Share a quiet moment"];this.ui.dialog([n.name+"|I am "+n.name+", one of the local "+n.role+"s. This stretch is my favorite place.",n.name+"|Today I noticed "+observation+". Every walk changes a little with the light and weather.",{choice:[{t:choices[0],next:[n.name+"|The route's shape follows a Fibonacci layout variant "+(v+1)+". No two bends quite tell the same story."]},{t:choices[1],next:[n.name+"|Watch patiently and give wild animals room. A quiet observer sees more than a hurried visitor."]},{t:choices[2],next:[n.name+"|Then let's listen for a moment. The path will still be here when we are ready."]}]},{do:g=>{g.set(historyKey,seen+1);g.set("walk_choice_"+o.npc,choices[(v+seen)%choices.length]);}},...nextNPCConversation(this.run,n.name)],n);}
  // ---------- interaction ----------
  updateChop(dt){
    const c=this.chop, prev=c.t; c.t+=dt;
    if(this.M.get(c.tx,c.ty)!==T.TREE){this.chop=null;return;}
    for(const hit of [0.25,0.62]) if(prev<hit && c.t>=hit){
      A.sfx("hit");this.fx.push({kind:"chips",x:c.tx+0.5,y:c.ty+0.55,t:0,dur:0.45});
    }
    if(c.t>=1.25){
      this.M.set(c.tx,c.ty,this.M.m(c.tx,c.ty)&1?T.PATH:T.GRASS);
      this.run.flags.trees_cut=(this.run.flags.trees_cut||0)+1;
      this.chop=null;this.give("wood",2);A.sfx("open");
    }
  }
  updateDig(dt){const d=this.dig,prev=d.t;d.t+=dt;for(const hit of [0.28,0.62])if(prev<hit&&d.t>=hit){A.sfx("hit");this.fx.push({kind:"chips",x:d.tx+0.5,y:d.ty+0.55,t:0,dur:0.45});}if(d.t<0.9)return;const M=this.M,id="hole_"+d.tx+"_"+d.ty;M.objs.push({kind:"hole",id,x:d.tx+0.5,y:d.ty+0.5,tx:d.tx,ty:d.ty,solid:false});const drops=["stone",["quartz","mica","clay"][Math.floor(Math.random()*3)]];for(let i=0;i<drops.length;i++)M.objs.push({kind:"pickup",id:id+"_find_"+i,item:drops[i],x:d.tx+0.35+i*0.3,y:d.ty+0.5,tx:d.tx,ty:d.ty,solid:false,forage:true});this.dig=null;A.sfx("open");this.ui.toast("You uncover a rock and a mineral.",true);}
  findInteract(){ const p=this.p, M=this.M; let best=null, bd=1.6;
    const fx=p.x+p.fx*0.6, fy=p.y+p.fy*0.6,cells=objectsByCell(M),x0=Math.max(0,Math.floor(p.x)-2),x1=Math.min(M.W-1,Math.floor(p.x)+2),y0=Math.max(0,Math.floor(p.y)-2),y1=Math.min(M.H-1,Math.floor(p.y)+2);
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++)for(const o of cells[ty*M.W+tx]||[]){if(!this.canUse(o))continue;const d=Math.min(Math.hypot(o.x-fx,o.y-fy),Math.hypot(o.x-p.x,o.y-p.y)+0.25);if(d<bd){bd=d;best={o};}}
    for (const e of M.enemies) if (!this.run.friendly && !e.gone && !e.leaving) { const d=dist(e,p); if (d<1.7 && d<bd+0.2) { bd=d; best={e}; } }
    if(this.run.mode!=="hearth"&&this.run.mode!=="meet"){
      for(const [dx,dy]of [[p.fx,p.fy],[1,0],[-1,0],[0,1],[0,-1]]){const tx=Math.floor(p.x)+dx,ty=Math.floor(p.y)+dy,d=Math.hypot(tx+0.5-p.x,ty+0.5-p.y);if(M.in(tx,ty)&&M.get(tx,ty)===T.TREE&&d<1.65&&d<bd){best={resource:{kind:"tree",tx,ty}};bd=d;}}
      if(this.run.tools.has("shovel")&&this.h.selectedItem==="shovel")for(const[dx,dy]of [[p.fx,p.fy],[1,0],[-1,0],[0,1],[0,-1]]){const tx=Math.floor(p.x)+dx,ty=Math.floor(p.y)+dy,d=Math.hypot(tx+0.5-p.x,ty+0.5-p.y),tile=M.get(tx,ty),ground=[T.GRASS,T.SAND,T.FLOOR,T.FLOWER,T.TALL].includes(tile);if(M.in(tx,ty)&&ground&&d<1.65&&d<bd&&!(cells[ty*M.W+tx]||[]).some(o=>o.kind==="hole")){best={resource:{kind:"dig",tx,ty}};bd=d;}}
      if(this.run.mode!=="story"&&this.run.tools.has("fishing_pole"))for(let y=Math.max(0,Math.floor(p.y)-2);y<=Math.min(M.H-1,Math.floor(p.y)+2);y++)for(let x=Math.max(0,Math.floor(p.x)-2);x<=Math.min(M.W-1,Math.floor(p.x)+2);x++)if([T.DEEP,T.SHALLOW,T.LAKE].includes(M.get(x,y))){const d=Math.hypot(x+0.5-p.x,y+0.5-p.y);if(d<=1.8&&d<bd){best={resource:{kind:"water",tx:x,ty:y}};bd=d;}}
    }
    if (this.G && !this.G.done && dist(this.G,p)<2.8) { best = best && best.o && best.o.kind==="calmstone" ? best : {G:true}; }
    return best; }
  canUse(o){ return !["gate","hole","collectible","twall","mark","source","field","emitter","darktree","pushdone","gone","savedtraveler","vent","pulse","foxfire"].includes(o.kind) && !(o.kind==="cache"&&o.open) && !(o.kind==="chest"&&o.open) && !(o.kind==="pickup"&&o.taken) && !(o.kind==="secret"&&o.taken) && !(o.kind==="act"&&o.on) && !(o.kind==="calmstone"&&o.on) && !(o.kind==="checkpoint") && !(o.kind==="stranded"&&(o.saved||o.following)) && !(o.kind==="landmark"&&!o.use&&o.sub!=="leaning_tree") && !(o.kind==="bed"&&o.on) && !(o.kind==="scenic"&&o.seen); }
  promptText(){ const b=this.prompt; if (!b) return null; if(b.resource)return b.resource.kind==="tree"?(this.run.tools.has("axe")?(this.h.selectedItem==="axe"?"Chop tree":"Select axe to chop"):"Tree · craft an axe"):b.resource.kind==="dig"?(this.h.selectedItem==="shovel"?"Dig":"Select shovel to dig"):this.run.tools.has("fishing_pole")?"Fish":"Water · craft a fishing pole"; if (b.e) return "Calm "+b.e.d.name; if (b.G) return this.G.state==="rest"||this.G.state==="stun"?"Soothe":"Soothe (wait for a pause)"; const o=b.o;
    if(o.kind==="garden_plot")return !o.tilled?"Prepare bed":!o.crop?"Plant seed":o.crop.growth>=1?"Harvest crop":o.wet?"Growing · watered":"Water crop";
    return ({npc:"Talk", sign:"Read", chest:"Open", cache:"Open cache", pickup:"Gather", collectible:"Gather keepsake", secret:"Search", cistern:"Fill watering can", workbench:"Craft tools", campfire:"Cook", meditate:"Meditate", lever:"Pull", tlever:"Turn", act:({snag:"Untangle",lever:"Pull",marker:"Read",carving:"Read",stormmark:"Read",inscription:"Read",lantern_plant:"Wake",glowcap:"Touch",vine:"Climb",mound:"Clear",branch:"Clear",root_lock:"Wake"})[o.sub]||"Use",
      target:o.sub==="gull"?"Calm the gull":"Open", portal:this.run.mode==="hearth"?"Step outside to nature":"Return to Quiet Rooms", seq:"Ring", dial:"Turn", pipe:"Turn gate", mirror:"Turn mirror", pushable:"Nudge", resetstone:"Reset puzzle", site:"Build", rest:"Rest", scenic:"Look", landmark:o.sub==="leaning_tree"?"Shelter":"Use", nest:"Watch", calmstone:"Touch stone", bed:"Plant", water_edge:"Look out", heron:"Approach", stranded:"Guide", shelterstones:"Shelter" })[o.kind] || "Use"; }

  interact(){ const b=this.prompt; if (!b) return; const g=this.api(), M=this.M, L=this.L, st=M.state, p=this.p;
    if (b.e) return this.gentle(b.e);
    if(b.resource){const r=b.resource;if(r.kind==="dig"){if(this.h.selectedItem!=="shovel"){this.ui.toast("Select the shovel from your bag before digging.");return;}if(this.dig)return;this._walkPath=null;p.vx=p.vy=0;this.dig={tx:r.tx,ty:r.ty,t:0};p.fx=Math.sign(r.tx+0.5-p.x);p.fy=Math.sign(r.ty+0.5-p.y);if(Math.abs(r.tx+0.5-p.x)>Math.abs(r.ty+0.5-p.y)){p.dir=p.fx>0?"right":"left";p.fy=0;}else{p.dir=p.fy>0?"down":"up";p.fx=0;}A.sfx("swing");return;}if(r.kind==="tree"){if(this.h.selectedItem!=="axe"||!this.run.tools.has("axe")||this.chop||M.get(r.tx,r.ty)!==T.TREE)return;this._walkPath=null;p.vx=p.vy=0;this.chop={tx:r.tx,ty:r.ty,t:0};p.fx=Math.sign(r.tx+0.5-p.x);p.fy=Math.sign(r.ty+0.5-p.y);if(Math.abs(r.tx+0.5-p.x)>Math.abs(r.ty+0.5-p.y)){p.dir=p.fx>0?"right":"left";p.fy=0;}else{p.dir=p.fy>0?"down":"up";p.fx=0;}A.sfx("swing");return;}if(r.kind==="water"){if(!this.run.tools.has("fishing_pole")){this.ui.toast("Craft a fishing pole at a workbench first.");return;}if(Math.random()<0.82){this.give("river_fish",1);this.run.flags.fish_caught=(this.run.flags.fish_caught||0)+1;this.ui.toast("A fish bites and joins your supper catch.",true);}else this.ui.toast("No bite this time. The water keeps its own counsel.");A.sfx("pickup");return;}}
    if (b.G) { const G=this.G; if (G.state==="rest"||G.state==="stun") { this.calmGuardian(7+this.stat("att")*0.8*this.weapon().calm,"soothe"); A.sfx("calm"); } else this.ui.toast("Not now — watch its movement, and wait."); return; }
    const o=b.o; A.sfx("menu");
    switch(o.kind){
      case "workbench": this.ui.openCraft("sandbox"); return;
      case "campfire": this.ui.openCooking(); return;
      case "portal": this.enterNaturePortal(); return;
      case "cistern": if(!this.run.tools.has("watering_can")){this.ui.toast("Craft a watering can first.");return;} this.give("water",3); return;
      case "meditate": this.toggleMeditation(); return;
      case "garden_plot": {
        if(!o.tilled){if(!this.run.tools.has("garden_trowel")){this.ui.toast("Craft a garden trowel at the workbench first.");return;}o.tilled=true;M.set(o.tx,o.ty,T.MUD);this.ui.toast("Bed prepared. Plant a gathered seed here.");return;}
        if(!o.crop){if(!this.h.inv.seed){this.ui.toast("Forage a seed before planting.");return;}this.take("seed",1);const crops=["blackberry","blueberry","wild_strawberry","raspberry","serviceberry","morel","chanterelle","oyster_mushroom"];o.crop={item:crops[this.run.gardenHarvests%crops.length],growth:0};this.ui.toast("Seed planted. Draw water from the cistern, then water this bed.");return;}
        if(o.crop.growth>=1){this.give(o.crop.item,1);this.give("seed",1);o.crop=null;o.wet=false;this.run.gardenHarvests++;this.gainXP(8);this.ui.toast("Harvest gathered. A seed is saved for replanting.",true);return;}
        if(!o.wet){if(!this.run.tools.has("watering_can")){this.ui.toast("Craft a watering can at the workbench first.");return;}if(!this.h.inv.water){this.ui.toast("The watering can is empty. Fill it at the cistern.");return;}this.take("water",1);o.wet=true;this.ui.toast("Bed watered. It will grow while you tend the garden.");return;}
        this.ui.toast("The seed is growing. Give it a little time.");return;
      }
      case "npc": { if(o.guru)return this.guidedMeditation(o);if(o.checkin){const N=this.npcDef(o.npc),place=LEVELS[(o.mapId||this.run.lv)-1]?.name||L.name;this.ui.dialog(nextCheckInConversation(this.run,place,N.name),N);return;}if(o.reassurer){const N=this.npcDef(o.npc),place=LEVELS[(o.mapId||this.run.lv)-1]?.name||L.name;this.ui.dialog(nextReassuranceConversation(this.run,place,N.name),N);return;}if(o.npc==="comp")return this.companions();if(o.walkNpc)return this.walkConversation(o);const N=NPCS[o.npc];this.ui.dialog([...N.talk(g),...nextNPCConversation(this.run,N.name)],N);return; }
      case "sign": this.ui.dialog(["|"+o.text]); return;
      case "chest": o.open=true;if(o.affirmation){this.ui.dialog(nextAffirmation(this.run).map(line=>"|"+line));return;}for(const k in o.give)this.give(k,o.give[k]);this.ui.dialog(["|Inside the crate: sweetberries, a twist of fern tea, and a smooth pebble that wasn't there before the storm.","|(Open your bag with TAB. Eat when you're hurt.)"]);if(L.mech==="intro")this.objDone();return;
      case "cache": { o.open=true; this.run.caches++; const n=this.run.lv; const mats=["shell","reed","lily","fiber","copperleaf","icecrystal","feather","mushroom","driftwood"]; const m=mats[Math.floor((n-1)/9)];
        this.give(m==="feather"?"reed":m, 2); this.give(n%2?"berry":"tea",1); if (n===74 || n===73) this.give("letter",1); if (n%9===5) this.give("broth",1); this.gainXP(8); this.ui.toast("Found a hidden cache!"); return; }
      case "collectible": o.kind="gone";if(!this.run.mapFinds.has(o.mapId)){this.run.mapFinds.add(o.mapId);this.ui.toast("Found: "+o.label,true);if(this.run.mapFinds.size===LEVELS.length&&!this.run.flags.map_finds_bonus){this.run.flags.map_finds_bonus=1;this.ui.bonusScene?.();}}return;
      case "pickup": if(o.forage&&ITEMS[o.item]?.cat==="food"&&!this.run.tools.has("forage_basket")&&!(this.run.mode==="walk"||this.run.mode==="nature")){this.ui.toast("Craft a foraging basket to gather wild foods.");return;} o.taken=true; o.solid=false; if (o.item.startsWith("w:")) { this.giveWeapon(o.item.slice(2)); this.learn("ripple_arc"); this.ui.dialog(["|A staff of driftwood, smooth from the sea and just your height.","|(J to strike. K uses your technique — Ripple Arc sweeps all around you.)"]); }
        else { this.give(o.item,1); this.checkGather(); } o.kind="gone"; return;
      case "secret": o.taken=true; o.kind="gone"; if (CHARMS[o.item]) this.giveCharm(o.item); else this.giveWeapon(o.item); this.gainXP(20); this.run.flags["secret_"+o.item]=1; return;
      case "landmark": return this.useLandmark(o);
      case "scenic": o.seen=true; this.run.scenic++; this.gainXP(5); this.ui.dialog(["|"+L.scenic]); return;
      case "rest": this.ui.dialog(["|A small fire, kept by whoever passes. You sit a while.",{do:()=>this.restHere()},{choice:[{t:"Rethink growth (respec)", do:()=>this.ui.openRespec()},{t:"Craft", do:()=>this.ui.openCraft(L.hub?"hub":"any")},{t:"Move on", next:[]}]}]); return;
      case "act": { o.on=true; st.count=(st.count||0)+1; const n=L.p.n; const s=o.sub; A.sfx("open");
        const msg = { snag:"The net comes loose.", lever:"Clunk. Something shifts far off.", marker:"The marker's carving points east, past the ferns: 'onward'.", lantern_plant:"The lantern plant opens, glowing softly.", glowcap:"The glowcap brightens under your hand.", vine:"You climb along the vine and over the trunk.", mound:"You scoop silt aside. Old stone shows beneath.", branch:"You drag the branch off the living roots.", root_lock:"The root lock unclenches, glowing.",
          carving:["A carving: two footprints, and an arrow bending north.","A carving: a small fish with its tail turned up.","A carving: 'TURN HERE' — and below, more faintly, 'the path remembers'."][st.count-1],
          stormmark:["The oldest mark: the coast was here, once.","A mark: the storm came, and the marsh was born.","A mark: the storm came, and the lake grew a second shore.","The newest mark is fresh: this year. Someone has added, 'And still they stayed.'"][st.count-1],
          inscription:["'We kept the seeds of every bad year. Bad years have the hardiest seeds.'","'A wall here, once, against the water. We took it down. The water stayed polite.'","'When the storm comes, some go home and some find home. Both kinds came back to plant.'","'Leave the door unlocked. Someone may need it more than you.'","'Whoever reads this: you are part of the record now.'"][st.count-1] }[s] || "Done.";
        if (s==="vine") { p.x = o.x + 2.2; if (!this.boxFree(p.x,p.y)) p.x=o.x+1; }
        if (L.p.target==="gull" || L.p.target==="shelter" || L.p.target==="door") { this.ui.toast(msg+" ("+st.count+"/"+n+")"); if (st.count>=n) this.ui.toast(L.p.target==="gull"?"The gull is free of the net—now go gently to it.":"Something opens nearby.", true); if (st.count>=n && L.p.target!=="gull") { const t=M.objs.find(q=>q.kind==="target"); if (t){ t.open=true; t.solid=false; } this.objDone(); } return; }
        if (["carving","stormmark","inscription","marker"].includes(s)) this.ui.dialog(["|"+msg]); else this.ui.toast(msg+" ("+st.count+"/"+n+")");
        if (st.count>=n) this.objDone(); return; }
      case "target": if (o.sub==="gull") { if (st.count<L.p.n) { this.ui.toast("The gull is still tangled. Free the net snags first."); return; } if ((this.t-p.lastAtk)<3) { this.ui.toast("The gull flinches. You've been swinging that staff—wait a moment."); return; }
        this.ui.dialog(["|You kneel. You move slowly. The gull's eye watches you, round and bright.","|It lets you lift the last strand. It hops twice, and flies—circling once over your head before heading out to sea.",{do:()=>{ this.run.flags.gull_freed=1; this.gainXP(15); o.kind="gone"; o.solid=false; this.objDone(); }}]); } return;
      case "seq": { o.flash=0.5; A.sfx("chime",o.idx); this.fx.push({kind:"ring",x:o.x,y:o.y,r:1.2,t:0,dur:0.5,col:"#fff8c0"}); st.input.push(o.idx); const i=st.input.length-1;
        if (st.order[i]!==o.idx) { st.input=[]; A.sfx("wrong"); this.ui.toast("The tone falls flat. Listen and watch again."); st.demoT=1.5; return; }
        if (st.input.length===st.order.length) { this.ui.toast("The pattern rings true.", true); this.objDone(); } return; }
      case "dial": o.dir=(o.dir+1)%4; A.sfx("menu"); if (M.objs.filter(q=>q.kind==="dial").every(q=>q.dir===q.target)) { this.ui.toast("The cairns face their old directions. A low hum runs through the stones.", true); this.objDone(); } return;
      case "pipe": o.rot=(o.rot+1)%4; A.sfx("menu"); this.pipeFlow(); return;
      case "mirror": o.m = o.m==="B"?"F":"B"; A.sfx("menu"); return;
      case "pushable": this.pushObj(o, p.fx, p.fy); return;
      case "resetstone": for (const q of M.objs) if (q.kind==="pushable") { q.tx=Math.floor(q.hx); q.ty=Math.floor(q.hy); q.x=q.tx+0.5; q.y=q.ty+0.5; } objectCells.delete(M); this.ui.toast("The puzzle settles back to how it began."); return;
      case "tlever": M.toggle.state^=1; o.on=!o.on; const s=M.toggle.state; for (const w of M.objs) if (w.kind==="twall") { const want = w.set==="A" ? s===0 : s===1; if (want && Math.floor(p.x)===w.tx && Math.floor(p.y)===w.ty) continue; w.solid=want; }
        A.sfx("open"); this.ui.toast(s?"The first screen swings open — the second swings shut.":"The first screen closes — the second opens."); if (p.x > M.objs.find(w=>w.kind==="twall"&&w.set==="B").x && !st.done) this.objDone(); return;
      case "lever": if (o.on) return; o.on=true; A.sfx("open"); this.ui.toast("The vent creaks open."); return;
      case "site": return this.useSite(o);
      case "nest": this.ui.toast(st.started? "Hold on — "+Math.ceil(st.left)+"s until the squall passes." : "Little bellflower nests, eggs pale as river stones."); return;
      case "calmstone": if (this.G && !this.G.done) { o.on=true; A.sfx("calm"); this.calmGuardian(26,"stone"); this.ui.toast("You touch the "+this.G.def.calm.replace(/s$/,"")+". It hums, and the guardian hears it."); } return;
      case "bed": if (!this.h.inv.seed) { this.ui.toast("You'll need an old seed to plant."); return; } this.take("seed",1); o.on=true; A.sfx("heal"); st.beds=(st.beds||0)+1; this.ui.toast("Planted. ("+st.beds+"/3)"); if (st.beds>=3) { this.run.flags.beds_done=1; this.ui.dialog(["Seli|Oh. Oh, listen—hear that? That's the orchard remembering.",{do:()=>this.objDone()}]); } return;
      case "heron": return this.calmHeron(o, (this.t-p.lastAtk)>3 ? 34 : 8);
      case "stranded": o.following=true; o.solid=false; this.followers.push(o); this.ui.toast("“Thank you—lead on, I'll stay close.”"); return;
      case "shelterstones": this.ui.toast("Shelter stones. Lead the stranded here."); return;
      case "water_edge": return this.ui.ending();
    }
  }
  calmHeron(o, n){ if (o.calmDone) return; o.calm=(o.calm||0)+n; A.sfx("calm"); if (o.calm>=100) { o.calmDone=true; this.run.flags.heron_calm=1; this.give("feather",1); this.gainXP(25); this.ui.dialog(["|The great heron lowers its neck. It lets you stand beside it as it fishes.","|When it leaves, a long grey feather stays on the stone."]); } else this.ui.toast(n>10?"The heron watches you, not moving. (Keep still and gentle.)":"The heron steps away from your restless staff."); }
  checkGather(){ const L=this.L, st=this.M.state; if (L.mech==="craft") return; const p=L.p||{}; if (L.mech!=="gather" || !p.item) return;
    const have=this.h.inv[p.item]||0; if (have>=p.n && !st.gotAll) { st.gotAll=true;
      if (!p.then) this.objDone(); else this.ui.toast(p.then.startsWith("npc")?"You have enough. Bring them back.":"You have enough. Now restore the "+this.L.land.replace(/_/g," ")+".", true); } }
  useLandmark(o){ const L=this.L, p=L.p||{}, g=this.api(), st=this.M.state;
    if (o.sub==="leaning_tree") { this.ui.dialog(this.run.lv===1?["|The leaning tree. You sheltered under it all night while the storm walked overhead.","|Its roots hold the dune together. Probably they held you too."]:["|The leaning tree is still leaning. A gull sits on it now."+(this.run.flags.gull_freed?" It looks at you like it knows you.":"")]); return; }
    const need = p.n; const have=this.h.inv[p.item]||0;
    if (o.use==="kiln") { const vents=this.M.objs.filter(q=>q.kind==="lever"&&q.sub==="vent"); if (have<need) { this.ui.toast("Pella needs "+need+" charcoal for the kiln."); return; }
      if (vents.some(v=>!v.on)) { this.ui.dialog(["Pella|Wait wait wait! Vents first! I like my eyebrows where they are."]); return; }
      this.take(p.item,need); o.lit=true; this.run.flags.kiln_lit=1; this.ui.dialog(["|The charcoal catches. Smoke rises straight up through both vents, clean and slow.","Pella|HA! Listen to it purr. Here—my first pot from the new fire. Well, it's from the old fire. But it's for you.",{do:()=>{ this.give("pot",1); this.give("broth",1); this.objDone(); }}]); return; }
    if (o.use==="beds") { this.ui.toast("Plant the seeds in the empty beds nearby."); return; }
    if (o.use) { if (have<need) { this.ui.toast("You need "+need+" "+(this.h.inv[p.item]!==undefined||true?((ITEMS[p.item]||{}).name||p.item):"")+". You have "+have+"."); return; }
      this.take(p.item,need); o.lit=true;
      const lines = { lamp:["|You pour the glow-seeds into the old lamp. For a moment nothing. Then the light swells, soft and gold, and sweeps the inlet.","|Tucked in the lamp housing, a bead of old glass glows warm. You keep it."], bell:["|The chime pieces slot together. The wind finds the Hollow Bell at once, and it sings the way through the cloud."] }[o.use] || ["|It is restored."];
      this.ui.dialog([...lines, {do:()=>{ if (o.use==="lamp") this.giveCharm("lantern_bead"); if (o.use==="bell") this.give("bellclapper",1); this.objDone(); }}]); return; }
  }
  useSite(o){ const L=this.L, p=L.p, M=this.M; if (o.done) { if (p.invite) this.ui.toast("Friends are gathering under the roof."); return; }
    const have=this.h.inv[p.item]||0; if (have<p.n) { this.ui.toast("You need "+p.n+" "+ITEMS[p.item].name+" here. You have "+have+"."); return; }
    this.take(p.item,p.n); o.done=true; A.sfx("done");
    if (o.sub==="bridge") { for (const [x,y] of M.bridgeTiles) M.set(x,y,T.BRIDGE); this.ui.dialog(["|You bind the twigs with bark cord, plank by plank. A squirrel inspects your work and pronounces it acceptable.",{do:()=>this.objDone()}]); return; }
    if (o.sub==="shelter") { o.kind="rest"; o.solid=true; this.ui.dialog(["|Pine boughs, lashed tight, roof sloped to shed the snow. It's warm inside. It will be warm for the next traveler too.",{do:()=>{ this.run.flags.built_pine=1; this.objDone(); this.restHere(); }}]); return; }
    if (o.sub==="open_shelter") { this.run.flags.shelter_built=1; o.kind="rest"; this.ui.dialog(["|Four posts and a roof. No walls. Anyone can come in from any side.","|Mira arrives first, then Tovan with seeds, then Pella with too many cups. Others follow—people you've helped, people you haven't met.",{do:()=>this.objDone()}]); return; }
  }
  companions(){ const r=this.run, M=this.M; if (M.state.done) { this.ui.dialog(["|The road home is clear. Your friends wave from their own turnings."]); return; }
    const avail = COMPANIONS.filter(c=>r.flags[c.req]); const chosen=[];
    const pick = ()=>{ const left=avail.filter(c=>!chosen.includes(c)); if (chosen.length>=2 || !left.length) return finish();
      this.ui.dialog([ chosen.length?"|Who else walks with you?":"|At the crossroads, friends you've made have gathered to see you off. Who will walk the next stretch with you?",
        {choice:[...left.map(c=>({t:c.name, do:()=>{ chosen.push(c); r.flags["comp_"+c.id]=1; setTimeout(pick,30); }})), {t: chosen.length?"That's enough company.":"I'll walk alone a while.", do:()=>setTimeout(finish,30)}]}]); };
    const finish = ()=>{ const lines=[]; for (const c of chosen) lines.push(...c.story); if (!chosen.length) lines.push("|You walk alone, and it is not lonely. The river keeps you company the whole way.");
      else lines.push("|At the last bend, they turn toward their own homes. Each one looks back once.");
      lines.push({do:()=>{ this.gainXP(20); this.objDone(); }}); this.ui.dialog(lines); };
    pick(); }
}
