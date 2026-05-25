const recorder = require('../../services/recorder');
const upload = require('../../services/upload');
const realtime = require('../../services/realtime');

Page({
  data: {
    personId: 'person_demo_001',
    conversationId: '',
    mode: 'dialogue',
    dialect: 'auto',
    messages: [],
    isRecording: false,
    isRealtimeReady: false,
    liveTranscript: '',
    photoIds: [],
    statusText: '正在准备实时语音'
  },

  async onLoad() {
    const app = getApp();
    this.setData({
      personId: app.globalData.currentPerson.id
    });
    this.bindRecorder();
    this.openRealtime('dialogue');
  },

  onUnload() {
    if (this.realtimeClient) {
      this.realtimeClient.close();
    }
  },

  bindRecorder() {
    recorder.onFrameRecorded((res) => {
      if (this.realtimeClient && this.data.isRecording) {
        this.realtimeClient.sendAudioFrame(res.frameBuffer);
      }
    });

    recorder.onStop(() => {
      this.setData({
        isRecording: false,
        statusText: '正在等 AI 回应'
      });

      if (this.realtimeClient) {
        this.realtimeClient.sendEndTurn(this.data.photoIds);
      }
    });

    recorder.onError(() => {
      this.setData({
        isRecording: false,
        statusText: '录音失败'
      });
      wx.showToast({
        title: '录音失败',
        icon: 'none'
      });
    });
  },

  openRealtime(mode) {
    if (this.realtimeClient) {
      this.realtimeClient.close();
    }

    this.setData({
      mode,
      messages: [],
      liveTranscript: '',
      isRealtimeReady: false,
      statusText: '正在连接实时语音'
    });

    this.realtimeClient = realtime.connectRealtimeConversation({
      personId: this.data.personId,
      mode,
      dialect: this.data.dialect,
      onEvent: (event) => this.handleRealtimeEvent(event)
    });
  },

  handleRealtimeEvent(event) {
    if (event.type === 'conversation_started') {
      this.setData({
        conversationId: event.conversation.id,
        messages: [event.assistantMessage],
        isRealtimeReady: true,
        statusText: '可以开始说了'
      });
      this.playAssistantAudio(event.assistantMessage);
      return;
    }

    if (event.type === 'turn_started') {
      this.setData({
        liveTranscript: '',
        statusText: 'AI 正在听'
      });
      return;
    }

    if (event.type === 'asr_partial') {
      this.setData({
        liveTranscript: event.text || '',
        statusText: '正在识别'
      });
      return;
    }

    if (event.type === 'asr_final') {
      this.setData({
        liveTranscript: event.text || '',
        statusText: '识别完成'
      });
      return;
    }

    if (event.type === 'assistant_reply') {
      this.appendMessages([event.userMessage, event.assistantMessage]);
      this.setData({
        photoIds: [],
        liveTranscript: '',
        statusText: '可以继续说'
      });
      return;
    }

    if (event.type === 'closed') {
      this.setData({
        isRealtimeReady: false,
        statusText: '实时连接已断开'
      });
      return;
    }

    if (event.type === 'error') {
      wx.showToast({
        title: event.message || '实时语音出错',
        icon: 'none'
      });
      this.setData({
        statusText: '实时语音出错'
      });
    }
  },

  setDialogueMode() {
    if (this.data.mode !== 'dialogue') {
      this.openRealtime('dialogue');
    }
  },

  setVentMode() {
    if (this.data.mode !== 'vent') {
      this.openRealtime('vent');
    }
  },

  setDialectAuto() {
    this.setData({ dialect: 'auto' });
    this.openRealtime(this.data.mode);
  },

  setDialectYue() {
    this.setData({ dialect: 'yue' });
    this.openRealtime(this.data.mode);
  },

  setDialectSichuan() {
    this.setData({ dialect: 'sichuan' });
    this.openRealtime(this.data.mode);
  },

  startRecord() {
    if (!this.data.isRealtimeReady || !this.realtimeClient) {
      wx.showToast({
        title: '还在连接',
        icon: 'none'
      });
      return;
    }

    this.realtimeClient.sendStartTurn(this.data.photoIds);
    this.setData({
      isRecording: true,
      liveTranscript: '',
      statusText: 'AI 正在听'
    });

    recorder.start({
      format: 'PCM',
      frameSize: 5,
      sampleRate: 16000,
      numberOfChannels: 1
    });
  },

  stopRecord() {
    recorder.stop();
  },

  async addPhoto() {
    try {
      const media = await chooseOneImage();
      const uploaded = await upload.uploadPhoto(media.tempFilePath, {
        personId: this.data.personId,
        conversationId: this.data.conversationId
      });

      this.setData({
        photoIds: this.data.photoIds.concat(uploaded.photo.id)
      });

      wx.showToast({
        title: '照片已加入',
        icon: 'success'
      });
    } catch (error) {
      wx.showToast({
        title: '没有加入照片',
        icon: 'none'
      });
    }
  },

  appendMessages(newMessages) {
    this.setData({
      messages: this.data.messages.concat(newMessages)
    });
    const assistantMessage = newMessages.find((message) => message.role === 'assistant');
    this.playAssistantAudio(assistantMessage);
  },

  playAssistantAudio(message) {
    if (!message || !message.audioUrl) {
      return;
    }

    const audio = wx.createInnerAudioContext();
    audio.src = message.audioUrl;
    audio.play();
  }
});

function chooseOneImage() {
  return new Promise((resolve, reject) => {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success(res) {
          resolve(res.tempFiles[0]);
        },
        fail: reject
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success(res) {
        resolve({
          tempFilePath: res.tempFilePaths[0]
        });
      },
      fail: reject
    });
  });
}
