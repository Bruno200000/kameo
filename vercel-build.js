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
  const frontendPath = path.join(process.cwd(), 'frontend');
  process.chdir(frontendPath);
  console.log('📍 Frontend directory:', process.cwd());
  
  execSync('npm install', { stdio: 'inherit' });
  execSync('npm run build', { stdio: 'inherit' });
  
  // Vérifier si le dossier dist existe
  const distPath = path.join(frontendPath, 'dist');
  if (fs.existsSync(distPath)) {
    console.log('✅ Frontend dist folder found at:', distPath);
  } else {
    console.log('❌ Frontend dist folder NOT found at:', distPath);
    // Lister les fichiers pour déboguer
    console.log('📂 Frontend directory contents:', fs.readdirSync(frontendPath));
    throw new Error('Build failed: dist folder not found');
  }
  
  console.log('\n✅ Build completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
