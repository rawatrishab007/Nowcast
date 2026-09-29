"""
WeatherNow AI — Atmospheric Data Providers Package
"""

import os
from typing import Optional
from .base import BaseDataProvider, DataProviderError, DataValidationError
from .synthetic import SyntheticDataProvider
from .operational import OperationalDataProvider, LivePredictionService, live_prediction_service
from .himawari import HimawariDownloader, HimawariUnavailableError
from .gfs import GFSDownloader, GFSUnavailableError
from .alignment import SpatiotemporalAligner, TemporalAlignmentError, CHANNEL_NAMES, NUM_CHANNELS, NUM_FRAMES
from .v3_preprocessing import normalize_for_v3, construct_v3_input_tensor, V3_FROZEN_MEAN, V3_FROZEN_STD, verify_physical_units_and_ranges

__all__ = [
    "BaseDataProvider",
    "DataProviderError",
    "DataValidationError",
    "SyntheticDataProvider",
    "OperationalDataProvider",
    "LivePredictionService",
    "live_prediction_service",
    "HimawariDownloader",
    "HimawariUnavailableError",
    "GFSDownloader",
    "GFSUnavailableError",
    "SpatiotemporalAligner",
    "TemporalAlignmentError",
    "CHANNEL_NAMES",
    "NUM_CHANNELS",
    "NUM_FRAMES",
    "normalize_for_v3",
    "construct_v3_input_tensor",
    "V3_FROZEN_MEAN",
    "V3_FROZEN_STD",
    "verify_physical_units_and_ranges",
    "get_data_provider",
]


def get_data_provider(provider_type: Optional[str] = None) -> BaseDataProvider:
    """
    Factory function to retrieve the configured data provider instance.
    Configurable via DATA_PROVIDER environment variable ('synthetic' | 'operational').
    Defaults to 'synthetic' for reliable testing & demo fallback.
    """
    provider_name = provider_type or os.getenv("DATA_PROVIDER", "synthetic").lower().strip()

    if provider_name in ("operational", "live", "gfs"):
        return OperationalDataProvider()
    
    # Default / fallback: synthetic provider
    return SyntheticDataProvider()
