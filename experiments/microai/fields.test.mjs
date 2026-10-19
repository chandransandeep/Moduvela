import assert from "node:assert/strict";
import test from "node:test";
import {suggestFields} from "./fields.mjs";
const base=()=>[{name:"Jobs",fields:["description"]},{name:"Customers",fields:["name"]},{name:"Inventory",fields:["item_name"]}];
test("recognises job serial number and cost with explicit context",()=>{
 const r=suggestFields("For repair jobs we keep a serial number and repair cost.",base());
 assert.deepEqual(r.entities[0].fields,["description","serial_number","repair_cost"]);
 assert.equal(r.questions.length,0);
});
test("ambiguous serial numbers create a question",()=>{
 const r=suggestFields("We also track serial numbers.",base());
 assert.ok(r.questions.some(q=>q.includes("serial_number")));
 assert.equal(r.entities[0].fields.length,1);
 assert.equal(r.entities[2].fields.length,1);
});
test("detects customer email and postcode",()=>{
 const r=suggestFields("Customer email addresses and postcodes are required.",base());
 assert.ok(r.entities[1].fields.includes("customer_email"));
 assert.ok(r.entities[1].fields.includes("postcode"));
});
test("recognises simple negation",()=>{
 const r=suggestFields("For our jobs no repair cost is required.",base());
 assert.ok(!r.entities[0].fields.includes("repair_cost"));
});
test("never mutates input or duplicates fields",()=>{
 const original=base();original[0].fields.push("repair_cost");
 const r=suggestFields("Track repair cost for repair jobs.",original);
 assert.equal(r.entities[0].fields.filter(f=>f==="repair_cost").length,1);
 assert.equal(original[0].fields.length,2);
});
