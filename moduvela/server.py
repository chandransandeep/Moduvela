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
input,textarea{display:block;box-sizing:border-box;width:100%;padding:.65rem;margin:.25rem 0 1rem;border:1px solid #96a7ba;border-radius:7px}
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
        allowed = {'index.html', 'app.mjs', 'planner.mjs', 'engine.mjs', 'review.mjs'}
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
                         "default-src 'none'; script-src 'self'; "
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
                    if not row["approved_at"]:
                        content += form_start("/fields") + hidden("id", app_id) + hidden("entity", name)
                        content += '<label>Add fields (comma separated)<input name="fields" maxlength="800" required></label><button>Add fields</button></form>'
                    else:
                        content += form_start("/record") + hidden("id", app_id) + hidden("entity", name)
                        for field in entity["fields"]:
                            content += "<label>" + esc(field) + hidden("nothing", "")[:0]
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
                                summary = "; ".join(esc(k) + ": " + esc(v) for k,v in record["values"].items())
                                content += "<li>" + summary
                                content += ' <a class="action" href="' + esc(link("/edit", id=app_id, entity=name, record=record["id"])) + '">Edit</a>'
                                content += ' <a class="action" href="' + esc(link("/delete-confirm", id=app_id, entity=name, record=record["id"])) + '">Delete</a></li>'
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
                    for field, value in record["values"].items():
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
            if self.path == "/import-draft":
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
