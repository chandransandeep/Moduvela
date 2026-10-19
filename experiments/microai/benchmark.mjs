/** Honest diagnostic comparisons on synthetic and hand-authored held-outs. */
import { CORPUS } from "./training/dataset.mjs";
import { predictCompact,compactInfo } from "./trained.mjs";
import { proposeBusinessPlan } from "./planner.mjs";
function measure(rows,run){
 let tp=0,fp=0,fn=0,exact=0;
 for(const x of rows){
   const expected=new Set(x.labels),out=new Set(run(x.description));
   if(expected.size===out.size&&[...expected].every(v=>out.has(v)))exact++;
   for(const v of out)expected.has(v)?tp++:fp++;
   for(const v of expected)if(!out.has(v))fn++;
 }
 const precision=tp+fp?tp/(tp+fp):1,recall=tp+fn?tp/(tp+fn):1;
 return {cases:rows.length,precision:+precision.toFixed(3),recall:+recall.toFixed(3),
 f1:+(precision+recall?2*precision*recall/(precision+recall):0).toFixed(3),exact};
}
const rule=text=>proposeBusinessPlan(text).blueprint?.entities.map(x=>x.name)||[];
const model=text=>predictCompact(text).filter(x=>x.suggested).map(x=>x.name);
const report={
 disclosure:"Synthetic template-generated data, plus 24 hand-authored challenges; NOT independent real-world accuracy.",
 trained_model:compactInfo(),
 validation:{trained:measure(CORPUS.validation,model),rules:measure(CORPUS.validation,rule)},
 held_out_test:{trained:measure(CORPUS.test,model),rules:measure(CORPUS.test,rule)},
 hand_authored_challenge:{trained:measure(CORPUS.challenge,model),rules:measure(CORPUS.challenge,rule)},
};
console.log(JSON.stringify(report,null,2));
