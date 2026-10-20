/**
 * Offline v2 inference experiments. No training or provider inference.
 * Select thresholds from TRAINING VALIDATION ONLY, keep held-outs untouched.
 */
import {CORPUS,LABELS} from "../training/dataset.mjs";
import {predictCompact} from "../trained.mjs";
import {proposeBusinessPlan} from "../planner.mjs";
function chunks(text){
 const parts=text.split(/[.!?;\n]+|,(?=\s+[a-z])|\b(?:and|also|plus)\b/gi)
   .map(x=>x.trim()).filter(x=>x.length>=12).slice(0,40);
 return [...new Set([...parts,text])];
}
function raw(text, mode){
 const all=chunks(text);
 if(mode==="whole")return Object.fromEntries(predictCompact(text,0).map(x=>[x.name,x.score]));
 const scores=Object.fromEntries(LABELS.map(x=>[x,0]));
 for(const section of all){
  for(const x of predictCompact(section,0)){
    scores[x.name]=Math.max(scores[x.name],x.score);
  }
 }
 if(mode==="blend"){
  const full=Object.fromEntries(predictCompact(text,0).map(x=>[x.name,x.score]));
  for(const label of LABELS)scores[label]=.65*scores[label]+.35*full[label];
 }
 return scores;
}
function stats(cases, select){
 let tp=0,fp=0,fn=0,exact=0;
 for(const item of cases){
  const expected=new Set(item.labels),output=new Set(select(item.description));
  if(expected.size===output.size&&[...output].every(e=>expected.has(e)))exact++;
  for(const l of output)expected.has(l)?tp++:fp++;
  for(const l of expected)if(!output.has(l))fn++;
 }
 const precision=tp+fp?tp/(tp+fp):1,recall=tp+fn?tp/(tp+fn):1;
 return {cases:cases.length,precision:+precision.toFixed(3),recall:+recall.toFixed(3),
  f1:+(precision+recall?2*precision*recall/(precision+recall):0).toFixed(3),exact};
}
const validation=CORPUS.validation;
const grid=Array.from({length:17},(_,i)=>Number((.10+i*.04).toFixed(2)));
const rule=text=>proposeBusinessPlan(text).entities.map(x=>x.name);
let results=[];
for(const mode of ["whole","max","blend"]){
 const global=grid.map(threshold=>({
  threshold,stats:stats(validation,text=>
    LABELS.filter(k=>raw(text,mode)[k]>=threshold))
 })).sort((a,b)=>b.stats.f1-a.stats.f1||b.stats.precision-a.stats.precision);
 const per={};
 for(const label of LABELS){
  const best=grid.map(threshold=>{
   let tp=0,fp=0,fn=0;
   for(const x of validation){
    const predicted=raw(x.description,mode)[label]>=threshold;
    const actual=x.labels.includes(label);
    if(predicted&&actual)tp++;
    if(predicted&&!actual)fp++;
    if(!predicted&&actual)fn++;
   }
   const f1=2*tp+fp+fn?2*tp/(2*tp+fp+fn):0;
   return {threshold,f1,precision:tp+fp?tp/(tp+fp):1}
  }).sort((a,b)=>b.f1-a.f1||b.precision-a.precision);
  per[label]=best[0].threshold;
 }
 const strategies={
   tuned_global:text=>LABELS.filter(label=>raw(text,mode)[label]>=global[0].threshold),
   tuned_per_label:text=>LABELS.filter(label=>raw(text,mode)[label]>=per[label])
 };
 for(const [name,selector] of Object.entries(strategies)){
  results.push({mode,strategy:name,thresholds:name==="tuned_global"?global[0].threshold:per,
    validation:stats(validation,selector),test:stats(CORPUS.test,selector),
    challenge:stats(CORPUS.challenge,selector)});
 }
}
results.sort((a,b)=>b.validation.f1-a.validation.f1);
console.log(JSON.stringify({disclosure:"Synthetic validation tuned; test/challenge remain evaluation only",
 baseline:{validation:stats(CORPUS.validation,rule),test:stats(CORPUS.test,rule),
 challenge:stats(CORPUS.challenge,rule)},
 ranking:results},null,2));
