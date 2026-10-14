# Starts the whole Ethio Fleet demo in three windows.
$root = "C:\dev\fleet-management-system"

# 1. Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload"

# Give the backend a few seconds to start
Start-Sleep -Seconds 5

# 2. Clean the alert list, then start the simulator
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .\venv\Scripts\Activate.ps1; python cleanup_alerts.py; python simulator.py"

# 3. Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Start-Sleep -Seconds 6
Start-Process "http://localhost:5173"