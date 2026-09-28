# SIH26084 — WeatherNow AI Nowcasting System

AI-Powered Weather Nowcasting and Early Warning System integrating the **SIH V3 PyTorch Deep-Convection ConvLSTM Model** with a high-performance **FastAPI backend** and a modern **React/Vite dashboard frontend**.

---

## 📂 Repository Architecture

```
weather nowcast/
├── backend/                # Python FastAPI backend serving SIH V3 Nowcast model
│   ├── models/             # PyTorch model weights (sih_v3_best.pth)
│   ├── routes/             # Endpoints (/api/health, /api/model-info, /api/predict, /api/hazards)
│   ├── utils/              # Normalization & preprocessing pipeline
│   ├── main.py             # FastAPI service entry point
│   ├── model_loader.py     # SIHV3Nowcast architecture & checkpoint loader
│   ├── inference.py        # Inference pipeline (tensor prep, forward pass, sigmoid)
│   ├── schemas.py          # Pydantic validation schemas
│   ├── config.py           # Model constants, fixed mean/std arrays, settings
│   ├── requirements.txt    # Python dependencies
│   ├── .env.example        # Backend environment template
│   └── README.md           # Backend documentation
│
├── frontend/               # React 19 + TypeScript + Vite frontend application
│   ├── src/                # UI source code, components, pages, services, types
│   ├── public/             # Favicon (SVG) and static assets
│   ├── package.json        # Frontend package config ("weathernow-ai")
│   ├── index.html          # HTML entry point & metadata
│   ├── vite.config.ts      # Vite configuration
│   ├── .env.example        # Frontend environment template
│   └── README.md           # Frontend documentation
│
└── README.md               # Root project documentation
```

---

## 🚀 Quick Start Guide

### 1. Run the Python FastAPI Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- API Docs & Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Status: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Model Info: [http://localhost:8000/api/model-info](http://localhost:8000/api/model-info)

### 2. Run the React Frontend

```bash
cd frontend
npm install
npm run dev
```
- Dashboard UI: [http://localhost:5173](http://localhost:5173)

---

## 🔬 Scientific Model Semantics (SIH V3 Nowcast)

- **Model Architecture**: ConvLSTM with Encoder-Decoder & 4 Horizon Output Heads (`SIHV3Nowcast`).
- **Input Dimensions**: `(1, 6, 8, 128, 128)` — 6 temporal frames (10-min cadence), 8 meteorological channels, 128x128 spatial resolution.
- **Strict Channel Order**: `["B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"]`.
- **Target Meaning**: `P(future B13 < 235 K)` — **Cold-Cloud / Deep-Convection Proxy Probability**.
- **Important Note**: Output represents deep convective proxy probabilities. It is not direct lightning, hail, or cloudburst detection. All derived hazard scores are explicitly marked as proxies.
- **Horizons**: 30, 60, 90, and 120 minutes.
