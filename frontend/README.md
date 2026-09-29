# WeatherNow AI — Frontend Dashboard

**WeatherNow AI** is an AI-powered Weather Nowcasting and Early Warning System dashboard designed for real-time monitoring and short-term weather prediction (0–120 minutes).

---

## 🛠️ Technology Stack
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (Dark Dashboard Theme)
- **Charts**: Recharts (Observed vs Predicted time-series with confidence bounds)
- **Map Layer**: Leaflet (NPM package `leaflet` with dark, satellite, terrain tiles)
- **Icons**: Custom Weather SVG suite & Emoji tokens

---

## 📁 Directory Structure

```
frontend/
├── public/
│   └── favicon.svg           # WeatherNow AI SVG icon
├── src/
│   ├── components/
│   │   ├── common/           # Card, Page, Navigation, NavIcons
│   │   ├── charts/           # PredictionChart (Observed vs Predicted + Bounds)
│   │   └── map/              # WeatherMap (Leaflet npm layer)
│   ├── pages/                # Dashboard, Nowcast, WeatherMap, History, Alerts, ModelInsights, Settings, Reports
│   ├── services/             # weatherApi.ts (API Adapter & Mock Fallback)
│   ├── data/                 # mockData.ts (Centralized mock datasets)
│   ├── types/                # weather.ts (Shared domain TypeScript types)
│   ├── App.tsx               # Main routing shell
│   ├── index.tsx             # Entry point
│   └── constants.ts          # Constants & color tokens
├── package.json              # Package name: "weathernow-ai"
├── index.html                # Page entry with metadata
├── vite.config.ts            # Vite build configuration
├── .env.example              # API & Mock mode environment configuration
└── README.md                 # Frontend documentation
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open `http://localhost:5173` (or `http://localhost:5174`) in your browser.

### 3. Build for Production
```bash
npm run build
```
Generates production bundle in `frontend/dist/`.

---

## 🔌 ML Backend Integration (For ML Team)

All UI data fetching flows through a single adapter file:
`frontend/src/services/weatherApi.ts`

### Steps to connect the live ML model backend:
1. Create `.env` inside `frontend/`:
   ```env
   VITE_API_BASE_URL=http://your-backend-host:8000/api
   VITE_USE_MOCK_DATA=false
   ```
2. Ensure your backend exposes endpoints such as:
   - `GET /weather/current?location={id}`
   - `GET /weather/nowcast?location={id}`
   - `GET /weather/history?location={id}&hours={hours}`
   - `GET /weather/alerts`
   - `GET /model/status`
   - `GET /weather/map?time={minutesAhead}`
   - `POST /weather/predict`
3. The adapter layer in `weatherApi.ts` automatically switches to live HTTP requests when `VITE_USE_MOCK_DATA=false`.
