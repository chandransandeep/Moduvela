"""Loopback-only, single-process Moduvela demonstration UI. Synthetic data only."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlparse
import html
import json
import os
import secrets
from pathlib import Path

from .core import (
    init_db, compile_blueprint, create_manual_blueprint, store_proposal,
    load_blueprint, approve, add_record, add_custom_entity, add_custom_fields,
    validate_imported_blueprint,
)
from .records import (
    list_records, get_record, update_record, delete_record,
    export_entity_csv, export_application_json,
)
from .workflows import (
    draft_workflow, activate_workflow, get_workflow,
    transition_record, available_transitions,
)
from .relationships import draft_relation,activate_relation,link_specs


DB = os.environ.get("MODUVELA_DB", "moduvela.db")
TOKEN = secrets.token_urlsafe(32)
conn = None


def esc(value):
    return html.escape(str(value), quote=True)


def link(path, **params):
    return path + "?" + urlencode(params)


def hidden(name, value):
    return '<input type="hidden" name="' + esc(name) + '" value="' + esc(value) + '">'


def form_start(action):
    return '<form method="post" action="' + esc(action) + '">' + hidden("csrf", TOKEN)


def page(content):
    return """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Moduvela — local-first</title>
<style>
body{font:16px system-ui;color:#182a40;background:#f2f5f9;max-width:980px;margin:2rem auto;padding:0 1rem}
main{background:white;border-radius:16px;padding:2rem;box-shadow:0 5px 28px #14253a12}
input,textarea,select{display:block;box-sizing:border-box;width:100%;padding:.65rem;margin:.25rem 0 1rem;border:1px solid #96a7ba;border-radius:7px}
label{font-weight:500}button{background:#175ba8;color:white;border:0;border-radius:7px;padding:.7rem 1rem;cursor:pointer}
section{border-top:1px solid #d8e2ee;padding:1.1rem 0}a{color:#07539a}
.action{display:inline-block;margin-right:.8rem;margin-top:.5rem}
small,.muted{color:#4e6174}li{margin:.6rem 0}.warn{background:#fff3d7;padding:.9rem;border-radius:7px}
.columns{display:grid;grid-template-columns:1fr 1fr;gap:1rem}@media(max-width:650px){.columns{grid-template-columns:1fr}}
</style><main><h1><a href="/">Moduvela</a> <small>v0.2-dev</small></h1>
<p class="muted">Business software designed and operated locally. No AI, cloud or internet required.</p>
""" + content + """<section><small>Prototype for fictional information only.
No authentication, multi-user protection or production-grade security.</small></section></main></html>"""


class Handler(BaseHTTPRequestHandler):
    def send(self, body, code=200):
        encoded = page(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy",
                         "default-src 'none'; style-src 'unsafe-inline'; "
                         "form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

    def download(self, data, content_type, filename):
        payload = data.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Content-Disposition", 'attachment; filename="' + filename + '"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def redirect(self, app_id):
        self.send_response(303)
        self.send_header("Location", link("/blueprint", id=app_id))
        self.send_header("Content-Length", "0")
        self.end_headers()


    def serve_microai_asset(self, name):
        """Serve only explicitly allowlisted static demo assets, locally."""
        allowed = {'index.html', 'app.mjs', 'planner.mjs', 'engine.mjs', 'review.mjs', 'fields.mjs', 'trained.mjs', 'training/model.generated.mjs', 'trained_v2.mjs', 'training/model.v2.generated.mjs', 'semantic.mjs', 'semantic_catalog.mjs'}
        if name not in allowed:
            return self.send('Not found', 404)
        root = Path(__file__).resolve().parents[1] / 'experiments' / 'microai'
        source = (root / name).read_text(encoding='utf-8')
        if name == 'index.html':
            source = source.replace('__MODUVELA_CSRF__', TOKEN)
        payload = source.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8'
                         if name == 'index.html' else
                         'text/javascript; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy',
                         "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'; "
                         "connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co "
                         "https://*.huggingface.co https://*.hf.co https://*.xethub.hf.co; "
                         "worker-src 'self' blob:; "
                         "style-src 'unsafe-inline'; form-action 'self'; "
                         "base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        try:
            if url.path == '/microai':
                self.send_response(302)
                self.send_header('Location', '/microai/')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            if url.path.startswith('/microai/'):
                resource = url.path.removeprefix('/microai/') or 'index.html'
                return self.serve_microai_asset(resource)
            if url.path == "/":
                content = '<section><h2>Offline Blueprint Designer</h2><p>Use the browser-based MicroAI assistant to review suggested business sections, relationships and questions. No paid AI or network access is required.</p><p><a href="/microai/">Open local MicroAI Blueprint Designer</a></p></section>'
                content += '<h2>Start with a suggestion</h2>'
                content += form_start("/propose")
                content += ('<label>Describe your example business'
                            '<textarea name="description" rows="4" minlength="12" maxlength="5000" required>'
                            '</textarea></label><button>Suggest a template</button></form>')
                content += '<section><h2>Or design from scratch — no AI</h2>'
                content += form_start("/manual")
                content += ('<label>Application name<input name="name" maxlength="70" required></label>'
                            '<label>What is this business for?<textarea name="description" rows="3" '
                            'minlength="12" maxlength="5000" required></textarea></label>'
                            '<label>First section<input name="entity" placeholder="Members" maxlength="40" required></label>'
                            '<label>Its fields, comma separated<input name="fields" '
                            'placeholder="name, member_since, notes" maxlength="800" required></label>'
                            '<button>Create custom blueprint</button></form></section>')
                projects = conn.execute(
                    "SELECT id, payload, approved_at FROM blueprints ORDER BY id DESC LIMIT 20"
                ).fetchall()
                if projects:
                    content += "<section><h2>Recent blueprints</h2><ul>"
                    for item in projects:
                        name = json.loads(item["payload"])["name"]
                        status = "Active" if item["approved_at"] else "Proposal"
                        content += '<li><a href="' + esc(link("/blueprint", id=item["id"])) + '">' + esc(name) + '</a> — ' + status + '</li>'
                    content += "</ul></section>"
                return self.send(content)

            if url.path == "/relations":
                app_id=int(query["id"][0])
                source=query["source"][0]
                row,blueprint=load_blueprint(conn,app_id)
                parts={e["name"]:e["fields"] for e in blueprint["entities"]}
                if not row["approved_at"] or source not in parts or len(parts)<2:
                    raise ValueError("An approved application with two sections is needed")
                content="<h2>Record links for "+esc(source)+"</h2>"
                content+="<p class='warn'>Configure links before creating source records. A linked field stores the numeric ID of an existing target record; this is not automatic MicroAI deployment.</p>"
                connections=link_specs(conn,app_id,source,active_only=False)
                for rel in connections:
                    state="Active" if rel["active_at"] else "Draft"
                    content+="<p>"+esc(source+"."+rel["field"]+" → "+rel["target"])+" — "+state+"</p>"
                    if not rel["active_at"]:
                        content+=form_start("/relation-activate")+hidden("id",app_id)
                        content+=hidden("source",source)+hidden("field",rel["field"])
                        content+="<button>Activate this link</button></form>"
                content+=form_start("/relation-draft")+hidden("id",app_id)+hidden("source",source)
                content+='<label>Field containing a target record ID<select name="field" required>'
                for f in parts[source]:content+='<option value="'+esc(f)+'">'+esc(f)+'</option>'
                content+="</select></label>"
                content+='<label>Target section<select name="target" required>'
                for target in parts:
                    if target!=source:content+='<option value="'+esc(target)+'">'+esc(target)+'</option>'
                content+='</select></label><button>Save link as inactive draft</button></form>'
                content+='<p><a href="'+esc(link("/blueprint",id=app_id))+'">Back to application</a></p>'
                return self.send(content)

            if url.path == "/workflow":
                app_id=int(query["id"][0])
                entity=query["entity"][0]
                row,blueprint=load_blueprint(conn,app_id)
                section=next((e for e in blueprint["entities"] if e["name"]==entity),None)
                if not row["approved_at"] or section is None or "status" not in section["fields"]:
                    raise ValueError("Approved section with status field required")
                current=get_workflow(conn,app_id,entity,active_only=False)
                content="<h2>Workflow for "+esc(entity)+"</h2>"
                content+='<p class="warn">Demo only: this is an unguarded state machine. No identity or manager approval enforcement exists.</p>'
                if current:
                    spec=current["spec"]
                    status="Active" if current["active_at"] else "Draft — not active"
                    content+="<p><strong>"+status+"</strong></p><p>Initial: "+esc(spec["initial"])+"</p>"
                    content+="<p>States: "+", ".join(map(esc,spec["states"]))+"</p>"
                    content+="<p>Transitions: "+", ".join(esc(t["from"]+" → "+t["to"]) for t in spec["transitions"])+"</p>"
                    if not current["active_at"]:
                        content+=form_start("/workflow-activate")+hidden("id",app_id)+hidden("entity",entity)
                        content+="<button>Activate this workflow</button></form>"
                else:
                    content+="<p>No workflow defined. Draft a simple state machine.</p>"
                if not current or not current["active_at"]:
                    content+=form_start("/workflow-draft")+hidden("id",app_id)+hidden("entity",entity)
                    content+='<label>States (comma-separated)<input name="states" maxlength="650" value="new,in_progress,completed" required></label>'
                    content+='<label>Initial state<input name="initial" maxlength="40" value="new" required></label>'
                    content+='<label>Transitions (comma-separated, from&gt;to)<input name="transitions" maxlength="1900" value="new>in_progress,in_progress>completed" required></label>'
                    content+='<button>Save workflow as inactive draft</button></form>'
                events=conn.execute("SELECT record_id,from_state,to_state,created_at FROM workflow_events "
                   "WHERE blueprint_id=? AND entity=? ORDER BY id DESC LIMIT 15",(app_id,entity)).fetchall()
                if events:
                    content+="<h3>Recent changes (local demo log)</h3><ul>"
                    for e in events:
                        content+="<li>Record "+esc(e["record_id"])+": "+esc(e["from_state"])+" → "+esc(e["to_state"])+"</li>"
                    content+="</ul>"
                content+='<p><a href="'+esc(link("/blueprint",id=app_id))+'">Back to application</a></p>'
                return self.send(content)

            if url.path == "/blueprint":
                app_id = int(query["id"][0])
                row, blueprint = load_blueprint(conn, app_id)
                content = "<h2>" + esc(blueprint["name"]) + "</h2>"
                content += "<p>" + esc(blueprint["description"]) + "</p>"
                if not row["approved_at"]:
                    content += '<p class="warn">Draft: add your own sections and fields before approval.</p>'
                else:
                    content += '<p><strong>Approved and active.</strong> '
                    content += '<a href="' + esc(link("/export", id=app_id, format="json")) + '">Export all as JSON</a></p>'
                for entity in blueprint["entities"]:
                    name = entity["name"]
                    content += "<section><h3>" + esc(name) + "</h3>"
                    content += "<p>Fields: " + ", ".join(map(esc, entity["fields"])) + "</p>"
                    if row["approved_at"] and len(blueprint["entities"])>1:
                        content += '<p><a href="' + esc(link("/relations",id=app_id,source=name)) + '">Configure record links from ' + esc(name) + '</a></p>'
                    if row["approved_at"] and "status" in entity["fields"]:
                        content += '<p><a href="' + esc(link("/workflow",id=app_id,entity=name)) + '">Configure workflow stages for ' + esc(name) + '</a></p>'
                    if not row["approved_at"]:
                        content += form_start("/fields") + hidden("id", app_id) + hidden("entity", name)
                        content += '<label>Add fields (comma separated)<input name="fields" maxlength="800" required></label><button>Add fields</button></form>'
                    else:
                        content += form_start("/record") + hidden("id", app_id) + hidden("entity", name)
                        active_flow=get_workflow(conn,app_id,name,active_only=True)
                        for field in entity["fields"]:
                            if field=="status" and active_flow:
                                content += "<p>Status starts at "+esc(active_flow["spec"]["initial"])+" (workflow enforced)</p>"
                                continue
                            content += "<label>" + esc(field)
                            links=[r for r in link_specs(conn,app_id,name,active_only=True) if r["field"]==field]
                            if links:content += '<small>Enter the numeric record ID from ' + esc(links[0]["target"]) + ' (leave blank if none).</small>'
                            content += '<input maxlength="500" name="field_' + esc(field) + '"></label>'
                        content += "<button>Add record</button></form>"
                        content += '<p><a href="' + esc(link("/export", id=app_id, entity=name, format="csv")) + '">Export ' + esc(name) + ' as CSV</a></p>'
                        content += '<h4>Records</h4>'
                        content += '<form method="get" action="/blueprint">' + hidden("id", app_id) + hidden("entity", name)
                        content += '<label>Search '+esc(name)+'<input name="q" maxlength="200" value="' + esc(query.get("q", [""])[0] if query.get("entity", [""])[0] == name else "") + '"></label><button>Search</button></form>'
                        selected = query.get("entity", [""])[0]
                        search = query.get("q", [""])[0] if selected == name else ""
                        matches = list_records(conn, app_id, name, search, limit=25)
                        if matches:
                            content += "<ul>"
                            for record in matches:
                                summary = "Record #" + esc(record["id"]) + " — " + "; ".join(esc(k) + ": " + esc(v) for k,v in record["values"].items())
                                content += "<li>" + summary
                                content += ' <a class="action" href="' + esc(link("/edit", id=app_id, entity=name, record=record["id"])) + '">Edit</a>'
                                content += ' <a class="action" href="' + esc(link("/delete-confirm", id=app_id, entity=name, record=record["id"])) + '">Delete</a>'
                                if active_flow:
                                    for destination in available_transitions(conn,app_id,name,record["id"]):
                                        content+=form_start("/transition-record")+hidden("id",app_id)+hidden("entity",name)
                                        content+=hidden("record",record["id"])+hidden("destination",destination)
                                        content+='<button>Move to '+esc(destination)+'</button></form>'
                                content+="</li>"
                            content += "</ul>"
                        else:
                            content += "<p>No matching records.</p>"
                    content += "</section>"
                if not row["approved_at"]:
                    content += '<section><h3>Add a custom section</h3>' + form_start("/entity")
                    content += hidden("id", app_id)
                    content += ('<label>Section name<input name="name" maxlength="40" placeholder="Inspections" required></label>'
                                '<label>Fields, comma separated<input name="fields" maxlength="800" '
                                'placeholder="vehicle, inspector, due_date" required></label>'
                                '<button>Add section</button></form></section>')
                    content += form_start("/approve") + hidden("id", app_id)
                    content += "<button>Approve and activate</button></form>"
                return self.send(content)

            if url.path in ("/edit", "/delete-confirm"):
                app_id = int(query["id"][0])
                entity = query["entity"][0]
                record_id = int(query["record"][0])
                record = get_record(conn, app_id, entity, record_id)
                if url.path == "/edit":
                    content = "<h2>Edit " + esc(entity) + " record</h2>"
                    content += form_start("/update")
                    content += hidden("id", app_id) + hidden("entity", entity) + hidden("record", record_id)
                    workflow=get_workflow(conn,app_id,entity,active_only=True)
                    for field, value in record["values"].items():
                        if field=="status" and workflow:
                            content+="<p>Current workflow status: "+esc(value)+" (use a workflow transition to change it)</p>"
                            continue
                        content += '<label>' + esc(field) + '<input name="field_' + esc(field) + '" maxlength="500" value="' + esc(value) + '"></label>'
                    content += '<button>Save changes</button></form>'
                else:
                    content = "<h2>Delete record?</h2>"
                    content += '<p class="warn">Deletion is permanent in this prototype. This operation cannot be undone.</p>'
                    content += '<p>' + esc("; ".join(str(v) for v in record["values"].values())) + '</p>'
                    content += form_start("/delete-record")
                    content += hidden("id", app_id) + hidden("entity", entity) + hidden("record", record_id)
                    content += '<button>Yes, permanently delete</button></form>'
                content += '<p><a href="' + esc(link("/blueprint", id=app_id)) + '">Cancel / back</a></p>'
                return self.send(content)

            if url.path == "/export":
                app_id = int(query["id"][0])
                kind = query["format"][0]
                if kind == "json":
                    data = export_application_json(conn, app_id)
                    return self.download(data, "application/json; charset=utf-8", "moduvela-app-" + str(app_id) + ".json")
                if kind == "csv":
                    entity = query["entity"][0]
                    data = export_entity_csv(conn, app_id, entity)
                    return self.download(data, "text/csv; charset=utf-8", "moduvela-app-" + str(app_id) + "-records.csv")
                raise ValueError("Unsupported export format")

            return self.send("Not found", 404)
        except (ValueError, TypeError, KeyError, IndexError) as error:
            return self.send("<p>" + esc(error) + "</p>", 400)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 20000:
                raise ValueError("Invalid request length")
            values = parse_qs(self.rfile.read(length).decode("utf-8"), keep_blank_values=True)
            fields = {k: v[0] for k,v in values.items()}
            if not secrets.compare_digest(fields.get("csrf", ""), TOKEN):
                raise ValueError("Invalid request token")
            if self.path == "/relation-draft":
                app_id=int(fields["id"])
                draft_relation(conn,app_id,{
                    "source":fields["source"],"field":fields["field"],"target":fields["target"]
                })
            elif self.path == "/relation-activate":
                app_id=int(fields["id"])
                activate_relation(conn,app_id,fields["source"],fields["field"])
            elif self.path == "/workflow-draft":
                app_id=int(fields["id"])
                entity=fields["entity"]
                states=[x.strip() for x in fields.get("states","").split(",")]
                initial=fields.get("initial","").strip()
                transitions=[]
                for item in fields.get("transitions","").split(","):
                    parts=item.strip().split(">")
                    if len(parts)!=2:raise ValueError("Use from>to for each transition")
                    transitions.append({"from":parts[0].strip(),"to":parts[1].strip()})
                draft_workflow(conn,app_id,{
                    "entity":entity,"initial":initial,"states":states,"transitions":transitions
                })
            elif self.path == "/workflow-activate":
                app_id=int(fields["id"])
                activate_workflow(conn,app_id,fields["entity"])
            elif self.path == "/transition-record":
                app_id=int(fields["id"])
                transition_record(conn,app_id,fields["entity"],
                                  int(fields["record"]),fields["destination"])
            elif self.path == "/import-draft":
                raw = fields.get("blueprint_json", "")
                if len(raw) > 16000:
                    raise ValueError("Blueprint is too large")
                blueprint = validate_imported_blueprint(json.loads(raw))
                app_id = store_proposal(conn, blueprint)
            elif self.path == "/propose":
                app_id = store_proposal(conn, compile_blueprint(fields.get("description", "")))
            elif self.path == "/manual":
                blueprint = create_manual_blueprint(
                    fields.get("name", ""), fields.get("description", ""),
                    fields.get("entity", ""), fields.get("fields", "").split(","),
                )
                app_id = store_proposal(conn, blueprint)
            elif self.path == "/entity":
                app_id = int(fields["id"])
                add_custom_entity(conn, app_id, fields.get("name", ""), fields.get("fields", "").split(","))
            elif self.path == "/fields":
                app_id = int(fields["id"])
                add_custom_fields(conn, app_id, fields.get("entity", ""), fields.get("fields", "").split(","))
            elif self.path == "/approve":
                app_id = int(fields["id"])
                approve(conn, app_id)
            elif self.path == "/record":
                app_id = int(fields["id"])
                entity = fields["entity"]
                add_record(conn, app_id, entity, {k[6:]:v for k,v in fields.items() if k.startswith("field_")})
            elif self.path == "/update":
                app_id = int(fields["id"])
                update_record(conn, app_id, fields["entity"], int(fields["record"]),
                              {k[6:]:v for k,v in fields.items() if k.startswith("field_")})
            elif self.path == "/delete-record":
                app_id = int(fields["id"])
                delete_record(conn, app_id, fields["entity"], int(fields["record"]))
            else:
                return self.send("Not found", 404)
            return self.redirect(app_id)
        except (ValueError, TypeError, KeyError, UnicodeError, IndexError, OSError) as error:
            return self.send("<p>" + esc(error) + "</p>", 400)


def main():
    global conn
    conn = init_db(DB)
    port = int(os.environ.get("MODUVELA_PORT", "8765"))
    server = HTTPServer(("127.0.0.1", port), Handler)
    print("Moduvela on http://127.0.0.1:" + str(port) + " (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        conn.close()


if __name__ == "__main__":
    main()
