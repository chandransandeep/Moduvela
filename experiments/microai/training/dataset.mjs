/** Seeded, labelled synthetic dataset generator for research; NOT independent business data. */
export const LABELS=["Customers","Jobs","Inventory","Appointments","Invoices","Staff","Inspections","Certificates"];
const DOMAINS=["motorcycle workshop","mobile phone repair studio","garden maintenance service","beauty salon","community library","independent tutoring centre","small catering company","plumbing contractor","local charity","medical equipment supplier","vehicle rental business","commercial cleaning company","building inspection practice","e-commerce stationery shop","pet grooming service","bookkeeping office","small furniture workshop","home appliance service","bicycle repair service","event photography business"];
const PHRASES={"Customers":["keep customer names and contact details","record client contact information","maintain a directory of clients","organise member profiles","capture customer addresses","store customer phone numbers","follow up with each client","register people using our services","keep contact cards for our clients","maintain a register of service users"],"Jobs":["track repair jobs from start to finish","record service work orders","manage tasks and their status","coordinate work requests","log work assigned to technicians","track outstanding jobs and completion","follow progress of service tickets","organise active work cases","see which repairs are finished","keep a work queue for pending requests"],"Inventory":["track spare parts and quantities","monitor inventory stock levels","manage materials in storage","record supplies that need reordering","keep a list of items in stock","manage warehouse quantities","count the components we use","track the supplies available on hand","see what material we have left","maintain stock records for replenishment"],"Appointments":["book customer appointments on a calendar","schedule client visits","organise time slots for consultations","handle service bookings","reserve available appointment times","manage customer reservations","track the visit diary","schedule recurring sessions","allocate slots for upcoming bookings","plan individual sessions with start times"],"Invoices":["issue invoices for completed work","record unpaid bills","track customer payments","manage charges and balances","generate invoices for services","follow up on outstanding billing","see which invoices have been settled","maintain a billing register","record payment due amounts","prepare bills for services performed"],"Staff":["manage staff availability and roles","schedule employees on shifts","track workers on the team","assign work to technicians","record staff shift patterns","maintain personnel names and roles","coordinate employee duty schedules","track who is working each day","schedule team members","keep a roster of workers and responsibilities"],"Inspections":["record audit inspections and findings","schedule safety assessments","track compliance inspections","document quality checks","manage site audit results","plan inspection dates and results","record assessment observations","maintain inspection checklists","store inspection outcomes","follow up quality assurance findings"],"Certificates":["issue completion certificates","record certificate reference numbers","track certification documents","maintain a register of issued certificates","prepare certificates after each service","track certificate expiry","log the numbers of completion certificates","record issue dates for certificates","maintain certification evidence","list issued completion documents"]};
const CHALLENGE=[["We run a workshop and maintain the records of everyone bringing a device for repairs.",["Customers","Jobs"]],["Our planners want a diary to reserve places at weekly consultations.",["Appointments"]],["The team counts replacement components and flags low quantities.",["Inventory"]],["We need to know who has paid and what money is still owing.",["Invoices"]],["We distribute people between duty rosters.",["Staff"]],["Our inspectors record compliance findings for each location.",["Inspections"]],["Each finished service needs a completion document with an issued reference.",["Certificates"]],["We don't need customers or billing; track only materials and work orders.",["Inventory","Jobs"]],["The library runs a lending programme and keeps member profiles and reservations.",["Customers","Appointments"]],["Some repairs need approval from a manager before starting.",["Jobs"]],["Track clients, job progress, stock quantities and unpaid balances.",["Customers","Jobs","Inventory","Invoices"]],["A clinic wants appointment slots and records of attendees.",["Appointments","Customers"]],["Our charity volunteers operate shifts and record assessments.",["Staff","Inspections"]],["We sell household products and track warehouse stock and customer details.",["Inventory","Customers"]],["We conduct yearly safety reviews and issue formal compliance certificates.",["Inspections","Certificates"]],["Manage visits and invoices without keeping staff records.",["Appointments","Invoices"]],["We want a dashboard showing only how many visitors use our website.",[]],["Blue oceans look pretty and contain many underwater animals.",[]],["We need an app for capturing repair tickets and sending a bill to the customer.",["Jobs","Invoices","Customers"]],["Every assessment produces a signed certificate and a record of the result.",["Inspections","Certificates"]],["The studio allocates shifts to employees and keeps a booking diary.",["Staff","Appointments"]],["Keep a customer directory and all of their bookings, invoices and payments.",["Customers","Appointments","Invoices"]],["The workshop prepares spare-parts orders, records repairs and tracks shift availability.",["Inventory","Jobs","Staff"]],["Our event organiser needs customers, appointment bookings and certificates.",["Customers","Appointments","Certificates"]]];
function makeCorpus() {
  function rng(seed){let state=seed>>>0;return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
  function make(split,count,domainStart,domainEnd,variants,seed){
    const random=rng(seed), result=[];
    const unknown=["make a guide to constellations in the night sky","think about quiet beaches and changing seasons","write a story about mountains and rivers","prepare a poster showing the planets"];
    for(let i=0;i<count;i++){
      const domain=DOMAINS[domainStart+Math.floor(random()*(domainEnd-domainStart))];
      const empty=i%15===0;
      const n=empty?0:1+Math.floor(random()*3);
      const picked=new Set();
      while(picked.size<n)picked.add(LABELS[Math.floor(random()*LABELS.length)]);
      const selected=[...picked].sort();
      const pieces=selected.map(label=>{
        const list=PHRASES[label], ix=variants[Math.floor(random()*variants.length)];
        return list[ix];
      });
      let text=empty ? unknown[Math.floor(random()*unknown.length)]
        :"Our "+domain+" needs to "+pieces.join(i%2?", and ":"; also ");
      if(i%9===0&&!empty)text+=". The team wants a simple daily overview.";
      result.push({id:split+"-"+String(i+1).padStart(4,"0"),
        scenario_group:split+"-"+String(i+1).padStart(4,"0"),
        sector:domain,description:text,labels:selected,
        relationship_labels:[],rule_labels:[],source:"synthetic_constructed",
        split});
    }
    return result;
  }
  return {
    train:make("train",480,0,12,[0,1,2,3,4,5],101),
    validation:make("validation",120,12,16,[6,7],202),
    test:make("test",120,16,20,[8,9],303),
    challenge:CHALLENGE.map(([description,labels],i)=>({
      id:"challenge-"+String(i+1).padStart(3,"0"),
      scenario_group:"challenge-"+(i+1),sector:"mixed",description,labels,
      relationship_labels:[],rule_labels:[],source:"hand_authored_heldout",
      split:"challenge"
    }))
  };
}
export const CORPUS=makeCorpus();
