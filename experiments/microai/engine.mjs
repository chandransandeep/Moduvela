/**
 * Moduvela MicroAI — tiny offline task-specific text classifier.
 *
 * Not a language model, not generative AI. A supervised nearest-example
 * classifier + schema-driven deterministic blueprint assembler.
 * Runs in a browser or Node without network, GPU, dependencies or API calls.
 * This is an experimental assistant: all results require owner review.
 */
const LABELS = {
  customers: {
    entity: "Customers", fields: ["name", "phone", "notes"],
    examples: [
      "keep a customer directory with contact details",
      "manage clients and their addresses",
      "store member profiles and telephone numbers",
      "track customers and contact history",
      "record client names and contact information",
      "our clients need a database",
    ],
  },
  jobs: {
    entity: "Jobs", fields: ["customer", "description", "status", "due_date"],
    examples: [
      "track repair jobs and service requests",
      "manage work orders with status and due dates",
      "assign service tasks and track progress",
      "record jobs that need completing",
      "keep a list of open jobs and completed work",
      "organise tasks for my service business",
    ],
  },
  inventory: {
    entity: "Inventory", fields: ["item_name", "quantity", "reorder_level"],
    examples: [
      "track stock levels and reorder parts",
      "manage inventory for our shop",
      "know how many materials are in storage",
      "record spare parts and low stock",
      "keep a catalogue of supplies and quantities",
      "manage warehouse products and stock",
    ],
  },
  appointments: {
    entity: "Appointments", fields: ["customer", "date", "time", "service"],
    examples: [
      "book appointments for our clients",
      "schedule customer visits and reservations",
      "manage salon bookings in a calendar",
      "record appointment dates and times",
      "customers need to reserve available slots",
      "organise scheduled consultations",
    ],
  },
  invoices: {
    entity: "Invoices", fields: ["customer", "amount", "status"],
    examples: [
      "send invoices and track unpaid bills",
      "record payments for our customers",
      "generate bills for completed work",
      "track amounts owed and outstanding invoices",
      "handle customer charges and payment status",
      "record who has paid for each invoice",
    ],
  },
  staff: {
    entity: "Staff", fields: ["name", "role", "availability"],
    examples: [
      "keep staff employee records",
      "manage mechanics and their shifts",
      "record worker schedules and availability",
      "assign tasks to team members",
      "maintain employee roles and availability",
      "organise our team of technicians",
    ],
  },
  inspections: {
    entity: "Inspections", fields: ["customer", "check_type", "due_date", "result"],
    examples: [
      "manage inspections and audit records",
      "schedule compliance assessments",
      "record inspection results and findings",
      "track yearly certification checks",
      "plan safety audits with due dates",
      "document quality assurance inspections",
    ],
  },
  certificates: {
    entity: "Certificates", fields: ["job", "certificate_number", "issued_date", "status"],
    examples: [
      "issue certificates when repair jobs are completed",
      "record completion certificates issued to customers",
      "generate service completion certificates",
      "track certificate numbers and issue dates",
      "record certificates of completion for finished work",
      "keep service certificates linked to jobs",
    ],
  },
  reminders: {
    feature: "Reminders (not implemented in core yet)",
    examples: [
      "remind customers of upcoming appointments",
      "send alerts when work is overdue",
      "notify me before a deadline",
      "automatic reminders about renewals",
      "alert staff about expiring certificates",
      "send notifications before due dates",
    ],
  },
  approvals: {
    feature: "Approvals (not implemented in core yet)",
    examples: [
      "manager must approve a job before starting",
      "require approval for purchases",
      "supervisor sign off a completed inspection",
      "authorise spending before ordering parts",
      "staff request permission for refunds",
      "review and approve submitted requests",
    ],
  },
};

const ALIASES = {
  customers: "customer", clients: "customer", client: "customer",
  members: "customer", member: "customer",
  employees: "staff", employee: "staff", mechanics: "staff", mechanic: "staff",
  workers: "staff", worker: "staff", technicians: "staff", technician: "staff",
  jobs: "job", tasks: "job", task: "job", workorders: "job",
  bookings: "appointment", booking: "appointment", reservations: "appointment",
  visits: "appointment", consultations: "appointment",
  invoices: "invoice", bills: "invoice", bill: "invoice", payments: "invoice",
  parts: "inventory", supplies: "inventory", materials: "inventory", stock: "inventory",
  audits: "inspection", audit: "inspection", assessments: "inspection",
  notifications: "reminder", alerts: "reminder", notify: "reminder",
  reminders: "reminder", reminder: "reminder",
  approvals: "approval", approve: "approval", approved: "approval",
  repairs: "repair", repairing: "repair", repaired: "repair",
  certificates: "certificate", certification: "certificate",
  dropoffs: "dropoff", dropoff: "dropoff",
};

const STOP = new Set("a an and as at be by can do for from i in is it my of on or our the their them to we with would want need should that this they have me please manage business run small record track".split(" "));
const WORDS = /^[a-z0-9]+$/;
function tokenize(text) {
  if (typeof text !== "string") return [];
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .map(w => ALIASES[w] || w)
    .filter(w => WORDS.test(w) && !STOP.has(w) && w.length > 1);
}
function counts(words) {
  const count = new Map();
  for (const word of words) count.set(word, (count.get(word) || 0) + 1);
  return count;
}
const TRAINING = Object.entries(LABELS).flatMap(([label, item]) =>
  item.examples.map(example => ({ label, words: counts(tokenize(example)) }))
);
const DF = new Map();
for (const item of TRAINING) {
  for (const word of item.words.keys()) DF.set(word, (DF.get(word) || 0) + 1);
}
function weighted(words) {
  const vector = new Map();
  let norm = 0;
  for (const [word, freq] of words) {
    const idf = Math.log(1 + (TRAINING.length + 1) / (1 + (DF.get(word) || 0)));
    const value = (1 + Math.log(freq)) * idf;
    vector.set(word, value); norm += value * value;
  }
  return { vector, norm: Math.sqrt(norm) };
}
const INDEX = TRAINING.map(item => ({ label: item.label, ...weighted(item.words) }));
function similarity(a, b) {
  if (!a.norm || !b.norm) return 0;
  let product = 0;
  for (const [word, value] of a.vector) product += value * (b.vector.get(word) || 0);
  return product / (a.norm * b.norm);
}

function titleCase(word) { return word.charAt(0).toUpperCase() + word.slice(1); }

// Lexical rules are intentionally narrow. The user still reviews the proposal.
const SIGNALS = {
  customers: /\b(?:customers?|clients?|members?)\b/i,
  jobs: /\b(?:repairs?|repairing|jobs?|tasks?|work[ -]?orders?|service requests?)\b/i,
  inventory: /\b(?:spare parts?|parts?|stock|inventory|materials?|supplies?|warehouse)\b/i,
  appointments: /\b(?:appointments?|bookings?|reservations?|consultations?|scheduled visits?)\b/i,
  invoices: /\b(?:invoices?|billing|bills?|payments?|charges?)\b/i,
  staff: /\b(?:staff|employees?|technicians?|mechanics?|workers?|team members?)\b/i,
  inspections: /\b(?:inspections?|audits?|assessments?|compliance checks?|quality checks?)\b/i,
  certificates: /\b(?:certificates?|certification|certificate numbers?)\b/i,
  reminders: /\b(?:reminders?|remind|notifications?|notify|alerts?|overdue|expiring)\b/i,
  approvals: /\b(?:approvals?|approve|approved|authoris\w*|authoriz\w*|sign[ -]?off)\b/i,
};

function descriptionSegments(text) {
  // Splitting prevents a long multi-intent paragraph from diluting each topic.
  return text.split(/[,.!?;\n]+|\b(?:and|also|plus)\b/gi)
    .map(chunk => chunk.trim()).filter(Boolean).slice(0, 100);
}
function sharedTerms(a, b) {
  let n = 0;
  for (const term of a.vector.keys()) if (b.vector.has(term)) n++;
  return n;
}
function classify(text, threshold) {
  const scores = Object.fromEntries(Object.keys(LABELS).map(label => [label, 0]));
  for (const part of [...descriptionSegments(text), text]) {
    const sample = weighted(counts(tokenize(part)));
    if (!sample.norm) continue;
    for (const training of INDEX) {
      const score = similarity(sample, training);
      if (sharedTerms(sample, training) >= 2 && score > scores[training.label])
        scores[training.label] = score;
    }
  }
  return Object.keys(LABELS).flatMap(label => {
    const explicit = SIGNALS[label].test(text);
    const similar = scores[label] >= Math.max(threshold, 0.42);
    if (!explicit && !similar) return [];
    return [{label, score: Number(scores[label].toFixed(3)),
      source: [explicit ? "direct term" : "", similar ? "example match" : ""].filter(Boolean).join(" + ")}];
  }).sort((a,b) => Number(b.source.includes("direct term")) -
                       Number(a.source.includes("direct term")) || b.score - a.score);
}

/**
 * Compiles a suggested Blueprint v1 only. Never executes a business workflow.
 * Scores represent lexical similarity, not calibrated probability.
 */
export function analyseDescription(text, threshold = 0.24) {
  if (typeof text !== "string" || text.length < 12 || text.length > 5000)
    throw new Error("Describe the business in 12 to 5000 characters");
  if (typeof threshold !== "number" || !Number.isFinite(threshold) ||
      threshold < 0 || threshold > 1) throw new Error("Invalid threshold");
  const selected = classify(text, threshold);
  const entities = selected.filter(({label}) => LABELS[label].entity)
    .slice(0, 12)
    .map(({label}) => ({name: LABELS[label].entity, fields: [...LABELS[label].fields]}));
  const jobs = entities.find(entity => entity.name === "Jobs");
  if (jobs && /\bdrop[ -]?offs?\b/i.test(text)) jobs.fields.push("drop_off_date");
  if (jobs && /\b(?:high[ -]?value|expensive|costly)\b/i.test(text))
    jobs.fields.push("repair_value");
  const wishes = selected.filter(({label}) => LABELS[label].feature)
    .map(({label}) => LABELS[label].feature);
  const highValueApproval = /\b(?:high[ -]?value|expensive|costly)\b/i.test(text) &&
    /\b(?:approvals?|approve|authoris\w*|authoriz\w*)\b/i.test(text);
  if (highValueApproval)
    wishes.push("Conditional manager approval for high-value repairs (not implemented)");
  const limitations = [
    "Experimental lexical classifier; confirm every suggestion",
    "Fields are text only in the current Moduvela engine",
    "Workflow approval, reminders and actual certificate issuance are not implemented",
  ];
  if (wishes.length) limitations.push("Requested but unsupported: " + wishes.join("; "));
  const unclear = !entities.length;
  return {
    input: text,
    matches: selected.map(item => ({
      label: titleCase(item.label), similarity: item.score, source: item.source,
    })),
    blueprint: unclear ? null : {
      version: 1,
      name: /\bdrone\b/i.test(text) && /\brepair\w*\b/i.test(text)
        ? "Drone Repair Workshop" : "Custom Business Operations",
      category: "custom", description: text, entities, status: "proposal", limitations,
    },
    futureFeatures: [...new Set(wishes)],
    clarification: unclear
      ? "I could not confidently identify a data section. What should you record: customers, jobs, stock, bookings, invoices, certificates, staff or inspections?"
      : "Please review all proposed sections, fields and unsupported workflow requests before approval.",
    note: "A rule-assisted nearest-example classifier, not an LLM. Similarity scores are not probabilities. Some requirements may be omitted or incorrect.",
  };
}

export function modelInformation() {
  return {
    method: "per-clause nearest-example matching plus explicit lexical rules",
    examples: TRAINING.length,
    categories: Object.keys(LABELS).length,
    vocabSize: DF.size,
    needsNetwork: false,
    needsGpu: false,
    usesModelApi: false,
  };
}

/** Schema candidates come from the local, reviewed catalog, not model-generated code. */
export function builtinSchemaForEntity(name){
  const item=Object.values(LABELS).find(x=>x.entity===name);
  return item?{name:item.entity,fields:[...item.fields]}:null;
}
