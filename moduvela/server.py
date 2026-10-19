"""Loopback-only demo web interface. Not intended for production or Internet exposure."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
import html
import os
import secrets
from .core import init_db, compile_blueprint, store_proposal, load_blueprint, approve, add_record

DB=os.environ.get('MODUVELA_DB','moduvela.db')
TOKEN=secrets.token_urlsafe(32)
conn=None

def esc(v):return html.escape(str(v),quote=True)

def page(content):
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moduvela Prototype</title>
    <style>body{font:16px system-ui;background:#f4f6f9;color:#1d2734;max-width:900px;margin:3rem auto;padding:0 1rem}main{background:white;padding:2rem;border-radius:18px;box-shadow:0 6px 30px #0b233014}textarea,input{box-sizing:border-box;width:100%;padding:.8rem;margin:.35rem 0 1rem;border:1px solid #b6c4d0;border-radius:9px}button,.button{background:#175caa;color:white;border:0;border-radius:9px;padding:.75rem 1.1rem;cursor:pointer;text-decoration:none}section{border-top:1px solid #dde4ed;padding-top:1rem;margin-top:1.5rem}small{color:#596777}.alert{background:#fff5db;padding:1rem;border-radius:9px}</style>
    <main><h1>Moduvela <small>v0.1</small></h1><p>Describe → review → approve → use your custom forms</p>''' + content + '''<footer><section><small>Local prototype only. No authentication, remote AI, payments or integrations. Use fictional data.</small></section></footer></main></html>'''

class Handler(BaseHTTPRequestHandler):
    def send(self,body,code=200):
        encoded=page(body).encode('utf-8')
        self.send_response(code);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(encoded)))
        self.send_header('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(encoded)
    def do_GET(self):
        global conn
        url=urlparse(self.path)
        if url.path=='/':
            content='<form method="post" action="/propose"><input type="hidden" name="csrf" value="'+TOKEN+'"><label>How does your business work?<textarea name="description" rows="6" minlength="12" maxlength="5000" required placeholder="I run a small garage. We book vehicles for repairs, order parts, and issue invoices..."></textarea></label><button>Create blueprint proposal</button></form>'
            projects=conn.execute('SELECT id,payload,approved_at FROM blueprints ORDER BY id DESC LIMIT 20').fetchall()
            if projects:
                import json
                content+='<section><h2>Recent blueprints</h2><ul>'
                for item in projects:
                    name=json.loads(item['payload']).get('name','Untitled')
                    status='Active' if item['approved_at'] else 'Proposal'
                    content+='<li><a href="/blueprint?id='+str(item['id'])+'">'+esc(name)+'</a> — '+status+'</li>'
                content+='</ul></section>'
            self.send(content)
            return
        if url.path=='/blueprint':
            try:
                ident=int(parse_qs(url.query).get('id',[''])[0]);row,bp=load_blueprint(conn,ident)
                content='<h2>'+esc(bp['name'])+'</h2><p>'+esc(bp['description'])+'</p>'
                content+='<div class="alert">Please review suggested fields and privacy requirements before approving.</div>'
                for entity in bp['entities']:
                    content+='<section><h3>'+esc(entity['name'])+'</h3><p>Fields: '+', '.join(map(esc,entity['fields']))+'</p>'
                    if row['approved_at']:
                        content+='<form method="post" action="/record"><input type="hidden" name="csrf" value="'+TOKEN+'"><input type="hidden" name="id" value="'+str(ident)+'"><input type="hidden" name="entity" value="'+esc(entity['name'])+'">'
                        for field in entity['fields']:content+='<label>'+esc(field)+'<input maxlength="500" name="field_'+esc(field)+'"></label>'
                        content+='<button>Add '+esc(entity['name'])+' record</button></form>'
                        records=conn.execute('SELECT payload FROM records WHERE blueprint_id=? AND entity=? ORDER BY id DESC LIMIT 10',(ident,entity['name'])).fetchall()
                        if records:
                            import json
                            content+='<h4>Latest records</h4><ul>'+''.join('<li>'+esc(', '.join(f'{k}: {v}' for k,v in json.loads(r['payload']).items()))+'</li>' for r in records)+'</ul>'
                    content+='</section>'
                if not row['approved_at']:content+='<form method="post" action="/approve"><input type="hidden" name="csrf" value="'+TOKEN+'"><input type="hidden" name="id" value="'+str(ident)+'"><button>Approve and activate</button></form>'
                else:content+='<p><strong>Approved and active.</strong></p>'
                self.send(content+'<p><a href="/">Create another proposal</a></p>')
            except (ValueError,TypeError) as e:self.send('<p>'+esc(e)+'</p>',400)
            return
        self.send('Not found',404)
    def do_POST(self):
        global conn
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0 < length <= 20000:raise ValueError('Invalid request length')
            body=self.rfile.read(length).decode('utf-8')
            fields={k:v[0] for k,v in parse_qs(body,keep_blank_values=True).items()}
            if not secrets.compare_digest(fields.get('csrf',''),TOKEN):raise ValueError('Invalid request token')
            if self.path=='/propose':
                ident=store_proposal(conn,compile_blueprint(fields.get('description','')))
            elif self.path=='/approve':
                ident=int(fields['id']);approve(conn,ident)
            elif self.path=='/record':
                ident=int(fields['id']);entity=fields['entity']; add_record(conn,ident,entity,{k[6:]:v for k,v in fields.items() if k.startswith('field_')})
            else:return self.send('Not found',404)
            self.send_response(303);self.send_header('Location','/blueprint?id='+str(ident));self.send_header('Content-Length','0');self.end_headers()
        except (ValueError,TypeError,KeyError,UnicodeError) as e:self.send('<p>'+esc(e)+'</p>',400)

def main():
    global conn
    conn=init_db(DB)
    port=int(os.environ.get('MODUVELA_PORT','8765'))
    server=HTTPServer(('127.0.0.1',port),Handler)
    print(f'Moduvela started at http://127.0.0.1:{port} (Ctrl+C to stop)',flush=True)
    try:server.serve_forever()
    finally:server.server_close();conn.close()

if __name__=='__main__':main()
