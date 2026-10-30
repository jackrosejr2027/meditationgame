const OPENERS = [
  "I was wondering whether a path remembers everyone who has walked it.",
  "The weather has been changing its mind all afternoon, and I don't blame it.",
  "I found a smooth stone today and decided it had earned a place in my pocket.",
  "Sometimes the smallest turn in a trail is the one you remember longest.",
  "I heard a bird call I couldn't name, so I listened until it felt familiar.",
  "A neighbor left a little kindness here before either of us knew it would matter.",
  "I used to hurry past this view. Now I try to give it a whole minute.",
  "The river makes a new map each season, and somehow it never seems lost.",
  "I have been thinking about the difference between being quiet and being alone.",
  "There is a patch of sunlight nearby that seems to arrive right on time."
];
const OBSERVATIONS = [
  "The roots hold the soft bank together better than any wall could.",
  "A small seed can wait a long time without giving up on spring.",
  "The wind carries loose leaves away, but it brings the smell of supper back.",
  "Someone mended the old trail marker with patient hands.",
  "The birds share the berry bush without needing to make a schedule.",
  "Rain sounds different on every roof, but it makes each room feel sheltered.",
  "A place gets friendlier when people leave it a little better than they found it.",
  "The stones along the water have been traveling much longer than we have.",
  "Rest is part of a journey, even when the map doesn't mark a place for it.",
  "I think the valley remembers care more clearly than footsteps."
];
const CLOSINGS = [
  "Anyway, that is one thought to carry around today.",
  "It is a small thing, but small things count here.",
  "I will probably notice something different tomorrow.",
  "No need to answer. It is nice just to say it aloud.",
  "The path will still be here when we are ready to move on.",
  "I hope the next bend is kind to you.",
  "There is always another good place to sit for a while.",
  "We can let that be enough for this moment.",
  "The valley has room for all kinds of days.",
  "Take your time. Nothing here needs to be hurried."
];

export const NPC_DIALOGUE_COUNT = OPENERS.length * OBSERVATIONS.length * CLOSINGS.length;

function drawIndex(run,key,count){if(!Array.isArray(run[key])||run[key].length===0){const deck=Array.from({length:count},(_,i)=>i);for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}run[key]=deck;}return run[key].pop();}

const CHECKIN_QUESTIONS=[
["How are you feeling today?","What's sitting closest to your heart right now?","Has anything felt heavier than usual today?","Where are you finding a little ease today?","How is your energy holding up?","Are you feeling settled, stretched, or somewhere in between?","What's one feeling you've noticed in yourself lately?","How has the day been meeting you so far?","Do you feel more ready for company or a quiet pause?","Before we go on, how are you doing?"],
["There's no wrong answer, especially after walking through {map}.","This stretch of {map} can be a lot to take in.","We can pause here in {map} for as long as you need.","After the journey across {map}, a check-in seemed kind.","Even a peaceful place like {map} can hold complicated feelings.","This part of {map} has a way of making room for a breath.","The path through {map} doesn't ask us to feel only one thing.","I thought the quiet of {map} might be a good place to ask.","Whatever the answer, there's time for it here in {map}.","We've reached {map}; would it help to pause together?"],
["Would you like to share?","Want to put a word to it?","Would company help, or would quiet feel better?","Is there something you wish someone would hear?","Would you like me to simply listen?","What would feel kind to you right now?","Is there one small thing you need?","Would a quiet moment help?","Do you want to talk about it, or leave it be?","What would you like me to know?" ]
];
const CHECKIN_RESPONSES=[
[["I'm glad there is some steadiness in your day.","That sounds like a welcome bit of ease.","I'm happy to hear you have some room to breathe.","It is good to notice when things feel okay.","You can let yourself enjoy that feeling.","I'm glad this moment is treating you gently.","That is worth appreciating, just as it is.","A little calm can be a real gift.","I'm glad you have found a comfortable rhythm.","You deserve to have days that feel manageable."],["You don't have to make the feeling bigger or smaller.","Let it be true without asking it to last forever.","You can carry that steadiness one step at a time.","There is no need to turn a good moment into a promise.","You are allowed to enjoy ease without guilt.","The next feeling can arrive when it arrives.","It is enough to recognize what is working today.","You can keep a little of this calm with you.","Good moments count, even when they are ordinary.","Let this be one kind thing about today."],["I hope you find another small ease along the way.","May the next bend be gentle, too.","We can keep walking at a pace that suits you.","Thank you for sharing that with me.","I'm glad we paused to notice it.","You can return to this calm whenever you need.","There is room for more good moments ahead.","Take that steadiness with you if you like.","I hope the rest of your day keeps some of this light.","For now, it sounds like you are doing okay."]],
[["Thank you for telling me; that sounds hard to hold.","I'm sorry this has been a heavy stretch.","That is a lot to carry through an ordinary day.","You don't have to pretend it feels easy.","I'm glad you didn't have to keep that to yourself.","It makes sense that you would feel worn down.","You deserve care while things are difficult.","I'm here with you in this moment.","That feeling matters, even if it is hard to explain.","You have been carrying a lot, and I hear you."],["You don't need to solve it all before taking a breath.","A hard feeling deserves patience, not a deadline.","We can make the next step very small.","You are allowed to ask someone trustworthy for help.","Rest is not a failure or a reward you must earn.","It is okay to set down what can wait.","You can take this one moment at a time.","Nothing about feeling low makes you a burden.","You don't have to be cheerful to be worthy of kindness.","If words are tiring, quiet company can count, too."],["Would you like to sit together for a little while?","I can listen more if you want.","We can leave the next step until you are ready.","Thank you for trusting me with the truth.","You don't have to walk this exact moment alone.","May one small thing feel gentler soon.","I hope you find support that feels safe and steady.","For now, being here is enough.","Let's take the path slowly, together.","You deserve a softer moment than this one." ]],
[["Not knowing is a real answer, too.","You don't need to decide how you feel on command.","Sometimes feelings take their time becoming clear.","It is okay if the answer changes later.","You can be uncertain and still take good care of yourself.","We don't have to name everything right away.","A quiet 'I'm not sure' is welcome here.","There is no test hidden inside my question.","You can let the feeling stay unfinished.","Thank you for answering in the way you could."],["Maybe notice one thing you can feel: your feet, the air, or a sound.","You might give yourself a moment before choosing what comes next.","You can ask for company without explaining why.","A small pause is a perfectly good next step.","You don't owe anyone a tidy answer.","It is enough to stay curious about what you need.","You can change your mind as you learn more.","Let the question rest beside you instead of pressing on it.","There is no rush to turn uncertainty into a plan.","You may simply keep breathing and see what follows."],["We can leave the question open and keep you company.","Whenever you know more, you can decide then.","I'm glad you let the answer be honest.","Let's take the next step without demanding certainty.","You are allowed to pause before you know why.","The path has room for questions as well as answers.","I hope a little clarity finds you in its own time.","We can sit quietly if that feels best.","For now, 'not sure' is more than enough.","Thank you for checking in with yourself." ]]
];
const REASSURANCE=[
["In {map}, remember that you do not have to carry the whole day at once.","There is no single right pace for a life or a walk.","You are allowed to be a work in progress and still be worthy of care.","A difficult moment cannot measure the whole of you.","You have made it through more than you sometimes give yourself credit for.","It is okay to rest before you know exactly what comes next.","Your needs matter, even when someone else has needs too.","You do not need to be perfect to belong here.","There is strength in asking for gentleness.","Small beginnings are still beginnings."],
["You can take the next step when you are ready.","One quiet breath is a good place to start.","Let the path through {map} remind you that turns are part of moving forward.","You are more than the hardest thing you have faced.","It is okay to ask a trusted person to walk beside you.","You can set down what is not yours to carry.","Your kindness counts, including the kindness you show yourself.","You have permission to change direction.","You deserve the same patience you give to others.","Even a small pause can make room for hope."],
["You are not alone in needing a little reassurance.","There is room for you here, just as you are.","Nothing needs to be proven in this moment.","The next gentle thing is enough for now.","You can begin again as many times as you need.","The day is still allowed to surprise you kindly.","Being here is already something you have done.","Keep this reminder close for the next uncertain bend.","May you meet yourself with a softer voice today.","You are worthy of care on every kind of day."]
];
export const CHECKIN_DIALOGUE_COUNT=CHECKIN_QUESTIONS[0].length*CHECKIN_QUESTIONS[1].length*CHECKIN_QUESTIONS[2].length;
export const REASSURANCE_DIALOGUE_COUNT=REASSURANCE.reduce((n,part)=>n*part.length,1);
export function nextCheckInConversation(run,mapName,speaker){const id=drawIndex(run,"checkInDialogueDeck",CHECKIN_DIALOGUE_COUNT),a=id%10,b=Math.floor(id/10)%10,c=Math.floor(id/100),name=String(speaker||"Neighbor"),map=String(mapName||"this trail"),question=CHECKIN_QUESTIONS[0][a]+" "+CHECKIN_QUESTIONS[1][b].replace("{map}",map)+" "+CHECKIN_QUESTIONS[2][c];const replies=CHECKIN_RESPONSES.map(lines=>[name+"|"+lines[0][a],name+"|"+lines[1][b],name+"|"+lines[2][c]]);return[name+"|"+question,{choice:[{t:"I'm doing okay.",next:replies[0]},{t:"I'm having a hard time.",next:replies[1]},{t:"I'm not sure / I'd rather not say.",next:replies[2]}]}];}
export function nextReassuranceConversation(run,mapName,speaker){const id=drawIndex(run,"reassuranceDialogueDeck",REASSURANCE_DIALOGUE_COUNT),a=id%10,b=Math.floor(id/10)%10,c=Math.floor(id/100),name=String(speaker||"Neighbor"),map=String(mapName||"this trail");return[name+"|"+REASSURANCE[0][a].replaceAll("{map}",map),name+"|"+REASSURANCE[1][b].replaceAll("{map}",map),name+"|"+REASSURANCE[2][c]];}


export function nextNPCConversation(run, name){
  if(!Array.isArray(run.npcDialogueDeck)||run.npcDialogueDeck.length===0){
    const deck=Array.from({length:NPC_DIALOGUE_COUNT},(_,i)=>i);
    for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    run.npcDialogueDeck=deck;
  }
  const id=run.npcDialogueDeck.pop(),speaker=String(name||"Neighbor"),a=id%OPENERS.length,b=Math.floor(id/OPENERS.length)%OBSERVATIONS.length,c=Math.floor(id/(OPENERS.length*OBSERVATIONS.length));
  return [speaker+"|"+OPENERS[a],speaker+"|"+OBSERVATIONS[b],speaker+"|"+CLOSINGS[c]];
}

const AFFIRMATIONS = [
  ["You are worthy of rest exactly as you are.","You are allowed to begin again without earning it.","You have made it through every hard day that brought you here.","You bring a steadiness that matters, even when nobody says so.","You belong in this world just as much as anyone else.","Your curiosity is a quiet kind of courage.","You can take one small step and let that be enough.","You are more resilient than this difficult moment feels.","The care you give others is a strength, not a weakness.","You deserve the same patience you offer your friends."],
  ["Your presence makes room for kindness.","Your effort counts even when the outcome takes time.","You notice small things others might miss.","Your voice deserves to be heard.","You can ask for help and still be strong.","You have the right to move at your own pace.","Your gentleness can change the shape of a day.","You are learning, even when progress feels quiet.","You do not have to solve everything at once.","There is more than one good way forward."],
  ["Let that truth travel with you today.","Take a breath and give yourself credit for arriving here.","You can return to this thought whenever you need it.","Keep a little space for hope beside whatever feels heavy.","Your next step can wait until you are ready.","The path ahead does not ask you to be perfect.","You are not behind; this is your own journey.","Let the kindness you give come back to you, too.","There is still room for a pleasant surprise.","For now, being here is enough."]
];
export const AFFIRMATION_COUNT=AFFIRMATIONS.reduce((n,part)=>n*part.length,1);
export function nextAffirmation(run){if(!Array.isArray(run.affirmationDeck)||run.affirmationDeck.length===0){const deck=Array.from({length:AFFIRMATION_COUNT},(_,i)=>i);for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}run.affirmationDeck=deck;}const id=run.affirmationDeck.pop(),a=id%10,b=Math.floor(id/10)%10,c=Math.floor(id/100);return [AFFIRMATIONS[0][a],AFFIRMATIONS[1][b],AFFIRMATIONS[2][c]];}
