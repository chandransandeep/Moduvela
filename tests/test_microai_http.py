"""Exercise the same-origin local MicroAI -> draft import route."""
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class DraftImportBrowserTests(unittest.TestCase):
    def test_microai_ui_and_local_draft_import(self):
        with tempfile.TemporaryDirectory() as directory:
            with socket.socket() as sock:
                sock.bind(("127.0.0.1",0))
                port=sock.getsockname()[1]
            env={**os.environ,
                 "MODUVELA_DB":str(Path(directory)/"demo.db"),
                 "MODUVELA_PORT":str(port)}
            process=subprocess.Popen(
                [sys.executable,"-m","moduvela.server"],
                cwd=Path(__file__).resolve().parents[1],
                env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            base=f"http://127.0.0.1:{port}"
            try:
                for attempt in range(100):
                    if process.poll() is not None:
                        self.fail("Server exited early: "+process.stderr.read().decode())
                    try:
                        response=urlopen(base+"/microai/",timeout=.3)
                        break
                    except (URLError,TimeoutError):
                        time.sleep(.05)
                else:
                    self.fail("Local server did not start")
                page=response.read().decode()
                self.assertIn("Moduvela Blueprint Designer",page)
                self.assertNotIn("__MODUVELA_CSRF__",page)
                token=re.search(r'id="csrf" value="([^"]+)"',page).group(1)
                script=urlopen(base+"/microai/planner.mjs").read().decode()
                self.assertIn("proposeBusinessPlan",script)
                v2_model=urlopen(base+"/microai/trained_v2.mjs").read().decode()
                self.assertIn("predictCompactV2", v2_model)
                weights=urlopen(base+"/microai/training/model.v2.generated.mjs").read().decode()
                self.assertIn("MODEL_V2", weights)
                semantic=urlopen(base+"/microai/semantic.mjs").read().decode()
                self.assertIn("loadLocalSemantic",semantic)
                catalog=urlopen(base+"/microai/semantic_catalog.mjs").read().decode()
                self.assertIn("CATALOG",catalog)
                local_generator=urlopen(base+"/microai/generative.mjs").read().decode()
                self.assertIn("loadLocalGenerator",local_generator)
                capability_js=urlopen(base+"/microai/capabilities.mjs").read().decode()
                self.assertIn("detectHardware",capability_js)
                discovery=urlopen(base+"/microai/catalog_planner.mjs").read().decode()
                self.assertIn("composeBusinessConcepts",discovery)
                review=urlopen(base+"/microai/review.mjs").read().decode()
                self.assertIn("compileReviewedBlueprint", review)
                payload={
                    "version":1,"name":"Fictional workshop","category":"custom",
                    "description":"We record fictional jobs for workshop tests",
                    "status":"proposal",
                    "entities":[{"name":"Jobs","fields":["customer","status"]}],
                    "limitations":["Not production-ready"],
                }
                def post(value):
                    request=Request(base+"/import-draft",method="POST",
                        data=urlencode({"csrf":token,
                                        "blueprint_json":json.dumps(value)}).encode())
                    return urlopen(request,timeout=2)
                body=post(payload).read().decode()
                self.assertIn("Draft: add your own sections",body)
                self.assertIn("Jobs",body)
                payload["workflows"]=[{"script":"RUN"}]
                with self.assertRaises(HTTPError) as error:
                    post(payload)
                self.assertEqual(error.exception.code,400)
            finally:
                process.terminate()
                try:process.communicate(timeout=4)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.communicate()

if __name__=="__main__":
    unittest.main()
