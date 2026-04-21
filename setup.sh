#!/bin/bash

BASE="/home/$(whoami)/project/smartparking"
echo ""
echo "SmartParking-Pi Setup"
echo "   Base dir: $BASE"
echo ""

# ── 1. Update OS & install system deps ──────────────────────
echo "Updating system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  curl git build-essential \
  python3 python3-pip python3-venv \
  mosquitto mosquitto-clients \
  libopenblas-dev liblapack-dev \
  libatlas-base-dev \
  pigpio

echo "System packages installed"

# ── 2. Install Node.js 20 LTS ──────────────────────────────
echo ""
echo "Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null || [[ $(node -v) != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node.js $(node -v) ready"

# ── 3. Setup Mosquitto (local MQTT broker) ──────────────────
echo ""
echo "Configuring Mosquitto..."
sudo bash -c 'cat > /etc/mosquitto/conf.d/smartparking.conf << EOF
listener 1883 localhost
allow_anonymous true
EOF'
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto
echo "Mosquitto running on localhost:1883"

# ── 4. Install PM2 ──────────────────────────────────────────
echo ""
echo "Installing PM2..."
sudo npm install -g pm2
echo "PM2 installed"

# ── 5. Backend setup ────────────────────────────────────────
echo ""
echo "Setting up Backend..."
cd "$BASE/source/backend"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from example — edit if needed"
fi

npm install
npx prisma db push
node seeds.js
echo "Backend ready, DB seeded"

# ── 6. AI Service setup ─────────────────────────────────────
echo ""
echo "Setting up AI Service..."
cd "$BASE/source/ai-service"
python3 -m venv venv
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
deactivate
echo "AI Service (PaddleOCR) installed"

# ── 7. Pi Driver setup ──────────────────────────────────────
echo ""
echo "Setting up Pi Driver..."
cd "$BASE/source/pi-driver"
python3 -m venv venv
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
deactivate

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created pi-driver .env — PLEASE EDIT IP_CAM_URL!"
fi
echo "Pi Driver installed"

# ── Create log directory ─────────────────────────────────────
mkdir -p "$BASE/logs"

# ── Add swap (safety for PaddleOCR first load) ──────────────
echo ""
echo "📦 Setting up swap (1GB)..."
if ! swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "Swap 1GB enabled"
else
  echo "Swap already exists"
fi

echo ""
echo "IMPORTANT — Edit these files before starting:"
echo "   nano $BASE/source/backend/.env       (check PORT, JWT_SECRET)"
echo "   nano $BASE/source/pi-driver/.env     (set IP_CAM_URL!)"
echo ""
echo "To start all services:"
echo "   cd $BASE && pm2 start ecosystem.config.cjs"
echo "   pm2 startup && pm2 save"
echo ""
echo "Monitor logs:"
echo "   pm2 logs"
echo "   pm2 monit"
echo ""
