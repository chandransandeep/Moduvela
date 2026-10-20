import assert from "node:assert/strict";
import test from "node:test";
import {parseLocalProposal,loadLocalGenerator,DEEP_MODEL,DEEP_LIMITS} from "./generative.mjs";
test("valid fields survive; executable workflow and permissions metadata discarded",()=>{
 const result=parseLocalProposal(JSON.stringify({
  entities:[{name:"Drones",fields:["serial_number","model"],workflow:{exec:"evil()"}}],
  permissions:{admin:true},code:"danger"
 }));
 assert.equal(result[0].name,"Drones");
 assert.deepEqual(result[0].fields,["serial_number","model"]);
 assert.equal(result[0].workflow,undefined);
 assert.equal(result[0].permissions,undefined);
});
test("reject invalid model section identifiers and fields",()=>{
 for(const name of ["<script>","Bad Name","1Bad","__proto__"])
  assert.throws(()=>parseLocalProposal(JSON.stringify({entities:[{name,fields:["name"]}]})));
 for(const field of ["created_at","customer email","<img>","constructor"])
  assert.throws(()=>parseLocalProposal(JSON.stringify({entities:[{name:"Drones",fields:[field]}]})));
});
test("invalid JSON and duplicates are refused before review",()=>{
 assert.throws(()=>parseLocalProposal("not JSON"));
 assert.throws(()=>parseLocalProposal('{"entities":'));
 assert.throws(()=>parseLocalProposal(JSON.stringify({entities:[
  {name:"Drones",fields:["name"]},{name:"drones",fields:["notes"]}
 ]})));
 assert.throws(()=>parseLocalProposal(JSON.stringify({entities:[{name:"Drones",fields:["name","name"]}]})));
 assert.throws(()=>parseLocalProposal(JSON.stringify({entities:Array.from({length:13},(_,i)=>({name:"Type"+i,fields:["name"]}))})));
});
test("empty array is allowed",()=>assert.deepEqual(parseLocalProposal('{"entities":[]}'),[]));
test("mock local model is loaded on request and no remote tests needed",async()=>{
 let loaded=0;
 const engine=await loadLocalGenerator({pipelineFactory:async(task,id,options)=>{
  loaded++;assert.equal(task,"text-generation");assert.equal(id,DEEP_MODEL);
  assert.equal(options.device,"webgpu");
  return async(_messages,options)=>{
   assert.equal(options.max_new_tokens,DEEP_LIMITS.maxOutputTokens);
   return [{generated_text:[{role:"assistant",content:'{"entities":[{"name":"Drones","fields":["serial_number"]}]}'}]}];
  };
 }});
 assert.equal(loaded,1);
 assert.equal((await engine.propose("Our workshop tracks fictional drones and repairs.")).entities[0].name,"Drones");
 await assert.rejects(()=>engine.propose("x".repeat(2001)));
 engine.dispose();
});
