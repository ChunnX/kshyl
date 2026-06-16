/**
 * Mini program environment config.
 *
 * local  - WeChat DevTools simulator on this computer.
 * lan    - Real phone on the same Wi-Fi as this computer.
 * tunnel - Public HTTPS/WSS tunnel, such as cpolar/ngrok/localtunnel.
 * cloud  - Tencent CloudBase run service.
 */
const MODE = 'cloud';

const LAN_IP = '192.168.200.38';
const TUNNEL_HOST = 'xxxx.cpolar.io';

const CLOUD_ENV_ID = 'kshyl-d9gikdvfc6102c4a9';
const CLOUD_SERVICE_NAME = 'express-bth9';
const CLOUD_REGION = 'ap-shanghai';
const CLOUD_HOST = 'api.zzzp.me';

let BASE_URL = '';
let WS_URL = '';

if (MODE === 'local') {
  BASE_URL = 'http://127.0.0.1:3000/api';
  WS_URL = 'ws://127.0.0.1:3000/realtime/conversations';
} else if (MODE === 'lan') {
  BASE_URL = `http://${LAN_IP}:3000/api`;
  WS_URL = `ws://${LAN_IP}:3000/realtime/conversations`;
} else if (MODE === 'tunnel') {
  BASE_URL = `https://${TUNNEL_HOST}/api`;
  WS_URL = `wss://${TUNNEL_HOST}/realtime/conversations`;
} else if (MODE === 'cloud') {
  const host = CLOUD_HOST || `${CLOUD_SERVICE_NAME}-${CLOUD_ENV_ID}.${CLOUD_REGION}.run.tcloudbase.com`;
  BASE_URL = `https://${host}/api`;
  WS_URL = `wss://${host}/realtime/conversations`;
}

module.exports = {
  MODE,
  BASE_URL,
  WS_URL
};
