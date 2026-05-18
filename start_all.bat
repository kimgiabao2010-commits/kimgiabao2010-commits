@echo off
echo Starting SWG Backend Services...

echo Starting WAF Central Gateway (Port 8000)...
start "WAF 8000" cmd /k "uvicorn main:app --port 8000"

echo Starting FastText AI Service (Port 5001)...
start "FastText 5001" cmd /k "python api_server_fasttext.py"

echo Starting DistilBERT Deep Analysis (Port 5002)...
start "DistilBERT 5002" cmd /k "python api_server_distilbert.py"

echo Starting Admin Report API (Port 5003)...
start "Report 5003" cmd /k "python api_server_report.py"

echo All services are starting up in separate windows.
pause
