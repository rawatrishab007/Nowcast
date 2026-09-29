import os
import logging
import torch
import torch.nn as nn
from typing import Optional, Tuple
from config import settings

logger = logging.getLogger("weathernow.model_loader")

# ==============================================================================
# EXACT MODEL ARCHITECTURE (SIH V3 Nowcast with ConvLSTMCell)
# DO NOT MODIFY THIS ARCHITECTURE
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
# MODEL LOADER & RUNTIME STATE
# ==============================================================================

class ModelManager:
    """
    Singleton manager for device detection, model instantiation, 
    and checkpoint loading. Loads once at application startup.
    """
    def __init__(self):
        self.model: Optional[SIHV3Nowcast] = None
        self.device: torch.device = self._detect_device()
        self.model_loaded: bool = False
        self.load_error: Optional[str] = None

    def _detect_device(self) -> torch.device:
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info("Hardware acceleration: CUDA GPU detected.")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = torch.device("mps")
            logger.info("Hardware acceleration: Apple Silicon MPS detected.")
        else:
            device = torch.device("cpu")
            logger.info("Hardware acceleration: None. Using standard CPU.")
        return device

    def load_model(self, checkpoint_path: Optional[str] = None) -> bool:
        path = checkpoint_path or settings.MODEL_PATH
        logger.info(f"Target model checkpoint path: {path}")

        if not os.path.exists(path):
            self.model_loaded = False
            self.load_error = f"Model checkpoint not found at path: {path}"
            logger.warning(self.load_error)
            logger.warning("Backend starting in uninitialized mode. Inference endpoint /api/predict will return 503 until checkpoint is provided.")
            return False

        try:
            # Instantiate exact SIH V3 Nowcast architecture
            net = SIHV3Nowcast(
                in_channels=len(settings.CHANNELS),
                hidden_channels=48,
                horizons=len(settings.FORECAST_HORIZONS)
            )

            # Load weights
            checkpoint = torch.load(path, map_location=self.device)
            if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
                net.load_state_dict(checkpoint["state_dict"])
            elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                net.load_state_dict(checkpoint["model_state_dict"])
            elif isinstance(checkpoint, dict):
                net.load_state_dict(checkpoint)
            elif isinstance(checkpoint, nn.Module):
                net = checkpoint

            net.to(self.device)
            net.eval()
            self.model = net
            self.model_loaded = True
            self.load_error = None
            logger.info(f"SIH V3 Nowcast model loaded successfully on {self.device}.")
            return True
        except Exception as e:
            self.model = None
            self.model_loaded = False
            self.load_error = f"Failed to load checkpoint: {str(e)}"
            logger.error(self.load_error)
            return False

    def get_model(self) -> Optional[SIHV3Nowcast]:
        return self.model

    def get_device(self) -> torch.device:
        return self.device

    def is_loaded(self) -> bool:
        return self.model_loaded


# Global singleton instance
model_manager = ModelManager()
