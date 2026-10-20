import assert from "node:assert/strict";
import test from "node:test";
import {proposeBusinessPlan} from "./planner.mjs";
import {beginReview,editSection,addSection,removeSection,compileReviewedBlueprint,includeSuggestedSection} from "./review.mjs";
import {builtinSchemaForEntity} from "./engine.mjs";

const PLAN=proposeBusinessPlan("I run a drone repair workshop. We track customers, parts and repair jobs, issue completion certificates, and require manager approval for high-value work.");
const start=()=>beginReview(PLAN);
test("human can rename and extend a suggested section",()=>{
 const old=start(); const key=old.sections.find(x=>x.name==="Jobs").key;
 const edited=editSection(old,key,{name:"RepairJobs",fields:"customer, status, due_date, serial_number"});
 const blueprint=compileReviewedBlueprint(PLAN,edited);
 assert.deepEqual(blueprint.entities.find(x=>x.name==="RepairJobs").fields,
  ["customer","status","due_date","serial_number"]);
 assert.equal(old.sections.find(x=>x.key===key).name,"Jobs");
 assert.equal(blueprint.workflows,undefined);
});
test("human can add and remove a custom section",()=>{
 let review=addSection(start());
 const key=review.sections.find(x=>x.origin==="manual").key;
 review=editSection(review,key,{name:"Drones",fields:"serial_number, model, warranty_date"});
 assert.ok(compileReviewedBlueprint(PLAN,review).entities.some(x=>x.name==="Drones"));
 assert.ok(!compileReviewedBlueprint(PLAN,removeSection(review,key)).entities.some(x=>x.name==="Drones"));
});
test("deselected sections are not exported",()=>{
 const s=start(),job=s.sections.find(x=>x.name==="Jobs");
 const result=compileReviewedBlueprint(PLAN,editSection(s,job.key,{included:false}));
 assert.ok(!result.entities.some(x=>x.name==="Jobs"));
});
test("strictly validates entity and field names",()=>{
 const s=start(),key=s.sections[0].key;
 for(const bad of ["Bad Name","<script>","1Wrong","x".repeat(41)])
  assert.throws(()=>compileReviewedBlueprint(PLAN,editSection(s,key,{name:bad})),/Invalid section/);
 for(const bad of ["id","created_at","bad field","name, name","a, "])
  assert.throws(()=>compileReviewedBlueprint(PLAN,editSection(s,key,{fields:bad})),/field/i);
});
test("duplicate section is rejected even with case variation",()=>{
 let r=addSection(start());const key=r.sections.find(x=>x.origin==="manual").key;
 r=editSection(r,key,{name:"jobs"});
 assert.throws(()=>compileReviewedBlueprint(PLAN,r),/Duplicate section/);
});
test("empty apps and incomplete descriptions cannot be deployed",()=>{
 let r=start();
 for(const section of r.sections)r=editSection(r,section.key,{included:false});
 assert.throws(()=>compileReviewedBlueprint(PLAN,r),/Select 1/);
 r=start();r.name="";assert.throws(()=>compileReviewedBlueprint(PLAN,r),/Application name/);
 r=start();r.description="tiny";assert.throws(()=>compileReviewedBlueprint(PLAN,r),/Description/);
});
test("no approval logic can cross the review boundary",()=>{
 const b=compileReviewedBlueprint(PLAN,start());
 assert.equal(b.status,"proposal");
 assert.deepEqual(Object.keys(b).sort(),["category","description","entities","limitations","name","status","version"].sort());
});

test("trained-model-only category requires explicit owner inclusion",()=>{
 const original=start();
 const schema=builtinSchemaForEntity("Appointments");
 assert.deepEqual(schema.name,"Appointments");
 const next=includeSuggestedSection(original,schema);
 assert.ok(!original.sections.some(s=>s.name==="Appointments"));
 assert.ok(compileReviewedBlueprint(PLAN,next).entities.some(e=>e.name==="Appointments"));
 assert.throws(()=>includeSuggestedSection(next,schema),/already included/);
 assert.equal(compileReviewedBlueprint(PLAN,next).workflows,undefined);
});
test("reject arbitrary suggested schema and unknown catalog category",()=>{
 assert.equal(builtinSchemaForEntity("Unknown"),null);
 assert.throws(()=>includeSuggestedSection(start(),{name:"Unsafe",fields:["<script>"]}));
});
