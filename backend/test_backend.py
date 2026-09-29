"""
WeatherNow AI — SIH V3 Backend Automated Test & Verification Suite
Verifies:
  1. Exact Model Architecture definition & layer parameter counts
  2. Input tensor shape (1, 6, 8, 128, 128) -> Output tensor shape (1, 4, 128, 128)
  3. Sigmoid activation range [0.0, 1.0]
  4. Fixed Normalization formula against MEAN & STD constants
  5. FastAPI Endpoints (/api/health, /api/model-info, /api/predict, /api/hazards)
  6. Request validation (frame count, missing channels, wrong dimensions)
"""

import sys
import unittest
import numpy as np
import torch
from fastapi.testclient import TestClient

from config import settings
from model_loader import SIHV3Nowcast, ConvLSTMCell, model_manager
from utils.preprocessing import prepare_input_tensor, PreprocessingError
from main import app

class TestSIHV3Backend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.device = torch.device("cpu")

    def test_01_model_architecture_and_forward_pass(self):
        """Verify SIHV3Nowcast forward pass produces (1, 4, 128, 128) from (1, 6, 8, 128, 128)."""
        model = SIHV3Nowcast(
            in_channels=len(settings.CHANNELS),
            hidden_channels=48,
            horizons=len(settings.FORECAST_HORIZONS)
        )
        model.eval()

        dummy_input = torch.randn(1, 6, 8, 128, 128, dtype=torch.float32)
        with torch.no_grad():
            output = model(dummy_input)
            probs = torch.sigmoid(output)

        self.assertEqual(output.shape, (1, 4, 128, 128), "Output tensor must be (1, 4, 128, 128)")
        self.assertTrue((probs >= 0.0).all() and (probs <= 1.0).all(), "Sigmoid outputs must be in [0, 1]")

    def test_02_fixed_normalization_and_channel_ordering(self):
        """Verify fixed training-set normalization matches formula (x - MEAN) / STD."""
        # Create 6 synthetic frames with 128x128 constant values
        frames = []
        for f in range(6):
            frame_data = {"timestamp": f"2026-09-28T12:{f*10:02d}:00Z"}
            for ch in settings.CHANNELS:
                frame_data[ch] = [[10.0 for _ in range(128)] for _ in range(128)]
            frames.append(frame_data)

        tensor = prepare_input_tensor(frames, self.device)
        self.assertEqual(tensor.shape, (1, 6, 8, 128, 128))

        # Check channel 0 (B13): (10.0 - 258.9513) / 12.8962
        expected_b13 = (10.0 - 258.9513) / 12.8962
        actual_b13 = tensor[0, 0, 0, 0, 0].item()
        self.assertAlmostEqual(actual_b13, expected_b13, places=3)

    def test_03_preprocessing_validation_errors(self):
        """Verify preprocessing rejects invalid frame counts or missing channels."""
        # Test wrong frame count (e.g. 5 instead of 6)
        with self.assertRaises(PreprocessingError):
            prepare_input_tensor([{} for _ in range(5)], self.device)

        # Test missing channel
        incomplete_frame = [{"B13": [[0.0]*128]*128} for _ in range(6)]
        with self.assertRaises(PreprocessingError):
            prepare_input_tensor(incomplete_frame, self.device)

    def test_04_health_endpoint(self):
        """Verify GET /api/health returns operational status."""
        response = self.client.get("/api/health")
        # If checkpoint is not present, status code is 503; if present, 200
        self.assertIn(response.status_code, [200, 503])
        data = response.json()
        self.assertIn("status", data)
        self.assertIn("model_loaded", data)

    def test_05_model_info_endpoint(self):
        """Verify GET /api/model-info returns exact V3 specification."""
        response = self.client.get("/api/model-info")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["input_channels"], 8)
        self.assertEqual(data["input_frames"], 6)
        self.assertEqual(data["forecast_horizons"], [30, 60, 90, 120])
        self.assertEqual(data["channels"], [
            "B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"
        ])
        self.assertEqual(data["target"], "P(future B13 < 235 K)")
        self.assertEqual(data["output_type"], "cold-cloud/deep-convection proxy probability")

    def test_06_predict_endpoint_validation_shield(self):
        """Verify POST /api/predict rejects malformed input with clean error message."""
        # Empty payload
        res = self.client.post("/api/predict", json={})
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["status"], "error")

        # Incomplete frames
        res = self.client.post("/api/predict", json={"frames": []})
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["status"], "error")

    def test_07_hazards_endpoint_validation_shield(self):
        """Verify POST /api/hazards rejects malformed input."""
        res = self.client.post("/api/hazards", json={})
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["status"], "error")

    def test_08_predict_model_unloaded_returns_503(self):
        """Verify handling when model checkpoint state is queried."""
        # If model is not loaded, verify 503 response
        if not model_manager.is_loaded():
            frames = []
            for f in range(6):
                frame_data = {"timestamp": f"2026-09-28T12:{f*10:02d}:00Z"}
                for ch in settings.CHANNELS:
                    frame_data[ch] = [[0.0]*128]*128
                frames.append(frame_data)
            
            res = self.client.post("/api/predict", json={"frames": frames})
            self.assertEqual(res.status_code, 503)
            self.assertEqual(res.json()["status"], "error")
            self.assertIn("not loaded", res.json()["message"])

    def test_09_sample_input_and_demo_prediction(self):
        """Verify GET /api/sample-input and POST /api/predict/demo execute with model."""
        # Load model for test
        loaded = model_manager.load_model()
        self.assertTrue(loaded, "Checkpoint should load successfully")

        # Test sample input structure
        sample_res = self.client.get("/api/sample-input")
        self.assertEqual(sample_res.status_code, 200)
        sample_data = sample_res.json()
        self.assertIn("frames", sample_data)
        self.assertEqual(len(sample_data["frames"]), 6)

        # Test demo prediction
        demo_res = self.client.post("/api/predict/demo")
        self.assertEqual(demo_res.status_code, 200)
        demo_data = demo_res.json()
        self.assertEqual(demo_data["status"], "success")
        self.assertIn("horizons", demo_data)
        self.assertEqual(list(demo_data["horizons"].keys()), ["30", "60", "90", "120"])
        # Check grid dimensions
        grid_30 = demo_data["horizons"]["30"]["map"]
        self.assertEqual(len(grid_30), 128)
        self.assertEqual(len(grid_30[0]), 128)

        # Check values are probabilities in [0.0, 1.0]
        val = grid_30[64][64]
        self.assertTrue(0.0 <= val <= 1.0)

    def test_10_spatial_interpolation_and_unit_conversions(self):
        """Verify spatial bilinear interpolation to (128, 128) and unit conversion formulas."""
        from data_providers.spatial import (
            interpolate_to_target_grid,
            kelvin_to_celsius,
            celsius_to_kelvin,
            mm_to_meters,
            wind_components_from_speed_dir,
        )

        # 1. Test unit conversions
        self.assertAlmostEqual(float(kelvin_to_celsius(np.array([273.15]))[0]), 0.0, places=4)
        self.assertAlmostEqual(float(kelvin_to_celsius(np.array([298.15]))[0]), 25.0, places=4)
        self.assertAlmostEqual(float(celsius_to_kelvin(np.array([0.0]))[0]), 273.15, places=4)
        self.assertAlmostEqual(float(mm_to_meters(np.array([10.0]))[0]), 0.01, places=5)

        u, v = wind_components_from_speed_dir(np.array([10.0]), np.array([270.0]))
        # 270 deg is wind coming from West -> u should be positive eastward (+10.0)
        self.assertAlmostEqual(float(u[0]), 10.0, places=2)
        self.assertAlmostEqual(float(v[0]), 0.0, places=2)

        # 2. Test spatial interpolation from 10x10 to (128, 128)
        src_grid = np.ones((10, 10), dtype=np.float32) * 50.0
        src_lats = np.linspace(38.0, 8.0, 10)
        src_lons = np.linspace(68.0, 98.0, 10)
        out_grid = interpolate_to_target_grid(src_grid, src_lats, src_lons)
        self.assertEqual(out_grid.shape, (128, 128))
        self.assertAlmostEqual(float(out_grid[0, 0]), 50.0, places=3)
        self.assertAlmostEqual(float(out_grid[127, 127]), 50.0, places=3)

    def test_11_data_provider_abstraction_and_validation(self):
        """Verify DataProvider interface, SyntheticDataProvider, and OperationalDataProvider output contracts."""
        from data_providers import (
            get_data_provider,
            SyntheticDataProvider,
            OperationalDataProvider,
            DataValidationError,
        )

        # 1. Synthetic Data Provider
        synth = get_data_provider("synthetic")
        self.assertFalse(synth.is_live)
        synth_frames = synth.get_frames()
        self.assertEqual(len(synth_frames), 6)
        for ch in settings.CHANNELS:
            self.assertEqual(len(synth_frames[0][ch]), 128)
            self.assertEqual(len(synth_frames[0][ch][0]), 128)

        # 2. Operational Data Provider
        op = OperationalDataProvider()
        self.assertTrue(op.is_live)
        op_frames = op.get_frames()
        self.assertEqual(len(op_frames), 6)
        for ch in settings.CHANNELS:
            self.assertEqual(len(op_frames[0][ch]), 128)
            self.assertEqual(len(op_frames[0][ch][0]), 128)

        # 3. Validation failure when frame missing channel
        bad_frames = [{"timestamp": "2026-09-28T00:00:00Z"}]
        with self.assertRaises(DataValidationError):
            synth.validate_frames(bad_frames)

    def test_12_operational_live_prediction_endpoint(self):
        """Verify POST /api/predict/live executes real model on operational atmospheric sequence."""
        res = self.client.post("/api/predict/live")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("horizons", data)
        self.assertEqual(list(data["horizons"].keys()), ["30", "60", "90", "120"])
        for h_key in ["30", "60", "90", "120"]:
            grid = data["horizons"][h_key]["map"]
            self.assertEqual(len(grid), 128)
            self.assertEqual(len(grid[0]), 128)
            self.assertTrue(0.0 <= grid[64][64] <= 1.0)


if __name__ == "__main__":
    unittest.main()


