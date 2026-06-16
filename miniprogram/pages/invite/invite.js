const api = require('../../services/api');
const auth = require('../../services/auth');

Page({
  data: {
    code: '',
    invitation: {},
    theme: null,
    stories: [],
    selectedStoryId: '', // 空字符串代表对整个主题进行一般性补充，选中代表对某段故事进行具体共创
    contributorName: '',
    text: '',
    submitted: false // 💻 是否已成功提交共创
  },

  async onLoad(options) {
    const code = options.code || '';
    this.setData({ code });
    try {
      const user = await auth.requireRegistration(`/pages/invite/invite?code=${encodeURIComponent(code)}`);
      if (user && user.username && !this.data.contributorName) {
        this.setData({ contributorName: user.username });
      }
    } catch (error) {
      return;
    }
    if (code) {
      wx.showLoading({ title: '正在加载邀请...' });
      try {
        const data = await api.getInvitation(code);
        const user = auth.getStoredUser();
        this.setData({
          invitation: data.invitation,
          theme: data.theme,
          stories: data.stories || [],
          contributorName: this.data.contributorName || (user && user.username) || data.invitation.targetName || ''
        });
      } catch (err) {
        wx.showToast({
          title: '邀请码失效或有误',
          icon: 'none'
        });
      } finally {
        wx.hideLoading();
      }
    }
  },

  onNameInput(event) {
    this.setData({ contributorName: event.detail.value });
  },

  onTextInput(event) {
    this.setData({ text: event.detail.value });
  },

  // 💻 选中要共创的具体故事卡片
  selectStory(event) {
    const id = event.currentTarget.dataset.id;
    // 如果点击已选中的，则取消选择（变为对主题的一般性补充）
    this.setData({
      selectedStoryId: this.data.selectedStoryId === id ? '' : id
    });
  },

  async submit() {
    if (!this.data.text.trim()) {
      wx.showToast({ title: '请填写补充内容', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在提交...' });
    try {
      await api.submitContribution(this.data.code, {
        contributorName: this.data.contributorName.trim(),
        text: this.data.text.trim(),
        storyId: this.data.selectedStoryId || null
      });

      wx.showToast({
        title: '共创提交成功！',
        icon: 'success',
        duration: 1500
      });

      setTimeout(() => {
        this.setData({ 
          submitted: true,
          text: '', 
          selectedStoryId: '' 
        });
      }, 1500);
    } catch (err) {
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 🚀 用户接受共创后，一键重新加载进入家庭记忆项目大厅！
  enterProject() {
    wx.reLaunch({
      url: '/pages/home/home'
    });
  }
});
