/** Tiny independently trained logistic multi-label classifier.
 * Inference only; no provider calls, GPU, network services or runtime training.
 * This is an experimental second opinion, not a replacement for rule validation.
 */
import { MODEL } from "./training/model.generated.mjs";
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);return h>>>0;}
function features(text){
 const tokens=(String(text).toLowerCase().match(/[a-z0-9]+/g)||[]).filter(t=>t.length>1);
 const bits=new Set();
 for(const token of tokens){
   bits.add(hash("w:"+token)%MODEL.dimensions);
   if(token.length>=4){
     const t="^"+token+"$";
     for(let i=0;i<=t.length-3;i++)bits.add(hash("c:"+t.slice(i,i+3))%MODEL.dimensions);
   }
 }
 return [...bits].sort((a,b)=>a-b);
}
const decoded=atob(MODEL.weightsBase64);
if(decoded.length!==MODEL.labels.length*MODEL.dimensions)throw Error("Model size is invalid");
const WEIGHTS=Uint8Array.from(decoded,x=>x.charCodeAt(0));
const sigmoid=x=>1/(1+Math.exp(-Math.max(-30,Math.min(30,x))));
export function predictCompact(text,threshold=MODEL.threshold) {
 if(typeof text!=="string"||text.length<12||text.length>5000)throw Error("Description must contain 12 to 5000 characters");
 if(!Number.isFinite(threshold)||threshold<0||threshold>1)throw Error("Invalid model threshold");
 const bits=features(text),scale=1/Math.sqrt(Math.max(1,bits.length));
 const raw=MODEL.labels.map((name,i)=>{
   let z=MODEL.bias[i],off=i*MODEL.dimensions;
   for(const bit of bits){
     const signed=WEIGHTS[off+bit]>127?WEIGHTS[off+bit]-256:WEIGHTS[off+bit];
     z+=signed*MODEL.scales[i]*scale;
   }
   return {name,score:sigmoid(z)};
 });
 return raw.map(x=>({name:x.name,score:Number(x.score.toFixed(4)),
   suggested:x.score>=threshold}));
}
export function compactInfo(){
 return {algorithm:MODEL.algorithm,labels:MODEL.labels.length,bytes:decoded.length,
  threshold:MODEL.threshold,training:MODEL.trainingNote,
  requiresModelAPI:false,requiresGPU:false,requiresRuntimeTraining:false};
}
