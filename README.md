# Megh Setu

**AI-Powered Convective Weather Nowcasting & Severe Weather Decision Support Platform**  
*Smart India Hackathon (SIH26084)*

---

## 🛰️ Overview

**Megh Setu** is an operational short-range weather nowcasting and severe convective hazard assessment platform engineered for the Indian subcontinent (domain: **8°N–38°N, 68°E–98°E**). 

The platform integrates real-time **Himawari-9 AHI satellite infrared observations** with **NOAA GFS 0.25° Numerical Weather Prediction (NWP)** fields. By feeding temporally synchronized 6-frame atmospheric tensors into multi-model ConvLSTM neural networks, Megh Setu generates high-resolution 0–120 minute nowcasts (+30m, +60m, +90m, +120m) for precipitation, deep convection, and severe weather hazard indicators.

```
                   MEGH SETU OPERATIONAL PIPELINE
                   
  Himawari-9 AHI (Band 13)            NOAA GFS 0.25° NWP Fields
  [10.4µm IR Brightness Temp]        [t2m, d2m, u10, v10, CAPE, CIN, tp]
              │                                      │
              └───────────────┬──────────────────────┘
                              ▼
                Spatiotemporal Grid Alignment
                  6 frames @ 10-min cadence
                              ▼
                 Input Tensor (1, 6, 8, 128, 128)
                              ▼
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   Model V4              Model V3              Model V1
Rainfall Nowcast     Convective Cloud      Severe Weather
(Rain Rate & Prob)   P(B13 < 235 K)        Hazard Assessment
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                  FastAPI Backend Services
                  (/api/v1/nowcast, /api/health)
                              ▼
            Megh Setu High-Contrast Operations UI
         (Interactive Map, Replay, Alert Engine, SitRep)
```

---

## ✨ Key Capabilities

* **Live Satellite Ingestion**: Direct automated ingestion and decoding of NOAA Himawari-9 AHI Band 13 (10.4 µm clean infrared) brightness temperature grids.
* **Operational NWP Integration**: Real-time atmospheric thermodynamic and kinematic parameters from NOAA GFS 0.25° resolution fields.
* **Temporal Alignment Engine**: Synchronizes 6 historical time slices ($t_{-50\text{m}}$ to $t_0$ at 10-minute cadence) into calibrated 8-channel physical tensors.
* **Multi-Horizon Nowcasting**: Continuous spatial predictions at **+30 min**, **+60 min**, **+90 min**, and **+120 min** lead times on a 128×128 grid (approx. 60 km domain resolution).
* **Multi-Model Intelligence**:
  * **V4 Rainfall Nowcast**: Experimental quantitative precipitation forecast (mm/hr) and precipitation occurrence probability $[0, 1]$.
  * **V3 Convective Cloud Nowcast**: Predicts future cold-cloud deep convective proxy $P(\text{future } B_{13} < 235\text{ K})$.
  * **V1 Severe Weather Assessment**: Evaluates physical proxy risk scores for severe convective hazards.
* **Decision-Support Risk Engine**: Rule-based meteorological threshold evaluation triggering automated operational advisories.
* **Scenario Replay & Forecast Timeline**: Scrub through temporal forecast horizons with instant map rendering and coordinate inspection.
* **Geospatial Location Inspector**: Probe any point across India or select major monitoring stations with automated reverse geocoding.
* **Meteorological Situation Report (SitRep)**: One-click exportable, print-ready formal situation briefing with a dedicated clean white document layout.
* **Operational Health & Latency Monitor**: Real-time telemetry monitoring data freshness, model load states, ingestion health, and inference latency.
* **IST-Centric Interface**: All user-facing operational timestamps and validity windows formatted in Indian Standard Time (IST, UTC+05:30).

---

## 🔬 Model Architecture & Semantics

Megh Setu orchestrates three specialized neural architectures sharing a spatio-temporal ConvLSTM backbone:

### 1. Model V4 — Rainfall Nowcasting (`SIHV4RainfallNowcast`)
* **Role**: Experimental precipitation rate and occurrence nowcasting.
* **Parameters**: 93,208 parameters.
* **Architecture**: Conv2D Encoder $\rightarrow$ ConvLSTM recurrent cell (32 channels) $\rightarrow$ Conv2D Decoder with dual heads:
  * `rain`: Quantitative rainfall rate output in $\text{mm/hr}$.
  * `rain_probability`: Probability of precipitation occurrence $[0.0, 1.0]$.
* **Horizons**: +30, +60, +90, +120 minutes.
* **Note**: V4 is an experimental research model calibrated against satellite precipitation benchmarks.

### 2. Model V3 — Convective Cloud Nowcasting (`SIHV3Nowcast`)
* **Role**: Deep convection and cold-cloud proxy forecasting.
* **Parameters**: 200,996 parameters.
* **Architecture**: Conv2D Encoder (BatchNorm + ReLU) $\rightarrow$ ConvLSTM cell (48 hidden channels) $\rightarrow$ Conv2D Decoder $\rightarrow$ 4 Horizon Output Heads.
* **Target Semantics**: Continuous probability map of $P(\text{future } B_{13} < 235\text{ K})$.
* **Horizons**: +30, +60, +90, +120 minutes.
* **Input Dimensions**: $(1, 6, 8, 128, 128)$ across 8 meteorological channels.

### 3. Model V1 — Severe Weather Hazard Assessment (`SIHMultiHazardNowcast`)
* **Role**: Multi-hazard severe convective risk assessment.
* **Parameters**: 93,548 parameters.
* **Supported Hazards**:
  * ⚡ **Lightning** Risk Score $[0.0 - 1.0]$
  * ⛈️ **Thunderstorm** Risk Score $[0.0 - 1.0]$
  * 🧊 **Hail** Risk Score $[0.0 - 1.0]$
  * 🌊 **Cloudburst** Risk Score $[0.0 - 1.0]$
  * 💨 **Downburst** Risk Score $[0.0 - 1.0]$
* **Scientific Semantics**: V1 outputs represent proxy risk scores derived from atmospheric thermodynamic and kinematic instability parameters. They are risk assessment indices, not calibrated observational probabilities.

---

## 📊 Data Pipeline & Input Tensor Specification

Every inference pass constructs a normalized physical tensor of shape `(batch=1, time=6, channels=8, height=128, width=128)`:

| Index | Channel | Source | Description | Physical Unit |
| :---: | :---: | :---: | :--- | :---: |
| **0** | `B13` | Himawari-9 AHI | Clean Infrared Brightness Temperature (10.4 µm) | $\text{K}$ |
| **1** | `t2m` | GFS NWP | 2-meter Air Temperature | $\text{K}$ |
| **2** | `d2m` | GFS NWP | 2-meter Dewpoint Temperature | $\text{K}$ |
| **3** | `u10` | GFS NWP | 10-meter Zonal (U) Wind Component | $\text{m/s}$ |
| **4** | `v10` | GFS NWP | 10-meter Meridional (V) Wind Component | $\text{m/s}$ |
| **5** | `cape` | GFS NWP | Convective Available Potential Energy | $\text{J/kg}$ |
| **6** | `cin` | GFS NWP | Convective Inhibition | $\text{J/kg}$ |
| **7** | `tp` | GFS NWP | Total Precipitation Accumulation | $\text{m}$ |

### Live Operational Data Sources
* **Satellite Scans**: AWS Open Data Registry Public Bucket (`noaa-himawari9`) for Himawari-9 full-disk AHI Band 13 radiance data (public access, no AWS credentials required).
* **NWP Forecasts**: Operational 0.25° GFS atmospheric fields synchronized for the South Asian spatial bounding box ($8^\circ\text{N} - 38^\circ\text{N}$, $68^\circ\text{E} - 98^\circ\text{E}$).

---

## 🖥️ Frontend User Interface

The Megh Setu frontend is built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Vite**:

* **ChatGPT-Style Neutral Dark Operations Dashboard**:
  * True neutral charcoal background (`#181818`) with elevated lighter dark-grey cards (`#2A2A2A`) and subtle borders (`#383838`).
  * High-contrast white typography (`#FFFFFF` / `#F5F5F5`) with crisp blue section headings (`#60A5FA` / `text-blue-400`).
  * Color restraint: Red (`#EF4444` / `#DC2626`) is strictly reserved for critical alerts and error conditions.
* **Simplified Header Navigation**:
  * Clean navigation containing **Home** (Dashboard) and **Reports** (Situation Report).
* **Professional White Situation Report**:
  * Dedicated document layout with pure white background (`#FFFFFF`), near-black text, blue headings, and print-ready CSS formatting.
* **Interactive Leaflet Weather Map**: Custom colormaps for each hazard layer, smooth bilinear interpolation, and interactive probes.
* **Trend Analysis**: SVG multi-horizon trend charts with responsive value tags across lead times.

---

## 🔌 Backend REST API Reference

The FastAPI service exposes the following endpoints (documented via Swagger at `/docs`):

### Core Prediction Endpoints
* **`GET /api/v1/nowcast`** (Alias: `/api/nowcast`)  
  *Executes unified multi-model inference (V1, V3, V4) on live operational satellite & NWP data.*
* **`GET /api/predict/live`**  
  *Executes V3 convective nowcasting on live operational atmospheric inputs.*
* **`GET /api/predict/demo`**  
  *Executes nowcasting on stored benchmark validation datasets.*
* **`POST /api/predict`**  
  *Accepts custom 6-frame, 8-channel JSON tensors for research inference.*

### System Health & Diagnostics
* **`GET /api/health`**  
  *Returns backend operational readiness, hardware accelerator (`cpu`/`cuda`/`mps`), and model load statuses (V1, V3, V4).*
* **`GET /api/health/pipeline`**  
  *Returns data ingestion health for Himawari-9 S3, GFS NWP, temporal alignment, tensor validation, data freshness, and inference latencies.*
* **`GET /api/model-info`**  
  *Returns exact architecture specifications, channel ordering, and target semantics.*
* **`GET /`**  
  *Root discovery endpoint with service metadata and documentation links.*

---

## 📁 Repository Structure

```
Megh-Setu/
├── ai_ml/                      # Machine learning models & training artifacts
│   └── models/                 # Model definition packages (v1, v3, v4)
├── backend/                    # Python FastAPI service
│   ├── data_providers/         # Himawari-9 S3 & GFS NWP ingestion pipelines
│   ├── models/                 # PyTorch checkpoints (e.g., sih_v3_best.pth)
│   ├── routes/                 # FastAPI routes (health.py, prediction.py)
│   ├── utils/                  # Normalization & tensor preprocessing
│   ├── config.py               # Channel constants, spatial bounds, settings
│   ├── inference.py            # Unified model forward pass & hazard evaluation
│   ├── main.py                 # FastAPI application entry point & CORS
│   ├── model_loader.py         # ConvLSTM architectures & checkpoint managers
│   ├── physics.py              # Atmospheric thermodynamics & proxy estimators
│   ├── schemas.py              # Pydantic validation models
│   ├── requirements.txt        # Python backend dependencies
│   └── .env.example            # Backend configuration template
├── frontend/                   # React 19 + TypeScript + Vite web dashboard
│   ├── src/
│   │   ├── components/         # Dashboard & report components (Header, MapView, etc.)
│   │   ├── services/           # Axios API client services
│   │   ├── types/              # TypeScript meteorological data contracts
│   │   ├── utils/              # Alert engine, geocoding, time formatters, export
│   │   ├── App.tsx             # Main application workspace layout
│   │   ├── constants.ts        # Station catalog & bounding box definitions
│   │   ├── index.css           # Tailwind custom styling & Leaflet overrides
│   │   └── index.tsx           # React entry point
│   ├── package.json            # Frontend package scripts & dependencies
│   ├── vite.config.ts          # Vite build configuration & proxy rules
│   └── .env.example            # Frontend environment template
└── README.md                   # Root project documentation
```

---

## 🚀 Local Development Setup

### 1. Backend Setup (FastAPI)

#### Prerequisites
* Python 3.10+
* PyTorch 2.0+ (CPU, CUDA, or Apple Silicon MPS)

#### Installation & Startup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Start FastAPI server with live reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
* Interactive API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
* Health Status Endpoint: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

### 2. Frontend Setup (React / Vite)

#### Prerequisites
* Node.js 18+
* npm or yarn

#### Installation & Startup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
* Web Application Dashboard: [http://localhost:5173](http://localhost:5173)

#### Production Build Verification
```bash
cd frontend
npm run build
```

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)
```bash
# Model checkpoint path
MODEL_PATH=./models/sih_v3_best.pth

# Server configuration
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174

# Ingestion provider mode: 'operational' for live satellite/NWP data
DATA_PROVIDER=operational

# Operational Data Ingestion Sources
GFS_OPERATIONAL_API=https://api.open-meteo.com/v1
HIMAWARI_S3_BUCKET=noaa-himawari9
```

### Frontend (`frontend/.env`)
```bash
# Backend API base URL
VITE_API_BASE_URL=http://localhost:8000/api

# Automated refresh interval in seconds
VITE_REFRESH_INTERVAL=60

# Default initial station
VITE_DEFAULT_LOCATION=dehradun
```

---

## ⚠️ Scientific & Operational Disclaimer

* **Research Prototype**: Megh Setu is a meteorological research and decision-support prototype platform developed for the Smart India Hackathon (SIH26084).
* **Proxy Assessments**: All lightning, thunderstorm, hail, cloudburst, and downburst indicators are proxy risk scores derived from atmospheric instability parameters and are **not** direct calibrated observational sensor readings.
* **Non-Official Advisory**: Outputs from Megh Setu are intended for meteorological research, situational awareness, and decision support. They do **not** constitute official government weather forecasts or warnings. For official public weather alerts in India, always consult the **India Meteorological Department (IMD)**.

---

## 👥 Authors & Acknowledgments

* **Project**: Megh Setu — AI-Powered Convective Weather Nowcasting Platform
* **Competition**: Smart India Hackathon 2024 / 2026 (Problem Statement SIH26084)
* **Data Providers**: NOAA Open Data Dissemination (Himawari-9 AHI), NOAA NCEP (GFS 0.25° NWP), and Open-Meteo.
