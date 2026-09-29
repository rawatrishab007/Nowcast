"""
WeatherNow AI — Phase 1E Live Operational Pipeline Test Suite
Validates the end-to-end integration of real Himawari-9 B13 satellite scans,
operational NOAA GFS NWP fields, frozen V3 normalization, and frozen SIHV3Nowcast inference.
Verifies zero synthetic fallback in live mode, explicit error codes, and complete provenance.
"""

import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import numpy as np
import torch
from fastapi.testclient import TestClient

from main import app
from config import settings
from model_loader import model_manager, SIHV3Nowcast
from data_providers.operational import LivePredictionService, OperationalDataProvider
from data_providers.himawari import HimawariUnavailableError
from data_providers.gfs import GFSUnavailableError
from data_providers.alignment import SpatiotemporalAligner, TemporalAlignmentError
from data_providers.base import DataValidationError
from schemas import PredictResponse


class TestPhase1ELiveOperationalPipeline(unittest.TestCase):
    """Integration and unit tests for Phase 1E Live Operational Pipeline."""

    @classmethod
    def setUpClass(cls):
        model_manager.load_model()
        cls.client = TestClient(app)

    def test_01_live_operational_predict_endpoint_success(self):
        """Verify POST /api/predict/live executes real pipeline and returns 4 valid horizon maps."""
        response = self.client.post("/api/predict/live")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["model"], settings.MODEL_NAME)
        self.assertEqual(data["target"], settings.TARGET_SEMANTICS)
        self.assertEqual(data["semantics"], settings.OUTPUT_TYPE)

        # Verify horizons
        self.assertIn("horizons", data)
        self.assertEqual(set(data["horizons"].keys()), {"30", "60", "90", "120"})
        for h_key in ["30", "60", "90", "120"]:
            h_data = data["horizons"][h_key]
            self.assertEqual(h_data["unit"], "probability")
            self.assertEqual(h_data["height"], 128)
            self.assertEqual(h_data["width"], 128)
            grid = np.array(h_data["map"], dtype=np.float32)
            self.assertEqual(grid.shape, (128, 128))
            self.assertFalse(np.isnan(grid).any())
            self.assertFalse(np.isinf(grid).any())
            self.assertGreaterEqual(float(grid.min()), 0.0)
            self.assertLessEqual(float(grid.max()), 1.0)

        # Verify temporal base_time and target_times
        self.assertIn("base_time", data)
        self.assertIsNotNone(data["base_time"])
        self.assertIn("target_times", data)
        self.assertEqual(set(data["target_times"].keys()), {"30", "60", "90", "120"})

        # Verify Provenance metadata
        self.assertIn("provenance", data)
        prov = data["provenance"]
        self.assertFalse(prov["synthetic_data_used"])
        self.assertEqual(len(prov["frame_timestamps"]), 6)
        self.assertEqual(prov["channel_order"], settings.CHANNELS)
        self.assertIn("performance", prov)
        self.assertGreater(prov["performance"]["total_latency_ms"], 0)

    def test_02_live_prediction_caching_and_determinism(self):
        """Verify repeated live predictions for same base_time are cached and deterministic."""
        service = LivePredictionService()
        target_time = datetime(2026, 9, 28, 16, 30, 0, tzinfo=timezone.utc)

        # First call: computes and caches
        pred_1 = service.predict_live(target_time)
        # Second call: served from cache
        pred_2 = service.predict_live(target_time)

        self.assertEqual(pred_1.base_time, pred_2.base_time)
        self.assertEqual(pred_1.horizons.keys(), pred_2.horizons.keys())
        for k in ["30", "60", "90", "120"]:
            arr_1 = np.array(pred_1.horizons[k].map)
            arr_2 = np.array(pred_2.horizons[k].map)
            np.testing.assert_allclose(arr_1, arr_2, atol=1e-7)

    def test_03_zero_synthetic_fallback_on_himawari_failure(self):
        """Verify that Himawari failure returns explicit 502 HIMAWARI_DATA_UNAVAILABLE with no fallback."""
        with patch.object(
            SpatiotemporalAligner,
            "fetch_and_align",
            side_effect=HimawariUnavailableError("Simulated NOAA Himawari bucket unreachable")
        ):
            response = self.client.post("/api/predict/live")
            self.assertEqual(response.status_code, 502)
            data = response.json()
            # Must return explicit error structure, never a synthetic prediction
            self.assertEqual(data["status"], "error")
            self.assertIn("HIMAWARI_DATA_UNAVAILABLE", str(data))

    def test_04_zero_synthetic_fallback_on_gfs_failure(self):
        """Verify that GFS failure returns explicit 502 GFS_DATA_UNAVAILABLE with no fallback."""
        with patch.object(
            SpatiotemporalAligner,
            "fetch_and_align",
            side_effect=GFSUnavailableError("Simulated NOAA GFS server timeout")
        ):
            response = self.client.post("/api/predict/live")
            self.assertEqual(response.status_code, 502)
            data = response.json()
            self.assertEqual(data["status"], "error")
            self.assertIn("GFS_DATA_UNAVAILABLE", str(data))

    def test_05_zero_synthetic_fallback_on_temporal_alignment_failure(self):
        """Verify that unbracketed temporal alignment returns explicit 422 error."""
        with patch.object(
            SpatiotemporalAligner,
            "fetch_and_align",
            side_effect=TemporalAlignmentError("Simulated GFS forecast bracket missing for target time")
        ):
            response = self.client.post("/api/predict/live")
            self.assertEqual(response.status_code, 422)
            data = response.json()
            self.assertEqual(data["status"], "error")
            self.assertIn("TEMPORAL_ALIGNMENT_FAILED", str(data))

    def test_06_model_unavailable_returns_503(self):
        """Verify that if model is unloaded and cannot load, returns 503 MODEL_UNAVAILABLE."""
        with patch.object(model_manager, "is_loaded", return_value=False):
            with patch.object(model_manager, "load_model", return_value=False):
                response = self.client.post("/api/predict/live")
                self.assertEqual(response.status_code, 503)
                data = response.json()
                self.assertEqual(data["status"], "error")
                self.assertIn("MODEL_UNAVAILABLE", str(data))

    def test_07_demo_endpoint_isolation(self):
        """Verify GET & POST /api/predict/demo remain available with SyntheticDataProvider."""
        res_get = self.client.get("/api/predict/demo?seed=42")
        self.assertEqual(res_get.status_code, 200)
        data_get = res_get.json()
        self.assertEqual(data_get["status"], "success")

        res_post = self.client.post("/api/predict/demo?seed=42")
        self.assertEqual(res_post.status_code, 200)
        data_post = res_post.json()
        self.assertEqual(data_post["status"], "success")


if __name__ == "__main__":
    unittest.main()
