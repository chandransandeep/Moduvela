/** Reviewed business record catalog for optional semantic suggestions.
 * Every schema uses identifiers accepted by the Python Blueprint v1 engine.
 * Semantic similarity never creates an application without explicit human review.
 */
export const CATALOG = Object.freeze([
 {name:"Farms",fields:["farm_name","location","contact","status"],examples:["connect local vertical farms and urban growers","register producers and farms supplying fresh food","record agricultural farms and producer contacts"]},
 {name:"HarvestBatches",fields:["farm","product","harvest_date","quantity"],examples:["track today's harvest batches from farms","record produce harvest quantities and harvest dates","track harvested crops and lot origins"]},
 {name:"Orders",fields:["customer","order_date","status","delivery_date"],examples:["accept customer orders for food deliveries","manage orders placed by shops and households","fulfil incoming orders for business customers"]},
 {name:"DeliveryRoutes",fields:["route_name","delivery_date","driver","status"],examples:["plan delivery routes and driver schedules","organise last-mile routes for delivery stops","track courier routes and drop-off sequences"]},
 {name:"FarmProducts",fields:["farm","product_name","unit","availability"],examples:["catalogue fresh vegetables and herbs grown locally","record farm-grown products by producer","list available crops sold by farms"]},
 {name:"Customers",fields:["name","phone","notes"],examples:["record customers, clients and contact details","manage members and contact profiles","keep a client directory"]},
 {name:"Jobs",fields:["customer","description","status","due_date"],examples:["track repair jobs and their progress","manage work orders and service tasks","create work tickets for technicians"]},
 {name:"Inventory",fields:["item_name","quantity","reorder_level"],examples:["track inventory and quantities in stock","manage spare parts and supplies","monitor available materials"]},
 {name:"Appointments",fields:["customer","date","time","service"],examples:["manage appointment bookings","schedule client meetings and calendar visits","reserve time slots for sessions"]},
 {name:"Invoices",fields:["customer","amount","status"],examples:["issue invoices and manage billing","track customer payments and unpaid bills","record charges for completed work"]},
 {name:"Staff",fields:["name","role","availability"],examples:["organise employee shifts and roles","schedule technicians and workers","track team availability"]},
 {name:"Inspections",fields:["customer","check_type","due_date","result"],examples:["manage safety inspections and audits","record compliance assessments","track quality checks and findings"]},
 {name:"Certificates",fields:["job","certificate_number","issued_date","status"],examples:["issue completion certificates","record certificate references and expiry","maintain certification documents"]},
 {name:"Vehicles",fields:["registration","model","customer","notes"],examples:["track vehicles checked into a garage","keep a fleet register with registration numbers","manage cars, vans and servicing history"]},
 {name:"Assets",fields:["asset_name","serial_number","location","status"],examples:["register business equipment and assets","track machines and ownership","manage tagged equipment and device assets"]},
 {name:"Projects",fields:["project_name","owner","status","deadline"],examples:["manage projects with milestones","track project delivery and project owners","plan client projects and deadlines"]},
 {name:"Leads",fields:["lead_name","contact","stage","source"],examples:["manage sales leads and prospects","record business enquiries and lead stages","follow up potential customers"]},
 {name:"Quotes",fields:["customer","description","amount","status"],examples:["prepare price quotations and estimates","send quotes before work starts","track accepted and rejected estimates"]},
 {name:"Suppliers",fields:["name","contact","lead_time","notes"],examples:["maintain a directory of vendors and suppliers","manage supplier contact records","record supply partners and lead times"]},
 {name:"PurchaseOrders",fields:["supplier","order_number","amount","status"],examples:["raise purchase orders to suppliers","approve purchase order requests","track orders placed with vendors"]},
 {name:"Deliveries",fields:["order","tracking_number","delivery_date","status"],examples:["track deliveries and parcels","dispatch shipped orders and track delivery dates","manage couriers and package arrivals"]},
 {name:"Products",fields:["product_name","sku","price","description"],examples:["maintain a product catalogue with prices","list items for sale and stock keeping units","manage merchandise product records"]},
 {name:"Rentals",fields:["customer","asset","start_date","end_date"],examples:["manage equipment rentals and hire agreements","track hire returns and rental dates","lend assets to customers and record returns"]},
 {name:"Subscriptions",fields:["customer","plan","renewal_date","status"],examples:["track recurring subscriptions and renewals","manage membership plans and renewal dates","record active service subscriptions"]},
 {name:"Timesheets",fields:["staff","work_date","hours","job"],examples:["record employee timesheets and hours","track hours spent on work orders","manage weekly staff time entries"]},
 {name:"Expenses",fields:["employee","expense_date","amount","category"],examples:["record expenses and reimbursements","capture business spending and expense claims","track employee expense reports"]},
 {name:"Incidents",fields:["reported_by","description","severity","status"],examples:["log safety incidents and investigations","record reported workplace incidents","track problems and corrective action"]},
 {name:"Courses",fields:["course_name","trainer","start_date","capacity"],examples:["organise training courses and classes","manage workshops and training sessions","keep a register of courses offered"]},
 {name:"Bookings",fields:["customer","resource","start_time","end_time"],examples:["reserve rooms or equipment by timeslot","manage venue and resource bookings","allocate spaces for sessions"]}
]);
export function schemaFor(name){
 const item=CATALOG.find(x=>x.name===name);
 return item?{name:item.name,fields:[...item.fields]}:null;
}
