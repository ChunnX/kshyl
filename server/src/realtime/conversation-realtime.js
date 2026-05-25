const { WebSocketServer } = require('ws');
const env = require('../config/env');
const conversationService = require('../services/conversation.service');
const streamingAsr = require('../services/streaming-asr.service');
const streamingTts = require('../services/streaming-tts.service');

function attachConversationRealtime(server) {
  const wss = new WebSocketServer({
    noServer: true
  });

  server.on('upgrade', (request, socket, head) => {
    const parsed = new URL(request.url, 'http://localhost');
    if (parsed.pathname !== env.realtimeWsPath) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, Object.fromEntries(parsed.searchParams.entries()));
    });
  });

  wss.on('connection', (ws, request, query) => {
    createRealtimeConnection(ws, query).catch((error) => {
      sendJson(ws, {
        type: 'error',
        message: error.message
      });
      ws.close();
    });
  });
}

async function createRealtimeConnection(ws, query) {
  const personId = query.personId;
  const mode = query.mode || 'dialogue';
  const dialect = query.dialect || 'auto';
  let currentPhotoIds = [];
  let asrSession = null;

  if (!personId) {
    throw new Error('personId is required');
  }

  const started = await conversationService.startConversation(personId, mode);
  const conversationId = started.conversation.id;

  sendJson(ws, {
    type: 'conversation_started',
    conversation: started.conversation,
    assistantMessage: started.assistantMessage,
    dialect
  });

  ws.on('message', async (data, isBinary) => {
    try {
      if (isBinary) {
        if (asrSession) {
          asrSession.sendAudioFrame(data);
        }
        return;
      }

      const event = JSON.parse(data.toString());
      if (event.type === 'start_turn') {
        currentPhotoIds = event.photoIds || [];
        asrSession = createAsrSession(ws, dialect);
        sendJson(ws, {
          type: 'turn_started'
        });
        return;
      }

      if (event.type === 'end_turn') {
        currentPhotoIds = event.photoIds || currentPhotoIds;
        if (!asrSession) {
          sendJson(ws, {
            type: 'error',
            message: 'No active ASR session'
          });
          return;
        }

        const text = await asrSession.finish();
        asrSession = null;
        const turn = await conversationService.addTurn(conversationId, {
          text,
          photoIds: currentPhotoIds
        });
        const tts = await streamingTts.synthesizeRealtimeReply(turn.assistantMessage.text);

        sendJson(ws, {
          type: 'assistant_reply',
          ...turn,
          tts
        });
        return;
      }
    } catch (error) {
      sendJson(ws, {
        type: 'error',
        message: error.message
      });
    }
  });

  ws.on('close', () => {
    if (asrSession) {
      asrSession.close();
    }
  });
}

function createAsrSession(ws, dialect) {
  return streamingAsr.createStreamingAsrSession({
    dialect,
    onPartial(partial) {
      sendJson(ws, {
        type: 'asr_partial',
        ...partial
      });
    },
    onFinal(finalResult) {
      sendJson(ws, {
        type: 'asr_final',
        ...finalResult
      });
    }
  });
}

function sendJson(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

module.exports = {
  attachConversationRealtime
};
