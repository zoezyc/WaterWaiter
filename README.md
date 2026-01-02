# WaterWaiter - Autonomous Drink-Serving Robot

An AI-powered autonomous robot that serves drinks at events using computer vision, cloud robotics, and a modern web dashboard.

![Robot Status](https://img.shields.io/badge/Status-Production-green)
![Platform](https://img.shields.io/badge/Platform-Raspberry%20Pi%204-red)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Development Setup (Laptop)](#development-setup-laptop)
  - [Production Setup (Raspberry Pi)](#production-setup-raspberry-pi)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🤖 Overview

WaterWaiter is an autonomous drink-serving robot designed for social events and hospitality environments. It uses:

- **AI-based person detection** via Viam Cloud platform
- **Camera-only navigation** (no expensive LiDAR)
- **Real-time web dashboard** for monitoring and control
- **Cloud database** for inventory and analytics
- **Autonomous state machine** for serving behavior

---

## ✨ Features

### Robot Capabilities
- ✅ Autonomous person detection and approach
- ✅ Proximity-based stopping (bounding box analysis)
- ✅ Multi-state behavior (Idle, Searching, Moving, Serving)
- ✅ Manual teleoperation via web joystick
- ✅ Real-time camera streaming

### Web Dashboard
- ✅ **Admin Dashboard**: Robot monitoring, manual control, analytics
- ✅ **Staff Dashboard**: Inventory management, event configuration
- ✅ **Client Interface**: Interactive drink ordering on robot tablet
- ✅ Real-time WebSocket updates
- ✅ Live camera feed

### Data Management
- ✅ Real-time inventory tracking
- ✅ Event management system
- ✅ Activity logging with timestamps
- ✅ Analytics and consumption reports

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Web Browser                       │
│         (Admin, Staff, Client Dashboards)           │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP/WebSocket
                    ↓
┌─────────────────────────────────────────────────────┐
│              Node.js Backend Server                 │
│  - Express REST API                                 │
│  - Socket.IO (WebSocket)                            │
│  - Child Process Manager                            │
└───────────┬─────────────────────────────────────────┘
            │ spawns
            ├──────────────┬────────────────┐
            ↓              ↓                ↓
    ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
    │  tipsy.py    │  │ camera      │  │ manual_drive │
    │  (Autonomous)│  │ _server.py  │  │ .py          │
    └──────┬───────┘  └──────┬──────┘  └──────┬───────┘
           │                 │                 │
           └─────────────────┴─────────────────┘
                          │
                          ↓
                  ┌───────────────┐
                  │  Viam Cloud   │
                  │  (Robot API)  │
                  └───────┬───────┘
                          │
                          ↓
                  ┌───────────────┐
                  │ Physical Robot│
                  │ Motors, Camera│
                  └───────────────┘
```

---

## 📦 Prerequisites

### Hardware (Production)
- Raspberry Pi 4 (4GB+ RAM recommended)
- USB Camera (or Pi Camera Module)
- Motor driver (L298N or similar)
- DC Motors (2x or 4x for movement)
- Chassis with wheels
- Battery pack (for motors and Pi)

### Software
- **Node.js**: v18.x or higher
- **Python**: 3.9 or higher
- **npm**: 8.x or higher
- **Git**: For cloning the repository

### Cloud Services
- **Viam Account**: Sign up at [viam.com](https://viam.com)
- **Supabase Account**: Sign up at [supabase.com](https://supabase.com)

---

## 🚀 Installation

### Development Setup (Laptop)

**For testing without physical hardware:**

#### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/WaterWaiter.git
cd WaterWaiter
```

#### 2. Install Backend Dependencies

```bash
cd server
npm install
```

#### 3. Install Frontend Dependencies

```bash
cd ../client
npm install
```

#### 4. Setup Python Environment

```bash
cd ..
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

# Install Python packages
pip install viam-sdk aiohttp
```

#### 5. Configure Environment Variables

Create `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Viam Robot Configuration
ROBOT_API_KEY=your_viam_api_key
ROBOT_API_KEY_ID=your_viam_api_key_id
ROBOT_ADDRESS=your-robot-name.viam.cloud
ROBOT_BASE=tipsy-base
ROBOT_CAMERA=cam
ROBOT_DETECTOR=myPeopleDetector

# Camera Server
CAMERA_PORT=3001

# Supabase Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### 6. Run Development Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

**Terminal 3 - Robot (Optional, requires hardware):**
```bash
# Activate venv first
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
cd robot
python tipsy.py
```

#### 7. Access Application

Open browser: `http://localhost:5173` (Vite dev server)

---

### Production Setup (Raspberry Pi)

**For deploying to physical robot:**

#### 1. Prepare Raspberry Pi

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python dependencies
sudo apt install -y python3-pip python3-venv python3-dev build-essential

# Install PM2 (process manager)
sudo npm install -g pm2
```

#### 2. Transfer Code to Pi

**Option A: Using SCP**
```bash
# From your laptop
scp -r WaterWaiter pi@raspberrypi.local:/home/pi/
```

**Option B: Using Git**
```bash
# On Raspberry Pi
cd /home/pi
git clone https://github.com/YOUR_USERNAME/WaterWaiter.git
cd WaterWaiter
```

#### 3. Install Dependencies on Pi

```bash
# Install Python packages
python3 -m venv .venv
source .venv/bin/activate
pip install viam-sdk aiohttp

# Install Node.js packages
cd /home/pi/WaterWaiter/server
npm install

# Build frontend (optional, if serving from Pi)
cd /home/pi/WaterWaiter/client
npm install
npm run build
```

#### 4. Configure Environment

```bash
cd /home/pi/WaterWaiter
nano .env
# Paste your environment variables (see Development Setup step 5)
```

#### 5. Setup Auto-Start with PM2

```bash
cd /home/pi/WaterWaiter

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'waterwaiter',
    cwd: '/home/pi/WaterWaiter/server',
    script: 'src/index.ts',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Enable auto-start on boot
pm2 save
pm2 startup
# Run the command it outputs (starts with 'sudo env PATH=...')

# Restart Pi to test
sudo reboot
```

#### 6. Access Application

After Pi reboots, open browser: `http://raspberrypi.local:3000`

---

## ⚙️ Configuration

### Viam Robot Setup

1. Create account at [viam.com](https://viam.com)
2. Create new machine/robot
3. Add components:
   - **Base**: Motor controller (e.g., `viam:base:wheeled`)
   - **Camera**: USB or Pi Camera
   - **Vision Service**: Add ML model for person detection
4. Copy API credentials to `.env`

### Supabase Database Setup

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run migrations in `supabase/migrations/`:
   - `20231217000000_initial_schema.sql`
   - `20231217000001_events_schema.sql`
4. Copy project URL and keys to `.env`

---

## 🎮 Running the Application

### Development Mode

```bash
# Start backend (Terminal 1)
cd server
npm run dev

# Start frontend (Terminal 2)
cd client
npm run dev

# Start robot (Terminal 3, optional)
source .venv/bin/activate
cd robot
python tipsy.py
```

### Production Mode

```bash
# On Raspberry Pi
pm2 status  # Check if running
pm2 logs waterwaiter  # View logs
pm2 restart waterwaiter  # Restart if needed
```

### Starting Autonomous Mode

1. Access web dashboard
2. Log in as Admin
3. Navigate to Robot Control
4. Click **"START ROBOT"**
5. Robot enters autonomous mode

---

## 📁 Project Structure

```
WaterWaiter/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Dashboard pages
│   │   ├── services/      # API services
│   │   └── socket.ts      # WebSocket client
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── controllers/   # Route handlers
│   │   ├── services/      # Business logic
│   │   ├── routes/        # API routes
│   │   └── index.ts       # Entry point
│   └── package.json
├── robot/                  # Python robot scripts
│   ├── tipsy.py           # Autonomous control
│   ├── camera_server.py   # Camera streaming
│   └── manual_drive.py    # Manual control
├── supabase/
│   └── migrations/        # Database schemas
├── .env                    # Environment variables
└── README.md              # This file
```

---

## 📡 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Robot Endpoints

#### Start Robot
```http
POST /robot/start
```
Spawns autonomous control script.

#### Stop Robot
```http
POST /robot/stop
```
Terminates robot processes.

#### Update Status
```http
POST /robot/status
Body: {
  "status": "searching|moving|serving|idle",
  "personDetected": boolean,
  "bboxHeight": number,
  "detectionConfidence": number
}
```
Posted by robot to update state.

#### Manual Control
```http
POST /robot/manual
Body: {
  "linear": {"x": 0, "y": 0.5, "z": 0},
  "angular": {"x": 0, "y": 0, "z": 0.3}
}
```
Send joystick commands.

### WebSocket Events

**Server → Client:**
- `robot_status`: Real-time robot state updates

**Client → Server:**
- `connection`: Client connects
- `disconnect`: Client disconnects

---

## 🐛 Troubleshooting

### Server won't start

```bash
# Check logs
pm2 logs waterwaiter

# Common issues:
# - Missing .env file
# - Port 3000 already in use (kill process using port)
# - Missing node_modules (run npm install)
```

### Camera server fails

```bash
# Test manually
cd robot
source ../venv/bin/activate
python camera_server.py

# Common issues:
# - Camera not connected
# - viam-sdk not installed
# - Wrong camera name in .env
```

### Robot can't connect to Viam

```bash
# Test Viam credentials
python -c "
import asyncio
from viam.robot.client import RobotClient

async def test():
    opts = RobotClient.Options.with_api_key(
        api_key='YOUR_API_KEY',
        api_key_id='YOUR_API_KEY_ID'
    )
    robot = await RobotClient.at_address('YOUR_ADDRESS', opts)
    print('✅ Connected to Viam!')
    await robot.close()

asyncio.run(test())
"
```

### WebSocket not connecting

- Check CORS settings in `.env`
- Ensure Socket.IO client version matches server version
- Check browser console for connection errors

### Database queries failing

- Verify Supabase credentials in `.env`
- Check network connectivity
- Ensure migrations have been run
- Check Supabase project status

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes: `git commit -m 'Add AmazingFeature'`
4. Push to branch: `git push origin feature/AmazingFeature`
5. Open Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 👥 Team

- **Koh Kean Hoe** - Raspberry Pi & Viam Integration
- **Zoe Chan Zi Yi** - Web Application Development
- **Alya Irdina Binti Mohd Allaudin** - Database Management
- **Mugendran A/L Suntheram** - Chassis & Hardware

---

## 🙏 Acknowledgments

- **Viam Robotics Platform** - Robot control and AI vision
- **Supabase** - Database and real-time features
- **React + Node.js** - Web framework
- **Dr. Azman Abdul Malik** - Project supervisor

---

## 📞 Support

For issues and questions:
- Create an issue in GitHub repository
- Contact: keanhoekoh@student.usm.my

---

**Built with ❤️ for CAT304 - Group Innovation Project**

**University Sains Malaysia** | 2025
