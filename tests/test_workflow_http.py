"""HTTP contract for local workflow draft, activation, and state transitions."""
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError,URLError
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from moduvela.core import create_manual_blueprint, init_db, store_proposal, approve

class WorkflowWebTests(unittest.TestCase):
 def test_draft_activate_transition(self):
  with tempfile.TemporaryDirectory() as temp:
   path=str(Path(temp)/"test.db")
   conn=init_db(path)
   ident=store_proposal(conn,create_manual_blueprint(
     "Fictional workshop","We repair fictional equipment and track service progress",
     "Jobs",["description","status"]))
   approve(conn,ident);conn.close()
   with socket.socket() as sock:
    sock.bind(("127.0.0.1",0));port=sock.getsockname()[1]
   env={**os.environ,"MODUVELA_DB":path,"MODUVELA_PORT":str(port)}
   proc=subprocess.Popen([sys.executable,"-m","moduvela.server"],env=env,
     cwd=Path(__file__).resolve().parents[1],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
   base=f"http://127.0.0.1:{port}"
   try:
    for i in range(100):
     if proc.poll() is not None:self.fail(proc.stderr.read().decode())
     try:
      page=urlopen(base+f"/workflow?id={ident}&entity=Jobs",timeout=.4).read().decode()
      break
     except (URLError,TimeoutError):time.sleep(.05)
    else:self.fail("Local server did not start")
    token=re.search(r'name="csrf" value="([^"]+)"',page).group(1)
    self.assertIn("unguarded state machine",page)
    def post(route,data):
     req=Request(base+route,method="POST",data=urlencode({"csrf":token,"id":ident,**data}).encode())
     return urlopen(req,timeout=3).read().decode()
    post("/workflow-draft",{"entity":"Jobs","states":"new,in_progress,done",
      "initial":"new","transitions":"new>in_progress,in_progress>done"})
    draft=urlopen(base+f"/workflow?id={ident}&entity=Jobs").read().decode()
    self.assertIn("Draft",draft)
    post("/workflow-activate",{"entity":"Jobs"})
    post("/record",{"entity":"Jobs","field_description":"Synthetic test job"})
    page=urlopen(base+f"/blueprint?id={ident}").read().decode()
    self.assertIn("Move to in_progress",page)
    db=init_db(path)
    record_id=db.execute("SELECT id FROM records ORDER BY id DESC LIMIT 1").fetchone()[0]
    db.close()
    post("/transition-record",{"entity":"Jobs","record":record_id,"destination":"in_progress"})
    page=urlopen(base+f"/blueprint?id={ident}").read().decode()
    self.assertIn("Move to done",page)
    try:post("/transition-record",{"entity":"Jobs","record":record_id,"destination":"new"})
    except HTTPError as e:self.assertEqual(e.code,400)
    else:self.fail("Invalid reverse transition was accepted")
   finally:
    proc.terminate()
    try:proc.communicate(timeout=4)
    except subprocess.TimeoutExpired:proc.kill();proc.communicate()
