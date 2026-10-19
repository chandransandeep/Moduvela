"""Offline record operations; no AI, network, or dynamic SQL identifiers.

This is a local single-user prototype. Never enter real customer or business data.
"""
from __future__ import annotations
import csv
import io
import json
from .core import load_blueprint


def allowed_fields(conn, app_id: int, entity: str) -> list[str]:
    row, blueprint = load_blueprint(conn, app_id)
    if not row["approved_at"]:
        raise ValueError("Blueprint must be approved first")
    match = next((e for e in blueprint["entities"] if e["name"] == entity), None)
    if match is None:
        raise ValueError("Unknown entity")
    return match["fields"]


def list_records(conn, app_id: int, entity: str, query: str = "", limit: int = 100) -> list[dict]:
    """Filter by a case-insensitive text substring. This prototype uses a table scan."""
    allowed_fields(conn, app_id, entity)
    if not isinstance(query, str) or len(query) > 200:
        raise ValueError("Search must not exceed 200 characters")
    if type(limit) is not int or not 1 <= limit <= 200:
        raise ValueError("Limit must be from 1 to 200")
    rows = conn.execute(
        "SELECT id, payload, created_at FROM records "
        "WHERE blueprint_id=? AND entity=? ORDER BY id DESC", (app_id, entity)
    )
    found = []
    for row in rows:
        values = json.loads(row["payload"])
        if query.casefold() not in " ".join(str(v) for v in values.values()).casefold():
            continue
        found.append({"id": row["id"], "values": values, "created_at": row["created_at"]})
        if len(found) >= limit:
            break
    return found


def get_record(conn, app_id: int, entity: str, record_id: int) -> dict:
    allowed_fields(conn, app_id, entity)
    row = conn.execute(
        "SELECT id, payload, created_at FROM records "
        "WHERE id=? AND blueprint_id=? AND entity=?",
        (record_id, app_id, entity),
    ).fetchone()
    if row is None:
        raise ValueError("Record not found")
    return {"id": row["id"], "values": json.loads(row["payload"]),
            "created_at": row["created_at"]}


def update_record(conn, app_id: int, entity: str, record_id: int, changes: dict) -> None:
    fields = allowed_fields(conn, app_id, entity)
    if not isinstance(changes, dict) or not changes or any(k not in fields for k in changes):
        raise ValueError("Unknown or missing field")
    if any(not isinstance(v, str) or len(v) > 500 for v in changes.values()):
        raise ValueError("Each field must contain at most 500 characters")
    existing = get_record(conn, app_id, entity, record_id)
    updated = {**existing["values"], **changes}
    with conn:
        conn.execute(
            "UPDATE records SET payload=? WHERE id=? AND blueprint_id=? AND entity=?",
            (json.dumps(updated, ensure_ascii=False), record_id, app_id, entity),
        )


def delete_record(conn, app_id: int, entity: str, record_id: int) -> None:
    """Hard delete, only called following an explicit browser confirmation step."""
    get_record(conn, app_id, entity, record_id)
    with conn:
        conn.execute(
            "DELETE FROM records WHERE id=? AND blueprint_id=? AND entity=?",
            (record_id, app_id, entity),
        )


def safe_csv_cell(text: str) -> str:
    """Neutralise common spreadsheet formula prefixes, including after whitespace."""
    if text.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + text
    return text


def export_entity_csv(conn, app_id: int, entity: str) -> str:
    """CSV is safe to open in spreadsheets, not lossless for formula-like cells."""
    fields = allowed_fields(conn, app_id, entity)
    out = io.StringIO(newline="")
    writer = csv.writer(out)
    writer.writerow(["record_id", *fields])
    rows = conn.execute(
        "SELECT id, payload FROM records WHERE blueprint_id=? AND entity=? ORDER BY id",
        (app_id, entity),
    )
    for row in rows:
        values = json.loads(row["payload"])
        writer.writerow([row["id"], *[
            safe_csv_cell(str(values.get(field, ""))) for field in fields
        ]])
    return out.getvalue()


def export_application_json(conn, app_id: int) -> str:
    """Lossless text snapshot for personal portability, not a managed backup."""
    row, blueprint = load_blueprint(conn, app_id)
    if not row["approved_at"]:
        raise ValueError("Only approved applications can be exported")
    records = conn.execute(
        "SELECT id, entity, payload, created_at FROM records "
        "WHERE blueprint_id=? ORDER BY id", (app_id,),
    )
    return json.dumps({
        "moduvela_export_version": 1,
        "blueprint": blueprint,
        "records": [
            {"id": r["id"], "entity": r["entity"],
             "values": json.loads(r["payload"]), "created_at": r["created_at"]}
            for r in records
        ],
    }, indent=2, ensure_ascii=False)
