import assert from "node:assert/strict";
import test from "node:test";
import { analyseDescription, modelInformation } from "./engine.mjs";

test("works with zero external model, GPU or network dependencies", () => {
  const info=modelInformation();
  assert.equal(info.needsNetwork,false);
  assert.equal(info.needsGpu,false);
  assert.equal(info.usesModelApi,false);
  assert.ok(info.examples >= 45);
  assert.ok(info.vocabSize > 40);
});

test("produces a valid v1 proposal for a focused invoice request", () => {
 const result=analyseDescription("We send invoices and track unpaid bills for our clients");
 assert.ok(result.blueprint);
 assert.equal(result.blueprint.version,1);
 assert.ok(result.blueprint.entities.some(e=>e.name==="Invoices"));
 assert.equal(result.blueprint.status,"proposal");
});

test("extracts inventory request without enabling a runtime workflow", () => {
 const result=analyseDescription("We manage inventory for our shop, track stock levels and reorder parts");
 assert.ok(result.blueprint.entities.some(e=>e.name==="Inventory"));
 assert.equal(result.futureFeatures.length,0);
});

test("reminder-only request does not invent deployable app features", () => {
 const result=analyseDescription("Send notifications before due dates and remind customers about renewals");
 assert.ok(result.futureFeatures.some(x=>x.includes("Reminders")));
 assert.ok(result.note.includes("not probabilities"));
});

test("unrecognised requests ask for clarification instead of inventing capability", () => {
 const result=analyseDescription("The starry constellation appears above a lavender mountain every morning");
 assert.equal(result.blueprint,null);
 assert.ok(result.clarification.includes("What should you record"));
});

test("validates input boundaries and avoids execution of injected markup", () => {
 assert.throws(()=>analyseDescription("short"),/12 to 5000/);
 const result=analyseDescription("We track customer names and contact details <script>alert(1)</script>");
 assert.ok(result.blueprint);
 assert.ok(result.blueprint.description.includes("<script>"));
 // Rendering uses textContent/JSON.stringify only; no markup interpretation.
});

test("drone repair workshop compound description creates four data sections", () => {
 const text="I run a small drone-repair workshop. We log repair jobs, track spare parts, record customer drop-offs, and issue completion certificates. I also want a workflow step where high-value repairs require manager approval.";
 const result=analyseDescription(text);
 assert.ok(result.blueprint);
 const sections=result.blueprint.entities.map(x=>x.name);
 for(const section of ["Customers","Jobs","Inventory","Certificates"])
   assert.ok(sections.includes(section), "missing "+section+"; found "+sections);
 assert.ok(result.blueprint.entities.find(x=>x.name==="Jobs").fields.includes("drop_off_date"));
 assert.ok(result.futureFeatures.some(s=>s.includes("manager approval")));
 assert.ok(result.blueprint.limitations.some(s=>s.includes("not implemented")));
});
test("handles multiple requirements rather than selecting one industry", () => {
 const text="We record customers, employ technicians, track repair jobs, stock spare parts, schedule appointments, invoice clients, and issue completion certificates. A manager must approve costly jobs.";
 const result=analyseDescription(text);
 assert.ok(result.blueprint);
 const sections=result.blueprint.entities.map(x=>x.name);
 for(const section of ["Customers","Staff","Jobs","Inventory","Appointments","Invoices","Certificates"])
   assert.ok(sections.includes(section), "missing "+section+"; found "+sections);
 assert.ok(result.futureFeatures.some(s=>s.includes("Approvals")));
});
test("approval is described as unsupported rather than an executable section", () => {
 const result=analyseDescription("We track repair jobs and require manager approval for expensive repairs");
 assert.ok(result.blueprint.entities.some(x=>x.name==="Jobs"));
 assert.ok(result.futureFeatures.some(x=>x.includes("manager approval")));
 assert.ok(!result.blueprint.entities.some(x=>x.name==="Approvals"));
});
