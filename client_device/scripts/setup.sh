#!/usr/bin/env bash
set -e

# === CONFIG ===
REPO_URL="https://github.com/GregDMeyer/IT8951.git"
TMP_DIR="/tmp/it8951"
SERVICE_NAME="Client_Device.service"
SCRIPT_DIR="$(pwd)"
PROG_DIR="$SCRIPT_DIR/../"
PROG_FILE_NAME="generic_device.py"
PROG_FILE="$PROG_DIR/$PROG_FILE_NAME"
REQUIREMENTS_FILE="$PROG_DIR/requirement.txt"

# === STEP 1: Clone and install IT8951 ===
echo "[*] Cloning IT8951 repo into $TMP_DIR..."
rm -rf "$TMP_DIR"
git clone "$REPO_URL" "$TMP_DIR"

echo "[*] Installing IT8951..."
cd "$TMP_DIR"
pip3 install .

# === STEP 2: Install requirements ===
cd "$PROG_DIR"
if [[ -f "$REQUIREMENTS_FILE" ]]; then
    echo "[*] Installing Python requirements..."
    pip3 install -r "$REQUIREMENTS_FILE"
else
    echo "[!] No requirement.txt found, skipping..."
fi

# === STEP 3: Configure client.py ===
echo
read -p "Enter server IP address (leave empty to keep default): " NEW_IP
if [[ -n "$NEW_IP" ]]; then
    sed -i "s/^\( *HOST *= *\).*/\1\"$NEW_IP\"/" "$PROG_FILE"
    echo "[*] Updated server IP in $PROG_FILE_NAME → $NEW_IP"
fi

read -p "Enter DEVICE_ID (leave empty to keep default): " NEW_ID
if [[ -n "$NEW_ID" ]]; then
    sed -i "s/^\( *DEVIC_NAME *= *\).*/\1\"$NEW_ID\"/" "$PROG_FILE"
    echo "[*] Updated DEVIC_NAME in $PROG_FILE_NAME → $NEW_ID"
fi

read -p "Enter N_HINT (leave empty to keep default): " NEW_N_HINT
if [[ -n "$NEW_ID" ]]; then
    sed -i "s/^\( *N_HINT *= *\).*/\1\"$NEW_ID\"/" "$PROG_FILE"
    echo "[*] Updated N_HINTS in $PROG_FILE_NAME → $NEW_ID"
fi


chmod +x "$PROG_FILE"

# === STEP 4: Create systemd service ===
SERVICE_PATH="/etc/systemd/system/$SERVICE_NAME"
echo "[*] Creating systemd service at $SERVICE_PATH..."

sudo tee "$SERVICE_PATH" > /dev/null <<EOF
[Unit]
Description=Python Client Script ($PROG_FILE_NAME)
After=network.target

[Service]
ExecStart=/usr/bin/python3 $PROG_FILE
WorkingDirectory=$SCRIPT_DIR
Restart=always
RestartSec=5
User=$USER

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
sudo rm -f /etc/systemd/system/$SERVICE_NAME
sudo systemctl daemon-reload
echo "[*] Autostart disabled and service removed for $PROG_FILE_NAME"
EOF
chmod +x "$DISABLE_SCRIPT"

echo
echo "✅ Setup complete!"
echo "➡ Use ./enable_autostart.sh to enable autostart."
echo "➡ Use ./disable_autostart.sh to remove autostart."
