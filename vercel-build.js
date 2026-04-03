#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔨 Starting Vercel build process...');
console.log('📍 Current directory:', process.cwd());
console.log('📂 Directory contents:', fs.readdirSync('.'));

try {
  console.log('\n📦 Installing root dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('\n📂 Building frontend...');
  process.chdir('frontend');
  console.log('📍 Frontend directory:', process.cwd());
  
  execSync('npm install', { stdio: 'inherit' });
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('\n✅ Build completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
