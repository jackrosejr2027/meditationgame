// Entry: wires Game + UI, runs the fixed-timestep loop, scales the canvas, touch pad.
import { VIEW_W, VIEW_H } from "./config.js";
import { Game } from "./game.js";
import { UI, settings } from "./ui.js";
import { render } from "./render.js";
import * as I from "./input.js";
import * as A from "./audio.js";
import { enableTileHover } from "./hover.js";
import { createScale2x } from "./upscale.js";

const canvas=document.getElementById("game");canvas.width=VIEW_W*2;canvas.height=VIEW_H*2;
const sourceCanvas=document.createElement("canvas");sourceCanvas.width=VIEW_W;sourceCanvas.height=VIEW_H;
const sourceCtx=sourceCanvas.getContext("2d");sourceCtx.imageSmoothingEnabled=false;
const scaler=createScale2x(canvas,sourceCanvas);

const ui = new UI(document.getElementById("stage"));
const g = new Game(ui);
ui.bind(g);
ui.applySettings();
ui.showTitle();

// ---------- scaling ----------
function fit(){
  const W = window.innerWidth, H = window.innerHeight;
  let s = Math.min(W / VIEW_W, H / VIEW_H);
  if (s >= 2) s = Math.floor(s * 2) / 2; // crisp half-steps when large
  canvas.style.width = Math.floor(VIEW_W * s) + "px";
  canvas.style.height = Math.floor(VIEW_H * s) + "px";
}
window.addEventListener("resize", fit); fit();
window.addEventListener("beforeunload",()=>{if(g.run)try{localStorage.setItem("riverTurnsAutosave",g.saveJSON(settings));}catch{}});
enableTileHover(canvas,g,ui);
canvas.addEventListener("wheel",e=>{if(!g.run||ui.busy())return;e.preventDefault();settings.zoom=Math.max(0.55,Math.min(1.8,settings.zoom*(e.deltaY<0?1.1:0.91)));},{passive:false});

// ---------- dialogue box ----------
document.getElementById("dlgSkip").onclick = e => { e.stopPropagation(); ui.skipDialog(); };
document.getElementById("dlg").addEventListener("click", e => { if (e.target.closest("button")) return; ui.advance(); });

// ---------- touch controls ----------
const pad = document.getElementById("pad"), knob = document.getElementById("knob");
let padId = null;
function padAt(e){
  const r = pad.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2, R = r.width/2;
  let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const l = Math.hypot(dx, dy);
  if (l > 1) { dx /= l; dy /= l; }
  const dz = 0.18, m = Math.hypot(dx, dy);
  I.touchMove(m < dz ? 0 : dx, m < dz ? 0 : dy);
  knob.style.transform = "translate(" + (dx * R * 0.6) + "px," + (dy * R * 0.6) + "px)";
}
function padEnd(){ padId = null; I.touchMove(0, 0); knob.style.transform = ""; }
pad.addEventListener("pointerdown", e => { padId = e.pointerId; pad.setPointerCapture(e.pointerId); padAt(e); e.preventDefault(); });
pad.addEventListener("pointermove", e => { if (e.pointerId === padId) padAt(e); });
pad.addEventListener("pointerup", padEnd); pad.addEventListener("pointercancel", padEnd);
document.querySelectorAll("#tbtns [data-t]").forEach(b => {
  const a = b.dataset.t;
  const down = e => { e.preventDefault(); A.initAudio(); b.classList.add("on");
    if (a === "interact" && ui.dlg && ui.dlg.mode === "line") { ui.advance(); return; }
    I.touchButton(a, true); };
  const up = e => { e.preventDefault(); b.classList.remove("on"); I.touchButton(a, false); };
  b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
  b.addEventListener("contextmenu", e => e.preventDefault());
});

// first gesture unlocks audio
window.addEventListener("pointerdown", () => A.initAudio(), { once: true });

// ---------- loop ----------
const STEP = 1 / 60;
let last = performance.now(), acc = 0, autoSaveAt=performance.now()+30000;

function globalKeys(){
  if (ui.busy()) I.consume("meditate");
  if (ui.state !== "play" || ui.fading) { I.consume("pause"); I.consume("inventory"); I.consume("map"); I.consume("meditate"); return; }
  if (I.consume("pause")) {
    if (ui.panel) ui.closePanel();
    else if (!ui.dlg) { A.sfx("menu"); ui.openPause(); }
  }
  if (I.consume("inventory")) {
    if (ui.panel && ui.panel.title === "Bag & Gear") ui.closePanel();
    else if (!ui.panel && !ui.dlg) { A.sfx("menu"); ui.openInventory(); }
  }
  if (I.consume("map")) {
    if (ui.panel && ui.panel.title === "Valley Map") ui.closePanel();
    else if (!ui.panel && !ui.dlg) { A.sfx("menu"); ui.openMap(); }
  }
}

function keyLabel(){
  const d = I.inputState.lastDevice;
  if (d === "pad") return "A";
  if (d === "touch") return "Use";
  return I.keyName((I.binds.interact || [])[0] || "Space");
}

function frame(now){
  let dt = (now - last) / 1000; last = now;
  if(g.run&&now>=autoSaveAt){try{localStorage.setItem("riverTurnsAutosave",g.saveJSON(settings));}catch{}autoSaveAt=now+30000;}
  if (dt > 0.25) dt = 0.25; // tab was hidden; don't spiral
  I.pollPad();
  if (I.inputState.padJustConnected) { I.inputState.padJustConnected = false; ui.toast("Controller connected"); }

  ui.menuNav();
  ui.tickDialog(dt);
  globalKeys();

  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 8) {
    if(g.run&&g.M&&ui.state==="intro")g.updateIntroDemo(STEP);
    else if (g.run && g.M && !ui.busy()) g.update(STEP);
    acc -= STEP; n++;
  }
  if (n >= 8) acc = 0;

  if (g.run && g.M && (ui.state === "play" || ui.state === "intro" || ui.panel || ui.dlg)) {
    try {
      render(sourceCtx, g, { mode: settings.mode, zoom:settings.zoom, reduceMotion: settings.reduceMotion, relief: settings.relief,
        reduceFlash: settings.reduceFlash, highContrast: settings.highContrast, keyLabel: keyLabel() }, now / 1000);
      scaler.draw();
    } catch (err) { console.error(err); }
    if (ui.state === "play") ui.updateHUD();
    const tense = (g.G && !g.G.done) || (g.M.enemies || []).some(e => !e.gone && (e.state === "tele" || e.state === "act"));
    A.tickMusic(!tense);
  } else {
    if(ui.state==="title")A.tickMusic(true);
    scaler.clear();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
