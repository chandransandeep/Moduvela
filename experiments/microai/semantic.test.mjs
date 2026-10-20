import assert from "node:assert/strict";
import test from "node:test";
import {CATALOG,schemaFor} from "./semantic_catalog.mjs";
import {dot,rankSemantic,segmentRequirements,createSemanticAnalyzer,loadLocalSemantic} from "./semantic.mjs";
test("catalog has expanded safe unique schemas",()=>{
 assert.ok(CATALOG.length>=20);
 assert.equal(new Set(CATALOG.map(x=>x.name)).size,CATALOG.length);
 assert.equal(schemaFor("Vehicles").fields[0],"registration");
 assert.equal(schemaFor("<script>"),null);
 for(const x of CATALOG){
  assert.match(x.name,/^[A-Za-z][A-Za-z0-9_]{0,39}$/);
  assert.ok(x.fields.every(f=>/^[a-z][a-z0-9_]{0,39}$/.test(f)));
 }
});
test("cosine handles orthogonal vectors and rejects malformed",()=>{
 assert.equal(dot([1,0],[0,1]),0);
 assert.ok(dot([1,0],[1,0])>.999);
 assert.throws(()=>dot([1],[1,2]));
 assert.throws(()=>dot([NaN],[1]));
});
test("semantic ranking uses actual relative embedding similarity, not labels",()=>{
 const categories=[
 {name:"Vehicles",fields:["registration"],examples:["vehicle repairs"]},
 {name:"Courses",fields:["course_name"],examples:["training courses"]}
 ];
 const segments=["repair vehicles"];
 const scores=rankSemantic(segments,[[1,0],[.95,.05],[0,1]],categories);
 assert.equal(scores[0].name,"Vehicles");
 assert.equal(scores[0].evidence,"repair vehicles");
 assert.equal(scores[0].reviewRequired,true);
});
test("injected encoder runs locally without a network fetch",async()=>{
 const categories=[
 {name:"Vehicles",fields:["registration"],examples:["vehicle repairs"]},
 {name:"Courses",fields:["course_name"],examples:["training courses"]}
 ];
 const calls=[];
 const mock=async phrases=>{
  calls.push(phrases);
  return {tolist:()=>phrases.map(x=>/course|training/i.test(x)?[0,1]:[1,0])};
 };
 const analyze=createSemanticAnalyzer(mock,categories);
 const first=await analyze("Our small workshop needs to track repaired cars and vehicles.");
 assert.equal(first[0].name,"Vehicles");
 await analyze("We need courses and professional training for our small school.");
 assert.equal(calls.length,3); // catalog cached once; inputs embedded twice
});
test("pipeline adapter is testable with a mock and rejects unknown devices",async()=>{
 const factory=async(task,model,options)=>{
  assert.equal(task,"feature-extraction");
  assert.equal(options.device,"wasm");
  return async texts=>({tolist:()=>texts.map(()=>[1,0])});
 };
 const loaded=await loadLocalSemantic({pipelineFactory:factory});
 assert.equal(loaded.device,"wasm");
 const scores=await loaded.analyze("Our service business tracks incoming vehicle repairs.");
 assert.ok(scores.length>=20);
 loaded.dispose();
 await assert.rejects(()=>loadLocalSemantic({device:"untrusted",pipelineFactory:factory}));
});
test("input boundaries and vector dimensions enforced",()=>{
 assert.throws(()=>segmentRequirements("tiny"));
 assert.throws(()=>segmentRequirements("x".repeat(5001)));
 assert.throws(()=>rankSemantic(["okay"],[[1,0]],CATALOG));
});
