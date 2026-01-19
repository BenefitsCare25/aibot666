#!/usr/bin/env node
/**
 * Build Widget Script
 *
 * This script automates the complete widget build process:
 * 1. Builds the widget in frontend/widget
 * 2. Copies built files to backend/public
 * 3. Regenerates SRI hashes
 *
 * Usage: npm run build-widget
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = join(__dirname, '..', '..');
const WIDGET_DIR = join(ROOT_DIR, 'frontend', 'widget');
const BACKEND_PUBLIC = join(ROOT_DIR, 'backend', 'public');
const WIDGET_DIST = join(WIDGET_DIR, 'dist');

function run(command, cwd) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd, stdio: 'inherit', shell: true });
}

function copyFile(src, dest) {
  console.log(`Copying: ${src} -> ${dest}`);
  copyFileSync(src, dest);
}

async function main() {
  console.log('='.repeat(50));
  console.log('Building Widget + Generating SRI Hashes');
  console.log('='.repeat(50));

  // Step 1: Build widget
  console.log('\n[1/3] Building widget...');
  run('npm run build', WIDGET_DIR);

  // Step 2: Copy files to backend/public
  console.log('\n[2/3] Copying files to backend/public...');

  const filesToCopy = ['widget.iife.js', 'widget.css'];
  for (const file of filesToCopy) {
    const src = join(WIDGET_DIST, file);
    const dest = join(BACKEND_PUBLIC, file);

    if (!existsSync(src)) {
      console.error(`ERROR: ${src} not found!`);
      process.exit(1);
    }
    copyFile(src, dest);
  }

  // Step 3: Generate SRI hashes
  console.log('\n[3/3] Generating SRI hashes...');
  run('npm run generate-sri', join(ROOT_DIR, 'backend'));

  console.log('\n' + '='.repeat(50));
  console.log('Build complete! Ready to commit and push.');
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
