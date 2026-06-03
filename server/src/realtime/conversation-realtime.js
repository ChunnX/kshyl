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
  let asrHadError = false;

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

  let turnFinalizing = false;

  async function finalizeTurn() {
    if (turnFinalizing || !asrSession) {
      return;
    }
    turnFinalizing = true;
    const session = asrSession;
    asrSession = null; // Clear immediately to prevent double processing

    try {
      const text = await session.finish();
      if (!text || !text.trim()) {
        if (asrHadError) {
          return;
        }
        sendJson(ws, {
          type: 'error',
          message: '没有识别到有效语音，请确认麦克风权限、说话音量和 ASR 配置后再试。'
        });
        return;
      }

      const turn = await conversationService.addTurn(conversationId, {
        text,
        photoIds: currentPhotoIds
      });

      // Split AI response into sentences for segmented streaming (Direction 3)
      const sentences = turn.assistantMessage.text
        .split(/(?<=[。！？；!?\n])/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (sentences.length <= 1) {
        const tts = await streamingTts.synthesizeRealtimeReply(turn.assistantMessage.text);
        sendJson(ws, {
          type: 'assistant_reply',
          ...turn,
          tts
        });
      } else {
        // Multi-sentence: stream the first sentence immediately to achieve ultra-low latency!
        const firstTts = await streamingTts.synthesizeRealtimeReply(sentences[0]);
        
        const firstTurn = {
          ...turn,
          assistantMessage: {
            ...turn.assistantMessage,
            text: sentences[0]
          }
        };

        sendJson(ws, {
          type: 'assistant_reply',
          ...firstTurn,
          tts: firstTts
        });

        // In the background, synthesize and stream subsequent segments!
        for (let i = 1; i < sentences.length; i++) {
          const ttsSeg = await streamingTts.synthesizeRealtimeReply(sentences[i]);
          sendJson(ws, {
            type: 'assistant_reply_segment',
            conversationId,
            messageId: turn.assistantMessage.id,
            text: sentences[i],
            tts: ttsSeg
          });
        }
      }
    } catch (err) {
      sendJson(ws, {
        type: 'error',
        message: err.message
      });
    } finally {
      turnFinalizing = false;
    }
  }

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
        asrHadError = false;
        asrSession = createAsrSession(ws, dialect, () => {
          // Automated VAD silence detection triggers turn finalization!
          finalizeTurn().catch((err) => {
            console.error('Error in VAD finalizeTurn:', err);
          });
        }, (message) => {
          asrHadError = true;
          sendJson(ws, {
            type: 'error',
            message: `实时语音识别失败：${message}`
          });
        });
        sendJson(ws, {
          type: 'turn_started'
        });
        return;
      }

      if (event.type === 'end_turn') {
        currentPhotoIds = event.photoIds || currentPhotoIds;
        if (!asrSession) {
          // If already finalized via VAD, ignore manual end_turn
          return;
        }
        await finalizeTurn();
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

function createAsrSession(ws, dialect, onSilenceDetected, onError) {
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
    },
    onError(message) {
      onError(message);
    },
    onSilenceDetected
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
