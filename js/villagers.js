// 160 named valley residents, distributed two per early level and one at the end.
const GIVEN = ["Ari","Tamsin","Jun","Mallow","Sora","Perrin","Lio","Nessa","Rill","Mina","Oren","Kit","Sable","Tavi","Ember","Celyn"];
const FAMILY = ["Reed","Moss","Vale","Brook","Thistle","Wren","Fern","Stone","Rain","Clover"];
const HAIR = ["#30231f","#705038","#bb7943","#e1c27d","#493e60","#8e4b3e","#242b32","#d4d0c5"];
const SKIN = ["#f0c8a0","#e0b090","#c89060","#a06a40","#7a4a2a","#c98970","#e7bd93","#91654f"];
const COAT = ["#c66c52","#537e70","#5475a2","#c19a50","#826395","#65854e","#b45e72","#528d9a","#aa795b","#78809b"];
const HATS = [null,"#d6bd83",null,"#668752",null,"#9a5748",null,"#61759a"];
const ROLES = ["fisher", "weather watcher", "herb keeper", "boat mender", "story collector", "trail tender", "seed keeper", "potter", "kite maker", "wayfinder"];
const THOUGHTS = [
  "I leave a little space in every basket. You never know who will need to carry something home.",
  "The old footpath is easier if you stop trying to walk in a straight line.",
  "I collect sounds when I travel. This valley has a very good rain on rooftops.",
  "A neighbor taught me to mend nets. I keep mending them, even when they do not need it.",
  "The birds know when the weather will turn. They tell us, but mostly we are too busy talking.",
  "I planted a tree where I got lost. Now it is the best place to stop and think.",
  "People leave kind things behind without meaning to. A dry seat. A lit fire. A clear path.",
  "I thought I was passing through. Then I learned the names of the stones.",
  "The river makes a new map every season. I stopped correcting my old one.",
  "Some days I make things that do not need to be useful. Those are often the useful ones.",
  "I like the hour when the lanterns are lit and nobody has quite gone inside yet.",
  "If you find a lost button, leave it on the waystone. Someone will know it is theirs.",
  "I have a list of good places to sit. It is longer than my list of places to go.",
  "The wind carries everyone's words away, but it brings the smell of supper back.",
  "My grandparent says home is where someone saves you the warm end of the loaf.",
  "I once followed a fox for half a day. It was going somewhere. I was just glad to be along."
];
const REGION_NOTES = [
  "The sea keeps all its promises, just not on the schedule we expect.",
  "Under these ferns, even the sunlight seems to walk softly.",
  "The marsh is not slow. It is just doing several things at once.",
  "Clouds come low enough here to remember what the grass looks like.",
  "Autumn leaves make every path sound like a small celebration.",
  "Snow makes the familiar places feel newly introduced.",
  "The lake has two skies, and I think both of them are right.",
  "The roots carry old stories farther than any road can.",
  "The storm changed the coast, but not the way people look after each other."
];

export const AMBIENT_NPCS = Array.from({length:160}, (_,i) => {
  const first = GIVEN[Math.floor(i/FAMILY.length)];
  const last = FAMILY[i%FAMILY.length];
  const id = "valley_"+(i+1).toString().padStart(3,"0");
  const name = first+" "+last;
  const level = Math.floor(i/2)+1;
  const role = ROLES[(i*7+3)%ROLES.length];
  const thought = THOUGHTS[(i*5+2)%THOUGHTS.length];
  const note = REGION_NOTES[Math.min(8,Math.floor((level-1)/9))];
  const look = {hair:HAIR[(i*3+1)%HAIR.length], coat:COAT[(i*7+2)%COAT.length], skin:SKIN[(i*5+3)%SKIN.length], hat:HATS[(i*3)%HATS.length], style:["short","long","tied"][i%3], scarf:i%4===0?COAT[(i+5)%COAT.length]:null};
  return {
    id, name, role, look,
    talk(g){
      const met="met_"+id,visitKey="resident_talk_"+id,turn=g.flag(visitKey)||0;
      const openings=["I was just listening to the rain on the eaves.","The path looks different after every hard weather.","I saved the sunny side of this bench for whoever came by.","The birds have been telling a story all morning.","I found a smooth stone and kept it for no practical reason.","The kettle is nearly ready; it always seems to know when company is near.","I have been thinking about where this footpath used to bend.","A small kindness can travel farther than a letter.","I was tending a patch of clover and lost track of the hour.","It is easier to notice the valley when I let myself walk slowly."];
      const observations=["The river changes its banks, but the neighbors keep learning one another's names.","A seed waits quietly; that is still a kind of work.","Some shelter is built from stone. Some is just someone leaving a light on.","There are more useful places to sit than there are reasons to hurry.","The woods are full of small lives doing their best without an audience.","A storm can redraw a map without deciding where anyone belongs.","I try to learn one new bird call each season and forget half of them.","We mend the net even when the next catch is uncertain.","The ordinary chores make a good rhythm for difficult days.","A shared meal is a map that shows how to get home."];
      const endings=["When the evening comes, I count warm windows, not miles traveled.","If you meet someone carrying too much, offer a hand before advice.","The wind takes loose leaves; roots keep the soil together.","I keep a little space in my basket for something unexpected.","It is all right to rest before you know exactly what comes next.","No path is wasted if it teaches you a gentler pace.","The smallest patch of green can make a room feel like spring.","I will be here tomorrow, and the bench will still be warm in the sun.","Every place has a story worth hearing twice.","Take the long way if it gives your thoughts room to settle."];
      const a=turn%10,b=Math.floor(turn/10)%10,c=Math.floor(turn/100)%10,variant=Math.floor(Math.random()*50),randomTopics=["I have a small thought about the weather.","I noticed something by the water.","I have been remembering an old kindness.","A neighbor told me a curious little story.","I found a detail in the woods worth sharing."];return [name+"|I'm "+name+". I look after the "+role+" work around here.",name+"|"+openings[a],name+"|"+observations[b]+" "+note,name+"|"+randomTopics[Math.floor(variant/10)]+" "+endings[variant%10],{choice:[{t:"What have you noticed lately?",next:[name+"|"+endings[c]]},{t:"What do you think about this place?",next:[name+"|"+thought]},{t:"I will let you get back to it.",next:[name+"|Good walking to you. The path is friendlier when someone has just passed along it."]}]},{do:g=>{g.set(met,1);g.set(visitKey,turn+1);g.set("resident_choice_"+id+"_"+turn,"listened");}}];
    }
  };
});
