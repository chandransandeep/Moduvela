/** Offline compact supervised model v2. Inference only.
 * Independent from Moduvela's deterministic authorisation and application runtime.
 */
import {MODEL_V2} from "./training/model.v2.generated.mjs";
const STOP=new Set(["the","our","and","with","have","needs","need","want","to","we","a","an","i","for","of","this","my","their","some","also","please","in","are","is"]);
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;};
function features(text){
 const tokens=(text.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(t=>t.length>1);
 const bag=new Set();
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i];
  if(STOP.has(token))continue;
  bag.add(hash("w:"+token)%MODEL_V2.dimensions);
  const t="^"+token+"$";
  if(token.length>=4)for(let j=0;j<=t.length-3;j++)bag.add(hash("c:"+t.slice(j,j+3))%MODEL_V2.dimensions);
  if(i&&tokens[i-1].length>1)bag.add(hash("bg:"+tokens[i-1]+"_"+token)%MODEL_V2.dimensions);
 }
 return [...bag];
}
function segments(text){
 const parts=text.split(/[.!?;\n]+|,(?=\s+[a-z])|\b(?:and|also|plus)\b/gi)
  .map(s=>s.trim()).filter(x=>x.length>=12).slice(0,40);
 return [...new Set([...parts,text])];
}
const raw=atob(MODEL_V2.weightsBase64);
const signed=Int8Array.from(raw,x=>{
 const v=x.charCodeAt(0);return v>127?v-256:v;
});
if(signed.length!==MODEL_V2.labels.length*MODEL_V2.dimensions)
 throw Error("Invalid model weight dimensions");
const sigmoid=x=>1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));
function inferSegment(text){
 const bits=features(text),inv=1/Math.sqrt(Math.max(1,bits.length));
 return MODEL_V2.labels.map((name,k)=>{
  let z=MODEL_V2.bias[k];
  const off=k*MODEL_V2.dimensions;
  for(const bit of bits)z+=signed[off+bit]*MODEL_V2.scales[k]*inv;
  return {name,score:sigmoid(z)};
 });
}
/** Outputs per-label scores and contributing clauses; suggestions are never executable.
 * These scores are not calibrated probabilities of correctness.
 */
export function predictCompactV2(text){
 if(typeof text!=="string"||text.length<12||text.length>5000)
  throw Error("Description must be between 12 and 5000 characters");
 const out=new Map(MODEL_V2.labels.map(name=>[name,{name,score:0,evidence:null}]));
 for(const clause of segments(text)){
  for(const prediction of inferSegment(clause)){
   const item=out.get(prediction.name);
   if(prediction.score>item.score){
    item.score=prediction.score;
    item.evidence=clause;
   }
  }
 }
 return MODEL_V2.labels.map(name=>{
  const entry=out.get(name);
  return {
   name,score:Number(entry.score.toFixed(4)),
   suggested:entry.score>=MODEL_V2.thresholds[name],
   evidence:entry.evidence,
   threshold:MODEL_V2.thresholds[name]
  };
 });
}
export function compactV2Info(){
 return {
  version:2,algorithm:MODEL_V2.algorithm,
  categories:MODEL_V2.labels.length,weightBytes:signed.byteLength,
  requiresGPU:false,requiresProvider:false,
  hasTrainedWeights:true,
  notice:"Synthetic, project-authored training; scores are not calibrated real-world probabilities."
 };
}
