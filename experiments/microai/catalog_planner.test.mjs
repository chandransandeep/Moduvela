import assert from "node:assert/strict";
import test from "node:test";
import {composeBusinessConcepts} from "./catalog_planner.mjs";
const MICRO="A micro-logistics and subscription platform connecting urban vertical micro-farms with downtown coffee shops and residential households for same-day harvest delivery.";
test("micro-farm logistics scenario creates useful candidate data model",()=>{
 const result=composeBusinessConcepts(MICRO);
 const names=result.entities.map(x=>x.name);
 for(const n of ["Farms","Customers","HarvestBatches","Subscriptions","Deliveries","Orders"])
  assert.ok(names.includes(n),n+" missing: "+names.join(", "));
 assert.ok(result.inferred.includes("Orders"));
 assert.equal(result.title,"Urban Farm Delivery Platform");
 assert.ok(result.unsupported.some(x=>x.kind==="same_day_delivery"&&!x.implemented));
 assert.ok(result.relationships.some(x=>x.from==="Orders"&&x.to==="Deliveries"));
 assert.ok(result.questions.some(q=>q.includes("cut-off")));
});
test("unrelated story must not create invented business records",()=>{
 const result=composeBusinessConcepts("The mountain clouds swirl as the ocean reflects a lavender sunset.");
 assert.deepEqual(result.entities,[]);
});
test("explicit exclusion of ordering is respected even if delivery implied",()=>{
 const result=composeBusinessConcepts("Deliver farm goods to households with no orders. We only manage deliveries.");
 assert.ok(!result.entities.some(x=>x.name==="Orders"));
});
test("no internet models or variable code execution",()=>{
 const r=composeBusinessConcepts("Our salon has subscriptions, customers and deliveries");
 assert.ok(r.entities.every(x=>x.fields.every(y=>/^[a-z][a-z0-9_]{0,39}$/.test(y))));
 assert.ok(r.relationships.every(x=>x.implemented===false));
});
test("different sectors and combinations remain separable",()=>{
 const a=composeBusinessConcepts("We track employees, inspections and invoices for building audits.");
 const names=a.entities.map(x=>x.name);
 for(const n of ["Staff","Inspections","Invoices"])assert.ok(names.includes(n));
 assert.ok(!names.includes("Farms"));
});
test("boundary checks reject non-strings and overly long content",()=>{
 assert.throws(()=>composeBusinessConcepts(null));
 assert.throws(()=>composeBusinessConcepts("too short"));
 assert.throws(()=>composeBusinessConcepts("x".repeat(5001)));
});
