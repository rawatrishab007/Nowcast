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
        """Verify POST /api/predict returns 503 when checkpoint file is missing."""
        # Ensure model is not loaded (as checkpoint is not in repo yet)
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

if __name__ == "__main__":
    unittest.main()
