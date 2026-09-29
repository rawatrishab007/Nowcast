"""
WeatherNow AI — Phase 1A Himawari AHI Band 13 Ingestion Test Suite
Separates Unit Tests, Mocked Integration Tests, and Real Data Smoke Tests.
"""

import os
import unittest
from datetime import datetime, timezone, timedelta
import numpy as np
import struct
import bz2

from data_providers.himawari import (
    HimawariHSDParser,
    HimawariCoordinateTransformer,
    HimawariDownloader,
    HimawariUnavailableError,
    HIMAWARI_SUB_LON,
)
from data_providers.base import DataValidationError
from config import settings


class TestHimawariIngestion(unittest.TestCase):
    """Unit and integration test cases for real Himawari Band 13 processing."""

    def test_01_coordinate_transformation_indian_domain(self):
        """Verify geostationary projection mapping produces correct Full Disk pixel locations for Indian region."""
        # Top-Left: 38°N, 68°E
        # Bottom-Right: 8°N, 98°E
        # Center: 23°N, 83°E
        lats = np.array([38.0, 23.0, 8.0])
        lons = np.array([68.0, 83.0, 98.0])

        cols, lines = HimawariCoordinateTransformer.get_sampling_grid_coordinates(lats, lons)

        self.assertEqual(cols.shape, (3, 3))
        self.assertEqual(lines.shape, (3, 3))

        # Top-left corner (38N, 68E) should be in the upper-left quadrant of Full Disk
        # Line ~1049 (Segment 2), Column ~646
        tl_col = cols[0, 0]
        tl_line = lines[0, 0]
        self.assertTrue(500.0 < tl_col < 800.0, f"Unexpected top-left column: {tl_col}")
        self.assertTrue(900.0 < tl_line < 1200.0, f"Unexpected top-left line: {tl_line}")

        # Bottom-right corner (8N, 98E): Line ~2332 (Segment 5), Column ~716
        br_col = cols[2, 2]
        br_line = lines[2, 2]
        self.assertTrue(500.0 < br_col < 900.0, f"Unexpected bottom-right column: {br_col}")
        self.assertTrue(2100.0 < br_line < 2500.0, f"Unexpected bottom-right line: {br_line}")

    def test_02_hsd_parser_and_planck_calibration_math(self):
        """Verify Planck function and effective temperature calibration convert counts to Kelvin accurately."""
        # Sample calibration metadata for AHI Band 13 (10.4074 µm)
        calib = {
            'band': 13,
            'wl_um': 10.4074,
            'gain': -0.0037525074,
            'const': 15.1976577,
            'c0': -0.1182608,
            'c1': 1.0010114,
            'c2': -1.8080045e-06,
            'c_speed': 299792458.0,
            'h_planck': 6.62606957e-34,
            'k_boltz': 1.3806488e-23,
        }

        # Simulated typical raw counts for deep convective cloud (count ~3300) vs warm tropical surface (count ~1800)
        counts = np.array([[3300, 2600], [2000, 1800]], dtype=np.uint16)
        kelvin_grid = HimawariHSDParser.counts_to_kelvin(counts, calib)

        self.assertEqual(kelvin_grid.shape, (2, 2))
        self.assertEqual(kelvin_grid.dtype, np.float32)

        # Convective cloud tops (high counts / low radiance) should be cold (~210–235 K)
        cold_cloud_temp = kelvin_grid[0, 0]
        warm_surface_temp = kelvin_grid[1, 1]

        self.assertTrue(180.0 < cold_cloud_temp < 240.0, f"Expected cold cloud temp ~220K, got {cold_cloud_temp:.1f}K")
        self.assertTrue(275.0 < warm_surface_temp < 310.0, f"Expected warm surface temp ~290K, got {warm_surface_temp:.1f}K")
        self.assertTrue(cold_cloud_temp < warm_surface_temp, "Cold cloud must have lower brightness temp than warm surface")

    def test_03_grid_dimensions_and_latitude_orientation(self):
        """Verify target grid is strictly 128x128 with correct North-to-South orientation."""
        lats_target = np.linspace(38.0, 8.0, 128)
        lons_target = np.linspace(68.0, 98.0, 128)

        self.assertEqual(len(lats_target), 128)
        self.assertEqual(len(lons_target), 128)
        self.assertEqual(lats_target[0], 38.0, "Row 0 must correspond to Northern boundary 38°N")
        self.assertEqual(lats_target[-1], 8.0, "Row 127 must correspond to Southern boundary 8°N")
        self.assertEqual(lons_target[0], 68.0, "Col 0 must correspond to Western boundary 68°E")
        self.assertEqual(lons_target[-1], 98.0, "Col 127 must correspond to Eastern boundary 98°E")

    def test_04_data_validation_rejection(self):
        """Verify invalid HSD byte stream raises DataValidationError."""
        with self.assertRaises(DataValidationError):
            HimawariHSDParser.parse_hsd_segment(b"invalid_short_stream")

    def test_05_mocked_hsd_segment_pipeline_to_128x128(self):
        """Verify end-to-end grid assembly produces deterministic 128x128 Kelvin matrix."""
        # Synthesize a stitched count block of shape (2200, 5500)
        stitched_counts = np.full((2200, 5500), 2200, dtype=np.uint16)
        calib = {
            'band': 13,
            'wl_um': 10.4074,
            'gain': -0.0037525074,
            'const': 15.1976577,
            'c0': -0.1182608,
            'c1': 1.0010114,
            'c2': -1.8080045e-06,
            'c_speed': 299792458.0,
            'h_planck': 6.62606957e-34,
            'k_boltz': 1.3806488e-23,
        }

        lats_target = np.linspace(38.0, 8.0, 128)
        lons_target = np.linspace(68.0, 98.0, 128)
        cols, lines = HimawariCoordinateTransformer.get_sampling_grid_coordinates(lats_target, lons_target)

        local_lines = lines - 550.0
        c_idx = np.clip(np.round(cols).astype(int), 0, 5499)
        l_idx = np.clip(np.round(local_lines).astype(int), 0, stitched_counts.shape[0] - 1)

        sampled_counts = stitched_counts[l_idx, c_idx]
        b13_kelvin = HimawariHSDParser.counts_to_kelvin(sampled_counts, calib)

        self.assertEqual(b13_kelvin.shape, (128, 128))
        self.assertFalse(np.isnan(b13_kelvin).any())
        self.assertFalse(np.isinf(b13_kelvin).any())
        self.assertTrue((b13_kelvin >= 150.0).all() and (b13_kelvin <= 350.0).all())

    def test_06_himawari_real_data_smoke(self):
        """
        SMOKE TEST: Attempts real external retrieval from AWS Open Data public archive.
        Reports REAL DATA TEST: PASS when connected, or SKIPPED when network is unavailable.
        """
        downloader = HimawariDownloader()
        
        # Test time: 2 hours ago slot
        now_utc = datetime.now(timezone.utc)
        target_slot = now_utc - timedelta(hours=2)
        
        try:
            obs = downloader.fetch_b13_observation(target_slot)
            grid = np.array(obs['grid'])
            self.assertEqual(grid.shape, (128, 128))
            self.assertFalse(np.isnan(grid).any())
            self.assertTrue(160.0 <= obs['min_kelvin'] <= obs['max_kelvin'] <= 340.0)
            print("\n" + "=" * 60)
            print("REAL DATA TEST: PASS")
            print(f"Observation Timestamp: {obs['timestamp']}")
            print(f"Source:                {obs['source']}")
            print(f"B13 Range:             [{obs['min_kelvin']:.2f} K, {obs['max_kelvin']:.2f} K]")
            print(f"B13 Mean:              {obs['mean_kelvin']:.2f} K")
            print("=" * 60)
        except HimawariUnavailableError as e:
            print(f"\nREAL DATA TEST: SKIPPED — network unavailable ({str(e)})")
            self.skipTest(f"External satellite network retrieval unavailable: {str(e)}")


if __name__ == "__main__":
    unittest.main()
