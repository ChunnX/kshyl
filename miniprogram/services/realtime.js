const CONFIG = require('../config');
const api = require('./api');
const WS_URL = CONFIG.WS_URL;

function connectRealtimeConversation(options) {
  const url = `${WS_URL}?personId=${encodeURIComponent(options.personId)}&mode=${encodeURIComponent(options.mode)}&dialect=${encodeURIComponent(options.dialect || 'auto')}`;
  let socket = null;
  let opened = false;
  let manuallyClosed = false;
  const pending = [];

  function send(data) {
    if (opened) {
      socket.send({ data });
      return;
    }
    pending.push(data);
  }

  api.ensureLogin().then(() => {
    if (manuallyClosed) {
      return;
    }
    const token = wx.getStorageSync('token') || '';
    socket = wx.connectSocket({
      url,
      header: token ? { Authorization: `Bearer ${token}` } : {}
    });

    socket.onOpen(() => {
      opened = true;
      while (pending.length) {
        socket.send({ data: pending.shift() });
      }
    });

    socket.onMessage((message) => {
      if (typeof message.data !== 'string') {
        return;
      }

      try {
        options.onEvent(JSON.parse(message.data));
      } catch (error) {
        options.onEvent({
          type: 'error',
          message: '实时消息解析失败'
        });
      }
    });

    socket.onError((error) => {
      const errMsg = error && error.errMsg ? error.errMsg : '';
      console.error('[realtime] connect failed', {
        mode: CONFIG.MODE,
        url,
        errMsg
      });
      options.onEvent({
        type: 'error',
        message: errMsg ? `实时连接失败：${errMsg}` : `实时连接失败：${url}`
      });
    });

    socket.onClose(() => {
      opened = false;
      if (!manuallyClosed) {
        options.onEvent({ type: 'closed' });
      }
    });
  }).catch((error) => {
    options.onEvent({
      type: 'error',
      message: error.message || '登录失败，无法连接实时语音'
    });
  });

  return {
    sendStartTurn(photoIds = []) {
      send(JSON.stringify({
        type: 'start_turn',
        photoIds
      }));
    },
    sendAudioFrame(buffer) {
      send(buffer);
    },
    sendEndTurn(photoIds = []) {
      send(JSON.stringify({
        type: 'end_turn',
        photoIds
      }));
    },
    close() {
      manuallyClosed = true;
      if (socket) {
        socket.close();
      }
    }
  };
}

module.exports = {
  connectRealtimeConversation
};
