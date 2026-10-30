// Keyboard (remappable), gamepad, and touch input -> abstract actions.
export const ACTIONS = ["up","down","left","right","interact","attack","tech","dodge","cycle","inventory","map","pause","meditate"];
export const LABELS = { up:"Move up", down:"Move down", left:"Move left", right:"Move right", interact:"Interact / Confirm", attack:"Basic attack", tech:"Use technique", dodge:"Dodge (Still Step)", cycle:"Switch technique", inventory:"Inventory", map:"Map", pause:"Pause", meditate:"Meditate / tend garden" };
export const DEFAULT_BINDS = { up:["KeyW","ArrowUp"], down:["KeyS","ArrowDown"], left:["KeyA","ArrowLeft"], right:["KeyD","ArrowRight"],
  interact:["Space","Enter"], attack:["KeyJ"], tech:["KeyK"], dodge:["ShiftLeft","ShiftRight"], cycle:["KeyQ"], inventory:["Tab"], map:["KeyM"], pause:["Escape"], meditate:["KeyG"] };
export let binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
export function resetBinds(){ binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); }

const held = new Set(), pressed = new Set();
let touch = { x:0, y:0, buttons:new Set() };
let pad = { connected:false, prev:{} };
let capture = null; // remap listener
export const inputState = { lastDevice:"keyboard", padName:"" };

export function keyName(code){ const m={ArrowUp:"↑",ArrowDown:"↓",ArrowLeft:"←",ArrowRight:"→",ShiftLeft:"Shift",ShiftRight:"R-Shift",Space:"Space",Escape:"Esc",Enter:"Enter",Tab:"Tab"}; return m[code]||(code||"").replace(/^Key|^Digit/,""); }
export function captureNext(cb){ capture = cb; }

window.addEventListener("keydown", e=>{
  if (capture) { e.preventDefault(); const cb=capture; capture=null; if (e.code!=="Escape") cb(e.code); else cb(null); return; }
  const tag = (e.target && e.target.tagName)||""; if (tag==="INPUT"||tag==="TEXTAREA") return;
  for (const a of ACTIONS) if (binds[a].includes(e.code)) { if (!held.has(a)) pressed.add(a); held.add(a); e.preventDefault(); }
  inputState.lastDevice="keyboard";
});
window.addEventListener("keyup", e=>{ for (const a of ACTIONS) if (binds[a].includes(e.code)) held.delete(a); });
window.addEventListener("blur", ()=>{ held.clear(); });

export function bindKey(action, code, slot=0){
  for (const a of ACTIONS) binds[a] = binds[a].filter(c=>c!==code);
  binds[action][slot] = code; binds[action] = binds[action].filter(Boolean);
}

// touch
export function touchMove(x,y){ touch.x=x; touch.y=y; inputState.lastDevice="touch"; }
export function touchButton(a, down){ if (down){ if(!touch.buttons.has(a)) pressed.add(a); touch.buttons.add(a);} else touch.buttons.delete(a); }
export function press(a){ pressed.add(a); }

// gamepad
window.addEventListener("gamepadconnected", e=>{ pad.connected=true; inputState.padName=e.gamepad.id; inputState.padJustConnected = true; });
window.addEventListener("gamepaddisconnected", ()=>{ pad.connected=false; });
const PADMAP = { 0:"interact", 2:"attack", 3:"tech", 1:"dodge", 4:"cycle", 5:"dodge", 8:"map", 9:"pause", 6:"inventory", 7:"tech" };
let padAxis = {x:0,y:0};
export function pollPad(){
  padAxis={x:0,y:0};
  if (!navigator.getGamepads) return; let gp=null; try { gp = [...navigator.getGamepads()].find(g=>g); } catch(e){ return; } if (!gp) return;
  const dz=0.3; padAxis.x = Math.abs(gp.axes[0])>dz?gp.axes[0]:0; padAxis.y = Math.abs(gp.axes[1])>dz?gp.axes[1]:0;
  const b = i=>gp.buttons[i]&&gp.buttons[i].pressed;
  if (b(12)) padAxis.y=-1; if (b(13)) padAxis.y=1; if (b(14)) padAxis.x=-1; if (b(15)) padAxis.x=1;
  for (const k in PADMAP){ const now=!!b(+k); if (now && !pad.prev[k]) { pressed.add(PADMAP[k]); inputState.lastDevice="pad"; } pad.prev[k]=now; }
  // menu navigation from stick
  const ny = padAxis.y>0.6?1:padAxis.y<-0.6?-1:0; if (ny && pad.prevNY!==ny) pressed.add(ny>0?"down":"up"); pad.prevNY=ny;
  const nx = padAxis.x>0.6?1:padAxis.x<-0.6?-1:0; if (nx && pad.prevNX!==nx) pressed.add(nx>0?"right":"left"); pad.prevNX=nx;
}

export function axis(){
  let x=0,y=0;
  if (held.has("left")) x-=1; if (held.has("right")) x+=1; if (held.has("up")) y-=1; if (held.has("down")) y+=1;
  x += touch.x + padAxis.x; y += touch.y + padAxis.y;
  const l=Math.hypot(x,y); if (l>1){ x/=l; y/=l; }
  return {x,y};
}
export function isHeld(a){ return held.has(a) || touch.buttons.has(a); }
export function consume(a){ if (pressed.has(a)) { pressed.delete(a); return true; } return false; }
export function clearPressed(){ pressed.clear(); }
