// Generated ambient music + sound effects with Web Audio. Gracefully silent if unavailable.
let ctx=null, master, musicG, sfxG, noiseBuf, rainG, windG, rainF, windF, delay, fb;
let vol = { music:0.5, sfx:0.7, muted:false };
let region=null, nextNote=0, step=0, enabled=false;

export function initAudio(){
  if (ctx) { if (ctx.state==="suspended") ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  try {
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
    musicG = ctx.createGain(); sfxG = ctx.createGain(); musicG.connect(master); sfxG.connect(master);
    delay = ctx.createDelay(1); delay.delayTime.value = 0.42; fb = ctx.createGain(); fb.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(musicG);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate); const d=noiseBuf.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const mkNoise=(type,freq)=>{ const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=freq; const g=ctx.createGain(); g.gain.value=0; s.connect(f); f.connect(g); g.connect(musicG); s.start(); return [g,f]; };
    [rainG,rainF] = mkNoise("highpass",1800); [windG,windF] = mkNoise("bandpass",400);
    enabled = true; applyVol(); return true;
  } catch(e){ console.warn("Audio unavailable", e); ctx=null; return false; }
}
function applyVol(){ if(!ctx) return; master.gain.value = vol.muted?0:1; musicG.gain.value = Math.min(1.2,vol.music*1.5); sfxG.gain.value = Math.min(1.2,vol.sfx*1.5); }
export function setVolume(k,v){ vol[k]=v; applyVol(); }
export function getVolume(){ return vol; }
export function setRegion(r){ region = r; }
export function setWeather(w, dark){
  if (!ctx) return; const t=ctx.currentTime;
  const rain = {rain:0.08, storm:0.16, mist:0.02, snow:0, wind:0.0}[w]||0, wind = {storm:0.22, wind:0.14, snow:0.07, rain:0.04}[w]||0.02;
  rainG.gain.setTargetAtTime(rain,t,1.5); windG.gain.setTargetAtTime(wind,t,1.5);
}
function tone(freq, t, dur, type="triangle", gain=0.08, dest){
  const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(dest||musicG); o.start(t); o.stop(t+dur+0.05); return g;
}
const mtof = m=>440*Math.pow(2,(m-69)/12);
const MAJOR=[0,2,4,5,7,9,11],MODE_NAMES=["Ionian","Dorian","Phrygian","Lydian","Mixolydian","Aeolian","Locrian"];
export const SOUNDTRACK=MODE_NAMES.map((name,i)=>({id:name.toLowerCase(),name:name+" · Fibonacci Walk",mode:name,degrees:MAJOR.map(n=>(n-MAJOR[i]+12)%12).sort((a,b)=>a-b),description:"Procedural major-scale mode with a Fibonacci scale-degree motif."}));
const fib=[1,1];for(let i=2;i<24;i++)fib.push(fib[i-1]+fib[i-2]);
export const FIBONACCI_DEGREES=fib.slice(0,16).map(n=>n%7);
export const SFX_LIBRARY={step:"Soft footstep",hit:"Impact",hurt:"Stumble",swing:"Weapon sweep",pickup:"Found item",calm:"Gentle chime",level:"Growth flourish",menu:"Menu note",open:"Latch or door",wrong:"Puzzle reset",heal:"Restoration",dodge:"Quick step",tech:"Technique",gust:"Wind rush",done:"Completion chord",chime:"Scale chime"};
export function previewTrack(id){if(!ctx)initAudio();const track=SOUNDTRACK.find(x=>x.id===id);if(!ctx||!track)return false;const mu=region?.music||{root:57,tempo:1},start=ctx.currentTime+.04;for(let i=0;i<16;i++){const degree=FIBONACCI_DEGREES[i];tone(mtof(mu.root+track.degrees[degree]+(i%4===3?12:0)),start+i*.17,.24,"triangle",.055,sfxG);}return true;}
export function tickMusic(calm){
  if (!ctx || !region || vol.muted) return;
  const t = ctx.currentTime; if (nextNote < t) nextNote = t+0.05;
  const mu = region.music, track=SOUNDTRACK[(Math.abs(mu.root+region.name.length)%SOUNDTRACK.length)], beat = 0.55/mu.tempo;
  while (nextNote < t+0.3) {
    const sc = mu.scale; const s = step++;
    const degree=FIBONACCI_DEGREES[s%FIBONACCI_DEGREES.length],turn=FIBONACCI_DEGREES[(s+5)%FIBONACCI_DEGREES.length];
    if (s%16===0) { tone(mtof(mu.root-12), nextNote, beat*14, "sine", 0.05); tone(mtof(mu.root+track.degrees[4]-12), nextNote, beat*14, "sine", 0.03); }
    const r = Math.sin(s*12.9898+mu.root)*43758.5453; const rr = r-Math.floor(r);
    if (rr < (calm?0.45:0.6)) { const deg = track.degrees[(degree+(rr>0.3?turn%3:0))%7] + 12*(Math.floor(rr*7)%2); const g=tone(mtof(mu.root+deg), nextNote, beat*3, "triangle", 0.045); g.connect(delay); }
    if (s%8===4 && rr>0.5) tone(mtof(mu.root+track.degrees[(degree+4)%7]+12), nextNote, beat*2, "sine", 0.025);
    nextNote += beat;
  }
}
const SFX = {
  step:   ()=>[[180,0.05,"square",0.015]],
  hit:    ()=>[[220,0.08,"square",0.08],[140,0.12,"triangle",0.08]],
  hurt:   ()=>[[160,0.15,"sawtooth",0.06],[90,0.2,"triangle",0.08]],
  swing:  ()=>[[600,0.05,"triangle",0.03],[300,0.06,"triangle",0.03]],
  pickup: ()=>[[880,0.08,"triangle",0.07],[1320,0.12,"triangle",0.06,0.07]],
  calm:   ()=>[[523,0.4,"sine",0.06],[659,0.4,"sine",0.05,0.1],[784,0.6,"sine",0.05,0.2]],
  level:  ()=>[[523,0.2,"triangle",0.07],[659,0.2,"triangle",0.07,0.12],[784,0.2,"triangle",0.07,0.24],[1047,0.5,"triangle",0.07,0.36]],
  menu:   ()=>[[700,0.04,"square",0.03]],
  open:   ()=>[[330,0.15,"triangle",0.06],[495,0.25,"triangle",0.06,0.1]],
  wrong:  ()=>[[300,0.12,"square",0.04],[220,0.2,"square",0.04,0.1]],
  heal:   ()=>[[660,0.3,"sine",0.05],[880,0.4,"sine",0.04,0.15]],
  dodge:  ()=>[[400,0.08,"sine",0.04]],
  tech:   ()=>[[440,0.12,"triangle",0.06],[880,0.18,"sine",0.04,0.05]],
  gust:   ()=>[[120,0.4,"sawtooth",0.02]],
  done:   ()=>[[392,0.3,"triangle",0.07],[523,0.3,"triangle",0.07,0.15],[659,0.6,"triangle",0.07,0.3]],
  chime:  (k=0)=>[[[784,880,988,1175,1319][k%5],0.9,"sine",0.08]],
};
export function sfx(name, arg){
  if (!ctx || vol.muted) return; const t=ctx.currentTime; const list = (SFX[name]||SFX.menu)(arg);
  for (const [f,d,ty,g,off=0] of list) tone(f, t+off, d, ty, g, sfxG);
}
