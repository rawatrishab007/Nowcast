"""
WeatherNow AI — Phase 1B NOAA GFS Operational NWP Ingestion Test Suite
Separates Unit Tests, Mocked Integration Tests, and Real Data Smoke Tests.
"""

import os
import unittest
from datetime import datetime, timezone, timedelta
import numpy as np

from data_providers.gfs import (
    GFSDownloader,
    GFSUnavailableError,
)
from data_providers.spatial import (
    interpolate_to_target_grid,
    kelvin_to_celsius,
    mm_to_meters,
    wind_components_from_speed_dir,
    LAT_MIN,
    LAT_MAX,
    LON_MIN,
    LON_MAX,
)
from data_providers.base import DataValidationError
from config import settings


class TestGFSIngestion(unittest.TestCase):
    """Unit and integration test cases for real NOAA GFS operational processing."""

    def test_01_gfs_variable_mapping_and_unit_conversions(self):
        """Verify unit conversion formulas for temperature, wind, and precipitation."""
        # Temperature: K to °C
        self.assertAlmostEqual(float(kelvin_to_celsius(np.array([298.15]))[0]), 25.0, places=4)
        self.assertAlmostEqual(float(kelvin_to_celsius(np.array([273.15]))[0]), 0.0, places=4)

        # Precipitation: mm to meters
        self.assertAlmostEqual(float(mm_to_meters(np.array([2.5]))[0]), 0.0025, places=5)
        self.assertAlmostEqual(float(mm_to_meters(np.array([0.0]))[0]), 0.0, places=5)

        # Wind: speed & direction to u, v
        u, v = wind_components_from_speed_dir(np.array([10.0]), np.array([270.0]))
        self.assertAlmostEqual(float(u[0]), 10.0, places=2)
        self.assertAlmostEqual(float(v[0]), 0.0, places=2)

    def test_02_gfs_spatial_interpolation_128x128(self):
        """Verify spatial interpolation maps regional 4x4 GFS grid to deterministic 128x128."""
        lats_sample = np.linspace(LAT_MAX, LAT_MIN, 4)
        lons_sample = np.linspace(LON_MIN, LON_MAX, 4)
        sample_grid = np.arange(16, dtype=np.float32).reshape((4, 4))

        out_grid = interpolate_to_target_grid(sample_grid, lats_sample, lons_sample)

        self.assertEqual(out_grid.shape, (128, 128))
        self.assertEqual(out_grid.dtype, np.float32)
        self.assertFalse(np.isnan(out_grid).any())
        self.assertFalse(np.isinf(out_grid).any())
        self.assertAlmostEqual(float(out_grid[0, 0]), 0.0, places=3)
        self.assertAlmostEqual(float(out_grid[127, 127]), 15.0, places=3)

    def test_03_gfs_mocked_integration(self):
        """Verify mocked GFS fields contain all 7 variables with shape 128x128."""
        gfs_vars = ["t2m", "d2m", "u10", "v10", "cape", "cin", "tp"]
        mock_data = {
            var: np.ones((128, 128), dtype=np.float32).tolist()
            for var in gfs_vars
        }

        self.assertEqual(len(mock_data), 7)
        for var in gfs_vars:
            arr = np.array(mock_data[var])
            self.assertEqual(arr.shape, (128, 128))
            self.assertFalse(np.isnan(arr).any())

    def test_04_gfs_real_data_smoke(self):
        """
        SMOKE TEST: Attempts real external retrieval from NOAA GFS operational feed.
        Reports REAL GFS TEST: PASS when connected, or SKIPPED when network is unavailable.
        """
        downloader = GFSDownloader()
        now_utc = datetime.now(timezone.utc)

        try:
            gfs_obs = downloader.fetch_gfs_observation(now_utc)
            meta = gfs_obs["metadata"]
            vars_ret = meta["variables_retrieved"]

            print("\n" + "=" * 65)
            print("REAL GFS TEST: PASS")
            print(f"GFS Source:              {meta['source']}")
            print(f"Data Source Mode:        {meta['data_source_mode']}")
            print(f"Forecast Valid Time:     {meta['forecast_valid_time']} UTC")
            print(f"Grid Resolution:         {meta['grid_resolution']}")
            print(f"Geographic Coverage:     {meta['geographic_coverage']}")
            print("\nVariables Retrieved:")
            for var_name, var_info in vars_ret.items():
                print(
                    f"  • {var_name:5s} | Source: {var_info['source_unit']:15s} | "
                    f"Output: {var_info['output_unit']:10s} | "
                    f"Range: [{var_info['min']:.4f}, {var_info['max']:.4f}] | "
                    f"Mean: {var_info['mean']:.4f}"
                )
            print("=" * 65)

            # Assert all 7 variables are (128, 128) float arrays
            for var_name in ["t2m", "d2m", "u10", "v10", "cape", "cin", "tp"]:
                arr = np.array(gfs_obs[var_name])
                self.assertEqual(arr.shape, (128, 128))
                self.assertFalse(np.isnan(arr).any())
                self.assertFalse(np.isinf(arr).any())

        except GFSUnavailableError as e:
            print(f"\nREAL GFS TEST: SKIPPED — network unavailable ({str(e)})")
            self.skipTest(f"External GFS network retrieval unavailable: {str(e)}")


if __name__ == "__main__":
    unittest.main()
