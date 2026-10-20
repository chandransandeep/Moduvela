/** Reproducible independent v2 inference vs v1 and deterministic baseline. */
import {CORPUS} from "./training/dataset.mjs";
import {predictCompactV2,compactV2Info} from "./trained_v2.mjs";
import {predictCompact} from "./trained.mjs";
import {proposeBusinessPlan} from "./planner.mjs";
function measure(rows,run){
 let tp=0,fp=0,fn=0,exact=0;
 for(const row of rows) {
  const actual=new Set(row.labels),got=new Set(run(row.description));
  if(actual.size===got.size&&[...actual].every(l=>got.has(l)))exact++;
  for(const l of got)actual.has(l)?tp++:fp++;
  for(const l of actual)if(!got.has(l))fn++;
 }
 const p=tp+fp?tp/(tp+fp):1,r=tp+fn?tp/(tp+fn):1;
 return {examples:rows.length,precision:+p.toFixed(3),recall:+r.toFixed(3),
  f1:+(p+r?2*p*r/(p+r):0).toFixed(3),exact};
}
const models={
 trained_v1:t=>predictCompact(t).filter(x=>x.suggested).map(x=>x.name),
 trained_v2:t=>predictCompactV2(t).filter(x=>x.suggested).map(x=>x.name),
 deterministic:t=>proposeBusinessPlan(t).entities.map(x=>x.name)
};
const report={model:compactV2Info(),
 disclosure:"Synthetic and project-authored tests only, not representative real-world accuracy.",
 validation:{},held_out_test:{},challenge:{}};
for(const [name,rows] of Object.entries({
 validation:CORPUS.validation,held_out_test:CORPUS.test,challenge:CORPUS.challenge
 }))for(const [kind,predict] of Object.entries(models))report[name][kind]=measure(rows,predict);
console.log(JSON.stringify(report,null,2));
