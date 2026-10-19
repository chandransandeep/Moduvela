import {DESIGN_CASES} from "./design_cases.mjs";
import {proposeBusinessPlan} from "../planner.mjs";
let tp=0,fp=0,fn=0,ruleHits=0,ruleTotal=0,errors=0;
for(const c of DESIGN_CASES){
 try{
  const proposal=proposeBusinessPlan(c.text);
  const predicted=new Set(proposal.entities.map(e=>e.name));
  const actual=new Set(c.entities);
  for(const e of predicted)actual.has(e)?tp++:fp++;
  for(const e of actual)if(!predicted.has(e))fn++;
  for(const rule of c.rules){
   ruleTotal++;
   if(proposal.unsupported.some(x=>x.kind===rule.kind))ruleHits++;
  }
 }catch(error){errors++;console.error(c.sector,error.message);}
}
const precision=tp+fp?tp/(tp+fp):1,recall=tp+fn?tp/(tp+fn):1;
console.log(JSON.stringify({
 disclosure:"36 project-authored synthetic scenario cards, not externally validated",
 cases:DESIGN_CASES.length,precision:+precision.toFixed(3),
 recall:+recall.toFixed(3),f1:+(2*precision*recall/(precision+recall)).toFixed(3),
 ruleKindRecall:ruleTotal?+(ruleHits/ruleTotal).toFixed(3):null,
 notice:"Relationship rules are suggestions based on entity coexistence; not scored as exact semantics.",
 errors
},null,2));
if(errors)process.exitCode=1;
