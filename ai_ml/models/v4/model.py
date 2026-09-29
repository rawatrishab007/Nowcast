import torch
import torch.nn as nn
from typing import Dict, Tuple

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


class SIHV4RainfallNowcast(nn.Module):
    """
    SIH V4 Spatiotemporal Rainfall Nowcasting Model.
    Architecture verified against state_dict in sih_v4_rain_corrected_best.pth:
      - Parameter count: 93,208
      - Input shape: (batch, time=6, channels=8, height=128, width=128)
      - Outputs: 'rain' (4 horizons), 'rain_probability' (4 horizons)
    """
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

        self.lstm = ConvLSTMCell(
            input_channels=32,
            hidden_channels=hidden_channels
        )

        self.decoder = nn.Sequential(
            nn.Conv2d(hidden_channels, 24, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(24, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True)
        )

        # Rainfall intensity heads (+30, +60, +90, +120 min)
        self.rain_heads = nn.ModuleList([
            nn.Conv2d(16, 1, kernel_size=1)
            for _ in range(horizons)
        ])

        # Rainfall occurrence probability heads (+30, +60, +90, +120 min)
        self.rain_probability_heads = nn.ModuleList([
            nn.Conv2d(16, 1, kernel_size=1)
            for _ in range(horizons)
        ])

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        batch_size, time_steps, _, height, width = x.shape
        h = torch.zeros(batch_size, self.hidden_channels, height, width, device=x.device)
        c = torch.zeros(batch_size, self.hidden_channels, height, width, device=x.device)

        for t in range(time_steps):
            features = self.encoder(x[:, t])
            h, c = self.lstm(features, h, c)

        features = self.decoder(h)

        rain = []
        rain_probability = []

        for head in self.rain_heads:
            rain.append(head(features).squeeze(1))

        for head in self.rain_probability_heads:
            rain_probability.append(head(features).squeeze(1))

        return {
            "rain": torch.stack(rain, dim=1),
            "rain_probability": torch.stack(rain_probability, dim=1)
        }
