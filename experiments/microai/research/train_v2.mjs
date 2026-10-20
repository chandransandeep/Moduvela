/** Research v2 trainer. TRAIN / VALIDATION separated; TEST and CHALLENGE evaluate only.
 * Generated model is not integrated unless it beats both the v1 model and
 * deterministic baseline on held-out cases without unsafe false positives.
 */
import {LABELS,CORPUS,TRAIN_PHRASES,TRAIN_DOMAINS} from "../training/dataset.mjs";
import {readFileSync,writeFileSync} from "node:fs";
import {predictCompact} from "../trained.mjs";
import {proposeBusinessPlan} from "../planner.mjs";
const DIMS=2048, EPOCHS=14, SEED=42657;
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
const rand=rng(SEED);
function sample(list){return list[Math.floor(rand()*list.length)];}
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);return h>>>0;}
const STOP=new Set(["the","our","and","with","have","needs","need","want","to","we","a","an","i","for","of","this","my","their","some","also","please","in","are","is"].values());
function features(text){
 const tokens=(text.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(t=>t.length>1);
 const f=new Set();
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i];
  if(STOP.has(token))continue;
  f.add(hash("w:"+token)%DIMS);
  const t="^"+token+"$";
  if(token.length>=4)for(let j=0;j<=t.length-3;j++)f.add(hash("c:"+t.slice(j,j+3))%DIMS);
  if(i&&tokens[i-1].length>1)
    f.add(hash("bg:"+tokens[i-1]+"_"+token)%DIMS);
 }
 return [...f];
}
function sigmoid(x){return 1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));}
function segment(text){
 const parts=text.split(/[.!?;\n]+|,(?=\s+[a-z])|\b(?:and|also|plus)\b/gi)
   .map(x=>x.trim()).filter(x=>x.length>=12).slice(0,40);
 return [...new Set([...parts,text])];
}
function augment(){
 const samples=[];
 for(let i=0;i<2700;i++){
   const domain=sample(TRAIN_DOMAINS.slice(0,12));
   const n=1+Math.floor(rand()*4);
   const chosen=new Set();
   while(chosen.size<n)chosen.add(sample(LABELS));
   const labels=[...chosen].sort();
   const clauses=labels.map(l=>sample(TRAIN_PHRASES[l].slice(0,6)));
   // Avoid using any validation/test phrase strings.
   const joiner=sample([", and ","; also ", ". We also ", "; "," plus "]);
   let description=sample(["Our ","At the ","In our "])+domain+
     sample([" we need to "," we want to "," our team must "])+clauses.join(joiner)+".";
   samples.push({description,labels});
   // Train on independent requirements as well as composite paragraphs.
   for(const j of labels)if(i%4===0)
     samples.push({description:sample(TRAIN_PHRASES[j].slice(0,6)),labels:[j]});
   if(i%5===0){
     const exclude=sample(LABELS.filter(x=>!chosen.has(x)));
     samples.push({description:clauses[0]+". We do not need "+exclude.toLowerCase()+".",
       labels:[labels[0]]});
   }
 }
 return samples.concat(CORPUS.train.map(({description,labels})=>({description,labels})));
}
const examples=augment();
const compiled=examples.map(row=>({bits:features(row.description),truth:LABELS.map(l=>row.labels.includes(l)?1:0)}));
const w=LABELS.map(()=>new Float32Array(DIMS)),bias=LABELS.map(()=>0);
for(let epoch=0;epoch<EPOCHS;epoch++){
 const lr=.46/(1+.13*epoch);
 const start=Math.floor(rand()*compiled.length);
 const stride=1297; // relatively prime to 575? check by simple loop below
 for(let j=0;j<compiled.length;j++){
  const row=compiled[(start+j*stride)%compiled.length];
  const scale=1/Math.sqrt(Math.max(1,row.bits.length));
  for(let k=0;k<LABELS.length;k++){
   let z=bias[k];
   for(const bit of row.bits)z+=w[k][bit]*scale;
   const error=row.truth[k]-sigmoid(z);
   bias[k]+=lr*error;
   for(const bit of row.bits)w[k][bit]+=lr*(scale*error-0.00003*w[k][bit]);
  }
 }
}
const evalFloat=(text)=>{
 const candidates=segment(text),scores=Object.fromEntries(LABELS.map(l=>[l,0]));
 for(const part of candidates){
  const bits=features(part),scale=1/Math.sqrt(Math.max(1,bits.length));
  for(let k=0;k<LABELS.length;k++){
   let z=bias[k];for(const bit of bits)z+=w[k][bit]*scale;
   const score=sigmoid(z);
   if(score>scores[LABELS[k]])scores[LABELS[k]]=score;
  }
 }
 return scores;
};
const peaks=w.map(weights=>weights.reduce((p,x)=>Math.max(p,Math.abs(x)),0));
const scales=peaks.map(x=>x/127||1),flat=[];
for(let k=0;k<LABELS.length;k++)for(const value of w[k])
 flat.push(Math.max(-127,Math.min(127,Math.round(value/scales[k]))));
function toBase64(data){
 const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
 let out="";
 for(let i=0;i<data.length;i+=3){
  const a=(data[i]+256)%256,b=i+1<data.length?(data[i+1]+256)%256:0,c=i+2<data.length?(data[i+2]+256)%256:0;
  out+=alphabet[a>>2]+alphabet[((a&3)<<4)|(b>>4)]
   +(i+1<data.length?alphabet[((b&15)<<2)|(c>>6)]:"=")
   +(i+2<data.length?alphabet[c&63]:"=");
 }
 return out;
}
const quantScores=text=>{
 const out=Object.fromEntries(LABELS.map(l=>[l,0]));
 for(const clause of segment(text)){
  const bits=features(clause),inv=1/Math.sqrt(Math.max(1,bits.length));
  for(let k=0;k<LABELS.length;k++){
   let z=bias[k];for(const bit of bits)z+=flat[k*DIMS+bit]*scales[k]*inv;
   out[LABELS[k]]=Math.max(out[LABELS[k]],sigmoid(z));
  }
 }
 return out;
};
const grid=Array.from({length:33},(_,i)=>.08+i*.025);
function metrics(rows,predict){
 let tp=0,fp=0,fn=0,exact=0;
 for(const row of rows){
  const expected=new Set(row.labels),found=new Set(predict(row.description));
  if(expected.size===found.size&&[...found].every(x=>expected.has(x)))exact++;
  for(const x of found)expected.has(x)?tp++:fp++;
  for(const x of expected)if(!found.has(x))fn++;
 }
 const precision=tp+fp?tp/(tp+fp):1,recall=tp+fn?tp/(tp+fn):1;
 return {precision:+precision.toFixed(3),recall:+recall.toFixed(3),
 f1:+(precision+recall?2*precision*recall/(precision+recall):0).toFixed(3),exact};
}
const valRows=CORPUS.validation.map(x=>({...x,scores:quantScores(x.description)}));
const cutoffs={};
for(const label of LABELS){
 let best={f1:-1,precision:0,threshold:0.4};
 for(const threshold of grid){
  let tp=0,fp=0,fn=0;
  for(const row of valRows){
   const yes=row.scores[label]>=threshold,truth=row.labels.includes(label);
   if(yes&&truth)tp++;else if(yes)fp++;else if(truth)fn++;
  }
  const f1=2*tp+fp+fn?2*tp/(2*tp+fp+fn):0;
  const precision=tp+fp?tp/(tp+fp):1;
  if(f1>best.f1+1e-8||(Math.abs(f1-best.f1)<1e-8&&precision>best.precision))
    best={f1,precision,threshold};
 }
 cutoffs[label]=Number(best.threshold.toFixed(4));
}
const infer=text=>LABELS.filter(x=>quantScores(text)[x]>=cutoffs[x]);
const baseline=text=>proposeBusinessPlan(text).entities.map(x=>x.name);
const old=text=>predictCompact(text).filter(x=>x.suggested).map(x=>x.name);
const report={trainingSamples:examples.length,
 modelWeightBytes:flat.length, thresholds:cutoffs,
 validation:{v2:metrics(CORPUS.validation,infer),v1:metrics(CORPUS.validation,old),rules:metrics(CORPUS.validation,baseline)},
 test:{v2:metrics(CORPUS.test,infer),v1:metrics(CORPUS.test,old),rules:metrics(CORPUS.test,baseline)},
 challenge:{v2:metrics(CORPUS.challenge,infer),v1:metrics(CORPUS.challenge,old),rules:metrics(CORPUS.challenge,baseline)}};
console.log("V2_REPORT_BEGIN");
console.log(JSON.stringify(report,null,2));
console.log("V2_REPORT_END");
const bundle={
 version:2, algorithm:"supervised quantised char+word+n-gram multi-label logistic model",
 dimensions:DIMS,labels:LABELS,thresholds:cutoffs,
 bias:bias.map(x=>+x.toFixed(8)),scales:scales.map(x=>+x.toPrecision(9)),
 weightsBase64:toBase64(flat),
 training:"Synthetic augmentation from training split only; validation-tuned per-label thresholds; not real-world validated"
};
const source='/** Reproducible synthetic v2 trained model. */\nexport const MODEL_V2 = '+JSON.stringify(bundle)+';\n';
const modelPath=new URL("../training/model.v2.generated.mjs",import.meta.url);
if(process.argv.includes("--check")){
 if(readFileSync(modelPath,"utf8")!==source){
  console.error("Reproducibility check failed: training produced a different v2 model");
  process.exitCode=1;
 }else console.log("Reproducible MicroAI v2 model verified");
}
if(process.argv.includes("--write"))writeFileSync(modelPath,source);
if(process.argv.includes("--emit-model")){
 // Public, non-sensitive model artifact; capture from CI for later explicit review.
 console.log("V2_MODEL_BASE64_BEGIN");
 console.log(Buffer.from(source,"utf8").toString("base64"));
 console.log("V2_MODEL_BASE64_END");
}
