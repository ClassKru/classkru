'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./media-dev.cjs');

const host = '127.0.0.1';
const preferredPort = Number(process.env.CLASSKRU_LOCAL_PORT) || 3511;
let appPort = preferredPort;
let appUrl = `http://${host}:${appPort}/`;
const noOpen = process.argv.includes('--no-open');

const envFile = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
process.env.CLASSKRU_AI_NAV_ENABLED ??= 'true';
const hasOpenRouterKey = Boolean(String(process.env.CLASSKRU_AI_NAV_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '').trim());
process.env.CLASSKRU_AI_NAV_PROVIDER ??= hasOpenRouterKey ? 'openrouter' : 'mock';
const miniLabModelSettings = path.resolve(__dirname, '..', '..', '..', 'all_mini lab', 'mini lab V5', '.interactive-v5-local', 'model-settings.json');
if (!process.env.CLASSKRU_AI_NAV_MODEL_SETTINGS_PATH && fs.existsSync(miniLabModelSettings)) {
  process.env.CLASSKRU_AI_NAV_MODEL_SETTINGS_PATH = miniLabModelSettings;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

function openBrowser() {
  if (process.platform === 'win32') {
    const options = {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    };
    const opener = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', appUrl], options);
    opener.once('error', () => {
      const fallback = spawn('cmd.exe', ['/d', '/c', 'start', '', appUrl], options);
      fallback.once('error', error => {
        console.error(`Could not open browser automatically: ${error.message}`);
        console.log(`Open ${appUrl} in your browser.`);
      });
      fallback.unref();
    });
    opener.unref();
    return;
  }
  console.log(`Open ${appUrl} in your browser.`);
}

async function main() {
  const app = createServer();
  try {
    await listen(app, appPort);
  } catch (error) {
    if (error.code !== 'EADDRINUSE') {
      app.close();
      console.error(`Could not start local ClassKru: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    appPort = preferredPort === 3513 ? 3514 : 3513;
    try {
      await listen(app, appPort);
    } catch (fallbackError) {
      app.close();
      console.error(`Could not start local ClassKru: ${fallbackError.message}`);
      process.exitCode = 1;
      return;
    }
  }

  appUrl = `http://${host}:${appPort}/`;
  process.env.CLASSKRU_APP_ORIGIN = `http://${host}:${appPort}`;
  console.log(`ClassKru local: ${appUrl}`);
  console.log('Leave this window open while using ClassKru. Close it to stop the server.');
  if (!noOpen) {
    console.log('Opening ClassKru in your default browser...');
    openBrowser();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
