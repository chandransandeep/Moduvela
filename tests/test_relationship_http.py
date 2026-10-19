"""Exercise the local relationship configuration web surface."""
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import URLError,HTTPError
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from moduvela.core import init_db,create_manual_blueprint,store_proposal,add_custom_entity,approve

class RelationshipWebTests(unittest.TestCase):
 def test_link_demo_and_rejected_nonexistent_target(self):
  with tempfile.TemporaryDirectory() as temp:
   dbfile=str(Path(temp)/"demo.db")
   db=init_db(dbfile)
   ident=store_proposal(db,create_manual_blueprint(
    "Test Club","Our invented small club manages members and related jobs",
    "Customers",["name"]))
   add_custom_entity(db,ident,"Jobs",["customer","description","status"])
   approve(db,ident);db.close()
   with socket.socket() as sock:
    sock.bind(("127.0.0.1",0));port=sock.getsockname()[1]
   process=subprocess.Popen([sys.executable,"-m","moduvela.server"],
    env={**os.environ,"MODUVELA_DB":dbfile,"MODUVELA_PORT":str(port)},
    cwd=Path(__file__).resolve().parents[1],
    stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
   base=f"http://127.0.0.1:{port}"
   try:
    for _ in range(100):
     if process.poll() is not None:self.fail(process.stderr.read().decode())
     try:page=urlopen(base+f"/relations?id={ident}&source=Jobs",timeout=.5).read().decode();break
     except (URLError,TimeoutError):time.sleep(.05)
    else:self.fail("Server did not start")
    token=re.search(r'name="csrf" value="([^"]+)"',page).group(1)
    def post(path,data):
     r=Request(base+path,method="POST",
      data=urlencode({"csrf":token,"id":ident,**data}).encode())
     return urlopen(r,timeout=3).read().decode()
    post("/relation-draft",{"source":"Jobs","field":"customer","target":"Customers"})
    draft=urlopen(base+f"/relations?id={ident}&source=Jobs").read().decode()
    self.assertIn("Draft",draft)
    post("/relation-activate",{"source":"Jobs","field":"customer"})
    active=urlopen(base+f"/relations?id={ident}&source=Jobs").read().decode()
    self.assertIn("Active",active)
    post("/record",{"entity":"Customers","field_name":"Synthetic Customer"})
    try:post("/record",{"entity":"Jobs","field_customer":"999","field_description":"Invalid link"})
    except HTTPError as e:self.assertEqual(e.code,400)
    else:self.fail("Invalid linked ID was accepted")
    db=init_db(dbfile)
    customer=db.execute("SELECT id FROM records WHERE entity='Customers'").fetchone()[0];db.close()
    post("/record",{"entity":"Jobs","field_customer":customer,"field_description":"Linked fictional job"})
    updated=urlopen(base+f"/blueprint?id={ident}").read().decode()
    self.assertIn("Record #",updated)
   finally:
    process.terminate()
    try:process.communicate(timeout=4)
    except subprocess.TimeoutExpired:process.kill();process.communicate()
