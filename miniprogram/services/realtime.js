const WS_URL = 'ws://localhost:3000/realtime/conversations';

function connectRealtimeConversation(options) {
  const socket = wx.connectSocket({
    url: `${WS_URL}?personId=${encodeURIComponent(options.personId)}&mode=${encodeURIComponent(options.mode)}&dialect=${encodeURIComponent(options.dialect || 'auto')}`
  });

  let opened = false;
  const pending = [];

  function send(data) {
    if (opened) {
      socket.send({ data });
      return;
    }
    pending.push(data);
  }

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

  socket.onError(() => {
    options.onEvent({
      type: 'error',
      message: '实时连接失败'
    });
  });

  socket.onClose(() => {
    opened = false;
    options.onEvent({
      type: 'closed'
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
      socket.close();
    }
  };
}

module.exports = {
  connectRealtimeConversation
};
