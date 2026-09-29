import os
import logging
from typing import Optional, Tuple, Dict, Any
import torch
import torch.nn as nn
from config import settings

logger = logging.getLogger("weathernow.model_loader")

# ==============================================================================
# 1. SHARED ConvLSTM CELL
# ==============================================================================

class ConvLSTMCell(nn.Module):
    def __init__(self, input_channels: int, hidden_channels: int):
        super().__init__()
        self.hidden_channels = hidden_channels
        self.conv = nn.Conv2d(
            input_channels + hidden_channels,
            4 * hidden_channels,
            kernel_size=3,
            padding=1
        )

    def forward(self, x: torch.Tensor, h: torch.Tensor, c: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        combined = torch.cat([x, h], dim=1)
        gates = self.conv(combined)
        i, f, o, g = torch.chunk(gates, 4, dim=1)
        i = torch.sigmoid(i)
        f = torch.sigmoid(f)
        o = torch.sigmoid(o)
        g = torch.tanh(g)
        c_next = f * c + i * g
        h_next = o * torch.tanh(c_next)
        return h_next, c_next


# ==============================================================================
# 2. MODEL V3: CONVECTIVE CLOUD NOWCAST (200,996 params)
# Target: P(future B13 < 235 K)
# ==============================================================================

class SIHV3Nowcast(nn.Module):
    def __init__(self, in_channels: int = 8, hidden_channels: int = 48, horizons: int = 4):
        super().__init__()
        self.hidden_channels = hidden_channels
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 48, kernel_size=3, padding=1),
            nn.BatchNorm2d(48),
            nn.ReLU(inplace=True)
        )
        self.lstm = ConvLSTMCell(input_channels=48, hidden_channels=hidden_channels)
        self.decoder = nn.Sequential(
            nn.Conv2d(hidden_channels, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True)
        )
        self.heads = nn.ModuleList([
            nn.Conv2d(16, 1, 1) for _ in range(horizons)
        ])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch_size, time_steps, _, height, width = x.shape
        h = torch.zeros(batch_size, self.hidden_channels, height, width, device=x.device)
        c = torch.zeros(batch_size, self.hidden_channels, height, width, device=x.device)
        for t in range(time_steps):
            features = self.encoder(x[:, t])
            h, c = self.lstm(features, h, c)
        features = self.decoder(h)
        outputs = []
        for head in self.heads:
            outputs.append(head(features).squeeze(1))
        return torch.stack(outputs, dim=1)


# ==============================================================================
# 3. MODEL V4: RAINFALL NOWCAST (93,208 params)
# Target: IMERG-derived Rain Rate (mm/hr) & Occurrence Probability
# ==============================================================================

class SIHV4RainfallNowcast(nn.Module):
    def __init__(self, in_channels: int = 8, hidden_channels: int = 32, horizons: int = 4):
        super().__init__()
        self.hidden_channels = hidden_channels
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 24, kernel_size=3, padding=1),
            nn.BatchNorm2d(24),
            nn.ReLU(inplace=True),
            nn.Conv2d(24, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True)
        )
        self.lstm = ConvLSTMCell(input_channels=32, hidden_channels=hidden_channels)
        self.decoder = nn.Sequential(
            nn.Conv2d(hidden_channels, 24, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(24, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True)
        )
        self.rain_heads = nn.ModuleList([nn.Conv2d(16, 1, kernel_size=1) for _ in range(horizons)])
        self.rain_probability_heads = nn.ModuleList([nn.Conv2d(16, 1, kernel_size=1) for _ in range(horizons)])

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        batch_size, time_steps, _, height, width = x.shape
        h = torch.zeros(batch_size, self.hidden_channels, height, width, device=x.device)
        c = torch.zeros(batch_size, self.hidden_channels, height, width, device=x.device)
        for t in range(time_steps):
            features = self.encoder(x[:, t])
            h, c = self.lstm(features, h, c)
        features = self.decoder(h)
        rain = [head(features).squeeze(1) for head in self.rain_heads]
        rain_prob = [head(features).squeeze(1) for head in self.rain_probability_heads]
        return {
            "rain": torch.stack(rain, dim=1),
            "rain_probability": torch.stack(rain_prob, dim=1)
        }


# ==============================================================================
# 4. MODEL V1: MULTI-HAZARD NOWCAST (93,548 params)
# ==============================================================================

class SIHMultiHazardNowcast(nn.Module):
    def __init__(self, in_channels: int = 8, hidden_channels: int = 32, horizons: int = 4):
        super().__init__()
        self.hidden_channels = hidden_channels
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 24, kernel_size=3, padding=1),
            nn.BatchNorm2d(24),
            nn.ReLU(inplace=True),
            nn.Conv2d(24, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True)
        )
        self.lstm = ConvLSTMCell(input_channels=32, hidden_channels=hidden_channels)
        self.decoder = nn.Sequential(
            nn.Conv2d(hidden_channels, 24, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(24, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True)
        )
        self.rain_heads = nn.ModuleList([nn.Conv2d(16, 1, 1) for _ in range(horizons)])
        self.rain_probability_heads = nn.ModuleList([nn.Conv2d(16, 1, 1) for _ in range(horizons)])
        self.hazard_heads = nn.ModuleDict({
            "lightning": nn.ModuleList([nn.Conv2d(16, 1, 1) for _ in range(horizons)]),
            "thunderstorm": nn.ModuleList([nn.Conv2d(16, 1, 1) for _ in range(horizons)]),
            "hail": nn.ModuleList([nn.Conv2d(16, 1, 1) for _ in range(horizons)]),
            "cloudburst": nn.ModuleList([nn.Conv2d(16, 1, 1) for _ in range(horizons)]),
            "downburst": nn.ModuleList([nn.Conv2d(16, 1, 1) for _ in range(horizons)]),
        })

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        batch_size, time_steps, _, height, width = x.shape
        h = torch.zeros(batch_size, self.hidden_channels, height, width, device=x.device)
        c = torch.zeros(batch_size, self.hidden_channels, height, width, device=x.device)
        for t in range(time_steps):
            features = self.encoder(x[:, t])
            h, c = self.lstm(features, h, c)
        features = self.decoder(h)
        rain = [head(features).squeeze(1) for head in self.rain_heads]
        rain_probability = [head(features).squeeze(1) for head in self.rain_probability_heads]
        outputs = {
            "rain": torch.stack(rain, dim=1),
            "rain_probability": torch.stack(rain_probability, dim=1),
        }
        for hazard_name, heads in self.hazard_heads.items():
            outputs[hazard_name] = torch.stack(
                [torch.sigmoid(head(features).squeeze(1)) for head in heads],
                dim=1
            )
        return outputs


# ==============================================================================
# 5. MULTI-MODEL MANAGER (V1, V3, V4 Lifecycle)
# ==============================================================================

class MultiModelManager:
    """
    Manages device selection and startup loading for V1, V3, and V4 models.
    """
    def __init__(self):
        self.device: torch.device = self._detect_device()
        self.model_v3: Optional[SIHV3Nowcast] = None
        self.model_v4: Optional[SIHV4RainfallNowcast] = None
        self.model_v1: Optional[SIHMultiHazardNowcast] = None
        self.model_loaded: bool = False
        self.load_errors: Dict[str, str] = {}

    def _detect_device(self) -> torch.device:
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info("Hardware acceleration: CUDA GPU detected.")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = torch.device("mps")
            logger.info("Hardware acceleration: Apple Silicon MPS detected.")
        else:
            device = torch.device("cpu")
            logger.info("Hardware acceleration: CPU fallback.")
        return device

    def _resolve_checkpoint(self, paths: list[str]) -> Optional[str]:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        for p in paths:
            if not p:
                continue
            cand = os.path.join(base_dir, p) if not os.path.isabs(p) else p
            if os.path.exists(cand):
                return os.path.abspath(cand)
            if os.path.exists(p):
                return os.path.abspath(p)
        return None

    def load_model(self) -> bool:
        """Loads V3, V4, and V1 checkpoints at startup."""
        base_dir = os.path.dirname(os.path.abspath(__file__))

        # 1. Load V3 (Convective Cloud Nowcasting)
        v3_path = self._resolve_checkpoint([
            settings.MODEL_PATH,
            "./models/sih_v3_best.pth",
            "../ai_ml/models/v3/sih_v3_best.pth",
            os.path.join(base_dir, "models", "sih_v3_best.pth"),
            os.path.join(base_dir, "..", "ai_ml", "models", "v3", "sih_v3_best.pth")
        ])
        if v3_path:
            try:
                net_v3 = SIHV3Nowcast(in_channels=8, hidden_channels=48, horizons=4)
                ckpt = torch.load(v3_path, map_location=self.device)
                state = ckpt["state_dict"] if isinstance(ckpt, dict) and "state_dict" in ckpt else ckpt
                net_v3.load_state_dict(state)
                net_v3.to(self.device)
                net_v3.eval()
                self.model_v3 = net_v3
                logger.info(f"Loaded V3 Convective Nowcast ({sum(p.numel() for p in net_v3.parameters())} params) from {v3_path}")
            except Exception as e:
                self.load_errors["v3"] = str(e)
                logger.error(f"Failed loading V3: {e}")
        else:
            self.load_errors["v3"] = "V3 checkpoint not found."

        # 2. Load V4 (Rainfall Nowcasting)
        v4_path = self._resolve_checkpoint([
            "../ai_ml/models/v4/sih_v4_rain_corrected_best.pth",
            "./models/sih_v4_rain_corrected_best.pth",
            os.path.join(base_dir, "..", "ai_ml", "models", "v4", "sih_v4_rain_corrected_best.pth")
        ])
        if v4_path:
            try:
                net_v4 = SIHV4RainfallNowcast(in_channels=8, hidden_channels=32, horizons=4)
                ckpt_v4 = torch.load(v4_path, map_location=self.device)
                state_v4 = ckpt_v4["state_dict"] if isinstance(ckpt_v4, dict) and "state_dict" in ckpt_v4 else ckpt_v4
                net_v4.load_state_dict(state_v4)
                net_v4.to(self.device)
                net_v4.eval()
                self.model_v4 = net_v4
                logger.info(f"Loaded V4 Rainfall Nowcast ({sum(p.numel() for p in net_v4.parameters())} params) from {v4_path}")
            except Exception as e:
                self.load_errors["v4"] = str(e)
                logger.error(f"Failed loading V4: {e}")
        else:
            self.load_errors["v4"] = "V4 checkpoint not found."

        # 3. Load V1 (Multi-Hazard Prototype)
        v1_path = self._resolve_checkpoint([
            "../ai_ml/models/v1/sih_multihazard_v1_best.pth",
            "./models/sih_multihazard_v1_best.pth",
            os.path.join(base_dir, "..", "ai_ml", "models", "v1", "sih_multihazard_v1_best.pth")
        ])
        if v1_path:
            try:
                net_v1 = SIHMultiHazardNowcast(in_channels=8, hidden_channels=32, horizons=4)
                ckpt_v1 = torch.load(v1_path, map_location=self.device)
                state_v1 = ckpt_v1["state_dict"] if isinstance(ckpt_v1, dict) and "state_dict" in ckpt_v1 else ckpt_v1
                net_v1.load_state_dict(state_v1)
                net_v1.to(self.device)
                net_v1.eval()
                self.model_v1 = net_v1
                logger.info(f"Loaded V1 Multi-Hazard ({sum(p.numel() for p in net_v1.parameters())} params) from {v1_path}")
            except Exception as e:
                self.load_errors["v1"] = str(e)
                logger.error(f"Failed loading V1: {e}")
        else:
            self.load_errors["v1"] = "V1 checkpoint not found."

        self.model_loaded = self.model_v3 is not None and self.model_v4 is not None
        return self.model_loaded

    load_models = load_model

    @property
    def load_error(self) -> Optional[str]:
        if not self.load_errors:
            return None
        return "; ".join(f"{k}: {v}" for k, v in self.load_errors.items())

    def is_loaded(self) -> bool:
        return self.model_loaded

    def get_device(self) -> torch.device:
        return self.device

    def get_model_v3(self) -> Optional[SIHV3Nowcast]:
        return self.model_v3

    def get_model_v4(self) -> Optional[SIHV4RainfallNowcast]:
        return self.model_v4

    def get_model_v1(self) -> Optional[SIHMultiHazardNowcast]:
        return self.model_v1

    # Backward compatibility alias
    def get_model(self) -> Optional[SIHV3Nowcast]:
        return self.model_v3


# Global singleton instance
model_manager = MultiModelManager()
