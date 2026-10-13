from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Fleet Management System API", version="0.1.0")

# CORS lets our React app (port 5173) talk to this backend (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Fleet Management System API is running"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "fms-backend"}