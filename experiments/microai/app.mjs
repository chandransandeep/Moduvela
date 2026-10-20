import { proposeBusinessPlan, reviewedBlueprint } from "./planner.mjs";
import { modelInformation,builtinSchemaForEntity } from "./engine.mjs";
import {predictCompact,compactInfo} from "./trained.mjs";
import {predictCompactV2,compactV2Info} from "./trained_v2.mjs";
import {loadLocalSemantic,SEMANTIC_OPTIONS} from "./semantic.mjs";
import {schemaFor} from "./semantic_catalog.mjs";
import {loadLocalGenerator,DEEP_MODELS} from "./generative.mjs";
import {beginReview,editSection,addSection,removeSection,compileReviewedBlueprint,includeSuggestedSection} from "./review.mjs";
const byId=id=>document.getElementById(id);
const input=byId("description");
let plan=null;
let review=null;
let semanticRuntime=null;
let semanticDevice=null;
let deepGenerator=null;
let deepTier=null;

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
function renderSemantic(scores,originalDescription){
 const list=byId("semantic-suggestions");clear(list);
 const excluded=plan?.excluded?.map(x=>x.name)||[];
 // Rank alone is not calibration; all suggestions require explicit opt-in.
 for(const candidate of scores.slice(0,8)){
  const item=document.createElement("li");
  const score=document.createElement("span");
  score.textContent=candidate.name+" — cosine similarity "+candidate.score.toFixed(3)+
     " (not a probability). Matched: "+candidate.closestExample+". ";
  item.append(score);
  const explicitlyExcluded=excluded.includes(candidate.name)||
   new RegExp("\\b(?:no|without|exclude|do not need|don't need)\\s+(?:any\\s+)?"+
     candidate.name.toLowerCase()+"\\b","i").test(originalDescription);
  const already=review?.sections?.some(x=>x.name===candidate.name);
  const schema=schemaFor(candidate.name);
  if(explicitlyExcluded){
   item.append(document.createTextNode("Excluded by your requirements."));
  }else if(already){
   item.append(document.createTextNode("Already in draft."));
  }else if(schema&&review){
   const button=document.createElement("button");
   button.className="secondary";button.type="button";
   button.textContent="Add "+candidate.name+" to draft";
   button.addEventListener("click",()=>{
    try{
     review=includeSuggestedSection(review,schema);
     renderEditor();refreshPreview();button.disabled=true;
     byId("status").textContent="Added "+candidate.name+". Check the suggested fields before saving.";
    }catch(error){byId("status").textContent=error.message;}
   });
   item.append(button);
  }else item.append(document.createTextNode("Review this manually."));
  list.append(item);
 }
}
async function runEnhanced(){
 const button=byId("semantic-run"),status=byId("semantic-status");
 const device=byId("semantic-device").value;
 const description=input.value;
 button.disabled=true;
 const started=performance.now();
 try{
  if(device==="webgpu"&&!navigator.gpu)
   throw Error("WebGPU unavailable in this browser. Select CPU (WebAssembly).");
  if(!semanticRuntime||semanticDevice!==device){
   semanticRuntime?.dispose?.();semanticRuntime=null;
   status.textContent="Downloading/loading an optional third-party model locally. "+
     "This may take time and use tens of MB; input text is not sent to an inference API.";
   semanticRuntime=await loadLocalSemantic({device});
   semanticDevice=device;
  }
  status.textContent="Computing local sentence embeddings and matching business concepts…";
  const ranking=await semanticRuntime.analyze(description);
  if(description!==input.value){
   status.textContent="The description changed. Run enhanced analysis again to avoid stale suggestions.";
   return;
  }
  if(!plan?.blueprint){
   status.textContent="The rule-based interpreter has no draft yet. Clarify the description before adding sections.";
  }else{
   renderSemantic(ranking,description);
   status.textContent="Matched "+ranking.length+" catalog concepts in "+
     ((performance.now()-started)/1000).toFixed(1)+" seconds (including model loading). "+
     "These matches are unvalidated and will never be applied automatically.";
  }
 }catch(err){
  status.textContent="Enhanced model unavailable: "+err.message+
    ". The normal offline designer is unaffected.";
 }finally{button.disabled=false;}
}
byId("semantic-run").addEventListener("click",runEnhanced);
async function runDeep(){
 const button=byId("deep-run"),status=byId("deep-status");
 const description=input.value;
 const selectedTier=byId("deep-model-tier").value;
 const tier=DEEP_MODELS[selectedTier];
 if(!tier){status.textContent="Invalid model tier";return;}
 if(!navigator.gpu){
  status.textContent="WebGPU is unavailable. Standard and CPU semantic modes remain available.";
  return;
 }
 if(!window.confirm("This experimental WebGPU model may download around "+tier.weightsMB+" MB of weights plus other assets, "+
   "use substantial GPU memory, and may fail or run slowly. "+
   "Model/runtime hosting can see download metadata but descriptions are inferred locally. Continue?"))return;
 button.disabled=true;
 const start=performance.now();
 try{
  if(!deepGenerator||deepTier!==selectedTier){
   deepGenerator?.dispose?.();deepGenerator=null;
   status.textContent="Loading local "+tier.description+". Download may be very large; please wait…";
   deepGenerator=await loadLocalGenerator({modelSize:selectedTier});
   deepTier=selectedTier;
  }
  status.textContent="Generating a candidate business data design on this device…";
  const output=await deepGenerator.propose(description);
  if(input.value!==description){
   status.textContent="Description changed while processing. Run again to avoid stale output.";
   return;
  }
  const list=byId("deep-results");clear(list);
  if(!plan?.blueprint&&output.entities.length){
   plan={...plan,blueprint:{
     version:1,name:"Custom Business Operations",category:"custom",
     description,status:"proposal",entities:[],
     limitations:["Generated locally from unverified model output; human review required"]
   }};
   review=beginReview(plan);
   byId("design").hidden=false;
   renderEditor();
  }
  for(const candidate of output.entities){
   const item=document.createElement("li");
   item.append(document.createTextNode(candidate.name+
     " — "+candidate.fields.join(", ")+". "));
   const excluded=plan?.excluded?.some(x=>x.name===candidate.name);
   const already=review?.sections?.some(x=>x.name.toLowerCase()===candidate.name.toLowerCase());
   if(excluded){item.append(document.createTextNode("Excluded by your description."));}
   else if(already){item.append(document.createTextNode("Already in draft."));}
   else if(review){
    const button=document.createElement("button");
    button.className="secondary";button.type="button";
    button.textContent="Add "+candidate.name+" for review";
    button.addEventListener("click",()=>{
     try{
      review=includeSuggestedSection(review,candidate);
      renderEditor();refreshPreview();button.disabled=true;
      byId("status").textContent="Added "+candidate.name+" to draft. Check all fields.";
     }catch(error){byId("status").textContent=error.message;}
    });
    item.append(button);
   }
   list.append(item);
  }
  status.textContent="Local model suggested "+output.entities.length+
    " editable section(s) in "+((performance.now()-start)/1000).toFixed(1)+
    " seconds (including load). None were applied automatically.";
 }catch(error){
  status.textContent="Local generation unavailable or output rejected: "+error.message+
    ". Your ordinary blueprint is unchanged.";
 }finally{button.disabled=false;}
}
byId("deep-run").addEventListener("click",runDeep);
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
