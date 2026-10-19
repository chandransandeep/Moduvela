/** Independently-authored-by-project diagnostic annotation cards.
 * Synthetic text only. NOT independently annotated by external experts.
 * Used for design regression, not training the classification model.
 */
export const DESIGN_CASES=[
{sector:"drone repair",text:"When a drone is left for repair, record the customer and the job. Each job belongs to its customer and finished jobs get a numbered certificate. Expensive repairs over £500 need manager approval.",entities:["Customers","Jobs","Certificates"],links:[["Customers","Jobs"],["Jobs","Certificates"]],rules:[{kind:"approval",role:"Manager",subject:"Jobs",currency:"GBP",amount:500}],excluded:[]},
{sector:"drone repair",text:"We track spare rotor stock against drone repair jobs. Parts used by each job must be linked back to stock.",entities:["Inventory","Jobs"],links:[["Jobs","Inventory"]],rules:[],excluded:[]},
{sector:"home plumbing",text:"Record customer profiles and book visits for every customer, then create service jobs. No invoicing in this system.",entities:["Customers","Appointments","Jobs"],links:[["Customers","Appointments"],["Customers","Jobs"]],rules:[],excluded:["Invoices"]},
{sector:"home plumbing",text:"The field technicians must have shifts, and service work must be assigned to an employee.",entities:["Staff","Jobs"],links:[["Staff","Jobs"]],rules:[{kind:"assignment",subject:"Jobs"}],excluded:[]},
{sector:"hair salon",text:"Customers reserve appointment slots with our stylists, and each appointment is for a customer.",entities:["Customers","Appointments","Staff"],links:[["Customers","Appointments"]],rules:[],excluded:[]},
{sector:"hair salon",text:"We invoice clients for their appointment services and keep the bills linked to client profiles.",entities:["Customers","Appointments","Invoices"],links:[["Customers","Invoices"]],rules:[],excluded:[]},
{sector:"compliance audit",text:"Track inspection cases for companies, with findings and an issued certificate for each passed inspection.",entities:["Customers","Inspections","Certificates"],links:[],rules:[{kind:"certificate_generation",subject:"Inspections"}],excluded:[]},
{sector:"compliance audit",text:"Our clients need annual safety audits and reminders before renewal. Staff sign off the findings.",entities:["Customers","Inspections","Staff"],links:[],rules:[{kind:"reminder",subject:"Inspections"},{kind:"approval",subject:"Inspections",role:null}],excluded:[]},
{sector:"small manufacturer",text:"Keep raw material inventory and associate materials consumed with every production job.",entities:["Inventory","Jobs"],links:[["Jobs","Inventory"]],rules:[],excluded:[]},
{sector:"small manufacturer",text:"A supervisor must approve production jobs costing more than $1000. Store jobs and parts.",entities:["Jobs","Inventory"],links:[],rules:[{kind:"approval",role:"Supervisor",subject:"Jobs",currency:"USD",amount:1000}],excluded:[]},
{sector:"charity",text:"We record members using the service, and staff appointments booked against the member.",entities:["Customers","Staff","Appointments"],links:[["Customers","Appointments"]],rules:[],excluded:[]},
{sector:"charity",text:"Volunteer shifts must be tracked. We do not issue invoices or collect payments.",entities:["Staff"],links:[],rules:[],excluded:["Invoices"]},
{sector:"vehicle garage",text:"Our repairs have a customer record, an assigned mechanic, and a work order status.",entities:["Customers","Staff","Jobs"],links:[["Customers","Jobs"],["Staff","Jobs"]],rules:[],excluded:[]},
{sector:"vehicle garage",text:"When work completes, issue a certificate for the job; track spare parts used on that job.",entities:["Jobs","Certificates","Inventory"],links:[["Jobs","Certificates"],["Jobs","Inventory"]],rules:[{kind:"certificate_generation",subject:"Jobs"}],excluded:[]},
{sector:"tutoring",text:"Schedule lessons with students and track each student's contact details.",entities:["Appointments","Customers"],links:[["Customers","Appointments"]],rules:[],excluded:[]},
{sector:"tutoring",text:"Our teachers have their staff schedules and send invoices to student families.",entities:["Staff","Invoices","Customers"],links:[["Customers","Invoices"]],rules:[],excluded:[]},
{sector:"equipment rental",text:"Track physical equipment stock, customers, and booking reservations. A booking belongs to a client.",entities:["Inventory","Customers","Appointments"],links:[["Customers","Appointments"]],rules:[],excluded:[]},
{sector:"equipment rental",text:"Expensive equipment hire requires a manager's approval for amounts above £200.",entities:["Inventory"],links:[],rules:[{kind:"approval",role:"Manager",subject:"Inventory",currency:"GBP",amount:200}],excluded:[]},
{sector:"pet grooming",text:"Each owner has an appointment at the grooming salon, and the owner contact details need storing.",entities:["Customers","Appointments"],links:[["Customers","Appointments"]],rules:[],excluded:[]},
{sector:"pet grooming",text:"We invoice the customer after an appointment and track paid or unpaid bills.",entities:["Invoices","Customers","Appointments"],links:[["Customers","Invoices"]],rules:[],excluded:[]},
{sector:"property management",text:"Residents submit maintenance work orders against their property accounts.",entities:["Customers","Jobs"],links:[["Customers","Jobs"]],rules:[],excluded:[]},
{sector:"property management",text:"The property service team needs notifications when a maintenance job is overdue.",entities:["Staff","Jobs"],links:[],rules:[{kind:"reminder",subject:"Jobs"}],excluded:[]},
{sector:"restaurant",text:"Count ingredients in inventory and plan staff shift coverage.",entities:["Inventory","Staff"],links:[],rules:[],excluded:[]},
{sector:"restaurant",text:"We need reservations for customers, but no invoicing or billing tools.",entities:["Customers","Appointments"],links:[["Customers","Appointments"]],rules:[],excluded:["Invoices"]},
{sector:"school club",text:"Club members need profiles and session reservations, including attendance dates.",entities:["Customers","Appointments"],links:[["Customers","Appointments"]],rules:[],excluded:[]},
{sector:"school club",text:"Staff manage inspection checklists for facilities and record signed certificates.",entities:["Staff","Inspections","Certificates"],links:[],rules:[],excluded:[]},
{sector:"electrical service",text:"Log jobs linked to clients; once a service is done issue a completion certificate.",entities:["Jobs","Customers","Certificates"],links:[["Customers","Jobs"],["Jobs","Certificates"]],rules:[{kind:"certificate_generation",subject:"Jobs"}],excluded:[]},
{sector:"electrical service",text:"The supervisor must approve jobs above €750 before assignment.",entities:["Jobs","Staff"],links:[["Staff","Jobs"]],rules:[{kind:"approval",role:"Supervisor",subject:"Jobs",currency:"EUR",amount:750}],excluded:[]},
{sector:"wholesale distributor",text:"Manage warehouse stock, outgoing customer orders and invoice billing.",entities:["Inventory","Customers","Invoices"],links:[["Customers","Invoices"]],rules:[],excluded:[]},
{sector:"wholesale distributor",text:"Our warehouse crew count parts and receive low-stock alerts.",entities:["Staff","Inventory"],links:[],rules:[{kind:"reminder",subject:"Inventory"}],excluded:[]},
{sector:"field photography",text:"Book client photo sessions and invoice the client afterwards.",entities:["Customers","Appointments","Invoices"],links:[["Customers","Appointments"],["Customers","Invoices"]],rules:[],excluded:[]},
{sector:"field photography",text:"Our photographers need staffing schedules and event appointments.",entities:["Staff","Appointments"],links:[],rules:[],excluded:[]},
{sector:"sports centre",text:"Store member contact details and class bookings associated with each member.",entities:["Customers","Appointments"],links:[["Customers","Appointments"]],rules:[],excluded:[]},
{sector:"sports centre",text:"The equipment stock room tracks quantities and scheduled safety inspections.",entities:["Inventory","Inspections"],links:[],rules:[],excluded:[]},
{sector:"furniture maker",text:"Keep manufacturing work jobs, stocks of timber, and job invoices for clients.",entities:["Jobs","Inventory","Invoices","Customers"],links:[["Customers","Jobs"],["Customers","Invoices"]],rules:[],excluded:[]},
{sector:"furniture maker",text:"The manager must approve bespoke production jobs exceeding £2,000 before work starts.",entities:["Jobs"],links:[],rules:[{kind:"approval",role:"Manager",subject:"Jobs",currency:"GBP",amount:2000}],excluded:[]}
];
export const ANNOTATION_SCHEMA={
 version:1,
 description:"Synthetic scenario annotations: expected record entities, explicitly requested relationship pairs, non-executable rule intents, and entity exclusions.",
 note:"Not independently labelled by external business owners, not real-world validated, and not a benchmark for deployment.",
 held_out_from_training:true
};
