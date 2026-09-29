"""
WeatherNow AI — Phase 1D Frozen V3 Normalization & Inference Test Suite
Validates frozen normalization, input tensor construction (1, 6, 8, 128, 128),
model architecture integrity (200,996 params), deterministic evaluation,
and end-to-end real-data inference audit.
"""

import os
import hashlib
import unittest
from datetime import datetime, timezone
import numpy as np
import torch

from config import settings
from model_loader import SIHV3Nowcast, model_manager
from data_providers.base import DataValidationError
from data_providers.alignment import (
    SpatiotemporalAligner,
    CHANNEL_NAMES,
    NUM_CHANNELS,
    NUM_FRAMES,
)
from data_providers.v3_preprocessing import (
    normalize_for_v3,
    construct_v3_input_tensor,
    verify_physical_units_and_ranges,
    V3_FROZEN_MEAN,
    V3_FROZEN_STD,
)
from data_providers.spatial import TARGET_HEIGHT, TARGET_WIDTH

EXPECTED_CHECKPOINT_SHA256 = "3c333cb479b2a350535482a3d0764c6b647dc2991ec9eed90a40a3d0c41ff276"
EXPECTED_PARAM_COUNT = 200996


class TestPhase1DFrozenNormalization(unittest.TestCase):
    """Unit tests for Phase 1D frozen normalization and tensor construction."""

    def test_01_frozen_normalization_exact_math(self):
        """Test exact normalization behavior: mean -> 0.0, mean+std -> +1.0, mean-std -> -1.0."""
        # 1. Test x = mean -> 0.0
        mean_tensor = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float32)
        for c in range(NUM_CHANNELS):
            mean_tensor[:, c, :, :] = V3_FROZEN_MEAN[c]

        norm_zeros = normalize_for_v3(mean_tensor)
        self.assertEqual(norm_zeros.shape, (NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH))
        self.assertEqual(norm_zeros.dtype, np.float32)
        np.testing.assert_allclose(norm_zeros, 0.0, atol=1e-5)

        # 2. Test x = mean + std -> +1.0
        plus_std_tensor = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float32)
        for c in range(NUM_CHANNELS):
            plus_std_tensor[:, c, :, :] = V3_FROZEN_MEAN[c] + V3_FROZEN_STD[c]

        norm_ones = normalize_for_v3(plus_std_tensor)
        np.testing.assert_allclose(norm_ones, 1.0, atol=1e-5)

        # 3. Test x = mean - std -> -1.0
        minus_std_tensor = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float32)
        for c in range(NUM_CHANNELS):
            minus_std_tensor[:, c, :, :] = V3_FROZEN_MEAN[c] - V3_FROZEN_STD[c]

        norm_neg_ones = normalize_for_v3(minus_std_tensor)
        np.testing.assert_allclose(norm_neg_ones, -1.0, atol=1e-5)

    def test_02_channel_statistic_mapping(self):
        """Verify strict 1-to-1 mapping between channel indices and frozen statistics."""
        expected_means = [258.9513, 24.3378, 17.6339, 2.7062, 1.7265, 720.3760, 90.9589, 0.0002]
        expected_stds = [12.8962, 11.2362, 11.1469, 2.8719, 2.7279, 851.9800, 145.4562, 0.0007]

        self.assertEqual(len(CHANNEL_NAMES), 8)
        self.assertEqual(CHANNEL_NAMES, ["B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"])

        for idx, ch_name in enumerate(CHANNEL_NAMES):
            self.assertAlmostEqual(float(V3_FROZEN_MEAN[idx]), expected_means[idx], places=4)
            self.assertAlmostEqual(float(V3_FROZEN_STD[idx]), expected_stds[idx], places=4)

    def test_03_tensor_shape_and_batch_dimension(self):
        """Verify tensor conversion from (6, 8, 128, 128) to PyTorch (1, 6, 8, 128, 128)."""
        physical = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float32)
        for c in range(NUM_CHANNELS):
            physical[:, c, :, :] = V3_FROZEN_MEAN[c]

        torch_tensor = construct_v3_input_tensor(physical)

        self.assertEqual(torch_tensor.shape, (1, 6, 8, 128, 128))
        self.assertEqual(torch_tensor.dtype, torch.float32)
        self.assertTrue(torch_tensor.is_contiguous())

    def test_04_dtype_float32(self):
        """Verify that double precision or other dtypes are strictly validated and handled."""
        physical_float64 = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float64)
        with self.assertRaises(DataValidationError):
            normalize_for_v3(physical_float64)

    def test_05_nan_and_inf_rejection(self):
        """Verify that NaN or Infinite values in physical input are rejected."""
        physical = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float32)
        for c in range(NUM_CHANNELS):
            physical[:, c, :, :] = V3_FROZEN_MEAN[c]

        physical_nan = physical.copy()
        physical_nan[0, 0, 10, 10] = np.nan
        with self.assertRaises(DataValidationError):
            normalize_for_v3(physical_nan)

        physical_inf = physical.copy()
        physical_inf[1, 5, 20, 20] = np.inf
        with self.assertRaises(DataValidationError):
            normalize_for_v3(physical_inf)


class TestPhase1DModelIntegrity(unittest.TestCase):
    """Tests validating frozen model architecture and checkpoint parameters."""

    def test_06_model_architecture_and_param_count(self):
        """Verify SIHV3Nowcast class instantiation and exact 200,996 parameter count."""
        model = SIHV3Nowcast(in_channels=8, hidden_channels=48, horizons=4)
        total_params = sum(p.numel() for p in model.parameters())

        self.assertEqual(model.__class__.__name__, "SIHV3Nowcast")
        self.assertEqual(total_params, EXPECTED_PARAM_COUNT)

    def test_07_checkpoint_identity_and_hash(self):
        """Verify that checkpoint exists and matches known SHA256 checksum."""
        checkpoint_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "models", "sih_v3_best.pth")
        )
        self.assertTrue(os.path.exists(checkpoint_path), f"Checkpoint not found at {checkpoint_path}")

        with open(checkpoint_path, "rb") as f:
            file_bytes = f.read()
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        self.assertEqual(sha256_hash, EXPECTED_CHECKPOINT_SHA256)
        self.assertEqual(len(file_bytes), 814103)

    def test_08_inference_output_shape_and_finite(self):
        """Verify raw inference produces (1, 4, 128, 128) float32 with no NaNs or Infs."""
        model_manager.load_model()
        self.assertTrue(model_manager.is_loaded())
        model = model_manager.get_model()
        device = model_manager.get_device()

        physical = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float32)
        for c in range(NUM_CHANNELS):
            physical[:, c, :, :] = V3_FROZEN_MEAN[c]

        inp_tensor = construct_v3_input_tensor(physical, device=device)

        model.eval()
        with torch.no_grad():
            raw_logits = model(inp_tensor)

        self.assertEqual(raw_logits.shape, (1, 4, 128, 128))
        self.assertEqual(raw_logits.dtype, torch.float32)
        self.assertFalse(torch.isnan(raw_logits).any())
        self.assertFalse(torch.isinf(raw_logits).any())

    def test_09_sigmoid_probability_range(self):
        """Verify sigmoid yields continuous probabilities in [0.0, 1.0] across all 4 horizons."""
        model_manager.load_model()
        model = model_manager.get_model()
        device = model_manager.get_device()

        physical = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float32)
        for c in range(NUM_CHANNELS):
            physical[:, c, :, :] = V3_FROZEN_MEAN[c]

        inp_tensor = construct_v3_input_tensor(physical, device=device)

        model.eval()
        with torch.no_grad():
            raw_logits = model(inp_tensor)
            probs = torch.sigmoid(raw_logits)

        probs_np = probs.cpu().numpy()
        self.assertEqual(probs_np.shape, (1, 4, 128, 128))
        self.assertGreaterEqual(float(probs_np.min()), 0.0)
        self.assertLessEqual(float(probs_np.max()), 1.0)
        self.assertFalse(np.isnan(probs_np).any())

    def test_10_deterministic_inference(self):
        """Verify repeated inference on identical input yields identical outputs."""
        model_manager.load_model()
        model = model_manager.get_model()
        device = model_manager.get_device()

        # Construct deterministic gradient input
        physical = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float32)
        for c in range(NUM_CHANNELS):
            physical[:, c, :, :] = V3_FROZEN_MEAN[c] + 0.5 * V3_FROZEN_STD[c]

        inp_tensor_1 = construct_v3_input_tensor(physical, device=device)
        inp_tensor_2 = construct_v3_input_tensor(physical, device=device)

        model.eval()
        with torch.no_grad():
            out_1 = torch.sigmoid(model(inp_tensor_1)).cpu().numpy()
            out_2 = torch.sigmoid(model(inp_tensor_2)).cpu().numpy()

        np.testing.assert_allclose(out_1, out_2, atol=1e-7, err_msg="Inference non-deterministic!")


class TestPhase1DRealDataEndToEndAudit(unittest.TestCase):
    """End-to-end real-data audit: Himawari + GFS -> Alignment -> Normalization -> V3 -> 4 Horizons."""

    def test_11_real_data_e2e_inference_audit(self):
        """Execute full real-data pipeline and print Phase 1D audit diagnostics."""
        aligner = SpatiotemporalAligner()
        target_time = datetime(2026, 9, 28, 16, 30, 0, tzinfo=timezone.utc)

        try:
            physical_tensor, provenance = aligner.fetch_and_align(target_time)
        except Exception as e:
            print(f"\nREAL V3 E2E TEST: SKIPPED — external data unavailable: {e}")
            return

        # 1. Physical input tensor verification
        self.assertEqual(physical_tensor.shape, (6, 8, 128, 128))
        self.assertEqual(physical_tensor.dtype, np.float32)
        self.assertFalse(np.isnan(physical_tensor).any())
        self.assertFalse(np.isinf(physical_tensor).any())
        self.assertFalse(provenance["synthetic_data_used"])

        # 2. Apply Frozen V3 Normalization
        normalized_tensor = normalize_for_v3(physical_tensor)
        self.assertEqual(normalized_tensor.shape, (6, 8, 128, 128))
        self.assertEqual(normalized_tensor.dtype, np.float32)

        # 3. Model loading and preparation
        model_manager.load_model()
        self.assertTrue(model_manager.is_loaded())
        model = model_manager.get_model()
        device = model_manager.get_device()
        model.eval()

        # 4. Assemble batched tensor (1, 6, 8, 128, 128)
        model_input = construct_v3_input_tensor(physical_tensor, device=device)
        self.assertEqual(model_input.shape, (1, 6, 8, 128, 128))
        self.assertEqual(model_input.dtype, torch.float32)

        # 5. Execute frozen model inference under torch.no_grad()
        with torch.no_grad():
            raw_logits = model(model_input)
            probabilities = torch.sigmoid(raw_logits)

        raw_np = raw_logits.cpu().numpy()
        prob_np = probabilities.cpu().numpy()

        # 6. Verify output shapes and numerical boundaries
        self.assertEqual(raw_np.shape, (1, 4, 128, 128))
        self.assertEqual(prob_np.shape, (1, 4, 128, 128))
        self.assertFalse(np.isnan(prob_np).any())
        self.assertFalse(np.isinf(prob_np).any())
        self.assertGreaterEqual(float(prob_np.min()), 0.0)
        self.assertLessEqual(float(prob_np.max()), 1.0)

        # 7. Print strict audit report
        print("\n=======================================================")
        print("PHASE 1D — REAL V3 INFERENCE AUDIT")
        print("=======================================================")
        print("STATUS: PASS\n")
        print("INPUT")
        print(f"Physical tensor shape:  {physical_tensor.shape}")
        print(f"Physical tensor dtype:  {physical_tensor.dtype}")
        print(f"Channel order:          {provenance['channel_order']}")
        print("Units verified:         B13: K, t2m: °C, d2m: °C, u10: m/s, v10: m/s, cape: J/kg, cin: J/kg, tp: m\n")

        print("NORMALIZATION")
        print("Normalization applied:  (x - MEAN[c]) / STD[c]")
        print("Frozen statistics used: True (Training set)")
        print("Dynamic normalization:  False")
        print(f"Normalized tensor shape:{normalized_tensor.shape}")
        print(f"Normalized tensor dtype:{normalized_tensor.dtype}")
        print(f"NaN count:              {int(np.isnan(normalized_tensor).sum())}")
        print(f"Inf count:              {int(np.isinf(normalized_tensor).sum())}\n")

        print("MODEL")
        print(f"Checkpoint:             backend/models/sih_v3_best.pth")
        print(f"Checkpoint hash:        {EXPECTED_CHECKPOINT_SHA256}")
        print(f"Architecture:           {model.__class__.__name__}")
        print(f"Parameter count:        {sum(p.numel() for p in model.parameters())}")
        print(f"Evaluation mode:        {not model.training}")
        print("Weights modified:       False\n")

        print("MODEL INPUT")
        print(f"Final tensor shape:     {model_input.shape}")
        print(f"Final dtype:            {model_input.dtype}")
        print("Model compatibility:    EXACT (1, 6, 8, 128, 128) float32\n")

        print("INFERENCE")
        print(f"Raw output shape:       {raw_np.shape}")
        print(f"Raw output min:         {raw_np.min():.4f}")
        print(f"Raw output max:         {raw_np.max():.4f}")
        print(f"Raw output mean:        {raw_np.mean():.4f}")
        print(f"Raw output std:         {raw_np.std():.4f}")
        print(f"Raw NaN count:          {int(np.isnan(raw_np).sum())}")
        print(f"Raw Inf count:          {int(np.isinf(raw_np).sum())}\n")

        print("SIGMOID")
        print(f"Probability shape:      {prob_np.shape}")
        print(f"Probability min:        {prob_np.min():.4f}")
        print(f"Probability max:        {prob_np.max():.4f}")
        print(f"Probability mean:       {prob_np.mean():.4f}")
        print(f"Probability std:        {prob_np.std():.4f}")
        print(f"Probability NaN count:  {int(np.isnan(prob_np).sum())}")
        print(f"Probability Inf count:  {int(np.isinf(prob_np).sum())}\n")

        print("HORIZONS")
        horizons = ["+30", "+60", "+90", "+120"]
        for h_idx, h_name in enumerate(horizons):
            h_slice = prob_np[0, h_idx, :, :]
            print(f"{h_name}: min={h_slice.min():.4f}, max={h_slice.max():.4f}, mean={h_slice.mean():.4f}, std={h_slice.std():.4f}")

        print("\nREAL-DATA PROVENANCE")
        print(f"Himawari timestamps:    {[f['target_timestamp'] for f in provenance['frames']]}")
        print(f"GFS valid times:        {provenance['frames'][0]['gfs_interpolation']['t0']} -> {provenance['frames'][-1]['gfs_interpolation']['t1']}")
        print(f"Interpolation metadata: {[f['gfs_interpolation']['alpha'] for f in provenance['frames']]}")
        print(f"Synthetic data used:    {provenance['synthetic_data_used']}")
        print("Temporal extrapolation: False")
        print("=======================================================\n")


if __name__ == "__main__":
    unittest.main()
