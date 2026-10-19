"""Deterministic demo workflow state machine; not an approval or identity system.

All definitions must be explicitly staged then activated. Workflow operations
cannot evaluate arbitrary Python, JavaScript, SQL, role grants, or external calls.
A single local user can operate everything, so NOT production authorization.
"""
import json
import re
from datetime import datetime, timezone

from .core import load_blueprint

IDENTIFIER = re.compile(r"^[a-z][a-z0-9_]{0,39}$")


def _time():
    return datetime.now(timezone.utc).isoformat()


def validate_spec(spec):
    if not isinstance(spec, dict) or set(spec) != {"entity", "initial", "states", "transitions"}:
        raise ValueError("Only state-machine workflow definitions are supported")
    name = spec["entity"]
    states = spec["states"]
    if not isinstance(name, str) or not name or len(name) > 40:
        raise ValueError("Invalid workflow entity")
    if not isinstance(states, list) or not 2 <= len(states) <= 12:
        raise ValueError("Workflow needs 2 to 12 states")
    if any(not isinstance(s, str) or not IDENTIFIER.fullmatch(s) for s in states):
        raise ValueError("Invalid state identifier")
    if len(set(states)) != len(states) or spec["initial"] not in states:
        raise ValueError("States must be unique and include the initial state")
    transitions = spec["transitions"]
    if not isinstance(transitions, list) or not 1 <= len(transitions) <= 36:
        raise ValueError("Workflow needs 1 to 36 transitions")
    seen = set()
    for step in transitions:
        if not isinstance(step, dict) or set(step) != {"from", "to"}:
            raise ValueError("Only unguarded from/to state transitions are supported")
        source, target = step["from"], step["to"]
        if source not in states or target not in states or source == target:
            raise ValueError("Invalid transition")
        if (source, target) in seen:
            raise ValueError("Duplicate transition")
        seen.add((source, target))
    return spec


def get_workflow(conn, app_id, entity, active_only=True):
    row = conn.execute(
        "SELECT payload, active_at FROM workflow_specs WHERE blueprint_id=? AND entity=?",
        (app_id, entity),
    ).fetchone()
    if row is None or (active_only and not row["active_at"]):
        return None
    return {"spec": json.loads(row["payload"]), "active_at": row["active_at"]}


def draft_workflow(conn, app_id, spec):
    spec = validate_spec(spec)
    row, blueprint = load_blueprint(conn, app_id)
    if not row["approved_at"]:
        raise ValueError("Approve the application blueprint before defining a workflow")
    section = next((e for e in blueprint["entities"] if e["name"] == spec["entity"]), None)
    if section is None or "status" not in section["fields"]:
        raise ValueError("Workflow section must exist and contain a status field")
    current = get_workflow(conn, app_id, spec["entity"], active_only=False)
    if current and current["active_at"]:
        raise ValueError("Active workflow cannot be overwritten without a migration plan")
    records_count = conn.execute(
        "SELECT COUNT(*) FROM records WHERE blueprint_id=? AND entity=?",
        (app_id, spec["entity"]),
    ).fetchone()[0]
    if records_count:
        raise ValueError("Configure workflow before adding records; migrations are not implemented")
    with conn:
        conn.execute(
            "INSERT INTO workflow_specs(blueprint_id,entity,payload,active_at) VALUES(?,?,?,NULL) "
            "ON CONFLICT(blueprint_id,entity) DO UPDATE SET payload=excluded.payload,active_at=NULL",
            (app_id, spec["entity"], json.dumps(spec)),
        )


def activate_workflow(conn, app_id, entity):
    stored = get_workflow(conn, app_id, entity, active_only=False)
    if stored is None:
        raise ValueError("No workflow draft found")
    if stored["active_at"]:
        raise ValueError("Workflow is already active")
    validate_spec(stored["spec"])
    count = conn.execute(
        "SELECT COUNT(*) FROM records WHERE blueprint_id=? AND entity=?",
        (app_id, entity),
    ).fetchone()[0]
    if count:
        raise ValueError("Cannot activate over existing records")
    with conn:
        conn.execute(
            "UPDATE workflow_specs SET active_at=? WHERE blueprint_id=? AND entity=? AND active_at IS NULL",
            (_time(), app_id, entity),
        )


def transition_record(conn, app_id, entity, record_id, destination):
    """Moves one record in a validated finite-state graph, recording an event."""
    from .records import get_record
    stored = get_workflow(conn, app_id, entity, active_only=True)
    if stored is None:
        raise ValueError("No active workflow for this section")
    spec = validate_spec(stored["spec"])
    current = get_record(conn, app_id, entity, record_id)
    source = current["values"].get("status", "")
    if {"from": source, "to": destination} not in spec["transitions"]:
        raise ValueError("Transition is not allowed")
    changed = dict(current["values"])
    changed["status"] = destination
    with conn:
        cursor = conn.execute(
            "UPDATE records SET payload=? WHERE id=? AND blueprint_id=? AND entity=? AND payload=?",
            (json.dumps(changed), record_id, app_id, entity,
             json.dumps(current["values"])),
        )
        if cursor.rowcount != 1:
            raise ValueError("Record changed concurrently; retry")
        conn.execute(
            "INSERT INTO workflow_events(blueprint_id,entity,record_id,from_state,to_state,created_at) "
            "VALUES(?,?,?,?,?,?)",
            (app_id, entity, record_id, source, destination, _time()),
        )
    return changed


def available_transitions(conn, app_id, entity, record_id):
    from .records import get_record
    stored = get_workflow(conn, app_id, entity, active_only=True)
    if stored is None:
        return []
    source = get_record(conn, app_id, entity, record_id)["values"].get("status")
    return [t["to"] for t in stored["spec"]["transitions"] if t["from"] == source]
