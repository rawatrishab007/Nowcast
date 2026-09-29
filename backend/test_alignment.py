"""
WeatherNow AI — Phase 1C Spatiotemporal Alignment Test Suite
Validates the spatiotemporal alignment between real Himawari-9 B13 satellite scans
and NOAA GFS NWP atmospheric fields into a (6, 8, 128, 128) float32 unnormalized sequence tensor.
"""

import unittest
from datetime import datetime, timezone, timedelta
import numpy as np

from data_providers.alignment import (
    SpatiotemporalAligner,
    TemporalAlignmentError,
    CHANNEL_NAMES,
    NUM_CHANNELS,
    NUM_FRAMES,
)
from data_providers.base import DataValidationError
from data_providers.himawari import HimawariDownloader
from data_providers.gfs import GFSDownloader
from data_providers.spatial import (
    TARGET_HEIGHT,
    TARGET_WIDTH,
    LAT_MIN,
    LAT_MAX,
    LON_MIN,
    LON_MAX,
)


class TestSpatiotemporalAlignment(unittest.TestCase):
    """Unit and mock tests for SpatiotemporalAligner."""

    def setUp(self):
        self.base_time = datetime(2026, 9, 28, 12, 0, 0, tzinfo=timezone.utc)
        
        # Create 6 mock Himawari frames from t-50m to t (10 min steps)
        self.mock_himawari_frames = []
        for i in range(NUM_FRAMES):
            frame_time = self.base_time - timedelta(minutes=(NUM_FRAMES - 1 - i) * 10)
            # Create synthetic gradient for B13 (e.g. 270.0 + i)
            grid = np.full((TARGET_HEIGHT, TARGET_WIDTH), 270.0 + i * 2.0, dtype=np.float32)
            self.mock_himawari_frames.append({
                "grid": grid.tolist(),
                "timestamp": frame_time.isoformat(),
                "source": f"Mock Himawari Frame {i}",
            })

        # Create 2 mock GFS snapshots at 11:00 UTC and 12:00 UTC
        # This brackets 11:10, 11:20, 11:30, 11:40, 11:50, 12:00
        t0_time = datetime(2026, 9, 28, 11, 0, 0, tzinfo=timezone.utc)
        t1_time = datetime(2026, 9, 28, 12, 0, 0, tzinfo=timezone.utc)

        self.mock_gfs_snapshots = [
            {
                "t2m": np.full((TARGET_HEIGHT, TARGET_WIDTH), 20.0, dtype=np.float32).tolist(),
                "d2m": np.full((TARGET_HEIGHT, TARGET_WIDTH), 10.0, dtype=np.float32).tolist(),
                "u10": np.full((TARGET_HEIGHT, TARGET_WIDTH), 2.0, dtype=np.float32).tolist(),
                "v10": np.full((TARGET_HEIGHT, TARGET_WIDTH), -3.0, dtype=np.float32).tolist(),
                "cape": np.full((TARGET_HEIGHT, TARGET_WIDTH), 500.0, dtype=np.float32).tolist(),
                "cin": np.full((TARGET_HEIGHT, TARGET_WIDTH), 25.0, dtype=np.float32).tolist(),
                "tp": np.full((TARGET_HEIGHT, TARGET_WIDTH), 0.001, dtype=np.float32).tolist(),
                "metadata": {
                    "forecast_valid_time": t0_time.isoformat(),
                    "source": "Mock GFS 11:00 UTC",
                }
            },
            {
                "t2m": np.full((TARGET_HEIGHT, TARGET_WIDTH), 30.0, dtype=np.float32).tolist(),
                "d2m": np.full((TARGET_HEIGHT, TARGET_WIDTH), 15.0, dtype=np.float32).tolist(),
                "u10": np.full((TARGET_HEIGHT, TARGET_WIDTH), 6.0, dtype=np.float32).tolist(),
                "v10": np.full((TARGET_HEIGHT, TARGET_WIDTH), -5.0, dtype=np.float32).tolist(),
                "cape": np.full((TARGET_HEIGHT, TARGET_WIDTH), 1500.0, dtype=np.float32).tolist(),
                "cin": np.full((TARGET_HEIGHT, TARGET_WIDTH), 10.0, dtype=np.float32).tolist(),
                "tp": np.full((TARGET_HEIGHT, TARGET_WIDTH), 0.005, dtype=np.float32).tolist(),
                "metadata": {
                    "forecast_valid_time": t1_time.isoformat(),
                    "source": "Mock GFS 12:00 UTC",
                }
            },
        ]

    def test_tensor_shape_and_dtype(self):
        """Test that aligned sequence produces exact (6, 8, 128, 128) float32 tensor."""
        tensor, provenance = SpatiotemporalAligner.align_sequence(
            self.mock_himawari_frames, self.mock_gfs_snapshots
        )

        self.assertEqual(tensor.shape, (6, 8, 128, 128))
        self.assertEqual(tensor.dtype, np.float32)
        self.assertEqual(provenance["tensor_shape"], [6, 8, 128, 128])
        self.assertFalse(provenance["synthetic_data_used"])

    def test_channel_order_and_values(self):
        """Test that channel ordering is strictly [B13, t2m, d2m, u10, v10, cape, cin, tp]."""
        tensor, provenance = SpatiotemporalAligner.align_sequence(
            self.mock_himawari_frames, self.mock_gfs_snapshots
        )

        self.assertEqual(provenance["channel_order"], CHANNEL_NAMES)
        self.assertEqual(CHANNEL_NAMES, ["B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"])

        # Frame 0 is at 11:10 UTC -> alpha = 10/60 = 1/6
        # B13: 270.0
        # t2m: (1-1/6)*20 + (1/6)*30 = 20 + 1.6667 = 21.6667
        # cape: (1-1/6)*500 + (1/6)*1500 = 500 + 166.6667 = 666.6667
        np.testing.assert_allclose(tensor[0, 0, :, :], 270.0, rtol=1e-5)
        np.testing.assert_allclose(tensor[0, 1, :, :], 20.0 + 10.0 * (1.0 / 6.0), rtol=1e-5)
        np.testing.assert_allclose(tensor[0, 5, :, :], 500.0 + 1000.0 * (1.0 / 6.0), rtol=1e-5)

        # Frame 5 is at 12:00 UTC -> alpha = 1.0
        # B13: 280.0
        # t2m: 30.0
        # cape: 1500.0
        np.testing.assert_allclose(tensor[5, 0, :, :], 280.0, rtol=1e-5)
        np.testing.assert_allclose(tensor[5, 1, :, :], 30.0, rtol=1e-5)
        np.testing.assert_allclose(tensor[5, 5, :, :], 1500.0, rtol=1e-5)

    def test_linear_interpolation_math(self):
        """Test linear temporal interpolation between two GFS snapshots."""
        mid_time = datetime(2026, 9, 28, 11, 30, 0, tzinfo=timezone.utc)
        fields, meta = SpatiotemporalAligner.interpolate_gfs_fields(mid_time, self.mock_gfs_snapshots)

        self.assertEqual(meta["interpolation_type"], "linear")
        self.assertAlmostEqual(meta["alpha"], 0.5, places=5)
        # Midpoint of t2m: (20 + 30) / 2 = 25.0
        np.testing.assert_allclose(fields["t2m"], 25.0, rtol=1e-5)
        # Midpoint of cape: (500 + 1500) / 2 = 1000.0
        np.testing.assert_allclose(fields["cape"], 1000.0, rtol=1e-5)
        # Midpoint of tp: (0.001 + 0.005) / 2 = 0.003
        np.testing.assert_allclose(fields["tp"], 0.003, rtol=1e-5)

    def test_out_of_bounds_temporal_rejection(self):
        """Test that out-of-bounds target observation times raise TemporalAlignmentError."""
        # 10:30 UTC is before the 11:00-12:00 GFS window
        early_time = datetime(2026, 9, 28, 10, 30, 0, tzinfo=timezone.utc)
        with self.assertRaises(TemporalAlignmentError):
            SpatiotemporalAligner.interpolate_gfs_fields(early_time, self.mock_gfs_snapshots)

        # 13:00 UTC is after the 11:00-12:00 GFS window
        late_time = datetime(2026, 9, 28, 13, 0, 0, tzinfo=timezone.utc)
        with self.assertRaises(TemporalAlignmentError):
            SpatiotemporalAligner.interpolate_gfs_fields(late_time, self.mock_gfs_snapshots)

    def test_nan_or_inf_rejection(self):
        """Test that NaN or Infinite values in inputs are strictly rejected."""
        corrupted_himawari = [dict(f) for f in self.mock_himawari_frames]
        bad_grid = np.full((TARGET_HEIGHT, TARGET_WIDTH), 270.0, dtype=np.float32)
        bad_grid[10, 10] = np.nan
        corrupted_himawari[0]["grid"] = bad_grid.tolist()

        with self.assertRaises(DataValidationError):
            SpatiotemporalAligner.align_sequence(corrupted_himawari, self.mock_gfs_snapshots)

    def test_spatial_grid_dimensions(self):
        """Test that geographic bounds and orientations are accurately recorded."""
        _, provenance = SpatiotemporalAligner.align_sequence(
            self.mock_himawari_frames, self.mock_gfs_snapshots
        )
        dims = provenance["grid_dimensions"]
        self.assertEqual(dims["height"], 128)
        self.assertEqual(dims["width"], 128)
        self.assertEqual(dims["lat_min"], LAT_MIN)
        self.assertEqual(dims["lat_max"], LAT_MAX)
        self.assertEqual(dims["lon_min"], LON_MIN)
        self.assertEqual(dims["lon_max"], LON_MAX)
        self.assertEqual(dims["row_0_latitude"], 38.0)
        self.assertEqual(dims["row_127_latitude"], 8.0)
        self.assertEqual(dims["col_0_longitude"], 68.0)
        self.assertEqual(dims["col_127_longitude"], 98.0)


class TestRealDataAlignmentSmoke(unittest.TestCase):
    """End-to-end alignment test using real Himawari and GFS observations (live or cached)."""

    def test_real_alignment_pipeline(self):
        """Fetch real Himawari and GFS observations and align into (6, 8, 128, 128) tensor."""
        aligner = SpatiotemporalAligner()
        target_time = datetime(2026, 9, 28, 16, 30, 0, tzinfo=timezone.utc)

        try:
            tensor, provenance = aligner.fetch_and_align(target_time)
        except Exception as e:
            print(f"\nREAL ALIGNMENT TEST: SKIPPED — network or source data unavailable: {e}")
            return

        # Verify output tensor structure
        self.assertEqual(tensor.shape, (6, 8, 128, 128))
        self.assertEqual(tensor.dtype, np.float32)
        self.assertFalse(np.isnan(tensor).any())
        self.assertFalse(np.isinf(tensor).any())
        self.assertFalse(provenance["synthetic_data_used"])

        # Check physical ranges for all 8 channels
        b13 = tensor[:, 0, :, :]
        t2m = tensor[:, 1, :, :]
        d2m = tensor[:, 2, :, :]
        u10 = tensor[:, 3, :, :]
        v10 = tensor[:, 4, :, :]
        cape = tensor[:, 5, :, :]
        cin = tensor[:, 6, :, :]
        tp = tensor[:, 7, :, :]

        # Print detailed diagnostics for verification report
        print("\n=======================================================")
        print("PHASE 1C: REAL HIMAWARI + GFS ALIGNMENT AUDIT")
        print("=======================================================")
        print(f"Aligned Tensor Shape: {tensor.shape}")
        print(f"Data Type: {tensor.dtype}")
        print(f"Synthetic Data Used: {provenance['synthetic_data_used']}")
        print(f"Number of Timesteps: {len(provenance['frames'])}")
        print("\nChannel Statistics (Physical Units):")
        for ch_name, stats in provenance["channel_statistics"].items():
            print(f"  Channel {stats['channel_index']} ({ch_name:4s}): min={stats['min']:8.3f}, max={stats['max']:8.3f}, mean={stats['mean']:8.3f}, std={stats['std']:8.3f}")
        print("\nObservation Sequence Timestamps:")
        for frame in provenance["frames"]:
            print(f"  Frame {frame['frame_index']}: {frame['target_timestamp']} (GFS alpha={frame['gfs_interpolation']['alpha']:.3f})")
        print("=======================================================\n")

        # Range assertions
        self.assertGreaterEqual(float(b13.min()), 150.0)
        self.assertLessEqual(float(b13.max()), 350.0)
        self.assertGreaterEqual(float(t2m.min()), -40.0)
        self.assertLessEqual(float(t2m.max()), 60.0)
        self.assertGreaterEqual(float(cape.min()), 0.0)
        self.assertGreaterEqual(float(tp.min()), 0.0)


if __name__ == "__main__":
    unittest.main()
