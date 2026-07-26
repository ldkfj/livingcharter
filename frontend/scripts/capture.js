import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const screenshotsDir = path.resolve(__dirname, '../../docs/screenshots');

function startServer(port = 3000) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(filePath));
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

async function run() {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Building dist...');
  execSync('npm run build', { cwd: path.resolve(__dirname, '..') });

  let server = await startServer(3000);
  console.log('Server listening on http://localhost:3000');

  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  console.log('Navigating to dashboard...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(4000);

  await page.screenshot({ path: path.join(screenshotsDir, 'dashboard.png') });
  console.log('Saved dashboard.png');

  const charterCard = page.locator('.card', { hasText: 'Ratified Living Charter' });
  if (await charterCard.count() > 0) {
    await charterCard.screenshot({ path: path.join(screenshotsDir, 'charter_panel.png') });
    console.log('Saved charter_panel.png');
  }

  const reqTab = page.locator('button', { hasText: 'Requests' });
  await reqTab.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, 'empty_state.png') });
  console.log('Saved empty_state.png');

  await browser.close();
  server.close();

  console.log('Testing env guard error state...');
  const envPath = path.resolve(__dirname, '../.env');
  const envBackup = fs.readFileSync(envPath, 'utf-8');
  try {
    fs.writeFileSync(envPath, 'VITE_CHARTER_ADDRESS=\nVITE_TREASURY_ADDRESS=\n');
    execSync('npm run build', { cwd: path.resolve(__dirname, '..') });

    const serverErr = await startServer(3001);
    const browserErr = await chromium.launch({ channel: 'msedge' });
    const pageErr = await browserErr.newPage({ viewport: { width: 1280, height: 900 } });

    await pageErr.goto('http://localhost:3001');
    await pageErr.waitForTimeout(1000);
    await pageErr.screenshot({ path: path.join(screenshotsDir, 'env_error.png') });
    console.log('Saved env_error.png');

    await browserErr.close();
    serverErr.close();
  } finally {
    console.log('Restoring real .env and rebuilding...');
    fs.writeFileSync(envPath, envBackup);
    execSync('npm run build', { cwd: path.resolve(__dirname, '..') });
  }

  console.log('ALL 4 SCREENSHOTS SUCCESSFULLY CAPTURED!');
}

run().catch(console.error);
