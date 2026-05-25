const api = require('../../services/api');

Page({
  data: {
    personId: 'person_demo_001',
    message: '',
    reply: '这个功能会在完成授权后开放。',
    consentStatus: 'pending'
  },

  async onLoad() {
    const app = getApp();
    this.setData({
      personId: app.globalData.currentPerson.id
    });
    await this.loadPerson();
  },

  async loadPerson() {
    try {
      const data = await api.getPerson(this.data.personId);
      this.setData({
        consentStatus: data.person.consentStatus
      });
    } catch (error) {
      wx.showToast({
        title: '读取授权失败',
        icon: 'none'
      });
    }
  },

  onInput(event) {
    this.setData({
      message: event.detail.value
    });
  },

  async send() {
    if (!this.data.message.trim()) {
      return;
    }
    try {
      const data = await api.chat(this.data.personId, this.data.message);
      this.setData({
        reply: data.reply,
        message: ''
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      });
    }
  },

  async grantConsent() {
    try {
      await api.updateConsent(this.data.personId, 'granted');
      this.setData({
        consentStatus: 'granted',
        reply: '已开启。后续正式版本会要求录制本人授权音频。'
      });
    } catch (error) {
      wx.showToast({
        title: '授权失败',
        icon: 'none'
      });
    }
  }
});
