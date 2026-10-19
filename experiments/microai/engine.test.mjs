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
