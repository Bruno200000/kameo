#!/bin/bash
echo "Starting Vercel build process..."
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

echo "Installing root dependencies..."
npm install

echo "Building frontend..."
cd frontend
echo "Frontend directory: $(pwd)"
npm install
npm run build

echo "Build completed successfully"