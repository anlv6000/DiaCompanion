import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import segmentation_models_pytorch as smp

from dataset_oct import OCTDataset
from metrics import dice_score

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Device:", device)

# =========================
# Dataset
# =========================

train_dataset = OCTDataset(
    "/content/dataset/dataset/train/images",
    "/content/dataset/dataset/train/masks"
)

val_dataset = OCTDataset(
    "/content/dataset/dataset/val/images",
    "/content/dataset/dataset/val/masks"
)

train_loader = DataLoader(
    train_dataset,
    batch_size=8,
    shuffle=True
)

val_loader = DataLoader(
    val_dataset,
    batch_size=8,
    shuffle=False
)

# =========================
# Model
# =========================

model = smp.Unet(
    encoder_name="resnet18",
    encoder_weights=None,
    in_channels=1,
    classes=8
)

model = model.to(device)

# =========================
# Loss
# =========================

criterion = nn.CrossEntropyLoss()

# =========================
# Optimizer
# =========================

optimizer = torch.optim.Adam(
    model.parameters(),
    lr=1e-4
)

# =========================
# Training
# =========================

EPOCHS = 20

best_dice = 0

for epoch in range(EPOCHS):

    # ---------------------
    # TRAIN
    # ---------------------

    model.train()

    train_loss = 0

    for imgs, masks in train_loader:

        imgs = imgs.to(device)
        masks = masks.to(device)

        optimizer.zero_grad()

        outputs = model(imgs)

        loss = criterion(
            outputs,
            masks
        )

        loss.backward()

        optimizer.step()

        train_loss += loss.item()

    train_loss /= len(train_loader)

    # ---------------------
    # VALIDATION
    # ---------------------

    model.eval()

    val_loss = 0
    val_dice = 0

    with torch.no_grad():

        for imgs, masks in val_loader:

            imgs = imgs.to(device)
            masks = masks.to(device)

            outputs = model(imgs)

            loss = criterion(
                outputs,
                masks
            )

            val_loss += loss.item()

            val_dice += dice_score(
                outputs,
                masks
            ).item()

    val_loss /= len(val_loader)
    val_dice /= len(val_loader)

    # ---------------------
    # SAVE BEST MODEL
    # ---------------------

    if val_dice > best_dice:

        best_dice = val_dice

        torch.save(
            model.state_dict(),
            "best_unet.pth"
        )

        saved_text = " <-- SAVED"

    else:

        saved_text = ""

    # ---------------------
    # PRINT
    # ---------------------

    print(
        f"Epoch {epoch+1:02d}/{EPOCHS} | "
        f"Train Loss: {train_loss:.4f} | "
        f"Val Loss: {val_loss:.4f} | "
        f"Dice: {val_dice:.4f}"
        f"{saved_text}"
    )

print()
print("Best Dice:", best_dice)