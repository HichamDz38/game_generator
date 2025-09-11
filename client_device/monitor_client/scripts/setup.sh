#!/usr/bin/env bash
set -e

# === CONFIG ===
SERVICE_NAME="Client_Device_Monitor.service"
PYTHON_BIN=/usr/bin/python
SCRIPT_DIR="$(pwd)"
PROG_DIR="$(realpath $SCRIPT_DIR/../)"
PROG_FILE_NAME="client.py"
PROG_FILE="$PROG_DIR/$PROG_FILE_NAME"
REQUIREMENTS_FILE="$PROG_DIR/requirment.txt"
USER_NAME=$(whoami)
GROUP_NAME=$(id -gn)
CONFIG_FILE="./scripts/config.env"     # path to your config
LOG_FILE=/var/log/monitor_device_client.log
ERR_LOG_FILE=/var/log/monitor_device_client_err.log
SERVICE_FILE=/etc/systemd/system/$SERVICE_NAME.service
DISPLAY_TYPE="monitor"



# === STEP 1: Prepare the PI by removing the display and enabling SSH and enabling SPI ===
echo "[*] Enabling SSH..."
sudo systemctl enable ssh
sudo systemctl start ssh

echo "[*] Enabling SPI..."
sudo raspi-config nonint do_spi 0 || {
    # fallback if raspi-config not used
    sudo sed -i 's/^#dtparam=spi=on/dtparam=spi=on/' /boot/config.txt
    grep -q '^dtparam=spi=on' /boot/config.txt || echo "dtparam=spi=on" | sudo tee -a /boot/config.txt
}

echo "[*] Enabling auto-login on console..."
sudo raspi-config nonint do_boot_behaviour B2 || {
    # fallback without raspi-config
    sudo ln -fs /etc/systemd/system/autologin@.service /etc/systemd/system/getty.target.wants/getty@tty1.service
}

echo "[*] Setting boot to console (not desktop)..."
sudo raspi-config nonint do_boot_behaviour B1 || {
    # fallback without raspi-config
    sudo systemctl set-default multi-user.target
}

echo "✅ Done! Reboot to apply changes."

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

# === STEP 3: Configure client.py ===
echo "[*] Updating $PROG_FILE_NAME using $CONFIG_FILE"

if [[ -n "$HOST" ]]; then
    sed -i "s/^\( *HOST *= *\).*/\1\"$HOST\"/" "$PROG_FILE"
    echo " → HOST set to $HOST"
fi

if [[ -n "$DEVICE_NAME" ]]; then
    sed -i "s/^\( *DEVIC_NAME *= *\).*/\1\"$DEVICE_NAME\"/" "$PROG_FILE"
    echo " → DEVICE_NAME set to $DEVICE_NAME"
fi

if [[ -n "$N_HINT" ]]; then
    sed -i "s/^\( *N_HINT *= *\).*/\1\"$N_HINT\"/" "$PROG_FILE"
    echo " → N_HINT set to $N_HINT"
fi

chmod +x "$PROG_FILE"

# === STEP 4: Create systemd service ===
SERVICE_PATH="/etc/systemd/system/$SERVICE_NAME"
echo "[*] Creating systemd service at $SERVICE_PATH..."

sudo tee "$SERVICE_PATH" > /dev/null <<EOF
[Unit]
Description=Autostart_Device_Client for ($PROG_FILE_NAME)
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
Environment="PYTHONUNBUFFERED=1"

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


# === STEP 6: Create uninstall.sh ===
UNINSTALL_SCRIPT="$SCRIPT_DIR/uninstall.sh"

cat > "$UNINSTALL_SCRIPT" <<EOF
#!/usr/bin/env bash
set -e

SERVICE_NAME="$SERVICE_NAME"
SERVICE_PATH="/etc/systemd/system/\$SERVICE_NAME"
SCRIPT_DIR="$(pwd)"
PROG_DIR="$(realpath \$SCRIPT_DIR/../)"
PROG_FILE_NAME="$PROG_FILE_NAME"
PROG_FILE="\$PROG_DIR/\$PROG_FILE_NAME"
ENABLE_SCRIPT="\$SCRIPT_DIR/enable_autostart.sh"
DISABLE_SCRIPT="\$SCRIPT_DIR/disable_autostart.sh"
LOG_FILE="$LOG_FILE"
ERR_LOG_FILE="$ERR_LOG_FILE"

echo "[*] Starting uninstall process..."

# === STEP 1: Stop & disable service ===
if systemctl list-units --full -all | grep -q "\$SERVICE_NAME"; then
    echo "[*] Stopping service \$SERVICE_NAME..."
    sudo systemctl stop "\$SERVICE_NAME" || true
    sudo systemctl disable "\$SERVICE_NAME" || true
    sudo rm -f "\$SERVICE_PATH"
    sudo systemctl daemon-reload
    echo " → Service removed"
else
    echo "[!] Service \$SERVICE_NAME not found, skipping..."
fi

# === STEP 2: Remove helper scripts ===
rm -f "\$ENABLE_SCRIPT" "\$DISABLE_SCRIPT"
echo " → Helper scripts removed"

# === STEP 3: Remove Python packages installed ===
echo "[*] Removing installed Python packages..."
pip3 uninstall -y it8951 || true
if [[ -f "\$PROG_DIR/requirment.txt" ]]; then
    pip3 uninstall -y -r "\$PROG_DIR/requirment.txt" || true
fi

# === STEP 4: Clean logs ===
echo "[*] Removing logs..."
sudo rm -f "\$LOG_FILE" "\$ERR_LOG_FILE"

# === STEP 5: Remove whole project folder (optional cleanup) ===

echo
read -p "⚠️  Do you really want to delete the whole project folder at '\$PROG_DIR'? [y/N]: " CONFIRM
if [[ "\$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "[*] Removing project folder \$PROG_DIR..."
    rm -rf "\$PROG_DIR"
    echo " → Project removed"
else
    echo "[!] Skipping project folder removal."
fi


echo
echo "✅ Uninstall complete!"
EOF

chmod +x "$UNINSTALL_SCRIPT"
echo "➡ Uninstall script created at $UNINSTALL_SCRIPT"


