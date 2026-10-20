/**
 * No-download business-domain composer.
 *
 * This is explicitly deterministic knowledge engineering (NOT neural semantic
 * understanding). It runs as ordinary JavaScript with no model, GPU, internet
 * access, user accounts, or inference fees.
 *
 * Outcomes are human-reviewable hypotheses; inferred objects must be confirmed.
 */
import {schemaFor} from "./semantic_catalog.mjs";
const RULES=Object.freeze([
 {name:"Farms",pattern:/\b(?:urban\s+)?(?:vertical\s+)?(?:micro[ -]?)?farms?\b|\bgrowers?\b|\bproduce suppliers?\b/i},
 {name:"HarvestBatches",pattern:/\bharvest(?:ed|ing|s)?\b/i,
  context:/\b(?:farm|produce|crop|greens|vegetable|grower|agricultur|delivery|delivering)\w*\b/i},
 {name:"FarmProducts",pattern:/\b(?:fresh\s+produce|crops?|vegetables?|microgreens|leafy greens|farm[- ]grown products?)\b/i,
  context:/\b(?:farm|food|harvest|grow|deliver|shop|local)\w*\b/i},
 {name:"Customers",pattern:/\b(?:customers?|clients?|buyers?|coffee shops?|caf[eé]s?|households?|residential customers?|residents?|consumers?|subscribers?)\b/i},
 {name:"Orders",pattern:/\b(?:customer orders?|orders?|ordering|purchases?|fulfill?ment)\b/i},
 {name:"Subscriptions",pattern:/\b(?:subscriptions?|subscribers?|recurring\s+(?:plan|delivery|order|payment)s?|weekly\s+(?:box|plan)|membership plans?)\b/i},
 {name:"Deliveries",pattern:/\b(?:deliver(?:y|ies|ed|ing)?|same[ -]day\s+(?:dispatch|fulfill?ment)|dispatch(?:es|ing)?|shipments?|couriers?|logistics|last[ -]mile)\b/i},
 {name:"DeliveryRoutes",pattern:/\b(?:delivery routes?|route\s+planning|last[ -]mile routes?|driver schedules?|delivery stops?)\b/i},
 {name:"Products",pattern:/\b(?:product\s+catalog(?:ue)?|merchandise|items\s+for\s+sale|products?\s+for\s+sale)\b/i},
 {name:"Inventory",pattern:/\b(?:inventory|stock levels?|warehouses?|stockroom|stor(?:ing|age)\s+quantities)\b/i},
 {name:"Suppliers",pattern:/\b(?:suppliers?|vendors?|wholesalers?)\b/i},
 {name:"Appointments",pattern:/\b(?:appointments?|consultations?|scheduled visits?|appointment bookings?)\b/i},
 {name:"Invoices",pattern:/\b(?:invoices?|billing|bills?|unpaid payments?)\b/i},
 {name:"Staff",pattern:/\b(?:employees?|staff|workers?|technicians?|mechanics?|shift rosters?)\b/i},
 {name:"Inspections",pattern:/\b(?:inspections?|audits?|compliance assessments?)\b/i},
 {name:"Vehicles",pattern:/\b(?:fleet vehicles?|car registrations?|vans?|vehicle fleet)\b/i},
 {name:"Courses",pattern:/\b(?:courses?|training workshops?|class curriculum)\b/i},
 {name:"Rentals",pattern:/\b(?:rentals?|hire agreements?)\b/i},
 {name:"Projects",pattern:/\b(?:project milestones?|project tracking|client projects?)\b/i},
 {name:"Quotes",pattern:/\b(?:quotations?|price quotes?|estimates?\s+for\s+(?:customer|work))\b/i},
 {name:"Leads",pattern:/\b(?:sales leads?|prospects?|sales enquiries?)\b/i},
 {name:"PurchaseOrders",pattern:/\b(?:purchase orders?|procurement requests?)\b/i},
 {name:"Timesheets",pattern:/\b(?:timesheets?|hours worked)\b/i},
 {name:"Expenses",pattern:/\b(?:expense claims?|business expenses?|reimbursements?)\b/i},
 {name:"Incidents",pattern:/\b(?:incident reports?|safety incidents?|accident reports?)\b/i}
]);
const EXCLUSION=/\b(?:no|without|exclude|do\s+not\s+(?:need|want|use|track)|don't\s+(?:need|want|use|track)|not\s+required)\s+(?:(?:any|the|a)\s+)?$/i;
function occurrences(value,pattern){
 const flags=pattern.flags.includes("g")?pattern.flags:pattern.flags+"g";
 return [...value.matchAll(new RegExp(pattern.source,flags))];
}
function negativeAround(text,index) {
 const nearby=text.slice(Math.max(0,index-45),index);
 return EXCLUSION.test(nearby);
}
function evidence(text,index){
 const beginning=Math.max(0,index-100),end=Math.min(text.length,index+105);
 return (beginning?"…":"")+text.slice(beginning,end).trim()+(end<text.length?"…":"");
}
export function composeBusinessConcepts(text){
 if(typeof text!=="string"||text.length<12||text.length>5000)
  throw Error("Description must be 12–5000 characters");
 const direct=[],excluded=[],inferred=[];
 for(const rule of RULES){
  const matches=occurrences(text,rule.pattern);
  const positive=matches.filter(m=>!negativeAround(text,m.index??0)
    &&(!rule.context||rule.context.test(text)));
  const negative=matches.filter(m=>negativeAround(text,m.index??0));
  if(positive.length){
   const schema=schemaFor(rule.name);
   if(schema)direct.push({...schema,evidence:[evidence(text,positive[0].index)],
     origin:"explicit_term",reviewRequired:true});
  }else if(negative.length)excluded.push(rule.name);
 }
 const selected=new Set(direct.map(x=>x.name));
 // Inferred models are proposals, not claims the user asked for these explicitly.
 const suggest=(name,why)=>{
  if(selected.has(name)||excluded.includes(name))return;
  const schema=schemaFor(name);
  if(schema){inferred.push({...schema,evidence:[why],origin:"inferred",
     reviewRequired:true});selected.add(name);}
 };
 // Order fulfilment is usually required by a customer-facing delivery business,
 // but may be handled outside Moduvela, so always call it inferred.
 if(selected.has("Deliveries")&&selected.has("Customers")&&
    !selected.has("Orders")&&!/\b(?:no|without)\s+(?:any\s+)?orders?\b/i.test(text))
  suggest("Orders","Suggested because customer-facing deliveries often need an order record; confirm.");
 // Fresh produce/crops on a supply platform may need a product catalogue.
 if(selected.has("Farms")&&selected.has("HarvestBatches"))
  suggest("FarmProducts","Suggested to record which crops a farm provides; confirm.");
 const concepts=[...direct,...inferred].slice(0,12);
 const names=new Set(concepts.map(x=>x.name));
 const relations=[
  ["Farms","HarvestBatches","Which farm produced each batch?"],
  ["Farms","FarmProducts","Which crops are offered by each farm?"],
  ["Customers","Orders","Who placed each order?"],
  ["Customers","Subscriptions","Which customer owns a subscription?"],
  ["Orders","Deliveries","Which delivery fulfils each order?"],
  ["HarvestBatches","Orders","Which harvest batch supplies each order?"],
  ["Orders","FarmProducts","Which farm product was ordered?"],
  ["Deliveries","DeliveryRoutes","Which route handles each delivery?"]
 ].filter(([a,b])=>names.has(a)&&names.has(b))
  .map(([from,to,reason])=>({from,to,reason,implemented:false,status:"review_required"}));
 const questions=[];
 if(names.has("Farms"))questions.push("Will farms manage their own product and harvest records, or will the platform operator do that?");
 if(names.has("Subscriptions"))questions.push("How often are subscriptions fulfilled, and can customers pause or change them?");
 if(names.has("Orders"))questions.push("Will each delivery come from one farm or combine produce from several farms?");
 if(names.has("Deliveries"))questions.push("What delivery cut-off, delivery area and fulfilment windows should apply?");
 const sameDay=/\bsame[ -]day\b/i.test(text);
 const unsupported=sameDay?[{kind:"same_day_delivery",status:"suggestion_only",
  evidence:[evidence(text,text.search(/same[ -]day/i))],implemented:false}]:[];
 if(sameDay)questions.push("How should same-day delivery cut-off times and missed delivery windows be handled?");
 let title="Custom Business Operations";
 if(names.has("Farms")&&names.has("Deliveries"))title="Urban Farm Delivery Platform";
 else if(names.has("Subscriptions")&&names.has("Deliveries"))title="Subscription Delivery Platform";
 else if(names.has("Deliveries"))title="Delivery Operations";
 return {entities:concepts,direct:direct.map(x=>x.name),
  inferred:inferred.map(x=>x.name),excluded,relationships:relations,
  questions:questions.slice(0,6),unsupported,title,
  notes:["Offline deterministic business-domain composer; not a trained language model",
         "Record selection and inferred concepts require owner review",
         "Relationships and same-day constraints are not activated"]};
}
