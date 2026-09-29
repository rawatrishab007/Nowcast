import numpy as np

PHYSICS_THRESHOLDS = {
    "cold_p50": 0.0,
    "cold_p99": 3.511749,

    "cape_p50": 403.080933,
    "cape_p99": 3802.541016,

    "cin_p50": 24.060404,
    "cin_p99": 686.133972,

    "wind_p50": 3.665158,
    "wind_p99": 10.770340,

    "dry_p50": 3.816540,
    "dry_p99": 28.799593,

    "tp_p50": 0.000021,
    "tp_p99": 0.002924,
}


def score_feature(value, p50, p99):
    value = np.asarray(value, dtype=np.float32)
    denominator = max(p99 - p50, 1e-8)
    score = (value - p50) / denominator
    return np.clip(score, 0.0, 1.0)


def calculate_physics_hazards(latest_frame):
    """
    Calculate physics-informed proxy risk scores for severe weather.
    Input:
        latest_frame: (8, 128, 128) physical float32 array
        Channels: B13, t2m, d2m, u10, v10, cape, cin, tp
    Returns:
        Dictionary containing 128x128 risk-score maps [0.0 - 1.0].
    """
    latest_frame = np.asarray(latest_frame, dtype=np.float32)

    if latest_frame.shape != (8, 128, 128):
        raise ValueError(f"Expected latest_frame shape (8, 128, 128), got {latest_frame.shape}")

    if not np.isfinite(latest_frame).all():
        raise ValueError("latest_frame contains NaN or Inf")

    B13 = latest_frame[0]
    T2M = latest_frame[1]
    D2M = latest_frame[2]
    U10 = latest_frame[3]
    V10 = latest_frame[4]
    CAPE = latest_frame[5]
    CIN = latest_frame[6]
    TP = latest_frame[7]

    WIND = np.sqrt(U10 ** 2 + V10 ** 2)
    DRY_AIR = np.maximum(T2M - D2M, 0.0)
    COLD_CLOUD = np.maximum(235.0 - B13, 0.0)

    cold_score = score_feature(COLD_CLOUD, PHYSICS_THRESHOLDS["cold_p50"], PHYSICS_THRESHOLDS["cold_p99"])
    cape_score = score_feature(CAPE, PHYSICS_THRESHOLDS["cape_p50"], PHYSICS_THRESHOLDS["cape_p99"])
    cin_score = 1.0 - score_feature(CIN, PHYSICS_THRESHOLDS["cin_p50"], PHYSICS_THRESHOLDS["cin_p99"])
    wind_score = score_feature(WIND, PHYSICS_THRESHOLDS["wind_p50"], PHYSICS_THRESHOLDS["wind_p99"])
    dry_air_score = score_feature(DRY_AIR, PHYSICS_THRESHOLDS["dry_p50"], PHYSICS_THRESHOLDS["dry_p99"])
    tp_score = score_feature(TP, PHYSICS_THRESHOLDS["tp_p50"], PHYSICS_THRESHOLDS["tp_p99"])

    lightning = 0.40 * cold_score + 0.30 * cape_score + 0.20 * tp_score + 0.10 * cin_score
    thunderstorm = 0.35 * cold_score + 0.30 * cape_score + 0.25 * tp_score + 0.10 * cin_score
    hail = 0.50 * cold_score + 0.30 * cape_score + 0.20 * tp_score
    cloudburst = 0.55 * tp_score + 0.25 * cape_score + 0.15 * cold_score + 0.05 * cin_score
    downburst = 0.35 * tp_score + 0.25 * cape_score + 0.20 * wind_score + 0.15 * dry_air_score + 0.05 * cin_score

    return {
        "lightning": np.clip(lightning, 0.0, 1.0),
        "thunderstorm": np.clip(thunderstorm, 0.0, 1.0),
        "hail": np.clip(hail, 0.0, 1.0),
        "cloudburst": np.clip(cloudburst, 0.0, 1.0),
        "downburst": np.clip(downburst, 0.0, 1.0),
    }
