import assert from "node:assert/strict";
import { AFFIRMATION_COUNT, CHECKIN_DIALOGUE_COUNT, NPC_DIALOGUE_COUNT, REASSURANCE_DIALOGUE_COUNT, nextAffirmation, nextCheckInConversation, nextNPCConversation, nextReassuranceConversation } from "../js/dialogue.js";

const run={},seen=new Set();
for(let i=0;i<NPC_DIALOGUE_COUNT;i++){
  const lines=nextNPCConversation(run,"Ari Reed");
  assert.equal(lines.length,3);
  assert.ok(lines.every(line=>line.startsWith("Ari Reed|")));
  const key=lines.join("\n");
  assert.equal(seen.has(key),false,"dialogue repeats before the shuffled pool is exhausted");
  seen.add(key);
}
assert.equal(seen.size,1000);
assert.equal(run.npcDialogueDeck.length,0);
const next=nextNPCConversation(run,"Mira");
assert.equal(next.length,3);
assert.equal(run.npcDialogueDeck.length,999);
const affirmationRun={},affirmations=new Set();
for(let i=0;i<AFFIRMATION_COUNT;i++){const lines=nextAffirmation(affirmationRun);assert.equal(lines.length,3);const key=lines.join("\n");assert.equal(affirmations.has(key),false,"affirmation repeats before the deck is exhausted");affirmations.add(key);}
assert.equal(affirmations.size,1000);
const checkinRun={},questions=new Set(),answers=[new Set(),new Set(),new Set()];for(let i=0;i<CHECKIN_DIALOGUE_COUNT;i++){const script=nextCheckInConversation(checkinRun,"Pebble Strand","Listener");assert.equal(script.length,2);assert.equal(questions.has(script[0]),false);questions.add(script[0]);assert.equal(script[1].choice.length,3);for(let j=0;j<3;j++){const response=script[1].choice[j].next.join("\n");assert.equal(answers[j].has(response),false);answers[j].add(response);}}assert.equal(questions.size,1000);assert.ok(answers.every(pool=>pool.size===1000));
const reassuranceRun={},reassurances=new Set();for(let i=0;i<REASSURANCE_DIALOGUE_COUNT;i++){const lines=nextReassuranceConversation(reassuranceRun,"Pebble Strand","Kind voice");const key=lines.join("\n");assert.equal(reassurances.has(key),false);reassurances.add(key);}assert.equal(reassurances.size,1000);
console.log("1000 UNIQUE RANDOMIZED NPC CONVERSATIONS, AFFIRMATIONS, CHECK-INS, AND REASSURANCES OK");
