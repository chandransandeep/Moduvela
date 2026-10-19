import unittest
from moduvela.core import compile_blueprint,validate_blueprint,init_db,store_proposal,approve,add_record,load_blueprint

class CoreTests(unittest.TestCase):
 def setUp(self): self.db=init_db(':memory:')
 def tearDown(self):self.db.close()
 def test_garage(self):
  b=compile_blueprint('We run a small garage, repairing vehicles and ordering parts')
  self.assertEqual(b['category'],'garage');validate_blueprint(b)
 def test_default(self):self.assertEqual(compile_blueprint('We manage memberships for a local club')['category'],'general')
 def test_approval(self):
  ident=store_proposal(self.db,compile_blueprint('We provide mechanic and garage repair services'))
  with self.assertRaises(ValueError):add_record(self.db,ident,'Customers',{'name':'Test'})
  approve(self.db,ident);add_record(self.db,ident,'Customers',{'name':'Synthetic Person'})
  self.assertIsNotNone(load_blueprint(self.db,ident)[0]['approved_at'])
  self.assertEqual(self.db.execute('select count(*) from records').fetchone()[0],1)
 def test_validation(self):
  b=compile_blueprint('A garage business for vehicle repairs')
  b['entities'][0]['fields'].append('created_at')
  with self.assertRaises(ValueError):validate_blueprint(b)
 def test_extra_field(self):
  ident=store_proposal(self.db,compile_blueprint('We have a barber salon offering haircuts'))
  approve(self.db,ident)
  with self.assertRaises(ValueError):add_record(self.db,ident,'Customers',{'bad':'value'})

if __name__=='__main__':unittest.main()
