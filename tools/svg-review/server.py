#!/usr/bin/env python3
"""Local SVG review. Comments are saved atomically outside the application source."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse, json, threading, mimetypes, datetime, os

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=5190)
parser.add_argument('--data',type=Path,default=ROOT.parent/'relief-svg-audit-2026-09-22')
args=parser.parse_args();DATA=args.data.resolve();DATA.mkdir(parents=True,exist_ok=True)
LIBRARY=ROOT/'public/achievement-library'
MANIFEST=json.loads((LIBRARY/'manifest.json').read_text())
FILES={item['file'] for item in MANIFEST}
COMMENTS=DATA/'comments.json';lock=threading.Lock()
def comments():
 return json.loads(COMMENTS.read_text()) if COMMENTS.exists() else {}
def result_data():
 rows={}
 for item in MANIFEST:
  p=DATA/'raw'/(Path(item['file']).stem+'.json')
  if p.exists():
   try:
    d=json.loads(p.read_text());rows[item['file']]={k:d.get(k) for k in ['status','message','totalMs','model','pixels']}
   except json.JSONDecodeError:pass
 return rows
class Handler(BaseHTTPRequestHandler):
 def send(self,content,status=200,mime='application/json; charset=utf-8'):
  if not isinstance(content,bytes):content=json.dumps(content,ensure_ascii=False).encode()
  self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(content)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(content)
 def do_GET(self):
  route=unquote(urlsplit(self.path).path)
  if route=='/api/state':
   with lock:saved=comments()
   self.send({'manifest':MANIFEST,'results':result_data(),'comments':saved});return
  if route in ['/','/index.html','/app.js','/style.css']:
   path=HERE/('index.html' if route=='/' else route[1:])
  elif route.startswith('/svg/') and route[5:] in FILES:path=LIBRARY/route[5:]
  elif route.startswith('/render/') and route[8:] in FILES:path=DATA/'images'/(Path(route[8:]).stem+'-render.png')
  else:self.send({'error':'Not found'},404);return
  if not path.is_file():self.send({'error':'Not ready'},404);return
  self.send(path.read_bytes(),mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
 def do_POST(self):
  if self.path!='/api/comments':self.send({'error':'Not found'},404);return
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<=65536:raise ValueError('Комментарий слишком длинный')
   payload=json.loads(self.rfile.read(length));file=payload.get('file');text=payload.get('text')
   if file not in FILES or not isinstance(text,str):raise ValueError('Некорректный комментарий')
   saved={'text':text,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
   with lock:
    data=comments();data[file]=saved;temporary=COMMENTS.with_suffix('.tmp')
    with temporary.open('w') as f:json.dump(data,f,ensure_ascii=False,indent=2);f.flush();os.fsync(f.fileno())
    temporary.replace(COMMENTS)
   self.send(saved)
  except (ValueError,TypeError,json.JSONDecodeError) as error:self.send({'error':str(error)},400)
 def log_message(self,*args):pass
print(f'SVG review: http://127.0.0.1:{args.port}/\nComments: {COMMENTS}',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
