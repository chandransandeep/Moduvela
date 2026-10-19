import assert from "node:assert/strict";
import test from "node:test";
import { proposeBusinessPlan, reviewedBlueprint } from "./planner.mjs";

const DRONE = "I run a small drone-repair workshop. We log repair jobs, track spare parts, record customer drop-offs, and issue completion certificates. I also want a workflow step where high-value repairs require manager approval.";

test("drone case extracts sections, evidence, relationships and unsupported approval",()=>{
  const p=proposeBusinessPlan(DRONE);
  assert.ok(p.blueprint);
  const names=p.entities.map(e=>e.name);
  for(const n of ["Customers","Jobs","Inventory","Certificates"])
    assert.ok(names.includes(n),"missing "+n);
  assert.ok(p.entities.find(e=>e.name==="Certificates").evidence.length>0);
  assert.ok(p.relationships.some(r=>r.from==="Jobs"&&r.to==="Certificates"&&!r.implemented));
  assert.ok(p.unsupported.some(s=>s.kind==="approval"&&s.role==="Manager"&&!s.implemented));
  assert.ok(p.questions.some(q=>q.includes("amount and currency")));
});

test("explicit monetary thresholds are parsed only as inert suggestions",()=>{
 const p=proposeBusinessPlan("We record repair jobs and require manager approval for repairs over £500.");
 const a=p.unsupported.find(x=>x.kind==="approval");
 assert.equal(a.condition?.amount,500);
 assert.equal(a.condition?.currency,"GBP");
 assert.equal(a.condition?.operator,">");
 assert.equal(a.implemented,false);
});

test("excludes explicitly rejected invoices without dropping unrelated records",()=>{
 const p=proposeBusinessPlan("We manage customer repair jobs and spare parts. We do not need invoices.");
 assert.ok(p.blueprint.entities.some(x=>x.name==="Customers"));
 assert.ok(!p.blueprint.entities.some(x=>x.name==="Invoices"));
 assert.ok(p.excluded.some(x=>x.name==="Invoices"));
});

test("allows manual selection and never exports unsupported workflow",()=>{
 const p=proposeBusinessPlan(DRONE);
 const b=reviewedBlueprint(p,["Customers","Jobs"]);
 assert.equal(b.entities.length,2);
 assert.equal(b.status,"proposal");
 assert.equal(b.version,1);
 assert.equal(b.workflows,undefined);
 assert.equal(b.approvals,undefined);
 assert.ok(!b.entities.some(x=>x.name==="Certificates"));
});

test("rejects section injection or empty/duplicate selections",()=>{
 const p=proposeBusinessPlan(DRONE);
 assert.throws(()=>reviewedBlueprint(p,[]));
 assert.throws(()=>reviewedBlueprint(p,["Injected"]));
 assert.throws(()=>reviewedBlueprint(p,["Jobs","Jobs"]));
});

test("recognises audits and inspections with evidence",()=>{
 const p=proposeBusinessPlan("Our small safety audit company records clients, runs inspections and issues certificates.");
 assert.ok(p.entities.some(x=>x.name==="Inspections"));
 assert.ok(p.entities.some(x=>x.name==="Certificates"));
 assert.ok(p.entities.some(x=>x.name==="Customers"));
});

test("reminders are pending, not executable rules",()=>{
 const p=proposeBusinessPlan("We manage appointments and remind clients when a booking is due.");
 assert.ok(p.unsupported.some(x=>x.kind==="reminder"&&!x.implemented));
 assert.ok(!p.blueprint.workflows);
});

test("unrelated statement asks for clarification, not invented software",()=>{
 const p=proposeBusinessPlan("The sky is purple because all the stars are above the mountain.");
 assert.equal(p.blueprint,null);
 assert.ok(p.questions.length>0);
});

test("contextual field extraction extends draft but still needs review",()=>{
 const p=proposeBusinessPlan("Our garage tracks customer repair jobs including serial numbers and repair costs.");
 const jobs=p.entities.find(x=>x.name==="Jobs");
 assert.ok(jobs?.fields.includes("serial_number"));
 assert.ok(jobs?.fields.includes("repair_cost"));
 assert.ok(p.fieldSuggestions.some(x=>x.field==="serial_number"&&x.reviewRequired));
});
