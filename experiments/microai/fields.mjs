/** Evidence-backed field suggestions; ambiguous ones become questions. */
const HINTS=[
{name:"serial_number",pattern:/\bserial\s*(?:numbers?|nos?\.?|#)\b/i,targets:["Jobs","Inventory"]},
{name:"warranty_date",pattern:/\b(?:warranty\s+(?:expiry\s+)?date|warranty\s+expiration)\b/i,targets:["Jobs","Inventory"]},
{name:"repair_cost",pattern:/\b(?:repair\s+costs?|repair\s+prices?|repair\s+values?)\b/i,targets:["Jobs"]},
{name:"estimated_cost",pattern:/\b(?:estimated\s+cost|cost\s+estimate|estimated\s+price)\b/i,targets:["Jobs"]},
{name:"customer_email",pattern:/\b(?:customer\s+email|client\s+email|email\s+address(?:es)?)\b/i,targets:["Customers"]},
{name:"postcode",pattern:/\b(?:postcodes?|zip\s+codes?|postal\s+codes?)\b/i,targets:["Customers"]},
{name:"certificate_expiry",pattern:/\b(?:certificate\s+expir(?:y|ation)|certification\s+expiry)\b/i,targets:["Certificates"]}
];
const CONTEXT={
Jobs:/\b(?:repair|jobs?|work[ -]?orders?|vehicles?|drone)\b/i,
Inventory:/\b(?:stock|inventory|spare\s+parts?|materials?|warehouse)\b/i,
Customers:/\b(?:customers?|clients?|members?|contacts?)\b/i,
Certificates:/\b(?:certificates?|certification)\b/i
};
const NEGATE=/\b(?:no|not|without|exclude|avoid|don't\s+(?:want|need)|do\s+not\s+(?:want|need))\s+(?:the\s+|any\s+)?$/i;
export function suggestFields(text,entities){
 if(typeof text!=="string"||!Array.isArray(entities))throw Error("Invalid field proposal input");
 const sections=entities.map(e=>({...e,fields:[...e.fields]}));
 const details=[],questions=[];
 const chunks=text.split(/[.!?;\n]+|,(?=\s+[a-z])/gi).map(x=>x.trim()).filter(Boolean).slice(0,100);
 for(const chunk of chunks){
  for(const hint of HINTS){
   const match=chunk.match(hint.pattern);
   if(!match)continue;
   if(NEGATE.test(chunk.slice(0,match.index)))continue;
   const candidates=sections.filter(e=>hint.targets.includes(e.name));
   if(!candidates.length)continue;
   const context=candidates.filter(e=>CONTEXT[e.name].test(chunk));
   const target=context.length===1?context[0]:
     context.length===0&&candidates.length===1?candidates[0]:null;
   if(!target){
    const q="Where should “"+hint.name+"” be stored: "+candidates.map(e=>e.name).join(" or ")+"?";
    if(!questions.includes(q))questions.push(q);
    continue;
   }
   if(target.fields.includes(hint.name))continue;
   if(target.fields.length>=20){questions.push("Field limit reached for "+target.name);continue;}
   target.fields.push(hint.name);
   details.push({section:target.name,field:hint.name,evidence:chunk,reviewRequired:true});
  }
 }
 return {entities:sections,suggestions:details,questions};
}
