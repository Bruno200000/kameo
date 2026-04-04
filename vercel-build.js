#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔨 Starting Vercel build process...');
console.log('📍 Current directory:', process.cwd());
console.log('📂 Directory contents:', fs.readdirSync('.'));

try {
  const rootDir = __dirname;
  console.log('📍 Root directory:', rootDir);

  console.log('\n📦 Installing root dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: rootDir });

  console.log('\n📂 Building frontend...');
  const frontendPath = path.join(rootDir, 'frontend');
  console.log('📍 Frontend directory:', frontendPath);
  
  if (!fs.existsSync(frontendPath)) {
    console.error('❌ Frontend directory NOT found at:', frontendPath);
    console.log('📂 Root directory contents:', fs.readdirSync(rootDir));
    throw new Error(`Frontend directory not found at ${frontendPath}`);
  }

  execSync('npm install', { stdio: 'inherit', cwd: frontendPath });
  execSync('npm run build', { stdio: 'inherit', cwd: frontendPath });
  
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
