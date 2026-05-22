import httpx

headers = {
    "Content-Type": "application/json",
    "X-API-Key": "swg-vnu-is-2026"
}

payload = {
    "text": "For every website, everywhere® Get your .xyz domain name now www.gen.xyz We are the Registry Operator for .xyz domain names.",
    "url": "https://nic.xyz/#"
}

try:
    resp = httpx.post("http://localhost:8000/api/scan", json=payload, headers=headers)
    print("STATUS:", resp.status_code)
    print("RESPONSE:", resp.json())
except Exception as e:
    print("ERROR:", e)
