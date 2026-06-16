const api = require('../../services/api');
const auth = require('../../services/auth');

Page({
  data: {
    storyId: '',
    content: ''
  },

  async onLoad(options) {
    try {
      await auth.requireRegistration();
    } catch (error) {
      return;
    }
    this.setData({
      storyId: options.storyId || ''
    });

    if (!options.storyId) {
      this.setData({
        content: '没有找到这段故事。'
      });
      return;
    }

    try {
      const data = await api.getStory(options.storyId);
      this.setData({
        content: data.story.polishedText || data.story.draftText || ''
      });
    } catch (error) {
      this.setData({
        content: '读取失败，请稍后再试。'
      });
    }
  },

  onInput(event) {
    this.setData({
      content: event.detail.value
    });
  },

  async save() {
    if (!this.data.storyId) {
      wx.showToast({
        title: '缺少故事编号',
        icon: 'none'
      });
      return;
    }

    await api.updateStory(this.data.storyId, {
      polishedText: this.data.content,
      status: 'approved'
    });
    wx.showToast({
      title: '已保存',
      icon: 'success'
    });
  }
});
