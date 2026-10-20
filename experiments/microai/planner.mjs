/**
 * Moduvela Business Blueprint Planner v0.3 (EXPERIMENT).
 * Offline, dependency-free requirement analysis on top of the MicroAI
 * classifier. Produces inspectable drafts, never executable workflow rules.
 * No LLM, provider cost, network calls or source-code generation.
 */
import { analyseDescription, modelInformation } from "./engine.mjs";
import {suggestFields} from "./fields.mjs";
import {composeBusinessConcepts} from "./catalog_planner.mjs";

const ENTITY_TERMS = Object.freeze({
  Customers: /\b(?:customer|client|member|patient|tenant)s?\b/i,
  Jobs: /\b(?:job|repair|work[\s-]?order|task|service[\s-]?request)s?\b/i,
  Inventory: /\b(?:stock|inventory|spare[\s-]?parts?|materials?|supplies|items? in storage)\b/i,
  Appointments: /\b(?:appointments?|bookings?|reservations?|scheduled visits?)\b/i,
  Invoices: /\b(?:invoices?|bills?|billing|payments?|amounts? owed)\b/i,
  Staff: /\b(?:staff|employees?|mechanics?|technicians?|workers?|shifts?)\b/i,
  Inspections: /\b(?:inspections?|audits?|compliance checks?|assessments?)\b/i,
  Certificates: /\b(?:certificates?|certification)\b/i,
});
const NEGATION = /\b(?:no|not|without|avoid|exclude|don't|do not|does not|never|don't need|not required)\b/i;
const NEGATE_SPECIFIC = {
  Customers: /\b(?:no|without|don't need|do not need|exclude|not using)\s+(?:(?:any|the|a)\s+)?(?:customers?|clients?|members?)\b/i,
  Jobs: /\b(?:no|without|don't need|do not need|exclude|not using)\s+(?:(?:any|the|a)\s+)?(?:jobs?|repairs?|tasks?|work orders?)\b/i,
  Inventory: /\b(?:no|without|don't need|do not need|exclude|not using)\s+(?:(?:any|the|a)\s+)?(?:stock|inventory|parts?|supplies)\b/i,
  Appointments: /\b(?:no|without|don't need|do not need|exclude|not using)\s+(?:(?:any|the|a)\s+)?(?:appointments?|bookings?|reservations?)\b/i,
  Invoices: /\b(?:no|without|don't need|do not need|exclude|not using)\s+(?:(?:any|the|a)\s+)?(?:invoices?|billing|bills?|payments?)\b/i,
  Staff: /\b(?:no|without|don't need|do not need|exclude|not using)\s+(?:(?:any|the|a)\s+)?(?:staff|employees?|workers?)\b/i,
  Inspections: /\b(?:no|without|don't need|do not need|exclude|not using)\s+(?:(?:any|the|a)\s+)?(?:inspections?|audits?)\b/i,
  Certificates: /\b(?:no|without|don't need|do not need|exclude|not using)\s+(?:(?:any|the|a)\s+)?(?:certificates?|certification)\b/i,
};
const TYPE_QUESTIONS = Object.freeze({
  Jobs: "Which stages should a job go through, from creation to completion?",
  Inventory: "Do you need to reserve stock against jobs, or only track quantities?",
  Certificates: "What information must a completion certificate contain, and who may issue it?",
});
const ALLOWED_CURRENCY = { "£":"GBP", "$":"USD", "€":"EUR" };

function clauses(text) {
  return text.split(/[.!?;\n]+|,(?=\s+[a-z])/gi)
    .map(x => x.trim()).filter(Boolean).slice(0, 80);
}
function supportingEvidence(text, entity) {
  const regex = ENTITY_TERMS[entity];
  return clauses(text).filter(c => regex?.test(c)).slice(0, 3);
}
function explicitExclusion(text, entity) {
  return Boolean(NEGATE_SPECIFIC[entity]?.test(text));
}
function approvalRequest(text) {
  const approvalTerms = /\b(?:approv(?:al|e|ed|ing)|authoris\w*|authoriz\w*|sign[\s-]?off)\b/i;
  if (!approvalTerms.test(text)) return null;
  const evidence = clauses(text).filter(c => approvalTerms.test(c));
  if (evidence.every(c => /\b(?:no|don't need|do not require|without|never need)\s+(?:a\s+)?(?:manager\s+)?approv/i.test(c)))
    return { excluded: true, evidence };
  const matched = text.match(/\b(?:more than|over|above|exceeds?|greater than|at least)\s*([£$€])\s*([\d,]+(?:\.\d{1,2})?)/i)
    || text.match(/([£$€])\s*([\d,]+(?:\.\d{1,2})?)\s*(?:or more|and above)/i);
  const amount = matched ? Number(matched[2].replace(/,/g,"")) : null;
  const currency = matched ? ALLOWED_CURRENCY[matched[1]] : null;
  const highValue = /\b(?:high[\s-]?value|expensive|costly)\b/i.test(text);
  const role = /\bmanager\b/i.test(text) ? "Manager" :
    /\bsupervisor\b/i.test(text) ? "Supervisor" : null;
  return {
    kind: "approval", status: "suggestion_only",
    subject: /\b(?:repair|job|work order)\b/i.test(text) ? "Jobs" : "Unspecified",
    role, highValue,
    condition: matched && Number.isFinite(amount) && amount >= 0 && amount <= 1e9
      ? { operator: matched[0].toLowerCase().includes("at least") ? ">=" : ">", amount, currency }
      : null,
    evidence,
    implemented: false,
  };
}
function relationshipCandidates(entities) {
  const names = new Set(entities.map(e=>e.name));
  const suggestions = [
    ["Customers","Jobs","A customer may have many jobs"],
    ["Jobs","Certificates","A completion certificate may belong to one job"],
    ["Jobs","Inventory","A repair job may consume spare parts"],
    ["Customers","Appointments","An appointment may be booked for a customer"],
    ["Customers","Invoices","An invoice may belong to a customer"],
    ["Staff","Jobs","A job may be assigned to a staff member"],
  ];
  return suggestions
    .filter(([from,to])=>names.has(from)&&names.has(to))
    .map(([from,to,reason])=>({from,to,reason,status:"review_required",implemented:false}));
}

/**
 * Analyse a multi-requirement description into a reviewable design proposal.
 * Exclusions, relationship hypotheses, and workflow requests are NEVER
 * silently applied to Moduvela's business runtime.
 */
export function proposeBusinessPlan(text) {
  const analysis = analyseDescription(text);
  const catalog = composeBusinessConcepts(text);
  const initial = analysis.blueprint?.entities || [];
  const excluded = [];
  const fromCatalog = new Map(catalog.entities.map(e=>[e.name,e]));
  for(const label of catalog.excluded)excluded.push({
    name:label,reason:"Explicit negative wording in requirements — confirm exclusion"
  });
  let entities = initial.filter(e=>{
    if (explicitExclusion(text,e.name)) {
      excluded.push({ name:e.name, reason:"Explicit negative wording — review before exclusion" });
      return false;
    }
    return true;
  }).map(entity => ({
    ...entity,
    evidence: supportingEvidence(text,entity.name),
    reviewRequired: true,
  }));
  // Complement the legacy eight-label classifier with the offline
  // cross-domain catalog. Keep inferred evidence and require user review.
  const found=new Set(entities.map(e=>e.name));
  for(const candidate of catalog.entities){
    if(found.has(candidate.name)||excluded.some(x=>x.name===candidate.name))continue;
    entities.push(candidate);
    found.add(candidate.name);
  }
  // For entities that the rules already know, prefer direct textual evidence.
  for(const item of entities){
    if(fromCatalog.has(item.name)&&!item.evidence?.length){
      item.evidence=[...fromCatalog.get(item.name).evidence];
    }
  }
  entities=entities.slice(0,12);
  const extracted=suggestFields(text,entities);
  entities=extracted.entities;
  const approval = approvalRequest(text);
  const unsupported = [];
  if (approval && !approval.excluded) unsupported.push(approval);
  if (analysis.futureFeatures.some(f=>f.includes("Reminders"))) {
    unsupported.push({kind:"reminder",status:"suggestion_only",
      evidence:clauses(text).filter(s=>/\b(?:remind|reminders?|alerts?|notify|notification|overdue)\b/i.test(s)),
      implemented:false});
  }
  if (entities.some(e=>e.name==="Certificates"))
    unsupported.push({kind:"certificate_generation",status:"suggestion_only",
      implemented:false, evidence:supportingEvidence(text,"Certificates")});
  const allRelationships=[...relationshipCandidates(entities),...catalog.relationships];
  const relationshipIds=new Set();
  const relationships=allRelationships.filter(link=>{
    const id=link.from+"\u0000"+link.to;
    if(relationshipIds.has(id))return false;
    relationshipIds.add(id);
    return true;
  });
  for(const item of catalog.unsupported)
    if(!unsupported.some(x=>x.kind===item.kind))unsupported.push(item);
  const questions=[...extracted.questions,...catalog.questions];
  if(!entities.length)questions.push("What information should this application store? Give an example record.");
  if(approval && !approval.excluded){
    if(!approval.role)questions.push("Who is allowed to approve the request?");
    if(approval.highValue && !approval.condition)
      questions.push("What amount and currency define a high-value item (for example £500)?");
  }
  if(entities.some(e=>e.name==="Certificates"))
    questions.push(TYPE_QUESTIONS.Certificates);
  if(entities.some(e=>e.name==="Jobs"))
    questions.push(TYPE_QUESTIONS.Jobs);
  if(entities.some(e=>e.name==="Inventory"))
    questions.push(TYPE_QUESTIONS.Inventory);
  if(excluded.length)questions.push("Confirm that excluded record sections are not needed.");
  const initialBlueprint=analysis.blueprint||{
    version:1,name:catalog.title,category:"custom",
    description:text,status:"proposal",entities:[],
    limitations:["Offline catalog-based suggestion; owner review required",
      "Only text fields are supported in the current application engine"]
  };
  const blueprint = entities.length
    ? {...initialBlueprint,
        name:catalog.title!=="Custom Business Operations"?catalog.title:initialBlueprint.name,
        entities: entities.map(({name,fields})=>({name,fields})),
        limitations: [
          ...initialBlueprint.limitations,
          "Relations and conditions are suggestions only; nothing executes automatically.",
          "Owner must review and approve the draft.",
        ]}
    : null;
  return {
    version:1, text, blueprint, entities, excluded, relationships,
    catalog:{direct:catalog.direct,inferred:catalog.inferred,notes:catalog.notes},
    fieldSuggestions:extracted.suggestions,
    unsupported, questions:questions.slice(0,6),
    notes:[
      "No external model, GPU, API token or network needed.",
      "Deterministic catalog rules broaden domain coverage but do not constitute general natural-language understanding.",
      "This is a rule-assisted classifier; it can miss negation, intent and complex business logic.",
      "Scores are not calibrated accuracy or probability.",
      "No sensitive business data: local prototype has no login or production data security.",
    ],
    classifier: { method:modelInformation().method, matches:analysis.matches },
  };
}

/**
 * Transform selected sections into a schema-compatible, unapproved Blueprint v1.
 * The caller cannot create executable workflow definitions using this function.
 */
export function reviewedBlueprint(plan, selectedNames) {
  if(!plan?.blueprint)throw new Error("No blueprint proposal available");
  if(!Array.isArray(selectedNames))throw new Error("Select sections to include");
  const unique=new Set(selectedNames);
  if(unique.size!==selectedNames.length)throw new Error("Duplicate section selection");
  const offered=new Map(plan.entities.map(e=>[e.name,e]));
  if(!unique.size)throw new Error("Select at least one section");
  const entities=[];
  for(const name of unique){
    if(!offered.has(name))throw new Error("Unknown section: "+String(name));
    const candidate=offered.get(name);
    entities.push({name:candidate.name,fields:[...candidate.fields]});
  }
  if(entities.length>12)throw new Error("Too many sections");
  return {...plan.blueprint, status:"proposal", entities};
}
