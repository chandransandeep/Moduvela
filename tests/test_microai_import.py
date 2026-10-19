"""Server-side safety checks for the offline MicroAI draft import gate."""
import unittest
from moduvela.core import (
    init_db, store_proposal, load_blueprint, approve,
    validate_imported_blueprint, add_record,
)


class DraftImportTests(unittest.TestCase):
    def setUp(self):
        self.connection = init_db(":memory:")
        self.candidate = {
            "version": 1, "name": "Demo Repair Workshop",
            "category": "custom",
            "description": "An invented example repair workshop for test purposes",
            "status": "proposal",
            "entities": [
                {"name": "Jobs", "fields": ["description", "status", "customer"]},
                {"name": "Customers", "fields": ["name", "phone"]},
            ],
            "limitations": ["No executable approval workflows"],
        }

    def tearDown(self):
        self.connection.close()

    def test_import_is_unapproved(self):
        safe = validate_imported_blueprint(self.candidate)
        key = store_proposal(self.connection, safe)
        row, draft = load_blueprint(self.connection, key)
        self.assertIsNone(row["approved_at"])
        self.assertIn("Imported from local MicroAI", draft["limitations"][-1])
        with self.assertRaises(ValueError):
            add_record(self.connection, key, "Jobs", {"description": "Unsafe"})
        approve(self.connection, key)
        add_record(self.connection, key, "Jobs", {"description": "Fictional"})

    def test_reject_generated_workflow_or_code_payload(self):
        for injection in (
            {"workflows": [{"execute": "arbitrary_code()"}]},
            {"permissions": {"owner": "*"}},
            {"status": "active"},
            {"version": 3},
            {"entities": [{"name": "Jobs", "fields": ["name"], "command": "exec"}]},
        ):
            candidate = {**self.candidate, **injection}
            with self.assertRaises(ValueError, msg=str(injection)):
                validate_imported_blueprint(candidate)

    def test_reject_invalid_fields_and_bad_types(self):
        for bad in ("created_at", "Bad Field", "select;drop"):
            candidate={**self.candidate,
                       "entities": [{"name": "Jobs", "fields": [bad]}]}
            with self.assertRaises(ValueError):
                validate_imported_blueprint(candidate)
        with self.assertRaises(ValueError):
            validate_imported_blueprint("not a dictionary")

    def test_reject_excessive_data(self):
        candidate={**self.candidate,"description":"x"*5001}
        with self.assertRaises(ValueError):
            validate_imported_blueprint(candidate)


if __name__ == "__main__":
    unittest.main()
