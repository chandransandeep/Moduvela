"""Offline record management and full export tests."""
import csv
import io
import json
import unittest
from moduvela.core import (
    create_manual_blueprint, init_db, store_proposal, approve, add_record, load_blueprint,
)
from moduvela.records import (
    delete_record, export_application_json, export_entity_csv,
    get_record, list_records, update_record,
)


class OfflineRecordsTests(unittest.TestCase):
    def setUp(self):
        self.conn = init_db(":memory:")
        self.a = store_proposal(self.conn, create_manual_blueprint(
            "Equipment Club", "We lend equipment to club members",
            "Members", ["name", "phone", "notes"]))
        self.b = store_proposal(self.conn, create_manual_blueprint(
            "Another Club", "Another example to test app isolation",
            "Members", ["name", "phone"]))
        approve(self.conn, self.a)
        approve(self.conn, self.b)

    def tearDown(self):
        self.conn.close()

    def test_manual_blueprint_is_not_ai_and_is_validated(self):
        row, blueprint = load_blueprint(self.conn, self.a)
        self.assertEqual(blueprint["category"], "custom")
        self.assertEqual(blueprint["entities"][0]["fields"], ["name", "phone", "notes"])
        for name, fields in [("Bad Name", ["name"]), ("Fine", ["id"]), ("Fine", ["x", "x"])]:
            with self.assertRaises(ValueError):
                create_manual_blueprint("Demo", "We manage a sample business", name, fields)

    def test_update_preserves_other_fields(self):
        rid = add_record(self.conn, self.a, "Members", {"name": "Alice", "phone": "000"})
        update_record(self.conn, self.a, "Members", rid, {"phone": "111"})
        vals = get_record(self.conn, self.a, "Members", rid)["values"]
        self.assertEqual(vals["name"], "Alice")
        self.assertEqual(vals["phone"], "111")

    def test_search_and_pagination_limit(self):
        add_record(self.conn, self.a, "Members", {"name": "MARY Test"})
        add_record(self.conn, self.a, "Members", {"name": "alex sample"})
        self.assertEqual(len(list_records(self.conn, self.a, "Members", "mary")), 1)
        self.assertEqual(len(list_records(self.conn, self.a, "Members", limit=1)), 1)
        with self.assertRaises(ValueError):
            list_records(self.conn, self.a, "Members", limit=1000)

    def test_wrong_app_and_entity_cannot_read_or_edit(self):
        rid = add_record(self.conn, self.a, "Members", {"name": "Demo"})
        for operation in [
            lambda: get_record(self.conn, self.b, "Members", rid),
            lambda: update_record(self.conn, self.b, "Members", rid, {"name": "Bad"}),
            lambda: delete_record(self.conn, self.b, "Members", rid),
            lambda: get_record(self.conn, self.a, "Other", rid),
            lambda: update_record(self.conn, self.a, "Members", rid, {"unknown": "bad"}),
        ]:
            with self.assertRaises(ValueError):
                operation()
        self.assertEqual(get_record(self.conn, self.a, "Members", rid)["values"]["name"], "Demo")

    def test_delete_is_scoped(self):
        rid = add_record(self.conn, self.a, "Members", {"name": "Remove"})
        delete_record(self.conn, self.a, "Members", rid)
        with self.assertRaises(ValueError):
            get_record(self.conn, self.a, "Members", rid)

    def test_csv_spreadsheet_formula_guard(self):
        add_record(self.conn, self.a, "Members", {"name": "=1+1", "phone": "+44123"})
        rows = list(csv.reader(io.StringIO(export_entity_csv(self.conn, self.a, "Members"))))
        self.assertEqual(rows[0], ["record_id", "name", "phone", "notes"])
        self.assertEqual(rows[1][1], "'=1+1")
        self.assertEqual(rows[1][2], "'+44123")

    def test_portable_json_has_exact_text(self):
        add_record(self.conn, self.a, "Members", {"name": "=literal-value"})
        add_record(self.conn, self.b, "Members", {"name": "not-in-export"})
        payload = json.loads(export_application_json(self.conn, self.a))
        self.assertEqual(payload["moduvela_export_version"], 1)
        self.assertEqual(len(payload["records"]), 1)
        self.assertEqual(payload["records"][0]["values"]["name"], "=literal-value")

    def test_draft_cannot_export(self):
        draft = store_proposal(self.conn, create_manual_blueprint(
            "Draft", "This is an unapproved demo business", "Projects", ["title"]))
        with self.assertRaises(ValueError):
            export_application_json(self.conn, draft)


if __name__ == "__main__":
    unittest.main()
