import numpy as np
import torch
import torch.nn as nn


# ============================================================
# V3 CONFIGURATION
# ============================================================

MEAN = np.array([
    258.9513,
    24.3378,
    17.6339,
    2.7062,
    1.7265,
    720.3760,
    90.9589,
    0.0002
], dtype=np.float32)

STD = np.array([
    12.8962,
    11.2362,
    11.1469,
    2.8719,
    2.7279,
    851.9800,
    145.4562,
    0.0007
], dtype=np.float32)


class ConvLSTMCell(nn.Module):
    def __init__(self, input_channels, hidden_channels):
        super().__init__()

        self.hidden_channels = hidden_channels

        self.conv = nn.Conv2d(
            input_channels + hidden_channels,
            4 * hidden_channels,
            kernel_size=3,
            padding=1
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


class SIHV3Nowcast(nn.Module):
    def __init__(
        self,
        in_channels=8,
        hidden_channels=48,
        horizons=4
    ):
        super().__init__()

        self.hidden_channels = hidden_channels

        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),

            nn.Conv2d(32, 48, 3, padding=1),
            nn.BatchNorm2d(48),
            nn.ReLU(inplace=True)
        )

        self.lstm = ConvLSTMCell(
            input_channels=48,
            hidden_channels=hidden_channels
        )

        self.decoder = nn.Sequential(
            nn.Conv2d(hidden_channels, 32, 3, padding=1),
            nn.ReLU(inplace=True),

            nn.Conv2d(32, 16, 3, padding=1),
            nn.ReLU(inplace=True)
        )

        self.heads = nn.ModuleList([
            nn.Conv2d(16, 1, 1)
            for _ in range(horizons)
        ])

    def forward(self, x):

        batch_size, time_steps, _, height, width = x.shape

        h = torch.zeros(
            batch_size,
            self.hidden_channels,
            height,
            width,
            device=x.device
        )

        c = torch.zeros(
            batch_size,
            self.hidden_channels,
            height,
            width,
            device=x.device
        )

        for t in range(time_steps):

            features = self.encoder(x[:, t])

            h, c = self.lstm(
                features,
                h,
                c
            )

        features = self.decoder(h)

        outputs = []

        for head in self.heads:
            outputs.append(
                head(features).squeeze(1)
            )

        return torch.stack(outputs, dim=1)


def load_model(checkpoint_path, device=None):

    if device is None:
        device = (
            "mps"
            if torch.backends.mps.is_available()
            else "cpu"
        )

    model = SIHV3Nowcast()

    checkpoint = torch.load(
        checkpoint_path,
        map_location=device
    )

    model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()

    return model, device


def normalize_input(x):

    """
    Input shape:
        (6, 8, 128, 128)

    Channel order:
        0 B13
        1 t2m
        2 d2m
        3 u10
        4 v10
        5 cape
        6 cin
        7 tp
    """

    return (
        x - MEAN[None, :, None, None]
    ) / STD[None, :, None, None]


def predict(model, x, device):

    """
    Input:
        numpy array with shape (6, 8, 128, 128)

    Output:
        numpy array with shape (4, 128, 128)

    Horizons:
        0 -> +30 min
        1 -> +60 min
        2 -> +90 min
        3 -> +120 min
    """

    x = normalize_input(x)

    x = torch.from_numpy(
        x.astype(np.float32)
    )

    x = x.unsqueeze(0).to(device)

    with torch.no_grad():

        logits = model(x)

        probabilities = torch.sigmoid(logits)

    return probabilities[0].cpu().numpy()


if __name__ == "__main__":

    from pathlib import Path

    checkpoint = Path(__file__).resolve().parent / "sih_v3_best.pth"

    model, device = load_model(
        checkpoint
    )

    dummy_input = np.random.randn(
        6, 8, 128, 128
    ).astype(np.float32)

    predictions = predict(
        model,
        dummy_input,
        device
    )

    print("V3 model loaded successfully")
    print("Device:", device)
    print("Parameters:",
          sum(p.numel() for p in model.parameters()))
    print("Input shape:",
          dummy_input.shape)
    print("Output shape:",
          predictions.shape)
