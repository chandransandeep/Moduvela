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

def add_custom_entity(conn, ident: int, name: str, fields: list[str]) -> None:
    """Add a validated section to a proposal; never modify approved applications."""
    row, blueprint = load_blueprint(conn, ident)
    if row['approved_at']:
        raise ValueError('Approved applications cannot be modified in this prototype')
    if not isinstance(fields, list):
        raise ValueError('Invalid fields')
    draft = dict(blueprint)
    draft['entities'] = [dict(e) for e in blueprint['entities']]
    draft['entities'].append({
        'name': name.strip(),
        'fields': [f.strip().lower() for f in fields],
    })
    validate_blueprint(draft)
    with conn:
        conn.execute('UPDATE blueprints SET payload=? WHERE id=? AND approved_at IS NULL',
                     (json.dumps(draft), ident))


def add_custom_fields(conn, ident: int, entity_name: str, fields: list[str]) -> None:
    """Extend a proposal's entity with new user-defined fields."""
    row, blueprint = load_blueprint(conn, ident)
    if row['approved_at']:
        raise ValueError('Approved applications cannot be modified in this prototype')
    if not isinstance(fields, list) or not fields:
        raise ValueError('Invalid fields')
    draft = dict(blueprint)
    draft['entities'] = [{'name': e['name'], 'fields': list(e['fields'])}
                         for e in blueprint['entities']]
    target = next((e for e in draft['entities'] if e['name'] == entity_name), None)
    if target is None:
        raise ValueError('Unknown entity')
    target['fields'].extend(f.strip().lower() for f in fields)
    validate_blueprint(draft)
    with conn:
        conn.execute('UPDATE blueprints SET payload=? WHERE id=? AND approved_at IS NULL',
                     (json.dumps(draft), ident))

def create_manual_blueprint(name: str, description: str, entity: str, fields: list[str]) -> dict:
    """Offline visual-wizard entry point: build an app without templates or AI."""
    name = name.strip()
    description = description.strip()
    if not 1 <= len(name) <= 70:
        raise ValueError('Application name must be between 1 and 70 characters')
    if not 12 <= len(description) <= 5000:
        raise ValueError('Business description must be 12 to 5000 characters')
    if not isinstance(fields, list):
        raise ValueError('Invalid fields')
    blueprint = {
        'version': 1, 'name': name, 'category': 'custom',
        'description': description, 'status': 'proposal',
        'entities': [{'name': entity.strip(),
                      'fields': [f.strip().lower() for f in fields]}],
        'limitations': ['Manual offline configuration, no AI',
                        'No user authentication or production security'],
    }
    validate_blueprint(blueprint)
    return blueprint

def validate_imported_blueprint(payload: dict) -> dict:
    """Accept only safe Blueprint v1 *draft data* from the local browser.

    Unsupported extensions (especially workflow or executable definitions)
    are rejected rather than copied into the persisted proposal.
    """
    if not isinstance(payload, dict):
        raise ValueError("Expected a blueprint object")
    allowed = {'version', 'name', 'category', 'description',
               'status', 'entities', 'limitations'}
    if set(payload) - allowed:
        raise ValueError("Unsupported blueprint properties")
    name = payload.get('name')
    description = payload.get('description')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 70:
        raise ValueError("Invalid application name")
    if not isinstance(description, str) or not 12 <= len(description) <= 5000:
        raise ValueError("Invalid business description")
    if payload.get('version') != 1 or payload.get('category') != 'custom':
        raise ValueError("Only custom blueprint version 1 is accepted")
    if payload.get('status') != 'proposal':
        raise ValueError("Only unapproved proposals may be imported")
    limits = payload.get('limitations', [])
    if not isinstance(limits, list) or len(limits) > 12 or any(
            not isinstance(x, str) or len(x) > 350 for x in limits):
        raise ValueError("Invalid limitation details")
    entities = payload.get('entities')
    if not isinstance(entities, list):
        raise ValueError("Invalid entity list")
    if any(not isinstance(item, dict) or
           set(item) != {'name','fields'} for item in entities):
        raise ValueError("Unsupported entity properties")
    result = {
        'version': 1, 'name': name.strip(), 'category': 'custom',
        'description': description, 'status': 'proposal',
        'entities': entities,
        'limitations': limits + ['Imported from local MicroAI as draft; owner review required']
    }
    validate_blueprint(result)
    return result
