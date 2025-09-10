#!/usr/bin/env bash
set -e

# === CONFIG ===
REPO_URL="https://github.com/GregDMeyer/IT8951.git"
TMP_DIR="/tmp/it8951"
SERVICE_NAME="Client_Device.service"
PYTHON_BIN=/usr/bin/python
SCRIPT_DIR="$(pwd)"
PROG_DIR="$(realpath $SCRIPT_DIR/../)"
PROG_FILE_NAME="generic_device.py"
PROG_FILE="$PROG_DIR/$PROG_FILE_NAME"
REQUIREMENTS_FILE="$PROG_DIR/requirment.txt"
USER_NAME=$(whoami)
GROUP_NAME=$(id -gn)
CONFIG_FILE="./scripts/config.env"     # path to your config
LOG_FILE=/var/log/generic_device.log
ERR_LOG_FILE=/var/log/generic_device_err.log
SERVICE_FILE=/etc/systemd/system/$SERVICE_NAME.service


# === STEP 1: Clone and install IT8951 ===
echo "[*] Cloning IT8951 repo into $TMP_DIR..."
rm -rf "$TMP_DIR"
git clone "$REPO_URL" "$TMP_DIR"

echo "[*] Installing IT8951..."
cd "$TMP_DIR"
pip3 install . --break-system-packages

# === STEP 2: Install requirements ===
cd "$PROG_DIR"
if [[ -f "$REQUIREMENTS_FILE" ]]; then
    echo "[*] Installing Python requirements..."
    pip3 install -r "$REQUIREMENTS_FILE" --break-system-packages
else
    echo "[!] No requirement.txt found, skipping..."
fi

# Load config values
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
else
    echo "[!] Config file not found: $CONFIG_FILE"
    exit 1
fi

# === STEP 3: Configure generic_device.py ===
echo "[*] Updating $PROG_FILE_NAME using $CONFIG_FILE"

if [[ -n "$HOST" ]]; then
    sed -i "s/^\( *HOST *= *\).*/\1\"$HOST\"/" "$PROG_FILE"
    echo " → HOST set to $HOST"
fi

if [[ -n "$DEVICE_ID" ]]; then
    sed -i "s/^\( *DEVIC_NAME *= *\).*/\1\"$DEVICE_ID\"/" "$PROG_FILE"
    echo " → DEVICE_ID set to $DEVICE_ID"
fi

if [[ -n "$N_HINT" ]]; then
    sed -i "s/^\( *N_HINT *= *\).*/\1\"$N_HINT\"/" "$PROG_FILE"
    echo " → N_HINT set to $N_HINT"
fi
#configure display type
if [[ "$DISPLAY_TYPE" == "epaper" ]]; then
    sed -i 's|^from .* as display_img|from display import main as display_img|' "$PROG_FILE"
    echo " → Display type set to EPAPER (display.py)"
elif [[ "$DISPLAY_TYPE" == "monitor" ]]; then
    sed -i 's|^from .* as display_img|from splash import cast as display_img|' "$PROG_FILE"
    echo " → Display type set to MONITOR (splash.py)"
else
    echo "[!] DISPLAY_TYPE not set correctly in $CONFIG_FILE (expected 'epaper' or 'monitor')"
fi
chmod +x "$PROG_FILE"

# === STEP 4: Create systemd service ===
SERVICE_PATH="/etc/systemd/system/$SERVICE_NAME"
echo "[*] Creating systemd service at $SERVICE_PATH..."

sudo tee "$SERVICE_PATH" > /dev/null <<EOF
[Unit]
Description=Generic_Device_Client for ($PROG_FILE_NAME)
After=network.target

[Service]
User=$USER_NAME
Group=$GROUP_NAME
ExecStart=$PYTHON_BIN $PROG_FILE
WorkingDirectory=$PROG_DIR
StandardOutput=append:$LOG_FILE
StandardError=append:$ERR_LOG_FILE
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# === STEP 5: Helper scripts ===
ENABLE_SCRIPT="$SCRIPT_DIR/enable_autostart.sh"
DISABLE_SCRIPT="$SCRIPT_DIR/disable_autostart.sh"

cat > "$ENABLE_SCRIPT" <<EOF
#!/usr/bin/env bash
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME
echo "[*] Autostart enabled for $PROG_FILE_NAME"
EOF
chmod +x "$ENABLE_SCRIPT"

cat > "$DISABLE_SCRIPT" <<EOF
#!/usr/bin/env bash
sudo systemctl stop $SERVICE_NAME
sudo systemctl disable $SERVICE_NAME
#sudo rm -f /etc/systemd/system/$SERVICE_NAME
sudo systemctl daemon-reload
echo "[*] Autostart disabled and service removed for $PROG_FILE_NAME"
EOF
chmod +x "$DISABLE_SCRIPT"

echo
echo "✅ Setup complete!"
echo "➡ Use ./enable_autostart.sh to enable autostart."
echo "➡ Use ./disable_autostart.sh to remove autostart."
