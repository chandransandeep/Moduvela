"""Explicitly configured local record references (prototype only).

Link rules are validated and activated by a human user; suggestions from
MicroAI are never made enforceable by this module.
"""
import json

from .core import load_blueprint


def _entities(conn, app_id):
    row,blueprint=load_blueprint(conn,app_id)
    if not row["approved_at"]:
        raise ValueError("Application must be approved first")
    return {e["name"]:e["fields"] for e in blueprint["entities"]}


def validate_relation(conn, app_id, spec):
    if not isinstance(spec,dict) or set(spec)!={"source","field","target"}:
        raise ValueError("Relation requires source, field, and target only")
    entities=_entities(conn,app_id)
    source,field,target=spec["source"],spec["field"],spec["target"]
    if any(not isinstance(x,str) for x in (source,field,target)):
        raise ValueError("Invalid relation types")
    if source not in entities or target not in entities or source==target:
        raise ValueError("Invalid source or target entity")
    if field not in entities[source]:
        raise ValueError("Field is not part of the source entity")
    return spec


def link_specs(conn, app_id, source=None, active_only=True):
    query="SELECT source_entity,source_field,target_entity,active_at FROM relationship_specs WHERE blueprint_id=?"
    args=[app_id]
    if source is not None:
        query+=" AND source_entity=?"
        args.append(source)
    result=[]
    for row in conn.execute(query,args):
        if active_only and not row["active_at"]:
            continue
        result.append({"source":row["source_entity"],"field":row["source_field"],
                       "target":row["target_entity"],"active_at":row["active_at"]})
    return result


def draft_relation(conn,app_id,spec):
    validate_relation(conn,app_id,spec)
    existing=conn.execute(
        "SELECT active_at FROM relationship_specs WHERE blueprint_id=? AND source_entity=? AND source_field=?",
        (app_id,spec["source"],spec["field"])).fetchone()
    if existing and existing["active_at"]:
        raise ValueError("Cannot change an active link without migration")
    count=conn.execute(
        "SELECT COUNT(*) FROM records WHERE blueprint_id=? AND entity=?",
        (app_id,spec["source"])).fetchone()[0]
    if count:
        raise ValueError("Configure links before creating source records")
    with conn:
        conn.execute(
            "INSERT INTO relationship_specs(blueprint_id,source_entity,source_field,target_entity,active_at) "
            "VALUES(?,?,?,?,NULL) ON CONFLICT(blueprint_id,source_entity,source_field) "
            "DO UPDATE SET target_entity=excluded.target_entity,active_at=NULL",
            (app_id,spec["source"],spec["field"],spec["target"]))


def activate_relation(conn,app_id,source,field):
    row=conn.execute(
        "SELECT target_entity,active_at FROM relationship_specs WHERE blueprint_id=? AND source_entity=? AND source_field=?",
        (app_id,source,field)).fetchone()
    if row is None or row["active_at"]:
        raise ValueError("No inactive relationship draft")
    validate_relation(conn,app_id,{"source":source,"field":field,"target":row["target_entity"]})
    existing=conn.execute(
        "SELECT COUNT(*) FROM records WHERE blueprint_id=? AND entity=?",
        (app_id,source)).fetchone()[0]
    if existing:
        raise ValueError("Links must be activated before source records are created")
    with conn:
        conn.execute(
            "UPDATE relationship_specs SET active_at=CURRENT_TIMESTAMP "
            "WHERE blueprint_id=? AND source_entity=? AND source_field=? AND active_at IS NULL",
            (app_id,source,field))


def check_references(conn,app_id,source,values):
    for relation in link_specs(conn,app_id,source,active_only=True):
        key=relation["field"]
        value=str(values.get(key,"")).strip()
        if not value:
            continue  # Optional link; required values need typed-field support later.
        if not value.isdecimal() or len(value)>18:
            raise ValueError(key+" must be an existing numeric record ID")
        target=conn.execute(
            "SELECT 1 FROM records WHERE id=? AND blueprint_id=? AND entity=?",
            (int(value),app_id,relation["target"])).fetchone()
        if not target:
            raise ValueError("Linked "+relation["target"]+" record not found")


def check_deletion(conn,app_id,target,record_id):
    for rel in link_specs(conn,app_id,active_only=True):
        if rel["target"]!=target:continue
        records=conn.execute(
            "SELECT payload FROM records WHERE blueprint_id=? AND entity=?",
            (app_id,rel["source"]))
        for record in records:
            values=json.loads(record["payload"])
            if str(values.get(rel["field"],"")).strip()==str(record_id):
                raise ValueError("Cannot delete: linked records still reference this record")
