// Node smoke test: stubs DOM/canvas, runs every level's simulation + both render modes.
const noop = ()=>{};
const ctxProxy = () => new Proxy({}, { get(t,k){ if (k in t) return t[k]; if (k==="measureText") return ()=>({width:10}); if (k==="getImageData"||k==="createImageData") return (x,y,w=1,h=1)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h}); if (k==="createLinearGradient"||k==="createRadialGradient"||k==="createPattern") return ()=>({addColorStop:noop}); return noop; }, set(t,k,v){ t[k]=v; return true; } });
const mkCanvas = () => ({ width:0, height:0, getContext: ()=>ctxProxy(), style:{} });
globalThis.document = { createElement: ()=>mkCanvas(), querySelector: ()=>null, documentElement:{style:{setProperty:noop}}, body:{classList:{toggle:noop}} };
globalThis.window = { addEventListener: noop };
globalThis.ImageData = class { constructor(d,w,h){ this.data=d; this.width=w; this.height=h; } };
globalThis.performance = { now: ()=>Date.now() };

const { Game } = await import("../js/game.js");
const { LEVELS } = await import("../js/levels.js");
const { render } = await import("../js/render.js");
const ui = { toast:noop, levelBanner:noop, completeCue:noop, combatLog:noop, fade:cb=>cb(), busy:()=>false,
  dialog:(s,n,end)=>{ end&&end(); }, openCraft:noop, openShop:noop, openRespec:noop, ending:noop, refresh:noop, state:"play" };
const g = new Game(ui);
g.newRun({ name:"Rowan", pres:"boy", pron:"he", look:{hair:"#222", coat:"#57a", skin:"#eb9", style:"short"} });
const ctx = ctxProxy(); let errs = 0;
for (const L of LEVELS) {
  try {
    g.enterLevel(L.n, "entry");
    for (let i=0;i<240;i++) g.update(1/60);
    render(ctx, g, {mode:"top", keyLabel:"Space"}, 1);
    render(ctx, g, {mode:"2.5d", relief:true, keyLabel:"Space"}, 2);
    if (g.prompt) g.promptText();
    g.interact && g.interact();
  } catch (e) { errs++; console.log("Level", L.n, L.mech, "->", e.stack.split("\n").slice(0,3).join(" | ")); }
}
console.log(errs ? errs+" levels failed" : "SMOKE OK");
