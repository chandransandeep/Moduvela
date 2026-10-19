import unittest
from moduvela.core import init_db,create_manual_blueprint,store_proposal,approve,add_custom_entity,add_record
from moduvela.records import update_record,delete_record
from moduvela.relationships import draft_relation,activate_relation,link_specs,validate_relation

class RelationshipTests(unittest.TestCase):
 def setUp(self):
  self.db=init_db(":memory:")
  bp=create_manual_blueprint("Test Garage","Fictional relational garage for local tests","Customers",["name"])
  self.id=store_proposal(self.db,bp)
  add_custom_entity(self.db,self.id,"Jobs",["customer","description","status"])
  approve(self.db,self.id)
 def tearDown(self):self.db.close()
 def test_manual_relation_and_referential_integrity(self):
  spec={"source":"Jobs","field":"customer","target":"Customers"}
  draft_relation(self.db,self.id,spec)
  self.assertEqual(link_specs(self.db,self.id),[])
  activate_relation(self.db,self.id,"Jobs","customer")
  self.assertEqual(len(link_specs(self.db,self.id)),1)
  customer=add_record(self.db,self.id,"Customers",{"name":"Fictional Name"})
  with self.assertRaises(ValueError):
   add_record(self.db,self.id,"Jobs",{"customer":"999","description":"Broken"})
  job=add_record(self.db,self.id,"Jobs",{"customer":str(customer),"description":"Synthetic"})
  with self.assertRaises(ValueError):
   update_record(self.db,self.id,"Jobs",job,{"customer":"999"})
  with self.assertRaises(ValueError):
   delete_record(self.db,self.id,"Customers",customer)
  delete_record(self.db,self.id,"Jobs",job)
  delete_record(self.db,self.id,"Customers",customer)
 def test_unknown_target_field_or_executable_metadata_rejected(self):
  for x in [
   {"source":"Jobs","field":"other","target":"Customers"},
   {"source":"Jobs","field":"customer","target":"Jobs"},
   {"source":"Jobs","field":"customer","target":"Customers","eval":"evil()"}
  ]:
   with self.assertRaises(ValueError):validate_relation(self.db,self.id,x)
 def test_draft_cannot_migrate_existing_records(self):
  add_record(self.db,self.id,"Jobs",{"description":"Prior job"})
  with self.assertRaises(ValueError):
   draft_relation(self.db,self.id,{"source":"Jobs","field":"customer","target":"Customers"})

if __name__=="__main__":unittest.main()
