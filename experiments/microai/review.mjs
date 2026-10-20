/**
 * Offline editable Blueprint review model. No code generation or remote requests.
 * Constraints intentionally mirror Python's Blueprint version 1 validator.
 */
const ENTITY=/^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const FIELD=/^[a-z][a-z0-9_]{0,39}$/;
const RESERVED=new Set(["id","created_at","updated_at"]);
const clone=x=>JSON.parse(JSON.stringify(x));

export function beginReview(plan){
  if(!plan?.blueprint)throw Error("No suggested blueprint; clarify requirements first");
  return {
    name:plan.blueprint.name, description:plan.blueprint.description,
    sections:plan.entities.map((e,index)=>({
      key:"suggested-"+index,included:true,name:e.name,
      fields:e.fields.join(", "),origin:"suggested",evidence:[...e.evidence]
    }))
  };
}
export function editSection(review,key,changes){
  if(!review?.sections?.some(s=>s.key===key))throw Error("Unknown section");
  if(Object.keys(changes).some(k=>!["name","fields","included"].includes(k)))
    throw Error("Unsupported edit");
  if("included" in changes && typeof changes.included!=="boolean")
    throw Error("Invalid selection");
  if(("name" in changes && typeof changes.name!=="string") ||
     ("fields" in changes && typeof changes.fields!=="string"))
    throw Error("Invalid section text");
  const next=clone(review);
  next.sections=next.sections.map(s=>s.key===key?{...s,...changes}:s);
  return next;
}
export function addSection(review){
  if(!review?.sections || review.sections.length>=12)
    throw Error("Maximum 12 sections per blueprint");
  const next=clone(review);
  let number=1;
  while(next.sections.some(s=>s.key==="manual-"+number))number++;
  next.sections.push({
    key:"manual-"+number,included:true,name:"Custom"+number,
    fields:"name, notes",origin:"manual",evidence:[]
  });
  return next;
}
export function removeSection(review,key){
  if(!review?.sections?.some(s=>s.key===key))throw Error("Unknown section");
  const next=clone(review);
  next.sections=next.sections.filter(s=>s.key!==key);
  return next;
}
/** Exports ONLY permitted entity/field data: workflow guesses cannot execute. */
export function compileReviewedBlueprint(plan,review){
  if(!plan?.blueprint || !review)throw Error("Review a proposal first");
  const name=String(review.name??"").trim();
  if(!name || name.length>70)throw Error("Application name must be 1–70 characters");
  const description=String(review.description??"");
  if(description.length<12 || description.length>5000)
    throw Error("Description must be 12–5000 characters");
  if(!Array.isArray(review.sections))throw Error("Missing sections");
  const active=review.sections.filter(s=>s.included);
  if(active.length<1 || active.length>12)throw Error("Select 1–12 sections");
  const seen=new Set();
  const entities=active.map(s=>{
    const entity=String(s.name??"").trim();
    if(!ENTITY.test(entity))throw Error("Invalid section name: "+entity+" (letters/numbers/underscores only)");
    if(seen.has(entity.toLowerCase()))throw Error("Duplicate section: "+entity);
    seen.add(entity.toLowerCase());
    const fields=String(s.fields??"").split(",").map(f=>f.trim());
    if(fields.length<1 || fields.length>20)throw Error("Each section needs 1–20 fields: "+entity);
    if(new Set(fields).size!==fields.length)throw Error("Duplicate fields in "+entity);
    for(const field of fields)
      if(!FIELD.test(field)||RESERVED.has(field))
        throw Error("Invalid field '"+field+"' in "+entity+". Use lowercase letters, numbers and underscores.");
    return {name:entity,fields};
  });
  return {
    version:1,name,category:"custom",description,entities,status:"proposal",
    limitations:[
      "Human-reviewed local MicroAI proposal; confirm all details",
      "Only text fields are supported in the current runtime",
      "Suggested workflows and relationships are not executable"
    ]
  };
}

/** Explicit human action only; caller supplies a catalog-backed schema candidate. */
export function includeSuggestedSection(review, schema){
  if(!schema||typeof schema.name!=="string"||!Array.isArray(schema.fields))
    throw Error("Invalid suggested section");
  if(!ENTITY.test(schema.name)||schema.fields.length<1||schema.fields.length>20)
    throw Error("Invalid suggested schema");
  if(schema.fields.some(f=>typeof f!=="string"||!FIELD.test(f)||RESERVED.has(f)))
    throw Error("Invalid suggested fields");
  if(review.sections.some(s=>s.name.toLowerCase()===schema.name.toLowerCase()))
    throw Error("Section already included");
  let next=addSection(review);
  const section=next.sections.at(-1);
  next=editSection(next,section.key,{name:schema.name,fields:schema.fields.join(", ")});
  return next;
}
