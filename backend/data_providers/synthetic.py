"""
WeatherNow AI — Synthetic Atmospheric Data Provider
Provides procedurally generated atmospheric frames for demonstration and testing.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import numpy as np

from config import settings
from .base import BaseDataProvider


class SyntheticDataProvider(BaseDataProvider):
    """
    Generates synthetic 6-frame sequences featuring active convective storm dynamics.
    Used as an offline fallback and testing baseline.
    """

    def __init__(self, default_seed: int = 42):
        self.default_seed = default_seed

    @property
    def provider_name(self) -> str:
        return "synthetic_demo"

    @property
    def is_live(self) -> bool:
        return False

    def fetch_frames(
        self,
        target_time: Optional[datetime] = None,
        seed: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        used_seed = seed if seed is not None else self.default_seed
        rng = np.random.default_rng(used_seed)

        ref_time = target_time or datetime.now(timezone.utc)
        base_time = ref_time - timedelta(minutes=50)
        frames = []

        # 128x128 spatial coordinate mesh
        y, x = np.mgrid[0:128, 0:128]
        # Convective storm cluster coordinates
        cx, cy = 64, 64

        for t in range(settings.INPUT_FRAMES):
            frame_time = (base_time + timedelta(minutes=t * settings.FRAME_INTERVAL_MINUTES)).isoformat()
            
            # Storm movement: eastward +3 px/frame, northward +1 px/frame
            offset_x = cx + (t * 3)
            offset_y = cy + (t * 1)
            dist_sq = (x - offset_x) ** 2 + (y - offset_y) ** 2
            storm_core = np.exp(-dist_sq / (2 * 18 ** 2))

            # Channel synthesis aligned with training distributions & units
            b13_grid = (settings.MEAN[0] - (storm_core * 45.0) + rng.normal(0, 1.5, (128, 128))).astype(float).tolist()
            t2m_grid = (settings.MEAN[1] - (storm_core * 4.0) + rng.normal(0, 0.8, (128, 128))).astype(float).tolist()
            d2m_grid = (settings.MEAN[2] + (storm_core * 2.0) + rng.normal(0, 0.5, (128, 128))).astype(float).tolist()
            u10_grid = (settings.MEAN[3] + (storm_core * 8.0) + rng.normal(0, 0.5, (128, 128))).astype(float).tolist()
            v10_grid = (settings.MEAN[4] + (storm_core * 5.0) + rng.normal(0, 0.5, (128, 128))).astype(float).tolist()
            cape_grid = (settings.MEAN[5] + (storm_core * 1200.0) + rng.normal(0, 50.0, (128, 128))).clip(0, 4500).astype(float).tolist()
            cin_grid = (settings.MEAN[6] - (storm_core * 60.0) + rng.normal(0, 10.0, (128, 128))).clip(0, 500).astype(float).tolist()
            tp_grid = (np.maximum(0, (storm_core * 0.008) + rng.normal(0, 0.0001, (128, 128)))).astype(float).tolist()

            frames.append({
                "timestamp": frame_time,
                "B13": b13_grid,
                "t2m": t2m_grid,
                "d2m": d2m_grid,
                "u10": u10_grid,
                "v10": v10_grid,
                "cape": cape_grid,
                "cin": cin_grid,
                "tp": tp_grid,
            })

        return frames
