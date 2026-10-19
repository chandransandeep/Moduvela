/** Offline Node-only training. No external ML package, model API or network. */
import {writeFileSync,readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {LABELS,CORPUS} from "./dataset.mjs";
const DIMS=1024;
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),16777619);}return h>>>0;}
function features(text){
 const tokens=(String(text).toLowerCase().match(/[a-z0-9]+/g)||[]).filter(t=>t.length>1);
 const bag=new Set();
 for(const token of tokens){
   bag.add(hash("w:"+token)%DIMS);
   if(token.length>=4){const t="^"+token+"$";for(let i=0;i<=t.length-3;i++)bag.add(hash("c:"+t.slice(i,i+3))%DIMS);}
 }
 return [...bag].sort((a,b)=>a-b);
}
function sigmoid(x){return 1/(1+Math.exp(-Math.max(-30,Math.min(30,x))));}
function trainCorpus(corpus){
 const samples=corpus.train.map(row=>({bits:features(row.description),targets:LABELS.map(x=>row.labels.includes(x)?1:0)}));
 const weights=LABELS.map(()=>new Float64Array(DIMS)), bias=LABELS.map(()=>0);
 for(let epoch=0;epoch<50;epoch++){
   const rate=.29/(1+epoch*.06);
   for(let k=0;k<samples.length;k++){
     const item=samples[(k*37+epoch*19)%samples.length]; // 37 coprime to 480
     const scale=1/Math.sqrt(Math.max(1,item.bits.length));
     for(let label=0;label<LABELS.length;label++){
       const w=weights[label];let raw=bias[label];
       for(const bit of item.bits)raw+=w[bit]*scale;
       const err=item.targets[label]-sigmoid(raw);
       bias[label]+=rate*err;
       for(const bit of item.bits)w[bit]+=rate*(err*scale-0.00005*w[bit]);
     }
   }
 }
 const predict=(text,threshold)=>{
   const bits=features(text),scale=1/Math.sqrt(Math.max(1,bits.length));
   return LABELS.map((name,i)=>{
     let val=bias[i];for(const bit of bits)val+=weights[i][bit]*scale;
     return [name,sigmoid(val)];
   }).filter(pair=>pair[1]>=threshold).map(pair=>pair[0]);
 };
 const evaluate=(rows,threshold)=>{
   let tp=0,fp=0,fn=0,exact=0;
   for(const row of rows){const got=new Set(predict(row.description,threshold)),exp=new Set(row.labels);
     if(got.size===exp.size&&[...got].every(x=>exp.has(x)))exact++;
     for(const val of got){if(exp.has(val))tp++;else fp++;}
     for(const val of exp){if(!got.has(val))fn++;}
   }
   const precision=tp+fp?tp/(tp+fp):1,recall=tp+fn?tp/(tp+fn):1;
   return {cases:rows.length,tp,fp,fn,precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0,exact};
 };
 const candidates=[.18,.23,.28,.33,.38,.43,.48,.53,.58,.63,.68,.73];
 const ranked=candidates.map(threshold=>({threshold,...evaluate(corpus.validation,threshold)})).sort((a,b)=>b.f1-a.f1||b.precision-a.precision||b.threshold-a.threshold);
 const threshold=ranked[0].threshold;
 const result={trainingCases:corpus.train.length,validation:evaluate(corpus.validation,threshold),test:evaluate(corpus.test,threshold),challenge:evaluate(corpus.challenge,threshold)};
 const quantWeights=[],scales=[];
 for(const w of weights){
   const peak=Math.max(...w.map(Math.abs));
   const scale=peak?peak/127:1;
   scales.push(scale);
   for(const value of w)quantWeights.push(Math.max(-127,Math.min(127,Math.round(value/scale))));
 }
 return {result,model:{version:1,algorithm:"supervised hashed-feature logistic classifier",dims:DIMS,labels:LABELS,threshold,scales,bias,weights:quantWeights}};
}
function toBase64(data){
 const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
 let out="";
 for(let i=0;i<data.length;i+=3){
   const a=(data[i]+256)%256,b=i+1<data.length?(data[i+1]+256)%256:0,c=i+2<data.length?(data[i+2]+256)%256:0;
   out+=alphabet[a>>2]+alphabet[((a&3)<<4)|(b>>4)]+(i+1<data.length?alphabet[((b&15)<<2)|(c>>6)]:"=")+(i+2<data.length?alphabet[c&63]:"=");
 }
 return out;
}
const trained=trainCorpus(CORPUS);
const compactModel={version:1,algorithm:trained.model.algorithm,dimensions:DIMS,
 labels:LABELS,threshold:trained.model.threshold,
 bias:trained.model.bias.map(x=>Number(x.toFixed(7))),
 scales:trained.model.scales.map(x=>Number(x.toPrecision(9))),
 weightsBase64:toBase64(trained.model.weights),
 trainingNote:"Synthetic labelled examples only; measured test performance cannot be generalised."
};
const source='/** Generated deterministically by train.mjs. No runtime training. */\\nexport const MODEL = '+JSON.stringify(compactModel)+';\\n';
const file=resolve(dirname(fileURLToPath(import.meta.url)),"model.generated.mjs");
const check=process.argv.includes("--check");
if(check){
 if(readFileSync(file,"utf8")!==source){console.error("Trained model differs from committed artifact");process.exitCode=1;}
 else console.log("Committed model is reproducible");
}else{
 writeFileSync(file,source);
 console.log("Generated",file);
}
console.log(JSON.stringify({syntheticCorpus:{train:CORPUS.train.length,validation:CORPUS.validation.length,test:CORPUS.test.length,challenge:CORPUS.challenge.length},
 threshold:trained.model.threshold,report:trained.result},null,2));
