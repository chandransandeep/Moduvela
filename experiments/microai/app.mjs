import { proposeBusinessPlan, reviewedBlueprint } from "./planner.mjs";
import { modelInformation,builtinSchemaForEntity } from "./engine.mjs";
import {predictCompact,compactInfo} from "./trained.mjs";
import {predictCompactV2,compactV2Info} from "./trained_v2.mjs";
import {beginReview,editSection,addSection,removeSection,compileReviewedBlueprint,includeSuggestedSection} from "./review.mjs";
const byId=id=>document.getElementById(id);
const input=byId("description");
let plan=null;
let review=null;

function line(target,text) {
  const li=document.createElement("li");
  li.textContent=text;
  target.append(li);
}
function clear(target){target.replaceChildren();}
function editableSection(section){
  const box=document.createElement("div");box.className="card";
  const label=document.createElement("label");
  const check=document.createElement("input");check.type="checkbox";
  check.checked=section.included;check.setAttribute("aria-label","Include "+section.name);
  check.addEventListener("change",()=>{
    review=editSection(review,section.key,{included:check.checked});
    refreshPreview();
  });
  label.append(check,document.createTextNode(" Include this section"));
  const name=document.createElement("input");
  name.value=section.name;name.maxLength=40;name.setAttribute("aria-label","Section name");
  name.addEventListener("input",()=>{
    review=editSection(review,section.key,{name:name.value});refreshPreview();
  });
  const fields=document.createElement("input");
  fields.value=section.fields;fields.setAttribute("aria-label","Comma-separated fields");
  fields.addEventListener("input",()=>{
    review=editSection(review,section.key,{fields:fields.value});refreshPreview();
  });
  const evidence=document.createElement("small");
  evidence.textContent=section.evidence.length
    ? "Evidence: "+section.evidence.join(" / ") : "Added manually by you";
  const fieldsLabel=document.createElement("small");
  fieldsLabel.textContent="Fields (comma-separated, lowercase identifiers)";
  box.append(label,document.createTextNode("Section name"),name,fieldsLabel,fields,evidence);
  if(section.origin==="manual"){
    const remove=document.createElement("button");remove.className="secondary";
    remove.textContent="Remove section";
    remove.addEventListener("click",()=>{
      review=removeSection(review,section.key);renderEditor();refreshPreview();
    });
    box.append(remove);
  }
  return box;
}
function renderEditor(){
  const cards=byId("entity-options");clear(cards);
  for(const section of review.sections)cards.append(editableSection(section));
  byId("app-name").value=review.name;
}
function draft(){return compileReviewedBlueprint(plan,review);}
function refreshPreview() {
  try{
    const blueprint=draft();
    byId("preview").textContent=JSON.stringify(blueprint,null,2);
    byId("download").disabled=false;
    byId("save").disabled=!availableImport();
  }catch(e) {
    byId("preview").textContent=e.message;
    byId("download").disabled=true;
    byId("save").disabled=true;
  }
}
function availableImport(){
  const token=byId("csrf").value;
  return token&&token!=="__MODUVELA_CSRF__"&&location.pathname.startsWith("/microai/");
}
function describe() {
  try{
    plan=proposeBusinessPlan(input.value);
    review=plan.blueprint?beginReview(plan):null;
    byId("design").hidden=false;
    byId("status").textContent=plan.blueprint
      ? "Draft suggestion ready. Select sections and review unresolved requirements."
      : "No safe section suggested. Please clarify what information the application should store.";
    const options=byId("entity-options");clear(options);
    if(review)renderEditor();
    else line(options,"No supported sections detected. Improve the description.");
    const extras=byId("extra-fields");clear(extras);
    for(const f of plan.fieldSuggestions||[])line(extras,f.section+"."+f.field+" — "+f.evidence+" (review/edit above)");
    if(!plan.fieldSuggestions?.length)line(extras,"No additional field suggestions identified.");
    const relations=byId("relationships");clear(relations);
    for(const r of plan.relationships)
      line(relations,r.from+" → "+r.to+": "+r.reason+" (candidate only)");
    if(!plan.relationships.length)line(relations,"No relationships suggested.");
    const unsupported=byId("unsupported");clear(unsupported);
    for(const u of plan.unsupported){
      const details=u.kind==="approval"
        ? " — "+(u.role||"approver unspecified")+(u.condition
          ? "; proposed threshold "+u.condition.operator+" "+u.condition.currency+" "+u.condition.amount
          : "; threshold unspecified")
        : "";
      line(unsupported,u.kind.replace(/_/g," ")+details+" — NOT ACTIVE");
    }
    if(!plan.unsupported.length)line(unsupported,"None identified.");
    const questions=byId("questions");clear(questions);
    for(const q of plan.questions)line(questions,q);
    if(plan.excluded.length)line(questions,"Excluded by wording: "+plan.excluded.map(x=>x.name).join(", ")+". Confirm intent.");
    if(!plan.questions.length&&!plan.excluded.length)line(questions,"No additional question generated; review the sections manually.");
    byId("savehint").textContent=availableImport()
      ? "Import saves this as an UNAPPROVED draft. You will review and activate it separately."
      : "To import directly, open this designer inside the running Moduvela application at http://127.0.0.1:8765/microai/. Standalone preview supports JSON download.";
    const trained=predictCompact(input.value);
    const trainedV2=predictCompactV2(input.value);
    const suggested=trainedV2.filter(x=>x.suggested).map(x=>x.name);
    const deterministic=plan.entities.map(x=>x.name);
    const comparison=byId("trained-model");
    comparison.textContent="MicroAI trained model v2 suggests: "+(suggested.join(", ")||"none")+". " +
      "Rule engine suggests: "+(deterministic.join(", ")||"none")+". "+
      "This is an advisory second opinion trained on synthetic examples. It cannot change the application automatically.";
    const modelAdditions=byId("model-additions");clear(modelAdditions);
    const omitted=suggested.filter(name=>!deterministic.includes(name));
    for(const name of omitted){
      const li=document.createElement("li");
      const excluded=plan.excluded.some(x=>x.name===name);
      const schema=builtinSchemaForEntity(name);
      if(excluded){
        li.textContent=name+": not offered, because you explicitly excluded it in your description.";
      }else if(schema&&review){
        const button=document.createElement("button");button.className="secondary";
        button.type="button";button.textContent="Add "+name+" to draft";
        button.addEventListener("click",()=>{
          try{
            review=includeSuggestedSection(review,schema);
            renderEditor();refreshPreview();
            button.disabled=true;
            byId("status").textContent="Added "+name+" as an editable draft section. Review all fields before saving.";
          }catch(error){byId("status").textContent=error.message;}
        });
        li.append(document.createTextNode("Possible missing section: "+name+". "),button);
      }else li.textContent=name+": review this suggestion manually.";
      modelAdditions.append(li);
    }
    if(!omitted.length)line(modelAdditions,"The trained model found no additional supported sections.");
    byId("diagnostics").textContent=JSON.stringify({
      engine:modelInformation(),compactModel:compactInfo(),compactV2:compactV2Info(),trainedV1Scores:trained,trainedV2Scores:trainedV2,matched:plan.classifier.matches,
      exclusions:plan.excluded,notes:plan.notes
    },null,2);
    refreshPreview();
  }catch(e){
    plan=null;review=null;
    byId("design").hidden=true;
    byId("status").textContent=e.message;
  }
}
function download(){
  const text=JSON.stringify(draft(),null,2);
  const blob=new Blob([text],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;anchor.download="moduvela-blueprint-draft.json";anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function save(){
  if(!availableImport())return;
  const blueprint=JSON.stringify(draft());
  const form=document.createElement("form");
  form.method="POST";form.action="/import-draft";
  for(const [name,value] of Object.entries({
    csrf:byId("csrf").value,blueprint_json:blueprint
  })) {
    const field=document.createElement("input");
    field.type="hidden";field.name=name;field.value=value;form.append(field);
  }
  document.body.append(form);form.submit();
}
byId("analyse").addEventListener("click",describe);
byId("app-name").addEventListener("input",()=>{
  if(!review)return;
  review.name=byId("app-name").value;refreshPreview();
});
byId("add-section").addEventListener("click",()=>{
  if(!review)return;
  try{review=addSection(review);renderEditor();refreshPreview();}
  catch(e){byId("status").textContent=e.message;}
});
byId("download").addEventListener("click",download);
byId("save").addEventListener("click",save);
describe();
