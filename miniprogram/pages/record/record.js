const recorder = require('../../services/recorder');
const upload = require('../../services/upload');
const api = require('../../services/api');
const auth = require('../../services/auth');

Page({
  data: {
    isRecording: false,
    statusTitle: '准备好了',
    prompt: '您可以讲小时候、工作、家人，或者一个忘不了的人。',
    personId: 'person_demo_001'
  },

  async onLoad() {
    try {
      await auth.requireRegistration();
    } catch (error) {
      return;
    }
    const app = getApp();
    this.setData({
      personId: app.globalData.currentPerson.id
    });

    recorder.onStop(async (res) => {
      this.setData({
        isRecording: false,
        statusTitle: '正在整理',
        prompt: '我先帮您保存下来。'
      });

      try {
        const uploaded = await upload.uploadRecording(res.tempFilePath, this.data.personId);
        const story = await api.createStoryFromRecording(uploaded.recording.id);
        wx.redirectTo({
          url: `/pages/story/story?storyId=${story.story.id}`
        });
      } catch (error) {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
        this.setData({
          statusTitle: '没保存成功',
          prompt: '请再试一次，或者让家人帮忙看看网络。'
        });
      }
    });

    recorder.onError(() => {
      wx.showToast({
        title: '录音失败',
        icon: 'none'
      });
      this.setData({
        isRecording: false,
        statusTitle: '录音失败',
        prompt: '请检查是否允许小程序使用麦克风。'
      });
    });
  },

  startRecord() {
    this.setData({
      isRecording: true,
      statusTitle: '正在听您说',
      prompt: '慢慢讲，我会一直帮您记着。'
    });
    recorder.start();
  },

  stopRecord() {
    recorder.stop();
  },

  goHome() {
    wx.navigateBack();
  }
});

