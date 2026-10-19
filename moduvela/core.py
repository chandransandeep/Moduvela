"""Safe deterministic business blueprint compiler for the Moduvela prototype."""
import re
import json
import sqlite3
from datetime import datetime, timezone

TEMPLATES = {
 'garage': [('Customers',['name','phone']),('Vehicles',['registration','make','customer']),('Jobs',['vehicle','description','status','assigned_to']),('Parts',['part_name','quantity']),('Invoices',['job','amount','status'])],
 'audit': [('Clients',['name','contact']),('Audits',['client','audit_type','due_date','status']),('Evidence',['audit','document_reference','status'])],
 'salon': [('Customers',['name','phone']),('Appointments',['customer','service','appointment_date','staff','status']),('Services',['service','price'])],
 'general': [('Customers',['name','contact']),('Jobs',['customer','description','due_date','status']),('Invoices',['customer','amount','status'])],
}
KEYWORDS = {'garage':['garage','mechanic','vehicle','repair','motor'], 'audit':['audit','inspection','compliance','certificate'], 'salon':['salon','beauty','hair','barber']}
RESERVED={'id','created_at','updated_at'}

def compile_blueprint(description: str) -> dict:
    """Create a reviewable blueprint from text; no external AI calls or dynamic code."""
    description=description.strip()
    if len(description)<12 or len(description)>5000:
        raise ValueError('Please describe your business in 12 to 5000 characters')
    lower=description.lower()
    category=max(KEYWORDS, key=lambda key:sum(lower.count(word) for word in KEYWORDS[key]))
    if not sum(lower.count(word) for word in KEYWORDS[category]): category='general'
    return {'version':1,'name':{'garage':'Garage Operations','audit':'Audit & Compliance','salon':'Salon Operations','general':'Business Operations'}[category],
            'category':category,'description':description,'entities':[{'name':name,'fields':fields} for name,fields in TEMPLATES[category]],
            'status':'proposal','limitations':['Suggested fields require owner approval','No external integrations are configured','Personal data requires privacy review']}

def validate_blueprint(blueprint: dict) -> None:
    if blueprint.get('version')!=1: raise ValueError('Unsupported blueprint version')
    entities=blueprint.get('entities')
    if not isinstance(entities,list) or not 1<=len(entities)<=12: raise ValueError('Invalid number of entities')
    names=[]
    for item in entities:
        name=item.get('name','')
        fields=item.get('fields',[])
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,39}',name) or name.lower() in names: raise ValueError('Invalid or duplicate entity')
        names.append(name.lower())
        if not isinstance(fields,list) or not 1<=len(fields)<=20 or len(fields)!=len(set(fields)): raise ValueError('Invalid fields')
        for field in fields:
            if not re.fullmatch(r'[a-z][a-z0-9_]{0,39}',field) or field in RESERVED: raise ValueError('Invalid field name')

def init_db(path: str):
    conn=sqlite3.connect(path)
    conn.row_factory=sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.executescript('''CREATE TABLE IF NOT EXISTS blueprints(id INTEGER PRIMARY KEY, payload TEXT NOT NULL, approved_at TEXT);
    CREATE TABLE IF NOT EXISTS records(id INTEGER PRIMARY KEY, blueprint_id INTEGER NOT NULL, entity TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
       FOREIGN KEY (blueprint_id) REFERENCES blueprints(id));''')
    return conn

def store_proposal(conn, blueprint):
    validate_blueprint(blueprint)
    with conn:
        cur=conn.execute('INSERT INTO blueprints(payload) VALUES (?)',(json.dumps(blueprint),))
    return cur.lastrowid

def load_blueprint(conn, ident):
    row=conn.execute('SELECT * FROM blueprints WHERE id=?',(ident,)).fetchone()
    if row is None: raise ValueError('Blueprint not found')
    return dict(row),json.loads(row['payload'])

def approve(conn, ident):
    row, blueprint=load_blueprint(conn,ident)
    validate_blueprint(blueprint)
    with conn: conn.execute('UPDATE blueprints SET approved_at=? WHERE id=? AND approved_at IS NULL',(datetime.now(timezone.utc).isoformat(),ident))

def add_record(conn, ident, entity, values):
    row,blueprint=load_blueprint(conn,ident)
    if not row['approved_at']: raise ValueError('Blueprint must be approved first')
    allowed=next((x['fields'] for x in blueprint['entities'] if x['name']==entity),None)
    if allowed is None: raise ValueError('Unknown entity')
    if not isinstance(values,dict) or any(k not in allowed for k in values): raise ValueError('Unknown field')
    clean={field:str(values.get(field,''))[:500] for field in allowed}
    with conn:
        cur=conn.execute('INSERT INTO records(blueprint_id,entity,payload,created_at) VALUES (?,?,?,?)',
          (ident,entity,json.dumps(clean),datetime.now(timezone.utc).isoformat()))
    return cur.lastrowid
