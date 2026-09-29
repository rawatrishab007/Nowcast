# SIH Multi-Hazard V1

Multi-hazard nowcasting prototype for SIH26084.

## Input

The model expects:

(1, 6, 8, 128, 128)

Six frames at 10-minute intervals.

Channel order:

1. B13
2. t2m
3. d2m
4. u10
5. v10
6. cape
7. cin
8. tp

## Neural outputs

Rainfall:

- +30 minutes
- +60 minutes
- +90 minutes
- +120 minutes

Rainfall unit:

mm/hr

Rainfall is produced by the experimental neural rainfall head.

## Hazard outputs

The system exposes:

- Lightning
- Thunderstorm
- Hail
- Cloudburst
- Downburst

These five hazards currently use physics-informed proxy risk scores rather than observationally calibrated probabilities.

Cloudburst is marked experimental because its current validation performance is limited.

## Grid

128 × 128

Latitude:

8°N to 38°N

Longitude:

68°E to 98°E

## Architecture

Himawari + ERA5
        ↓
CNN encoder
        ↓
ConvLSTM
        ↓
Shared decoder
        ↓
Multi-hazard output heads

## Checkpoint

`sih_multihazard_v1_best.pth`

## Files

- `model.py` — trained neural architecture
- `physics.py` — physics-informed hazard proxy calculations
- `inference.py` — preprocessing, model inference and output assembly
- `sih_multihazard_v1_best.pth` — trained checkpoint

## Validation status

This is a research/demo prototype.

The rainfall head currently underestimates extreme rainfall intensity.

The non-rain hazard outputs are physics-informed proxies and are not direct observationally calibrated hazard probabilities.

The current demonstrated forecast horizon is 30–120 minutes. The architecture can be extended to longer horizons.

## Important

Do not label the proxy outputs as measured lightning, hail, thunderstorm, cloudburst or downburst probabilities.

Use `risk_score` for proxy hazards.
