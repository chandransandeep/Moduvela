import assert from "node:assert/strict";
import test from "node:test";
import {DESIGN_CASES,ANNOTATION_SCHEMA} from "./design_cases.mjs";
import {proposeBusinessPlan} from "../planner.mjs";
const allow=new Set(["Customers","Jobs","Inventory","Appointments","Invoices","Staff","Inspections","Certificates"]);
test("annotated design cases span 15+ sectors without duplicates",()=>{
 assert.ok(DESIGN_CASES.length>=36);
 assert.ok(new Set(DESIGN_CASES.map(x=>x.sector)).size>=15);
 assert.equal(new Set(DESIGN_CASES.map(x=>x.text)).size,DESIGN_CASES.length);
 assert.equal(ANNOTATION_SCHEMA.held_out_from_training,true);
});
test("hand-authored relationship and rule annotations are well-formed",()=>{
 for(const c of DESIGN_CASES){
  assert.ok(c.text.length>=30);
  assert.ok(c.entities.every(e=>allow.has(e)));
  assert.ok(c.excluded.every(e=>allow.has(e)));
  for(const [from,to] of c.links){assert.ok(c.entities.includes(from));assert.ok(c.entities.includes(to));}
  for(const r of c.rules){assert.ok(["approval","reminder","assignment","certificate_generation"].includes(r.kind));}
 }
});
test("rule proposals remain explicitly unsupported, even with annotated approvals",()=>{
 const samples=DESIGN_CASES.filter(x=>x.rules.some(r=>r.kind==="approval"));
 for(const c of samples){
  const p=proposeBusinessPlan(c.text);
  assert.ok(!p.blueprint?.workflows);
  assert.ok(p.unsupported.every(x=>!x.implemented));
 }
});
