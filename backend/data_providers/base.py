"""
WeatherNow AI — Base Data Provider Interface & Validation
Defines the standard contract for atmospheric data ingestion across all sources.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import numpy as np
import logging

from config import settings

logger = logging.getLogger("weathernow.data_providers.base")


class DataProviderError(Exception):
    """Base exception for data provider failures."""
    pass


class DataValidationError(DataProviderError):
    """Raised when atmospheric data fails validation checks."""
    pass


class BaseDataProvider(ABC):
    """
    Abstract Base Class for atmospheric data providers.
    Guarantees output conforms strictly to:
      6 frames x 8 channels x 128 x 128
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the data provider implementation."""
        pass

    @property
    @abstractmethod
    def is_live(self) -> bool:
        """True if data is from real operational/live feeds, False if synthetic/mock."""
        pass

    @abstractmethod
    def fetch_frames(self, target_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Fetches or constructs 6 temporal frames of atmospheric data.
        
        Args:
            target_time: Optional reference UTC timestamp (defaults to now).

        Returns:
            List of 6 dictionaries, each containing:
              - timestamp: ISO 8601 string
              - B13: 128x128 2D list/array of float (Brightness Temp in K)
              - t2m: 128x128 2D list/array of float (2m Temp in °C)
              - d2m: 128x128 2D list/array of float (2m Dewpoint in °C)
              - u10: 128x128 2D list/array of float (10m U-Wind in m/s)
              - v10: 128x128 2D list/array of float (10m V-Wind in m/s)
              - cape: 128x128 2D list/array of float (CAPE in J/kg)
              - cin: 128x128 2D list/array of float (CIN in J/kg)
              - tp: 128x128 2D list/array of float (Total Precipitation in m)
        """
        pass

    def get_frames(self, target_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Public template method that fetches frames and executes comprehensive validation.
        """
        frames = self.fetch_frames(target_time=target_time)
        self.validate_frames(frames)
        return frames

    def validate_frames(self, frames: List[Dict[str, Any]]) -> None:
        """
        Validates frame count, channel completeness, 128x128 matrix dimensions,
        and checks for NaN/infinite values and basic physical sanity bounds.
        """
        if not isinstance(frames, list):
            raise DataValidationError(f"Expected list of frames, got {type(frames)}")

        if len(frames) != settings.INPUT_FRAMES:
            raise DataValidationError(
                f"Expected exactly {settings.INPUT_FRAMES} frames, received {len(frames)}."
            )

        # Expected physical validity ranges for channels (for unit validation)
        physical_ranges = {
            "B13": (150.0, 350.0),    # Brightness Temp (K)
            "t2m": (-60.0, 65.0),     # 2m Temp (°C)
            "d2m": (-60.0, 45.0),     # 2m Dewpoint (°C)
            "u10": (-120.0, 120.0),   # 10m U-Wind (m/s)
            "v10": (-120.0, 120.0),   # 10m V-Wind (m/s)
            "cape": (0.0, 10000.0),   # CAPE (J/kg)
            "cin": (0.0, 2000.0),     # CIN (J/kg)
            "tp": (0.0, 1.5),         # Total Precipitation (m)
        }

        for t_idx, frame in enumerate(frames):
            if not isinstance(frame, dict):
                raise DataValidationError(f"Frame {t_idx} is not a valid dictionary.")

            if "timestamp" not in frame:
                raise DataValidationError(f"Frame {t_idx} is missing timestamp.")

            for ch in settings.CHANNELS:
                if ch not in frame:
                    raise DataValidationError(
                        f"Frame {t_idx} is missing required channel '{ch}' from provider {self.provider_name}."
                    )

                data = np.asarray(frame[ch], dtype=np.float32)

                if data.shape != (settings.HEIGHT, settings.WIDTH):
                    raise DataValidationError(
                        f"Frame {t_idx}, channel '{ch}' has shape {data.shape}, "
                        f"expected ({settings.HEIGHT}, {settings.WIDTH})."
                    )

                if np.isnan(data).any():
                    raise DataValidationError(
                        f"Frame {t_idx}, channel '{ch}' contains NaN values."
                    )

                if np.isinf(data).any():
                    raise DataValidationError(
                        f"Frame {t_idx}, channel '{ch}' contains infinite values."
                    )

                # Physical range bounds sanity check
                min_val, max_val = physical_ranges.get(ch, (-1e9, 1e9))
                actual_min = float(np.min(data))
                actual_max = float(np.max(data))

                if actual_min < min_val - 1e-3 or actual_max > max_val + 1e-3:
                    logger.warning(
                        f"Physical range advisory for channel '{ch}' in frame {t_idx}: "
                        f"values range [{actual_min:.3f}, {actual_max:.3f}], expected ~[{min_val}, {max_val}]."
                    )
