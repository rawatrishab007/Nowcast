# SIH V4 — Rainfall Nowcasting

V4 is the rainfall-nowcasting model developed for SIH26084.

## Input

Shape:

(1, 6, 8, 128, 128)

Channels:

1. B13
2. t2m
3. d2m
4. u10
5. v10
6. cape
7. cin
8. tp

Six input frames are separated by 10 minutes.

## Output

Four rainfall forecasts:

- +30 minutes
- +60 minutes
- +90 minutes
- +120 minutes

Rainfall target:
IMERG precipitation.

## Checkpoint

`sih_v4_rain_corrected_best.pth`

## Important

This is an experimental rainfall-nowcasting model.

The model underestimates extreme rainfall and should not be presented as an operationally validated forecasting system.

V4 provides the rainfall-nowcasting foundation for the later SIH Multi-Hazard V1 architecture.
