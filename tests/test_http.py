"""E2E browser-flow test using a subprocess and local HTTP only."""
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen, Request

class BrowserFlowTests(unittest.TestCase):
    def test_propose_approve_and_add_record(self):
        with tempfile.TemporaryDirectory() as tmp:
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            env = os.environ.copy()
            env.update(MODUVELA_DB=str(Path(tmp) / 'test.db'), MODUVELA_PORT=str(port))
            proc = subprocess.Popen([sys.executable, '-m', 'moduvela.server'],
                                    cwd=Path(__file__).resolve().parents[1],
                                    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            base = f'http://127.0.0.1:{port}'
            try:
                for _ in range(100):
                    if proc.poll() is not None:
                        self.fail(f'Server stopped early: {proc.stderr.read().decode()}')
                    try:
                        home = urlopen(base, timeout=0.2).read().decode()
                        break
                    except (URLError, TimeoutError):
                        time.sleep(0.05)
                else:
                    self.fail('Server failed to start')
                token = re.search(r'name="csrf" value="([^"]+)"', home).group(1)

                def post(path, values, expected=200):
                    request = Request(base + path, data=urlencode({'csrf': token, **values}).encode(),
                                      method='POST')
                    try:
                        response = urlopen(request, timeout=2)
                        self.assertEqual(response.status, expected)
                        return response.read().decode(), response.geturl()
                    except HTTPError as e:
                        self.assertEqual(e.code, expected)
                        return e.read().decode(), e.geturl()

                html, url = post('/propose', {'description':'We have a garage repairing fictional vehicles'})
                self.assertIn('Garage Operations', html)
                self.assertRegex(url, r'/blueprint\?id=1$')
                html, _ = post('/approve', {'id':'1'})
                self.assertIn('Approved and active', html)
                html, _ = post('/record', {'id':'1','entity':'Customers',
                                          'field_name':'Synthetic Alice', 'field_phone':'000000'})
                self.assertIn('Synthetic Alice', html)
                self.assertIn('Recent blueprints', urlopen(base, timeout=2).read().decode())
                html, _ = post('/record', {'id':'1','entity':'Customers', 'field_bad':'No'}, expected=400)
                self.assertIn('Unknown field', html)
                request = Request(base + '/approve', data=urlencode({'csrf':'wrong','id':'1'}).encode(), method='POST')
                with self.assertRaises(HTTPError) as ex:
                    urlopen(request, timeout=2)
                self.assertEqual(ex.exception.code, 400)
            finally:
                proc.terminate()
                try: proc.communicate(timeout=3)
                except subprocess.TimeoutExpired: proc.kill();proc.communicate()

if __name__ == '__main__':
    unittest.main()
