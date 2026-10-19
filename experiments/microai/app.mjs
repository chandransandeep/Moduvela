import { proposeBusinessPlan, reviewedBlueprint } from "./planner.mjs";
import { modelInformation } from "./engine.mjs";
const byId=id=>document.getElementById(id);
const input=byId("description");
let plan=null;

function line(target,text) {
  const li=document.createElement("li");
  li.textContent=text;
  target.append(li);
}
function clear(target){target.replaceChildren();}
function addLabel(name,fields,evidence) {
  const div=document.createElement("div");
  div.className="card";
  const label=document.createElement("label");
  const checkbox=document.createElement("input");
  checkbox.type="checkbox";checkbox.checked=true;checkbox.value=name;
  checkbox.addEventListener("change",refreshPreview);
  label.append(checkbox,document.createTextNode(name));
  const fieldNote=document.createElement("small");
  fieldNote.textContent="Fields: "+fields.join(", ");
  const evidenceNote=document.createElement("small");
  evidenceNote.textContent=evidence.length ? "Evidence: "+evidence.join(" / ") : "Possible section; verify relevance";
  div.append(label,fieldNote,evidenceNote);
  return div;
}
function selected(){
  return [...byId("entity-options").querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);
}
function draft(){return reviewedBlueprint(plan,selected());}
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
    byId("design").hidden=false;
    byId("status").textContent=plan.blueprint
      ? "Draft suggestion ready. Select sections and review unresolved requirements."
      : "No safe section suggested. Please clarify what information the application should store.";
    const options=byId("entity-options");clear(options);
    for(const entity of plan.entities)
      options.append(addLabel(entity.name,entity.fields,entity.evidence));
    if(!plan.entities.length)line(options,"No supported sections detected. Improve the description.");
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
    byId("diagnostics").textContent=JSON.stringify({
      engine:modelInformation(),matched:plan.classifier.matches,
      exclusions:plan.excluded,notes:plan.notes
    },null,2);
    refreshPreview();
  }catch(e){
    plan=null;
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
byId("download").addEventListener("click",download);
byId("save").addEventListener("click",save);
describe();
