const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const miniprogramConfigPath = path.resolve(__dirname, '../../miniprogram/config.js');

console.log('🚀 Starting Memory Server and LocalTunnel...');

// 1. Start Node.js Express server
const serverProcess = spawn('node', ['src/server.js'], {
  stdio: 'inherit',
  shell: true
});

serverProcess.on('error', (err) => {
  console.error('❌ Failed to start Memory Server:', err);
});

// 2. Start Localtunnel
console.log('📡 Launching LocalTunnel tunnel on port 3000...');
const tunnelProcess = spawn('npx', ['localtunnel', '--port', '3000'], {
  shell: true
});

tunnelProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('[Tunnel Log]', output.trim());

  const match = output.match(/your url is: https:\/\/([a-zA-Z0-9.-]+)/);
  if (match) {
    const domain = match[1];
    console.log('\n==================================================');
    console.log(`🎉 Localtunnel established successfully!`);
    console.log(`🌐 Public URL: https://${domain}`);
    console.log(`🔗 WebSocket URL: wss://${domain}`);
    console.log('==================================================\n');

    // Automatically update miniprogram/config.js
    updateMiniProgramConfig(domain);
  }
});

tunnelProcess.stderr.on('data', (data) => {
  console.error('[Tunnel Error]', data.toString().trim());
});

tunnelProcess.on('close', (code) => {
  console.log(`📡 Localtunnel tunnel exited with code ${code}`);
});

function updateMiniProgramConfig(domain) {
  if (!fs.existsSync(miniprogramConfigPath)) {
    console.error(`❌ Miniprogram config file not found at: ${miniprogramConfigPath}`);
    return;
  }

  try {
    let content = fs.readFileSync(miniprogramConfigPath, 'utf8');

    // Replace MODE to 'tunnel'
    content = content.replace(/const MODE = '[a-zA-Z0-9]+';/, "const MODE = 'tunnel';");

    // Replace TUNNEL_HOST to domain
    content = content.replace(/const TUNNEL_HOST = '[a-zA-Z0-9.-]+';/, `const TUNNEL_HOST = '${domain}';`);

    fs.writeFileSync(miniprogramConfigPath, content, 'utf8');
    console.log('📝 Successfully auto-updated miniprogram/config.js with your public tunnel domain!');
    console.log('📲 You can now re-compile in WeChat Developer Tools and scan QR on your phone!');
  } catch (err) {
    console.error('❌ Error updating miniprogram/config.js:', err);
  }
}

// Handle exit cleanly
process.on('SIGINT', () => {
  console.log('\n👋 Closing tunnel and backend server...');
  serverProcess.kill();
  tunnelProcess.kill();
  process.exit();
});
