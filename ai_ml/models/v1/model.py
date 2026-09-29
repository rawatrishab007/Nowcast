import torch
import torch.nn as nn


class ConvLSTMCell(nn.Module):
    def __init__(self, input_channels, hidden_channels):
        super().__init__()

        self.hidden_channels = hidden_channels

        self.conv = nn.Conv2d(
            input_channels + hidden_channels,
            4 * hidden_channels,
            kernel_size=3,
            padding=1,
        )

    def forward(self, x, h, c):
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


class SIHMultiHazardNowcast(nn.Module):

    def __init__(
        self,
        in_channels=8,
        hidden_channels=32,
        horizons=4,
    ):
        super().__init__()

        self.hidden_channels = hidden_channels

        self.encoder = nn.Sequential(
            nn.Conv2d(
                in_channels,
                24,
                kernel_size=3,
                padding=1,
            ),
            nn.BatchNorm2d(24),
            nn.ReLU(inplace=True),

            nn.Conv2d(
                24,
                32,
                kernel_size=3,
                padding=1,
            ),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
        )

        self.lstm = ConvLSTMCell(
            input_channels=32,
            hidden_channels=hidden_channels,
        )

        self.decoder = nn.Sequential(
            nn.Conv2d(
                hidden_channels,
                24,
                kernel_size=3,
                padding=1,
            ),
            nn.ReLU(inplace=True),

            nn.Conv2d(
                24,
                16,
                kernel_size=3,
                padding=1,
            ),
            nn.ReLU(inplace=True),
        )

        # Rainfall intensity
        self.rain_heads = nn.ModuleList([
            nn.Conv2d(16, 1, 1)
            for _ in range(horizons)
        ])

        # Rainfall occurrence
        self.rain_probability_heads = nn.ModuleList([
            nn.Conv2d(16, 1, 1)
            for _ in range(horizons)
        ])

        # Physics-informed proxy hazards
        self.hazard_heads = nn.ModuleDict({
            "lightning": nn.ModuleList([
                nn.Conv2d(16, 1, 1)
                for _ in range(horizons)
            ]),

            "thunderstorm": nn.ModuleList([
                nn.Conv2d(16, 1, 1)
                for _ in range(horizons)
            ]),

            "hail": nn.ModuleList([
                nn.Conv2d(16, 1, 1)
                for _ in range(horizons)
            ]),

            "cloudburst": nn.ModuleList([
                nn.Conv2d(16, 1, 1)
                for _ in range(horizons)
            ]),

            "downburst": nn.ModuleList([
                nn.Conv2d(16, 1, 1)
                for _ in range(horizons)
            ]),
        })

    def forward(self, x):

        batch_size, time_steps, _, height, width = x.shape

        h = torch.zeros(
            batch_size,
            self.hidden_channels,
            height,
            width,
            device=x.device,
        )

        c = torch.zeros(
            batch_size,
            self.hidden_channels,
            height,
            width,
            device=x.device,
        )

        for t in range(time_steps):

            features = self.encoder(x[:, t])

            h, c = self.lstm(
                features,
                h,
                c,
            )

        features = self.decoder(h)

        rain = []
        rain_probability = []

        for head in self.rain_heads:
            rain.append(head(features).squeeze(1))

        for head in self.rain_probability_heads:
            rain_probability.append(
                head(features).squeeze(1)
            )

        outputs = {
            "rain": torch.stack(rain, dim=1),
            "rain_probability": torch.stack(
                rain_probability,
                dim=1,
            ),
        }

        for hazard_name, heads in self.hazard_heads.items():

            outputs[hazard_name] = torch.stack(
                [
                    torch.sigmoid(head(features).squeeze(1))
                    for head in heads
                ],
                dim=1,
            )

        return outputs
