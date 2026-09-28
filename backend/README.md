# WeatherNow AI — SIH V3 Nowcasting Backend Service

FastAPI serving service for the **SIH V3 PyTorch ConvLSTM Weather Nowcasting Model** (`SIHV3Nowcast`).

Provides real-time, short-range (0–120 minute) atmospheric prediction based on 6 temporal satellite and numerical weather prediction (NWP) frames across 8 meteorological channels.

---

## 🔬 Model Specification & Scientific Semantics

### Target Semantics
- **Target Formulation**: `future_B13 < 235 K`
- **Output Meaning**: `P(future B13 < 235 K)` — **Cold-Cloud / Deep-Convection Proxy Probability**
- **CRITICAL NOTE**: The output represents the probability of deep convective cloud-top cooling. It is **NOT** direct lightning, hail, or cloudburst detection. All derived hazard scores are explicitly designated as proxies.

### Input Specification
- **Tensor Input Shape**: `(batch_size, time_steps, channels, height, width)` = `(1, 6, 8, 128, 128)`
- **Temporal Sequence**: 6 consecutive frames spaced at 10-minute intervals:
  - Frame 1: $t - 50\text{ min}$
  - Frame 2: $t - 40\text{ min}$
  - Frame 3: $t - 30\text{ min}$
  - Frame 4: $t - 20\text{ min}$
  - Frame 5: $t - 10\text{ min}$
  - Frame 6: $t\text{ (current observation)}$
- **Channel Order**: Must strictly follow this exact 8-channel sequence:
  1. `B13`: Brightness Temperature (Kelvin, INSAT-3D/3DR TIR1 channel)
  2. `t2m`: 2m Surface Temperature (°C)
  3. `d2m`: 2m Dewpoint Temperature (°C)
  4. `u10`: 10m U-Wind Component (m/s)
  5. `v10`: 10m V-Wind Component (m/s)
  6. `cape`: Convective Available Potential Energy (J/kg)
  7. `cin`: Convective Inhibition (J/kg)
  8. `tp`: Total Precipitation (ERA5 surface parameter)

### Fixed Normalization
Inputs are normalized using fixed training-set constants (do NOT dynamically normalize from individual requests):
$$x_{\text{norm}} = \frac{x - \text{MEAN}}{\text{STD}}$$

```python
MEAN = np.array([258.9513, 24.3378, 17.6339, 2.7062, 1.7265, 720.3760, 90.9589, 0.0002], dtype=np.float32)
STD  = np.array([12.8962,  11.2362, 11.1469, 2.8719, 2.7279, 851.9800,  145.4562, 0.0007], dtype=np.float32)
```

### Output Specification
- **Output Tensor Shape**: `(1, 4, 128, 128)`
- **Activation**: Sigmoid ($\sigma$) applied to logits $\rightarrow [0.0, 1.0]$ probabilities.
- **Forecast Horizons**:
  - `horizons["30"]`: $+30\text{ minutes}$
  - `horizons["60"]`: $+60\text{ minutes}$
  - `horizons["90"]`: $+90\text{ minutes}$
  - `horizons["120"]`: $+120\text{ minutes}$

---

## 📁 Folder Structure

```
backend/
├── main.py                # FastAPI app, CORS, lifespan, global exception handlers
├── config.py              # Environment configuration & model constants
├── model_loader.py        # PyTorch SIHV3Nowcast architecture & checkpoint loader
├── inference.py           # Preprocessing, normalization, model inference execution
├── schemas.py             # Pydantic request & response models
├── requirements.txt       # Dependencies
├── .env.example           # Environment variables template
├── test_backend.py        # Automated test suite
├── models/
│   └── sih_v3_best.pth    # Place trained checkpoint here (or configure MODEL_PATH)
├── routes/
│   ├── health.py          # GET /api/health
│   ├── prediction.py      # GET /api/model-info, POST /api/predict
│   └── hazards.py         # POST /api/hazards
└── utils/
    └── preprocessing.py   # Normalization & shape validation logic
```

---

## 🚀 Setup & Execution

### 1. Prerequisites
- Python 3.10+
- PyTorch 2.0+

### 2. Environment Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Place Model Checkpoint
Place the trained checkpoint at:
```
backend/models/sih_v3_best.pth
```
*(Alternatively, point `MODEL_PATH` in `.env` to the checkpoint location).*

### 4. Configure Environment
```bash
cp .env.example .env
```
Default settings:
```env
MODEL_PATH=./models/sih_v3_best.pth
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
HOST=0.0.0.0
PORT=8000
```

### 5. Run the Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The interactive Swagger UI is accessible at:
[http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📡 API Endpoints

### 1. Health Check
`GET /api/health`

**Response (200 OK — Model Loaded)**:
```json
{
  "status": "ok",
  "model_loaded": true,
  "device": "mps",
  "message": "Model loaded and operational."
}
```

**Response (503 Service Unavailable — Checkpoint Missing)**:
```json
{
  "status": "error",
  "model_loaded": false,
  "device": "mps",
  "message": "Model checkpoint not found at path: ./models/sih_v3_best.pth"
}
```

---

### 2. Model Information
`GET /api/model-info`

**Response**:
```json
{
  "model": "SIH V3 ConvLSTM",
  "version": "v3.0.0",
  "input_channels": 8,
  "input_frames": 6,
  "frame_interval_minutes": 10,
  "forecast_horizons": [30, 60, 90, 120],
  "resolution": "128x128",
  "target": "P(future B13 < 235 K)",
  "output_type": "cold-cloud/deep-convection proxy probability",
  "channels": ["B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"]
}
```

---

### 3. Run Inference
`POST /api/predict`

**Request Body**:
```json
{
  "frames": [
    {
      "timestamp": "2026-09-28T12:00:00Z",
      "B13": [[240.5, ...], ...128 rows x 128 cols],
      "t2m": [[28.4, ...], ...128 rows x 128 cols],
      "d2m": [[22.1, ...], ...128 rows x 128 cols],
      "u10": [[3.2, ...], ...128 rows x 128 cols],
      "v10": [[1.8, ...], ...128 rows x 128 cols],
      "cape": [[1200.0, ...], ...128 rows x 128 cols],
      "cin": [[45.0, ...], ...128 rows x 128 cols],
      "tp": [[0.005, ...], ...128 rows x 128 cols]
    }
    // ... exactly 6 frames (10 min apart)
  ]
}
```

**Response (200 OK)**:
```json
{
  "status": "success",
  "model": "SIH V3 ConvLSTM",
  "target": "P(future B13 < 235 K)",
  "semantics": "cold-cloud/deep-convection proxy probability",
  "horizons": {
    "30": {
      "unit": "probability",
      "height": 128,
      "width": 128,
      "map": [[0.12, 0.45, ...], ...]
    },
    "60": {
      "unit": "probability",
      "height": 128,
      "width": 128,
      "map": [...]
    },
    "90": {
      "unit": "probability",
      "height": 128,
      "width": 128,
      "map": [...]
    },
    "120": {
      "unit": "probability",
      "height": 128,
      "width": 128,
      "map": [...]
    }
  }
}
```

---

### 4. Convective Hazard Proxies
`POST /api/hazards`

**Response (200 OK)**:
```json
{
  "status": "success",
  "disclaimer": "HAZARD PROXY INDICATORS ONLY...",
  "horizons": {
    "30": {
      "indicators": [
        {
          "hazard": "Deep Convective Storm",
          "proxy_type": "derived_proxy",
          "confidence": 0.3541,
          "peak_probability": 0.8214,
          "severity": "Critical",
          "description": "Proxy based on predicted cloud-top cooling (B13 < 235K)..."
        }
      ]
    }
  }
}
```

---

## 🧪 Testing

Run the automated backend test suite:
```bash
python3 test_backend.py
```
Verifies model architecture, normalization, tensor dimensions, and API routing.
