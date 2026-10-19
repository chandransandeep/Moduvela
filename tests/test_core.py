import unittest
from moduvela.core import compile_blueprint,validate_blueprint,init_db,store_proposal,approve,add_record,load_blueprint,add_custom_entity,add_custom_fields

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

 def test_custom_business_objects_no_ai(self):
  ident=store_proposal(self.db,compile_blueprint('We organise local club memberships and equipment rentals'))
  add_custom_entity(self.db,ident,'Equipment',['item_name','serial_number','return_date'])
  add_custom_fields(self.db,ident,'Customers',['member_since'])
  row,bp=load_blueprint(self.db,ident)
  self.assertFalse(row['approved_at'])
  self.assertIn('member_since',bp['entities'][0]['fields'])
  self.assertEqual(bp['entities'][-1]['name'],'Equipment')
  approve(self.db,ident)
  add_record(self.db,ident,'Equipment',{'item_name':'Demo bike','serial_number':'DEMO-01'})
  self.assertEqual(self.db.execute('select count(*) from records').fetchone()[0],1)
  with self.assertRaises(ValueError):add_custom_entity(self.db,ident,'More',['field'])
  with self.assertRaises(ValueError):add_custom_fields(self.db,ident,'Equipment',['notes'])
 def test_invalid_customisation_is_rejected(self):
  ident=store_proposal(self.db,compile_blueprint('We handle appointments and customer services'))
  for name,fields in [('Customers',['other']),('Bad Name',['other']),('Reviews',['id'])]:
   with self.assertRaises(ValueError):add_custom_entity(self.db,ident,name,fields)
  with self.assertRaises(ValueError):add_custom_fields(self.db,ident,'Customers',['name'])
  self.assertEqual(len(load_blueprint(self.db,ident)[1]['entities']),3)

if __name__=='__main__':unittest.main()
