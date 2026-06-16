const api = require('../../services/api');
const auth = require('../../services/auth');
const LEGAL = require('../../utils/legal-content');

Page({
  data: {
    username: '',
    acceptedTerms: false,
    acceptedPrivacy: false,
    loading: false,
    redirect: '/pages/home/home',
    termsVersion: LEGAL.TERMS_VERSION,
    privacyVersion: LEGAL.PRIVACY_VERSION
  },

  onLoad(options) {
    this.setData({
      redirect: options.redirect ? decodeURIComponent(options.redirect) : '/pages/home/home'
    });
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value });
  },

  toggleTerms(event) {
    this.setData({ acceptedTerms: event.detail.value.length > 0 });
  },

  togglePrivacy(event) {
    this.setData({ acceptedPrivacy: event.detail.value.length > 0 });
  },

  openTerms() {
    wx.navigateTo({ url: '/pages/legal/user-agreement' });
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/legal/privacy-policy' });
  },

  async submit() {
    const username = this.data.username.trim();
    if (username.length < 2 || username.length > 20) {
      wx.showToast({ title: '用户名需为 2-20 个字符', icon: 'none' });
      return;
    }
    if (!this.data.acceptedTerms || !this.data.acceptedPrivacy) {
      wx.showToast({ title: '请先阅读并勾选协议', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const data = await api.register(username);
      auth.saveSession(data);
      wx.redirectTo({ url: this.data.redirect });
    } catch (error) {
      wx.showToast({
        title: error.message || '注册失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});
