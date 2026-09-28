# SIH26084 — V3 AI/ML Model

## Status
FROZEN — STABLE BASELINE

## Model
ConvLSTM-based spatiotemporal nowcasting model.

Parameters: 200,996

## Input

Shape:

(1, 6, 8, 128, 128)

Meaning:

- 1 = batch
- 6 = six consecutive 10-minute frames
- 8 = meteorological/satellite channels
- 128 × 128 = spatial grid

## Channels

0. Himawari-9 AHI B13
1. ERA5 2m temperature
2. ERA5 2m dew point
3. ERA5 10m u-wind
4. ERA5 10m v-wind
5. ERA5 CAPE
6. ERA5 CIN
7. ERA5 total precipitation

## Forecast Horizons

The model produces four probability maps:

- +30 minutes
- +60 minutes
- +90 minutes
- +120 minutes

Output shape:

(1, 4, 128, 128)

## Target

Probability of:

B13 < 235 K

This represents a cold-cloud / deep-convection proxy.

It is NOT a direct observed lightning, hail,
cloudburst, or downburst prediction.

## Normalization

Training-set mean:

258.9513
24.3378
17.6339
2.7062
1.7265
720.3760
90.9589
0.0002

Training-set standard deviation:

12.8962
11.2362
11.1469
2.8719
2.7279
851.9800
145.4562
0.0007

## V3 Status

V3 is frozen as the stable baseline.

Future improvements will be developed as V4, V5, etc.

V3 must remain unchanged as the fallback model.
