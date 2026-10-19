/** Transparent synthetic smoke benchmark. NOT an independent accuracy study.
 * Run locally: node experiments/microai/evaluate.mjs
 */
import { performance } from "node:perf_hooks";
import { proposeBusinessPlan } from "./planner.mjs";

const cases=[
 ["A mechanic garage logs repair jobs, customer details and spare parts.",["Jobs","Customers","Inventory"]],
 ["We manage salon appointments and keep customer contact details.",["Appointments","Customers"]],
 ["Send invoices to clients for completed work.",["Invoices","Customers"]],
 ["Our charity tracks volunteer staff, visits and client contacts.",["Staff","Customers"]],
 ["We run annual compliance audits and issue certificates.",["Inspections","Certificates"]],
 ["We keep inventory records with stock quantities.",["Inventory"]],
 ["A cafe schedules staff shifts and orders ingredients as stock.",["Staff","Inventory"]],
 ["Our accountants need customer files and invoices.",["Customers","Invoices"]],
 ["Book customer appointments and issue an invoice afterward.",["Customers","Appointments","Invoices"]],
 ["We repair vehicles, invoice customers, and schedule technician shifts.",["Jobs","Invoices","Customers","Staff"]],
 ["We organise inspections for clients, with certificates after audit.",["Inspections","Customers","Certificates"]],
 ["We don't need invoices; only customer details and repair jobs.",["Customers","Jobs"]],
 ["Track spare parts and send reminders when stock is low.",["Inventory"]],
 ["Our employee staff have appointments for clients.",["Staff","Appointments","Customers"]],
 ["We do not use customer details; stock quantities are sufficient.",["Inventory"]],
 ["We provide service bookings, manage repair jobs and issue invoices.",["Appointments","Jobs","Invoices"]],
 ["I run a drone workshop. We register customer drop-offs, spare parts and issue completion certificates.",["Customers","Inventory","Certificates"]],
 ["We track jobs and require manager approval if costs exceed £500.",["Jobs"]],
 ["Schedule audit inspections and notify managers of overdue checks.",["Inspections"]],
 ["The moon is bright above the hillside and clouds are quiet.",[]],
];
let tp=0,fp=0,fn=0,allCases=0;
const started=performance.now();
for(const [description,expectedNames] of cases){
  const actual=(proposeBusinessPlan(description).blueprint?.entities || []).map(e=>e.name);
  const expected=new Set(expectedNames);
  const returned=new Set(actual);
  const hits=actual.filter(x=>expected.has(x)).length;
  tp+=hits; fp+=actual.length-hits; fn+=expectedNames.length-hits;
  if(!expectedNames.length ? !actual.length : expectedNames.every(x=>returned.has(x)))allCases++;
  console.log(JSON.stringify({description,expected:expectedNames,actual}));
}
const precision=tp+fp?tp/(tp+fp):0;
const recall=tp+fn?tp/(tp+fn):0;
const result={note:"20 synthetic hand-authored smoke examples only; not a production benchmark",
  examples:cases.length,precision:Number(precision.toFixed(3)),recall:Number(recall.toFixed(3)),
  casesWithAllRequiredLabels:allCases,elapsedMs:Number((performance.now()-started).toFixed(2)),
  networkCalls:0,requiresGPU:false};
console.log("\n"+JSON.stringify(result,null,2));
