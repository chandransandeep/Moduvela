/**
 * Optional, on-device semantic matching (no inference provider).
 * The Hugging Face Transformer model / browser WASM assets are downloaded
 * only after an explicit user click. The user's text is passed only to
 * the local feature-extraction pipeline after download.
 *
 * This is not a text-generative LLM and does not learn new model weights.
 */
import {CATALOG} from "./semantic_catalog.mjs";

export const SEMANTIC_OPTIONS=Object.freeze({
 model:"Xenova/all-MiniLM-L6-v2",
 library:"@huggingface/transformers@3.8.1",
 cpuModel:"q8",
 gpuModel:"fp16"
});
export const SEMANTIC_LIBRARY_URL="https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
const EPS=1e-9;
export function dot(a,b){
 if(!Array.isArray(a)&&!ArrayBuffer.isView(a))throw Error("Invalid embedding");
 if(a.length!==b.length||!a.length)throw Error("Embedding dimensions differ");
 let product=0,na=0,nb=0;
 for(let i=0;i<a.length;i++){
  const x=Number(a[i]),y=Number(b[i]);
  if(!Number.isFinite(x)||!Number.isFinite(y))throw Error("Nonfinite embedding");
  product+=x*y;na+=x*x;nb+=y*y;
 }
 return product/(Math.sqrt(na*nb)+EPS);
}
export function segmentRequirements(text){
 if(typeof text!=="string"||text.length<12||text.length>5000)throw Error("Description must be 12–5000 characters");
 const segments=text.split(/[.!?;\n]+|,(?=\s+[a-z])|\b(?:and|also|plus)\b/gi)
    .map(x=>x.trim()).filter(x=>x.length>=12).slice(0,32);
 return [...new Set([...segments,text])];
}
export function rankSemantic(segments,vectors,catalog=CATALOG){
 if(!Array.isArray(segments)||!segments.length||!Array.isArray(vectors))throw Error("Missing embeddings");
 const examples=catalog.flatMap(item=>item.examples.map(text=>({name:item.name,text})));
 if(vectors.length!==segments.length+examples.length)throw Error("Embedding count mismatch");
 const ranked=catalog.map(item=>{
  let best=-2,evidence="",example="";
  for(let j=0;j<segments.length;j++)for(let i=0;i<examples.length;i++){
   if(examples[i].name!==item.name)continue;
   const score=dot(vectors[j],vectors[segments.length+i]);
   if(score>best){best=score;evidence=segments[j];example=examples[i].text;}
  }
  return {name:item.name,score:Number(best.toFixed(3)),evidence,closestExample:example,
    fields:[...item.fields],reviewRequired:true};
 });
 return ranked.sort((a,b)=>b.score-a.score);
}
function rows(tensor){
 const value=typeof tensor?.tolist==="function"?tensor.tolist():tensor;
 if(!Array.isArray(value)||!value.length||!Array.isArray(value[0]))throw Error("Expected batched numeric embeddings");
 return value;
}
export function createSemanticAnalyzer(encoder, catalog=CATALOG){
 if(typeof encoder!=="function")throw Error("Embedding provider must be a local function");
 // Prototype embeddings never contain customer prompts; can be reused per load.
 const examples=catalog.flatMap(item=>item.examples);
 let cachedExamples=null;
 return async function analyze(text){
  const segments=segmentRequirements(text);
  if(!cachedExamples)cachedExamples=await encoder(examples);
  const inputs=await encoder(segments);
  return rankSemantic(segments,[...rows(inputs),...rows(cachedExamples)],catalog);
 };
}
/**
 * User gesture only. No transformer package is loaded by this module itself.
 * Dependency can be injected for deterministic tests; production imports a
 * pinned browser library at an external CDN. Prompt text is never sent to it
 * by an HTTP request; only inference runs through the returned local pipeline.
 */
export async function loadLocalSemantic({device="wasm",pipelineFactory}={}){
 if(device!=="wasm"&&device!=="webgpu")throw Error("Unknown inference device");
 const pipeline=pipelineFactory ?? (await import(SEMANTIC_LIBRARY_URL)).pipeline;
 const extractor=await pipeline("feature-extraction",SEMANTIC_OPTIONS.model,
   {device,dtype:device==="webgpu"?"fp16":"q8"});
 const embed=async texts=>{
  const result=await extractor(texts,{pooling:"mean",normalize:true});
  return result;
 };
 return {analyze:createSemanticAnalyzer(embed),device,
   source:"local browser execution; model files downloaded on first use",
   dispose:()=>{try{extractor.dispose?.();}catch{}}};
}
