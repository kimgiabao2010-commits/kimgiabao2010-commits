import urllib.request, json
req = urllib.request.Request('http://127.0.0.1:8000/api/scan', data=b'{"text": "../../../etc/passwd"}', headers={'Content-Type': 'application/json', 'Origin': 'http://localhost'})
try:
  urllib.request.urlopen(req)
except Exception as e:
  print(e.headers)
