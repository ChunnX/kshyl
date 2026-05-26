const api = require('../../services/api');

Page({
  data: {
    code: '',
    invitation: {},
    contributorName: '',
    text: ''
  },

  async onLoad(options) {
    const code = options.code || '';
    this.setData({ code });
    if (code) {
      const data = await api.getInvitation(code);
      this.setData({
        invitation: data.invitation,
        contributorName: data.invitation.targetName || ''
      });
    }
  },

  onNameInput(event) {
    this.setData({ contributorName: event.detail.value });
  },

  onTextInput(event) {
    this.setData({ text: event.detail.value });
  },

  async submit() {
    if (!this.data.text.trim()) {
      wx.showToast({ title: '请填写内容', icon: 'none' });
      return;
    }

    await api.submitContribution(this.data.code, {
      contributorName: this.data.contributorName.trim(),
      text: this.data.text.trim()
    });

    wx.showToast({ title: '已提交', icon: 'success' });
    this.setData({ text: '' });
  }
});

