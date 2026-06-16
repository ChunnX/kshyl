const api = require('../../services/api');
const auth = require('../../services/auth');

Page({
  data: {
    loading: true,
    stories: [],
    personId: 'person_demo_001',
    latestFollowUp: ''
  },

  async onLoad(options) {
    try {
      await auth.requireRegistration();
    } catch (error) {
      return;
    }
    const app = getApp();
    this.setData({
      personId: app.globalData.currentPerson.id
    });
    if (options && options.storyId) {
      this.loadLatestStory(options.storyId);
    }
    this.loadStories();
  },

  async loadLatestStory(storyId) {
    try {
      const data = await api.getStory(storyId);
      this.setData({
        latestFollowUp: data.story.followUpQuestion || ''
      });
    } catch (error) {
      this.setData({
        latestFollowUp: ''
      });
    }
  },

  async loadStories() {
    try {
      const data = await api.getPersonStories(this.data.personId);
      this.setData({
        stories: data.stories || [],
        loading: false
      });
    } catch (error) {
      wx.showToast({
        title: '读取失败',
        icon: 'none'
      });
      this.setData({
        loading: false
      });
    }
  },

  openReview(event) {
    const storyId = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/family-review/family-review?storyId=${storyId}`
    });
  },

  goBook() {
    wx.navigateTo({
      url: '/pages/book/book'
    });
  },

  goChat() {
    wx.navigateTo({
      url: '/pages/chat/chat'
    });
  }
});
