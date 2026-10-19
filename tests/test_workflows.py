import unittest
from moduvela.core import init_db,create_manual_blueprint,store_proposal,approve,add_record
from moduvela.records import update_record,get_record
from moduvela.workflows import draft_workflow,activate_workflow,get_workflow,transition_record,available_transitions,validate_spec

SPEC={"entity":"Jobs","initial":"new","states":["new","in_progress","completed"],
 "transitions":[{"from":"new","to":"in_progress"},{"from":"in_progress","to":"completed"}]}

class WorkflowTests(unittest.TestCase):
 def setUp(self):
  self.db=init_db(":memory:")
  bp=create_manual_blueprint("Fictional workshop","Sample workshop with deterministic workflow tests","Jobs",["description","status"])
  self.id=store_proposal(self.db,bp);approve(self.db,self.id)
 def tearDown(self): self.db.close()
 def test_draft_activation_and_transitions(self):
  draft_workflow(self.db,self.id,SPEC)
  self.assertIsNone(get_workflow(self.db,self.id,"Jobs"))
  activate_workflow(self.db,self.id,"Jobs")
  rid=add_record(self.db,self.id,"Jobs",{"description":"Synthetic repair"})
  self.assertEqual(get_record(self.db,self.id,"Jobs",rid)["values"]["status"],"new")
  self.assertEqual(available_transitions(self.db,self.id,"Jobs",rid),["in_progress"])
  with self.assertRaises(ValueError):transition_record(self.db,self.id,"Jobs",rid,"completed")
  with self.assertRaises(ValueError):update_record(self.db,self.id,"Jobs",rid,{"status":"completed"})
  transition_record(self.db,self.id,"Jobs",rid,"in_progress")
  transition_record(self.db,self.id,"Jobs",rid,"completed")
  self.assertEqual(get_record(self.db,self.id,"Jobs",rid)["values"]["status"],"completed")
  self.assertEqual(self.db.execute("SELECT count(*) FROM workflow_events").fetchone()[0],2)
 def test_cannot_override_initial_state(self):
  draft_workflow(self.db,self.id,SPEC);activate_workflow(self.db,self.id,"Jobs")
  with self.assertRaises(ValueError):
   add_record(self.db,self.id,"Jobs",{"status":"completed"})
 def test_reject_code_roles_guards_and_cycles(self):
  for change in (
    {"role":"manager"},
    {"transitions":[{"from":"new","to":"completed","guard":"eval(input())"}]},
    {"states":["new","new"]},
    {"initial":"unknown"},
    {"transitions":[{"from":"completed","to":"completed"}]},
  ):
   with self.assertRaises(ValueError):validate_spec({**SPEC,**change})
 def test_existing_records_require_explicit_migration(self):
  add_record(self.db,self.id,"Jobs",{"description":"old record"})
  with self.assertRaises(ValueError):draft_workflow(self.db,self.id,SPEC)
 def test_no_approval_or_identity_claim(self):
  self.assertTrue(all(set(s)=={"from","to"} for s in SPEC["transitions"]))
  with self.assertRaises(ValueError):
   validate_spec({**SPEC,"approver":"Manager"})
 def test_wrong_record_cannot_transition(self):
  draft_workflow(self.db,self.id,SPEC);activate_workflow(self.db,self.id,"Jobs")
  with self.assertRaises(ValueError):
   transition_record(self.db,self.id,"Jobs",999,"in_progress")

if __name__=="__main__":unittest.main()
