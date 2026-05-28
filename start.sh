#!/bin/bash

# La Isla Cafe Backend startup/restart script with PM2.
echo "Starting La Isla Cafe backend..."

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="la-isla-cafe-backend"
DEFAULT_PORT="4000"

print_status() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

if [ ! -f "package.json" ]; then
  print_error "package.json not found. Run this script from the backend folder."
  exit 1
fi

if [ ! -f ".env" ]; then
  print_error ".env file missing in backend folder."
  print_status "Creating .env from .env.example..."

  if [ -f ".env.example" ]; then
    cp .env.example .env
    print_warning "Created .env file from template."
    print_warning "Edit .env with your production configuration before running again."
    echo ""
    print_status "Required production values:"
    echo "  - MONGODB_URI (MongoDB Atlas connection string)"
    echo "  - JWT_SECRET (generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
    echo "  - CORS_ORIGIN (https://laislacafepicnic.com,https://www.laislacafepicnic.com)"
    echo "  - NODE_ENV=production"
    echo "  - PORT=${DEFAULT_PORT} (or your chosen port)"
    exit 1
  fi

  print_error ".env.example not found. Create .env manually."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  print_error "PM2 is not installed."
  print_status "Install it globally with:"
  echo "  npm install -g pm2"
  exit 1
fi

print_status "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
  print_error "Failed to install dependencies."
  exit 1
fi

print_status "Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
  print_error "Failed to build TypeScript."
  exit 1
fi

print_status "Starting or restarting backend with PM2..."
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start dist/index.js --name "$APP_NAME"
if [ $? -ne 0 ]; then
  print_error "Failed to start backend with PM2."
  exit 1
fi

pm2 save

print_status "Backend started successfully."
echo ""
print_status "Backend API should be running on port ${DEFAULT_PORT}, unless PORT is overridden in .env."
echo ""
print_status "Useful PM2 commands:"
echo "  pm2 status"
echo "  pm2 logs ${APP_NAME}"
echo "  pm2 logs ${APP_NAME} --lines 100"
echo "  pm2 restart ${APP_NAME}"
echo "  pm2 stop ${APP_NAME}"
echo "  pm2 delete ${APP_NAME}"
echo "  pm2 monit"
echo ""
print_status "Test the API locally:"
echo "  curl http://localhost:${DEFAULT_PORT}/api/health"
echo ""
print_status "To make PM2 start on system reboot:"
echo "  pm2 startup"
echo "  # Then run the command PM2 prints."
