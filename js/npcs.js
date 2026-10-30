// NPC definitions and dialogue. Scripts are arrays of steps:
//  "Speaker|text"   a line ({name},{sub},{obj},{pos},{word},{Sub} tokens are filled in)
//  {choice:[{t:"text", next:[...steps], do:(g)=>{}}]}
//  {do:(g)=>{}}     run an action
// g is the game API: flag/set/give/has/take/xp/learn/objDone/craft/respec/rest/shop/heal/sexy.

import { AMBIENT_NPCS } from "./villagers.js";

const H = "{name}";
export const NPCS = {
  quiet_keeper:{name:"Hearth Keeper",role:"keeper of the quiet rooms",fact:"A patient neighbor tending the shared indoor refuge.",look:{hair:"#51483e",coat:"#657e68",skin:"#c89070",hat:"#d3ba82"},talk(g){const count=g.flag("hearth_reflections")||0;if(!g.flag("hearth_met"))return ["Hearth Keeper|The door is never locked. There is room here for a tired traveler.","Hearth Keeper|I keep a thought from the psalms close: like a shepherd guiding someone through rough country, care can meet us one step at a time.",{choice:[{t:"I could use some rest.",next:["Hearth Keeper|Then rest. You do not have to earn a quiet moment."]},{t:"What helps when the night feels long?",next:["Hearth Keeper|A psalm pictures a table set even in a hard place. It reminds me that welcome can survive a difficult day."]},{t:"Thank you for keeping the room.",next:["Hearth Keeper|We take turns. Someone kept a light for me once, and now I can keep one for you."]}]},{do:g=>g.set("hearth_met",1)}];if(count<3)return ["Hearth Keeper|A line of wisdom I return to says that quiet waters and green places can restore a weary heart. No hurry; begin with a breath.",{choice:[{t:"Sit and reflect for a moment.",next:["Hearth Keeper|Gratitude does not deny what hurts. It helps us notice that hurt is not the only thing here."],do:g=>{g.set("hearth_reflections",count+1);g.give("tea",1);g.set("hearth_choice_"+count,"reflection");}},{t:"Ask for a hopeful thought.",next:["Hearth Keeper|The psalms keep making room for morning after a dark night. Hope can be small and still be real."],do:g=>g.set("hearth_choice_"+count,"hope")},{t:"Just sit together quietly.",next:["Hearth Keeper|No answer is needed. We can let the room be peaceful for a while."],do:g=>g.set("hearth_choice_"+count,"quiet")}]},"Hearth Keeper|A warm cup is for the road, if you would like it."];return ["Hearth Keeper|You have made time for three quiet reflections. Carry one gentle thing back with you: you are not alone, and you may begin again.",{choice:[{t:"Rest by the window.",do:g=>g.rest()},{t:"Share a cup of tea.",do:g=>g.give("tea",1)},{t:"Return to the valley.",next:[]}]}];}},
  mira: { name:"Mira", role:"shellmaker", look:{hair:"#3a2a22", coat:"#c87a5a", skin:"#e8b890", hat:"#e0d0b0"},
    talk(g){
      if (!g.flag("met_mira")) return [
        "Mira|Mind the step. Everything in my nook is either sharp or half-finished.",
        "Mira|You came in with the storm. You've the look of it, still—salt in your hair and a hundred questions.",
        {choice:[
          {t:"I need to find my way home.", next:["Mira|Then you'll need to stay dry long enough to get there. Rain here doesn't stop. It just pauses."]},
          {t:"What is this place?", next:["Mira|The Rainwake. It used to be a straight coast. The storm gave it a few new bends.","Mira|It'll give it more. Coasts are like that."]},
          {t:"(Say nothing, look around.)", next:["Mira|Good. Most people talk before they've seen the room."]},
        ]},
        "Mira|I could give you a cloak. But you'd treat it like a gift, and gifts get left on chairs.",
        "Mira|Bring me three reed fibers and a shell. I'll show you how. You'll make your own.",
        {do:g=>{ g.set("met_mira",1); g.set("quest_cloak",1); }},
      ];
      if (g.flag("crafted_rain_cloak")) return [
        g.pick(["Mira|Wear it a while before you judge it. Cloaks and people both need time to soften.",
          "Mira|If anything breaks, bring it here. Broken is just a step before mended.",
          "Mira|The storm took three of my shutters. I've decided the house prefers the view."]),
        {choice:[{t:"Craft something", do:g=>g.craft("mira")},{t:"Rest a while", do:g=>g.rest()},{t:"Goodbye", next:[]}]},
      ];
      return [ g.has("reed",3)&&g.has("shell",1) ? "Mira|There. Sit. Hands like this—no, slower. Slower still. Good." : "Mira|Three reeds, one shell. The reeds grow along the shore path. Shells, well. Look down.",
        {choice:[{t:"Craft", do:g=>g.craft("mira")},{t:"Rest a while", do:g=>g.rest()},{t:"Later", next:[]}]} ];
    }},
  tovan: { name:"Tovan", role:"herbalist", look:{hair:"#8a6a3a", coat:"#6a8a3a", skin:"#c89870", hat:"#4a6a2a"},
    talk(g){
      if (!g.flag("met_tovan")) return [
        "Tovan|Shh. Shh! You're standing on a conversation.",
        "Tovan|...Ah, you've stepped off. The clover will forgive you. Clover forgives everything.",
        "Tovan|I'm Tovan. I mix remedies, mostly from things other people pull out as weeds.",
        {choice:[
          {t:"Weeds can heal?", next:["Tovan|A weed is just a plant in a place someone had other plans for."]},
          {t:"Can you help me get home?", next:["Tovan|I can help you get to tomorrow in good shape. Home's further along that road."]},
        ]},
        "Tovan|Foxglove grows in this clearing—three sprigs is all I need. Careful: it's bitter, and it bites back if you eat it raw.",
        {do:g=>g.set("met_tovan",1)},
      ];
      if (g.flag("tovan_done")) return [ g.pick(["Tovan|The bees and I have an arrangement. They don't tell me how to mix, I don't tell them how to dance.",
        "Tovan|You walk differently than when you came. Lighter. Or the boots dried.","Tovan|Rest is a remedy too. The cheapest one. Nobody takes it."]),
        {choice:[{t:"Craft remedies", do:g=>g.craft("any")},{t:"Goodbye", next:[]}]} ];
      if (g.has("foxglove",3)) return [
        "Tovan|Three! And you didn't nibble one. I can tell. Your tongue would be purple.",
        "Tovan|Here—a satchel of moss. It keeps things fresh and somehow fits more than it should.",
        "Tovan|And one more thing. Hold your palms out. Feel the rain? Now ask it to stay a while.",
        {do:g=>{ g.take("foxglove",3); g.giveCharm("moss_satchel"); g.learn("rain_mend"); g.give("remedy",2); g.xp(25); g.set("tovan_done",1); g.objDone(); }},
        "Tovan|That's Rain Mend. It's slow out in the open, quick when you've a moment of peace. Like most healing.",
      ];
      return ["Tovan|Three foxglove sprigs. Tall, purple, smug-looking. You'll know them."];
    }},
  keeper: { name:"Wade", role:"marsh keeper", look:{hair:"#c0c0b8", coat:"#5a7a7a", skin:"#b88860", hat:"#8a9a6a"},
    talk(g){
      if (!g.flag("learned_listening_palm")) return [
        "Wade|Steady on the boards. The marsh likes to keep a visitor or two.",
        "Wade|The mud lanterns are cross again. Storm stirred up their bottoms. Can't blame 'em.",
        {choice:[
          {t:"Should I drive them off?", next:["Wade|You could. They'd come back crosser."]},
          {t:"How do you calm them?", next:["Wade|You stop being the loudest thing in the marsh. Here, I'll show you."]},
        ]},
        "Wade|Palm open, low. Breathe out longer than you breathe in. Listen till you can hear what it's upset about.",
        {do:g=>{ g.learn("listening_palm"); g.set("learned_listening_palm",1); g.xp(15); }},
        "Wade|That's the Listening Palm. Doesn't work twice in a row. Nobody likes being listened to that hard all at once.",
        "Wade|Calm two of those lanterns and the path north'll settle.",
      ];
      return [ g.pick(["Wade|The heron and I have fished this pool thirty years. He's still ahead.","Wade|Marsh was here before the boardwalk. It'll be here after. We just borrow the dry bits.",
        "Wade|Rest if you like. The stilt house creaks but it never falls."]), {choice:[{t:"Rest", do:g=>g.rest()},{t:"Goodbye", next:[]}]} ];
    }},
  eren: { name:"Eren", role:"ridge guide", look:{hair:"#2a2a30", coat:"#4a6a9a", skin:"#d0a080", hat:"#9a3a3a"},
    talk(g){
      if (!g.flag("met_eren")) return [
        "Eren|Stop. Right there. ...Good, that stone's loose. Now step left.",
        "Eren|Sorry. Habit. I'm Eren. I guide people over the ridge, mostly by telling them to stop.",
        {choice:[
          {t:"Are you always this careful?", next:["Eren|I'm careful so other people don't have to be quite so careful. Seems a fair trade."]},
          {t:"The wind keeps shoving me.", next:["Eren|It isn't shoving. It's going somewhere and you're in the way. Let me show you how to go with it."]},
        ]},
        "Eren|Watch. Gather the air in your hands—not grab, gather—and let it go along a thread.",
        {do:g=>{ g.learn("wind_thread"); g.set("met_eren",1); g.xp(20); g.objDone(); }},
        "Eren|That's Wind Thread. It'll move light things: seed-puffs, gustlings, the hat off a rude person. Use it gently.",
        "Eren|There's a camp up at the high meadow. Rest there when your legs go to string.",
      ];
      if (g.lv()===35) {
        const res = [];
        if (!g.flag("eren_camp")) res.push("Eren|You made it. I'll admit I counted the clouds while I waited—you came in on the fourteenth.", {do:g=>{g.set("eren_camp",1); g.objDone();}});
        res.push(g.pick(["Eren|Sit. The fire's honest. It'll warm whoever sits nearest.","Eren|I lost a traveler once. Not lost—they chose a different path than I'd have chosen. Took me years to see the difference.",
          "Eren|Your growth—the way you've been leaning your strength. You can rethink that here. Nothing's carved yet."]),
          {choice:[{t:"Rest by the fire", do:g=>g.rest()},{t:"Rethink my growth (respec)", do:g=>g.respec()},{t:"Craft", do:g=>g.craft("hub")},{t:"Goodbye", next:[]}]});
        return res;
      }
      return ["Eren|Lean into it. Not against. Into."];
    }},
  orchard: { name:"Hesk", role:"orchard keeper", look:{hair:"#e0e0d0", coat:"#8a5a3a", skin:"#c89060", hat:"#5a7a3a"},
    talk(g){
      if (g.flag("orchard_done")) return ["Hesk|The children made pies. Lopsided pies. Best I've had."];
      if (g.has("fruit",6)) return ["Hesk|Six! Bruised, sure. So am I. Still good for something.",
        {do:g=>{ g.take("fruit",6); g.give("broth",2); g.xp(30); g.set("orchard_done",1); g.objDone(); }},
        "Hesk|Take some broth. Made with last week's apples. They didn't mind."];
      return ["Hesk|The wind shook every tree bare overnight. Six apples would feed the little ones till market. Can you look about?"];
    }},
  nim: { name:"Nim", role:"kite-maker", look:{hair:"#e0a040", coat:"#e05a6a", skin:"#e8c0a0", hat:null, small:true},
    talk(g){
      const lv = g.lv();
      if (lv===35) return [ g.pick(["Nim|This one's a heron kite. It flies better than the fish one. The fish one sulked.",
        "Nim|Do you think the wind gets lonely? It's always going places and never staying.",
        "Nim|I tie the strings extra long. So the kites can see further than me."]) ];
      if (lv===57) {
        if (g.flag("kites_done")) return ["Nim|They're all flying! Look—the blue one's showing off."];
        if (g.has("kite",4)) return ["Nim|You found them ALL? Even the frog one? It hides!",
          {do:g=>{ g.take("kite",4); g.xp(35); g.set("kites_done",1); g.give("tea",2); g.objDone(); }},
          "Nim|I'm making you one. It'll have your face. Your face but with wings.",
          {choice:[{t:"I'd like that.", next:["Nim|I'll make the wings big. In case you need them."]},{t:"Maybe no face?", next:["Nim|Fine. A cloud, then. You've got a cloudy sort of look."]}]}];
        return ["Nim|The storm took four of my kites out to the islets. I can't row yet—Oru says my arms are 'aspirational'.", {do:g=>g.set("met_nim",1)}];
      }
      return ["Nim|Hi! Are you the one from the storm? Did you fly? I always wanted to fly in one."];
    }},
  pella: { name:"Pella", role:"potter", look:{hair:"#5a2a20", coat:"#d0a060", skin:"#a87050", hat:"#d05a3a"},
    talk(g){
      if (g.lv()===40) return [ g.flag("kiln_lit") ? "Pella|The kiln's purring! I've already cracked three pots celebrating. Worth it." : "Pella|Kiln's still cold, but I'm warm! That's half the job.",
        g.pick(["Pella|A pot's mostly empty space. That's the part you use. Funny, eh?","Pella|My mother's pots were perfect. Mine lean. People buy mine to make their tables feel straight."]),
        {do:g=>g.set("talk_pella",1)} ];
      if (!g.flag("met_pella")) return [
        "Pella|Ha! A visitor, and me covered in ash. Welcome anyway!",
        "Pella|The storm blew out my kiln. I've been trying to relight it for a week. It's winning, but I'm more stubborn.",
        "Pella|I need three lumps of charcoal—the burners near the old pits dropped some. And open both vents first, or the smoke'll fill the hollow.",
        {choice:[
          {t:"Why not just light it now?", next:["Pella|Tried that. Eyebrows still growing back. Slowly is faster, as it turns out."]},
          {t:"I'll help.", next:["Pella|Ha! I knew the storm owed me something."]},
        ]},
        {do:g=>g.set("met_pella",1)},
      ];
      return ["Pella|Charcoal, then the vents, then the fire. In that order, or we'll both be eyebrowless."];
    }},
  vendor: { name:"Dov", role:"trader", look:{hair:"#6a4a2a", coat:"#3a5a7a", skin:"#d8b088", hat:"#c0a050"},
    talk(g){ return [ "Dov|Trading! Not selling—trading. Coin's useless here; a good root is worth something.",
      {do:g=>g.set("talk_vendor",1)}, {choice:[{t:"Trade", do:g=>g.shop()},{t:"Any news?", next:[g.pick(["Dov|The tortoises came down from the hills early. Means a warm winter, or a confused tortoise.","Dov|Somebody in a blue coat bought nothing and asked about the coast. Odd sort. Nice sort."])]},{t:"Goodbye", next:[]}]} ]; }},
  elder: { name:"Old Wenna", role:"elder", look:{hair:"#f0f0f0", coat:"#7a4a6a", skin:"#c09070", hat:null},
    talk(g){ return [ "Wenna|Sit, child. My knees and I are taking the afternoon slowly.",
      "Wenna|When I was young, the hamlet was lower, by the creek. A flood moved us up here. We grumbled for a year.",
      "Wenna|Now the creek floods every spring, and we watch it from the porch with tea.",
      {do:g=>{ if(!g.flag("talk_elder")) g.xp(10); g.set("talk_elder",1); }} ]; }},
  storyteller: { name:"Yarrow", role:"storyteller", look:{hair:"#8a8aa0", coat:"#5a4a7a", skin:"#d0a888", hat:"#3a3a5a"},
    talk(g){
      if (!g.flag("story_heard")) return [
        "Yarrow|Warm your hands. Stories come out slower when the teller's cold.",
        "Yarrow|Here's one. A village once built a wall to keep out a river. The river was patient. It went around.",
        "Yarrow|So they built a longer wall. The river was patient. It went under.",
        {choice:[
          {t:"What happened then?", next:["Yarrow|They moved the village. The river grew a meadow where the wall had been. Best grazing in the valley."]},
          {t:"Was the river angry?", next:["Yarrow|Rivers are never angry. They're just going downhill. It's people who take it personally."]},
        ]},
        {do:g=>{ g.set("story_heard",1); g.xp(20); g.objDone(); }},
        "Yarrow|Rest in the spring. It's been warm since before anyone counted.",
      ];
      return [ g.pick(["Yarrow|Another? A heron once tried to stand on two legs. It fell asleep standing on one. Both worked.","Yarrow|The best stories have holes in them. The listener fills them."]),
        {choice:[{t:"Rest in the spring", do:g=>g.rest()},{t:"Goodbye", next:[]}]} ];
    }},
  hurt_hare: { name:"Mountain Hare", role:"creature", creature:true,
    talk(g){
      if (g.flag("hare_done")) return ["|The hare nudges your boot, then hops off into the snow, barely limping."];
      if (g.has("berry",3)) return ["|You kneel slowly. The hare watches. You set the berries down, and wait.",
        "|After a long while, it eats. Then it lets you wrap its leg with a strip of cloak.",
        {do:g=>{ g.take("berry",3); g.give("harefur",1); g.xp(30); g.set("hare_done",1); g.objDone(); }}];
      return ["|A hare with a hurt leg. It flinches when you come close. It looks hungry."];
    }},
  dockhand: { name:"Tam", role:"dockhand", look:{hair:"#3a5a3a", coat:"#a0705a", skin:"#c89878", hat:"#4a6a8a"},
    talk(g){
      if (g.flag("has_boat")) return ["Tam|Paddle on the left to go right. Or the right. One of those. You'll learn."];
      return ["Tam|You'll want a boat. Everyone does, out here—the lake is the road.",
        {choice:[
          {t:"Can I borrow one?", next:["Tam|Borrow? Take it. It's reed—when it wears out, you weave another. That's the whole secret."]},
          {t:"What do I owe you?", next:["Tam|Bring it back when you don't need it. Or don't. Someone else will find it, and they'll need it too."]},
        ]},
        {do:g=>{ g.set("has_boat",1); g.give("boatpass",1); g.xp(15); g.toast("You can now cross marked lake water."); }},
        "Tam|Stay on the blue-marked water—the dark lake. The boat floats there and only there."];
    }},
  oru: { name:"Oru", role:"boatkeeper", look:{hair:"#202020", coat:"#3a4a6a", skin:"#8a5a3a", hat:"#c0b080"},
    talk(g){
      if (!g.flag("met_oru")) return [
        "Oru|Boathouse. Sit or work. No standing in doorways.",
        "Oru|The lake has six seasons. Ice. Breaking. Mud. Green. Gold. Still. Storm came in Gold. Pushed us straight into Still.",
        {choice:[
          {t:"Is that bad?", next:["Oru|It's early. Early isn't bad. Early is just early."]},
          {t:"Which season is best?", next:["Oru|The one you're in. The others are only stories."]},
        ]},
        {do:g=>{ g.set("met_oru",1); g.xp(15); g.objDone(); }},
        "Oru|You can mend your gear here. Rest. Change how you fight, if you're tired of how you fight.",
      ];
      return [ g.pick(["Oru|My father kept this boathouse. He talked less than me. I thought that was impossible.","Oru|Nim keeps tying kites to my boats. They go faster. I've stopped complaining.",
        "Oru|In Breaking season, the ice talks all night. You get used to it. Then you miss it."]),
        {choice:[{t:"Rest", do:g=>g.rest()},{t:"Respec growth", do:g=>g.respec()},{t:"Craft / repair", do:g=>g.craft("hub")},{t:"Goodbye", next:[]}]} ];
    }},
  mira_r7: { name:"Mira", role:"shellmaker", look:{hair:"#3a2a22", coat:"#c87a5a", skin:"#e8b890", hat:"#e0d0b0"},
    talk(g){ return ["Mira|Don't look so surprised. I trade shells with Oru every Still season. The storm made it early, that's all.",
      "Mira|Your cloak's held up. Your knees, less so. Sit.", {do:g=>{ if(!g.flag("mira_r7")){ g.give("shellwhistle",1); g.toast("Mira gives you a Shell Whistle."); } g.set("mira_r7",1); }}]; }},
  seli: { name:"Seli", role:"root gardener", look:{hair:"#a0f0c0", coat:"#5a4a7a", skin:"#b0a0c0", hat:null},
    talk(g){
      if (g.flag("beds_done")) return [ g.pick(["Seli|The orchard says thank you. It says it slowly, in leaves.","Seli|Every path in the valley starts as a root's idea. People just widen them.",
        "Seli|Up top, they think the storm came from nowhere. Down here, we heard it coming for years."]), {choice:[{t:"Rest", do:g=>g.rest()},{t:"Goodbye", next:[]}]} ];
      if (!g.flag("met_seli")) return [
        "Seli|Oh. A surface walker. You brought the weather in on your shoulders.",
        "Seli|I'm Seli. I keep this orchard. It's slow work. The trees here count years the way you count breaths.",
        {choice:[
          {t:"How do trees grow without sun?", next:["Seli|The roots carry light down from above. Slowly. Everything here is slowly."]},
          {t:"Do you know the way out?", next:["Seli|I know every way. Which one you take depends on what you're carrying."]},
        ]},
        "Seli|Three old seeds are tucked in this cavern somewhere. Plant them in the empty beds, and the orchard will remember itself.",
        {do:g=>g.set("met_seli",1)},
      ];
      return ["Seli|Seeds first. Then beds. The orchard is patient, but I'm curious."];
    }},
  mira_r9: { name:"Mira", role:"shellmaker", look:{hair:"#3a2a22", coat:"#c87a5a", skin:"#e8b890", hat:"#e0d0b0"},
    talk(g){
      if (g.lv()===76) return [ g.flag("shelter_built") ? "Mira|A roof with no walls. Practical. I'd have added a shelf." : "Mira|Build it simple. Simple things get mended.",
        {do:g=>g.set("invite_mira",1)} ];
      return [
        "Mira|There you are. I was beginning to think the roots had kept you.",
        "Mira|I came up the long way. The coast is quieter now. Different. You'll see.",
        {choice:[
          {t:"I'm close to home now, I think.", next:["Mira|Close is a good place. You can see both sides from close."]},
          {t:"I missed your porch.", next:["Mira|The porch missed being complained about. I'll tell it you're coming."]},
        ]},
        {do:g=>{ g.set("met_mira_r9",1); g.xp(15); g.objDone(); }},
      ];
    }},
  tovan_r9: { name:"Tovan", role:"herbalist", look:{hair:"#8a6a3a", coat:"#6a8a3a", skin:"#c89870", hat:"#4a6a2a"},
    talk(g){ return [ "Tovan|I brought seeds for the shelter's edge. Weeds, of course. The best kind.", {do:g=>g.set("invite_tovan",1)} ]; }},
  pella_r9: { name:"Pella", role:"potter", look:{hair:"#5a2a20", coat:"#d0a060", skin:"#a87050", hat:"#d05a3a"},
    talk(g){ return [ "Pella|I brought cups! Nine cups. Some of them hold water.", {do:g=>g.set("invite_pella",1)} ]; }},
  trav_a: { name:"Brisk", role:"traveler", look:{hair:"#c05a2a", coat:"#8a8a3a", skin:"#e0b090", hat:null},
    talk(g){ if (g.flag("trav_a")) return ["Brisk|East, you said. Always east. Thank you."];
      return ["Brisk|I've been walking in circles. Every road looks like it goes home and none of them do.",
        {choice:[{t:"Follow the river down. It always finds the sea.", next:["Brisk|The sea. Yes. My house had a sea outside it. I'd forgotten I knew that."]},
                 {t:"Maybe stay a while and look around?", next:["Brisk|...I could. It's nice here. I could look for one more day."]}]},
        {do:g=>{ g.set("trav_a",1); g.xp(10); }} ]; }},
  trav_b: { name:"Lowe", role:"traveler", look:{hair:"#202030", coat:"#6a3a5a", skin:"#7a4a30", hat:"#c0c0a0"},
    talk(g){ if (g.flag("trav_b")) return ["Lowe|I'm writing it all down. For my sister."];
      return ["Lowe|My sister and I got separated in the wind. She'll be angry I didn't wait where I was.",
        {choice:[{t:"Leave her a letter at the waystone.", do:g=>{ if (g.has("letter",1)) g.take("letter",1); }, next:["Lowe|A letter. Of course. She always finds the things I leave."]},
                 {t:"Wait here. People come back to where they lost something.", next:["Lowe|You're right. I'll wait. I'm good at waiting, as long as someone tells me to."]}]},
        {do:g=>{ g.set("trav_b",1); g.xp(10); }} ]; }},
  trav_c: { name:"Pipkin", role:"traveler", look:{hair:"#e0d080", coat:"#3a7a5a", skin:"#e8c8a0", hat:null, small:true},
    talk(g){ if (g.flag("trav_c")) return ["Pipkin|Grandad says hello! He's very loud."];
      return ["Pipkin|I'm not lost. I'm exploring. Grandad is lost.",
        {choice:[{t:"Where did you last see him?", next:["Pipkin|By the tall stone. He was napping. ...He's still napping. Oh."]},
                 {t:"Want to explore together for a bit?", next:["Pipkin|Yes! ...Then I'd better go wake Grandad so he can be not-lost too."]}]},
        {do:g=>{ g.set("trav_c",1); g.xp(10); }} ]; }},
  blue: { name:"Traveler in the Blue Coat", role:"stranger", look:{hair:"#5a5a6a", coat:"#3a5ab0", skin:"#d0a078", hat:"#2a3a7a"},
    talk(g){
      const lv = g.lv();
      const B = { 17:"blue1", 35:"blue2", 49:"blue3", 62:"blue4" }[lv];
      if (g.flag(B)) return [ g.pick(["Blue|I'll be along. I'm always along, somewhere.","Blue|Go on. The path won't walk itself. Well—some do, here."]) ];
      const lines = {
        17:["Blue|Those carvings are mine. Some of them. The older ones belong to people who came before me.",
            "Blue|I carve 'turn here', never 'stop here'. Stopping you can figure out yourself.",
            {choice:[{t:"Who are you?", next:["Blue|Somebody who came in on a storm. Like you. Longer ago."]},{t:"(Just nod.)", next:["Blue|Hm. You nod like someone I used to know."]}]}],
        35:["Blue|You've got a good fire there. Mind if I share it?","Blue|I used to try to get home every year. Each year I'd learn a little more of the valley and a little less of the road.",
            {choice:[{t:"Did you ever find the road?", next:["Blue|Found it many times. Never walked it. Funny how that goes."]},{t:"Where is home for you?", next:["Blue|A coast. Grey shingle, a red boat, a carved-wood fish over the door."]}]}],
        49:["Blue|Warm, isn't it? I come here when my bones remember the cold of that first storm.","Blue|There was a child in my village. Not mine—a neighbor's. I carved a wooden fish for them, the last summer.",
            {choice:[{t:"My parent has a wooden fish like that.", next:["Blue|...Do they. Carved with the tail curled up? Like it's about to turn?","Blue|Well. Well, well."]},{t:"What happened to the child?", next:["Blue|I expect they grew up. Children are good at that. Better than I was."]}]}],
        62:["Blue|You've seen the marks. The storm comes every generation or so. It takes a few of us, and moves the coastline about.",
            "Blue|For years I thought it had stolen my life. Now I think it just handed me a different one, and I took a long time to open my hands.",
            {choice:[{t:"Will you come home with me?", next:["Blue|Ask me again on the shore. I'll have an answer by then. Probably."]},{t:"Do you regret staying?", next:["Blue|Some days. Not most. That's about the best anyone gets."]}]}],
      }[lv] || ["Blue|Hm."];
      return [...lines, {do:g=>{ if(B){ g.set(B,1); g.xp(10); if(lv===17) g.give("bluethread",1);} }}];
    }},
  shore_blue: { name:"Traveler in the Blue Coat", role:"stranger", look:{hair:"#5a5a6a", coat:"#3a5ab0", skin:"#d0a078", hat:"#2a3a7a"},
    talk(g){
      const heard = ["blue1","blue2","blue3","blue4"].filter(f=>g.flag(f)).length;
      const steps = [ "Blue|You came back to the leaning tree. I thought you might.",
        "Blue|My name is Aster. I should have said so ages ago. Names are heavy things to put down on a stranger's table."];
      if (heard>=3) steps.push("Blue|That wooden fish over your parent's door—I carved it. Before the storm took me. Tell them the tail turned, the way I meant it to.");
      else if (heard>=1) steps.push("Blue|I came from a coast like yours. Further back than you'd think.");
      else steps.push("Blue|We've passed each other a few times, you and I. That's how it goes with storm-travelers.");
      steps.push({choice:[
        {t:"Come home with me, Aster.", next:["Aster|...No. Not to stay. I've a valley to look after now. But I'll walk you to the water.","Aster|And maybe I'll visit. Visiting is a fine thing. You get to love two places at once."], do:g=>g.set("aster_ask",1)},
        {t:"I think you belong here.", next:["Aster|I think so too. It took me a long time to say it out loud. Thank you for saying it first."], do:g=>g.set("aster_stay",1)},
        {t:"I'm glad I met you.", next:["Aster|Likewise, small storm. Likewise."]},
      ]});
      steps.push({do:g=>{ g.set("met_aster",1); g.xp(20); g.objDone(); }});
      return steps;
    }},
  ...Object.fromEntries(AMBIENT_NPCS.map(npc=>[npc.id,npc]))
};

// Companion closing stories (level 79). key = npc flag requirement.
export const COMPANIONS = [
  { id:"mira", name:"Mira", req:"met_mira", story:[
    "Mira|When I was your age I wanted to be a sailor. Then I broke my leg on the dock, and spent a summer sorting shells.",
    "Mira|I never did sail. But half the boats on this coast carry my charms. So I go everywhere, in a way. Just slowly."] },
  { id:"tovan", name:"Tovan", req:"tovan_done", story:[
    "Tovan|I was apprenticed to a proper healer, once. Very proper. She pulled every weed in her garden.",
    "Tovan|Then a sickness came and only the weeds could cure it. She laughed for an hour. Then she gave me her garden."] },
  { id:"eren", name:"Eren", req:"met_eren", story:[
    "Eren|My brother was the brave one. He'd run the ridge in fog. I'd stay home and worry.",
    "Eren|He taught me that worrying and caring sit close together. I just turned mine around to face outward."] },
  { id:"pella", name:"Pella", req:"met_pella", story:[
    "Pella|My first hundred pots all cracked. A hundred! I kept the pieces.",
    "Pella|I made a path out of them, down to the creek. Best thing I ever made, and it was all mistakes."] },
  { id:"nim", name:"Nim", req:"met_nim", story:[
    "Nim|Sometimes I let a kite go on purpose. Just cut the string.",
    "Nim|Oru says it's a waste. But somebody somewhere finds a kite. That's a whole good day for them."] },
  { id:"oru", name:"Oru", req:"met_oru", story:[
    "Oru|My father drowned in Breaking season. I hated the lake for a year.",
    "Oru|Then I rowed out in Green and the lake was just the lake. It had never been anything else. So I stayed."] },
  { id:"seli", name:"Seli", req:"met_seli", story:[
    "Seli|I came down here to hide, the first time. From a crowd, a noise, a life.",
    "Seli|I stayed because the orchard needed someone quiet. It's strange how hiding can turn into tending."] },
];
