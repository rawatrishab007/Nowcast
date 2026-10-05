# Megh Setu — Frontend Web Dashboard

**Megh Setu** frontend is a high-performance, responsive web application for real-time convective nowcasting (0–120 minutes) across the Indian subcontinent.

🌐 **Live Vercel Deployment**: [https://frontend-gamma-six-53.vercel.app](https://frontend-gamma-six-53.vercel.app)

---

## 🛠️ Technology Stack

* **Framework**: React 19 + TypeScript + Vite
* **Styling**: Tailwind CSS (ChatGPT-Style Neutral Dark Theme with White Situation Report Document Mode)
* **Map Layer**: Leaflet (`react-leaflet` with custom Canvas colormap renderers and bilinear interpolation)
* **Visuals**: Responsive SVG charts & JetBrains Mono / Montserrat typography
* **API Client**: Axios with automated retry and error code propagation

---

## 📁 Directory Structure

```
frontend/
├── public/
│   └── favicon.svg           # Megh Setu application icon
├── src/
│   ├── components/
│   │   ├── Header.tsx                    # Top navigation & operational status
│   │   ├── MapView.tsx                   # High-resolution Leaflet map layer
│   │   ├── PredictionControls.tsx        # Hazard layer & horizon selector
│   │   ├── ScenarioReplayControls.tsx    # Horizon scrubber timeline
│   │   ├── LocationInspector.tsx         # Station & probe grid cell inspector
│   │   ├── LocationRiskCard.tsx          # Point risk outputs & severe proxies
│   │   ├── AlertEngineCard.tsx           # Rule-based decision-support alert engine
│   │   ├── ForecastTrendChart.tsx        # SVG multi-horizon trend series
│   │   ├── OperationalIntegrationCard.tsx# Live ingestion health rows
│   │   ├── DataHealthMonitor.tsx         # Latency, model status & diagnostics
│   │   ├── SituationReportModal.tsx      # Formal printable white-background SitRep
│   │   ├── SummaryMetricCards.tsx        # 4-card overview metrics grid
│   │   ├── LoadingState.tsx              # Ingestion & model loading overlay
│   │   └── ErrorState.tsx                # Operational warning banner
│   ├── services/
│   │   └── api.ts                        # Centralized Axios API client
│   ├── types/
│   │   └── weather.ts                    # TypeScript domain interfaces
│   ├── utils/
│   │   ├── alertEngine.ts                # Rule-based meteorological threshold engine
│   │   ├── exportUtils.ts                # CSV & JSON 4-horizon data exporters
│   │   ├── geocoding.ts                  # Reverse geocoding utility
│   │   └── timeUtils.ts                  # IST (UTC+05:30) date & time formatters
│   ├── App.tsx                           # Main workspace shell & state manager
│   ├── constants.ts                      # Station catalog & bounding box coordinates
│   ├── index.css                         # Tailwind CSS & custom styling rules
│   └── index.tsx                         # Application React DOM root
├── package.json                          # Package configuration
├── index.html                            # HTML entry point & metadata
├── vite.config.ts                        # Vite build configuration
└── .env.example                          # Environment template
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Dashboard available at: `http://localhost:5173`

### 3. Build for Production
```bash
npm run build
```
Generates production bundle in `dist/`.

---

## ☁️ Vercel Deployment

The frontend is configured for one-click deployment on **Vercel**:

* **Root Directory**: `frontend`
* **Framework**: `Vite`
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **SPA Routing**: Handled via `frontend/vercel.json` (rewrites `/*` to `/index.html`)

### Connecting to Backend
In the Vercel project settings under **Environment Variables**, set:
```bash
VITE_API_BASE_URL=https://<your-aws-backend-domain>
```
All API queries will automatically target the production backend while preserving full route paths.

