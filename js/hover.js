import { T } from "./world.js";
import { ITEMS } from "./data.js";
import { VIEW_W, VIEW_H } from "./config.js";

const TILE_NAMES = {
  [T.GRASS]:"Forest floor", [T.FLOWER]:"Wildflowers", [T.PATH]:"Footpath", [T.SAND]:"Sand",
  [T.SHALLOW]:"Shallow water", [T.DEEP]:"Deep water", [T.TREE]:"Tree", [T.ROCK]:"Rock",
  [T.CLIFF]:"Cliff", [T.BRIDGE]:"Bridge", [T.PLANK]:"Wooden walkway", [T.SNOW]:"Snow",
  [T.ICE]:"Ice", [T.MUD]:"Mud", [T.TALL]:"Tall grass", [T.BUSH]:"Bush", [T.FLOOR]:"Stone floor",
  [T.WALL]:"Stone wall", [T.LAKE]:"Lake", [T.VOID]:"Open air", [T.HOUSE]:"Building", [T.FENCE]:"Fence"
};

export function enableTileHover(canvas, game, ui){
  const tip=document.getElementById("tileTip");
  const coords=e=>{ const rect=canvas.getBoundingClientRect(), rawX=(e.clientX-rect.left)*VIEW_W/rect.width,rawY=(e.clientY-rect.top)*VIEW_H/rect.height,v=game._view;if(!v)return null;const zoom=v.zoom||1,sx=VIEW_W/2+(rawX-VIEW_W/2)/zoom,sy=VIEW_H/2+(rawY-VIEW_H/2)/zoom;
    if(v.mode25){const dy=Math.max(0,sy-42),depth=(-2.7+Math.sqrt(7.29+.64*dy))/.32,scale=.48+depth*.052;return{x:v.cx+(sx-VIEW_W/2)/(16*scale),y:v.cy-20+depth};}
    return{x:v.cx+(sx-VIEW_W/2)/16,y:v.cy+(sy-VIEW_H/2)/16};};
  canvas.addEventListener("pointerdown",e=>{if(!game.run||!game._view||ui.busy())return;const w=coords(e);if(!w)return;const x=Math.floor(w.x),y=Math.floor(w.y),M=game.M;game.selectedTile={x,y};game.inspectTile(x,y);game._directPickup=null;game._clickTalk=null;const npc=M.in(x,y)&&M.objs.find(o=>o.tx===x&&o.ty===y&&o.kind==="npc");if(npc){game._clickTalk=npc.npc;const steps=[[x,y+1],[x,y-1],[x+1,y],[x-1,y]].filter(([tx,ty])=>M.in(tx,ty)&&!game.solidAt(tx+.5,ty+.5)).sort((a,b)=>Math.hypot(a[0]+.5-game.p.x,a[1]+.5-game.p.y)-Math.hypot(b[0]+.5-game.p.x,b[1]+.5-game.p.y));if(steps.length)game.setDestination(steps[0][0],steps[0][1]);return;}const forage=M.in(x,y)&&M.objs.find(o=>o.tx===x&&o.ty===y&&(o.kind==="pickup"||o.kind==="collectible")&&!o.taken);game._directPickup=forage?.id||null;if(forage&&e.detail>=2&&Math.hypot(forage.x-game.p.x,forage.y-game.p.y)<1.4){game.prompt={o:forage};game.interact();}if(M.in(x,y))game.setDestination(x,y);});
  canvas.addEventListener("pointermove",e=>{
    if(e.pointerType==="touch")return;
    if(!game.run||!game._view||ui.busy()){tip.hidden=true;return;}
    const w=coords(e),tx=Math.floor(w.x),ty=Math.floor(w.y),M=game.M;game.hoverTile={x:tx,y:ty};
    if(!M.in(tx,ty)){tip.textContent="Beyond the map edge";}
    else{
      const tile=M.get(tx,ty),o=M.objs.find(q=>q.tx===tx&&q.ty===ty&&q.kind!=="gone");
      if(o?.kind==="npc"){const N=game.npcDef(o.npc);tip.textContent=N?N.name+" · "+(N.role||"neighbor")+" · "+(N.fact||"A resident of the river valley."):"Valley resident";}
      else if(o?.kind==="collectible"){tip.textContent=o.label+" · A one-of-a-kind find from this trail. Double-click to gather; click to walk.";}else if(o?.kind==="pickup"){const it=ITEMS[o.item];tip.textContent=(it?.name||o.item)+" · "+(it?.desc||"A natural find along the trail.")+" · Double-click to gather; click to walk.";}
      else if(o?.kind==="garden_plot")tip.textContent=o.crop?(o.crop.growth>=1?"Ripe crop · ready to harvest":"Growing crop · "+Math.floor(o.crop.growth*100)+"%"):(o.tilled?"Prepared garden bed":"Garden bed · needs a trowel");
      else if(o?.kind==="cistern")tip.textContent="Cistern · refill water";
      else if(o?.kind==="workbench")tip.textContent="Workbench · craft tools and food";
      else { const name=o?.label||o?.kind?.replace(/_/g," ")||TILE_NAMES[tile]||"Unknown ground"; const ecology={ [T.GRASS]:"A living layer of grasses, leaf litter and soil organisms.",[T.TREE]:"Trees shelter wildlife, hold soil and shape the forest's light.",[T.ROCK]:"Exposed bedrock and stones weather into mineral-rich soil.",[T.FLOWER]:"Wildflowers provide nectar and pollen for visiting insects.",[T.TALL]:"Tall grasses offer seeds and cover for small animals.",[T.SHALLOW]:"The sunny shallows warm quickly and shelter aquatic life.",[T.DEEP]:"Deeper water changes slowly and offers refuge from the shore.",[T.MUD]:"Wet, fine soil holds water and decomposing plant matter.",[T.SNOW]:"A blanket of snow insulates the ground and records animal tracks.",[T.ICE]:"Clear ice forms where cold water freezes in a sheltered place."}[tile]||"Part of the valley's varied natural landscape."; tip.textContent=name+" · "+(o?.kind==="npc"?"Meet this neighbor to hear their story.":ecology)+" Click to select or walk."; }
    }
    const stage=document.getElementById("stage").getBoundingClientRect();
    tip.style.left=Math.max(6,Math.min(e.clientX-stage.left+14,stage.width-230))+"px";
    tip.style.top=Math.max(6,Math.min(e.clientY-stage.top+14,stage.height-42))+"px";tip.hidden=false;
  });
  canvas.addEventListener("pointerleave",()=>{game.hoverTile=null;tip.hidden=true;});
}
