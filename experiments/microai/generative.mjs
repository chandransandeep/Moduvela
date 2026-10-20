/**
 * Optional WebGPU local 0.5B model. Downloads only after the user's choice.
 * All model output is UNTRUSTED until deliberately reviewed, and executable
 * rules, code, security grants and network actions are always discarded.
 */
import {SEMANTIC_LIBRARY_URL} from "./semantic.mjs";
export const DEEP_MODEL="onnx-community/Qwen2.5-0.5B-Instruct";
export const DEEP_MODELS=Object.freeze({
 "small":{id:DEEP_MODEL,weightsMB:483,description:"0.5B instruct · experimental"},
 "large":{id:"onnx-community/Qwen2.5-1.5B-Instruct",weightsMB:1220,description:"1.5B instruct · very demanding"}
});
const IDENT=/^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const FIELD=/^[a-z][a-z0-9_]{0,39}$/;
const RESERVED=new Set(["id","created_at","updated_at","__proto__","constructor"]);
export const DEEP_LIMITS={maxInputCharacters:2000,maxOutputTokens:250,maxEntities:12,maxFieldsPerEntity:20};

export function parseLocalProposal(output){
 if(typeof output!=="string"||output.length>16000||!output.trim())
  throw Error("Model returned no parseable text");
 const cleaned=output.trim().replace(/^`{3}(?:json)?\s*/i,"").replace(/\s*`{3}$/,"");
 const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");
 if(start<0||end<=start)throw Error("Model did not produce a JSON object");
 let candidate;
 try{candidate=JSON.parse(cleaned.slice(start,end+1));}
 catch{throw Error("The model produced invalid JSON; no changes were made");}
 if(!candidate||Array.isArray(candidate)||typeof candidate!=="object"||!Array.isArray(candidate.entities))
  throw Error("Model did not supply an entities array");
 if(candidate.entities.length>DEEP_LIMITS.maxEntities)throw Error("Too many proposed sections");
 const seen=new Set(),result=[];
 for(const v of candidate.entities){
  if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Invalid section");
  const name=v.name;
  if(typeof name!=="string"||!IDENT.test(name)||RESERVED.has(name.toLowerCase()))
   throw Error("Invalid section identifier");
  if(seen.has(name.toLowerCase()))throw Error("Duplicate section identifiers");
  seen.add(name.toLowerCase());
  if(!Array.isArray(v.fields)||v.fields.length<1||
     v.fields.length>DEEP_LIMITS.maxFieldsPerEntity)throw Error("Invalid field collection");
  if(v.fields.some(x=>typeof x!=="string"||!FIELD.test(x)||RESERVED.has(x)))
   throw Error("Unsafe field identifier");
  if(new Set(v.fields).size!==v.fields.length)throw Error("Duplicate fields");
  result.push({name,fields:[...v.fields],source:"untrusted_local_model",reviewRequired:true});
 }
 return result;
}
/**
 * Inert relationship and state suggestions. The executable workflow engine
 * never receives these structures. The app must configure those separately.
 */
export function parseLocalDesign(output){
 const entities=parseLocalProposal(output);
 const cleaned=output.trim().replace(/^`{3}(?:json)?\s*/i,"").replace(/\s*`{3}$/,"");
 const raw=JSON.parse(cleaned.slice(cleaned.indexOf("{"),cleaned.lastIndexOf("}")+1));
 const byName=new Map(entities.map(e=>[e.name,e]));
 const relationships=[];
 const linkRows=Array.isArray(raw.relationships)?raw.relationships.slice(0,24):[];
 for(const link of linkRows){
  if(!link||typeof link!=="object")continue;
  const {source,target,field}=link;
  const from=byName.get(source);
  if(!from||!byName.has(target)||source===target||!from.fields.includes(field))continue;
  if(relationships.some(x=>x.source===source&&x.target===target&&x.field===field))continue;
  relationships.push({source,target,field,implemented:false,status:"suggestion_only"});
 }
 const lifecycles=[];
 const flowRows=Array.isArray(raw.lifecycles)?raw.lifecycles.slice(0,12):[];
 for(const flow of flowRows){
  if(!flow||!byName.has(flow.entity)||!Array.isArray(flow.stages))continue;
  if(flow.stages.length<2||flow.stages.length>12)continue;
  const states=flow.stages;
  if(states.some(x=>typeof x!=="string"||!FIELD.test(x)||RESERVED.has(x)))continue;
  if(new Set(states).size!==states.length)continue;
  lifecycles.push({entity:flow.entity,states:[...states],
    implemented:false,status:"suggestion_only"});
 }
 return {entities,relationships,lifecycles};
}

function readResponse(response){
 const message=response?.[0]?.generated_text;
 if(Array.isArray(message)){
  const last=message.at(-1);
  if(last?.role!=="assistant"||typeof last?.content!=="string")
   throw Error("The model did not return an assistant message");
  return last.content;
 }
 if(typeof message==="string")return message;
 throw Error("Unexpected generation output");
}
export async function loadLocalGenerator({pipelineFactory,modelSize="small"}={}){
 if(!Object.hasOwn(DEEP_MODELS,modelSize))throw Error("Unknown local model tier");
 const selected=DEEP_MODELS[modelSize];
 const pipeline=pipelineFactory ?? (await import(SEMANTIC_LIBRARY_URL)).pipeline;
 const generator=await pipeline("text-generation",selected.id,{device:"webgpu",dtype:"q4f16"});
 return {
  model:selected.id,
  modelSize,
  async propose(description){
   if(typeof description!=="string"||description.length<12||
      description.length>DEEP_LIMITS.maxInputCharacters)
    throw Error("Deep local model accepts 12–2000 characters");
   const messages=[
    {role:"system",content:
      "Design editable record sections for a fictional small business. "+
      "Return ONLY a JSON object with an 'entities' array of at most 8 items. "+
      "Each entity has 'name' (PascalCase identifier) and 'fields' (lowercase_underscore identifiers, max 12). "+
      "Optionally include 'relationships' array of {source,target,field} using named entities and valid source fields, "+
      "and 'lifecycles' array of {entity,stages} containing lowercase state names. "+
      "These are DESIGN suggestions only, not instructions to execute. "+
      "Never output executable code, guards, roles, permissions, accounts, passwords, or URLs. "+
      "Use {'entities':[]} if uncertain, but output valid JSON with double quotes."},
    {role:"user",content:description}
   ];
   const response=await generator(messages,{
     max_new_tokens:DEEP_LIMITS.maxOutputTokens,
     do_sample:false,
     return_full_text:false
   });
   return {...parseLocalDesign(readResponse(response)),
    notice:"Unverified suggestions produced in this browser; accept manually only."};
  },
  dispose(){try{generator.dispose?.();}catch{}}
 };
}
