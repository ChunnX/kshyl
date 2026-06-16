const api = require('../../services/api');
const auth = require('../../services/auth');
const CONFIG = require('../../config');

// Files are served from the backend origin (BASE_URL without the trailing /api).
const FILE_BASE = CONFIG.BASE_URL.replace(/\/api\/?$/, '');

Page({
  data: {
    personId: 'person_demo_001',
    result: '准备好后，点击下面按钮生成书稿。',
    outline: [],
    downloadUrl: '',
    generating: false
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
  },

  async exportBook() {
    if (this.data.generating) {
      return;
    }
    this.setData({ generating: true, result: '正在生成书稿...', outline: [], downloadUrl: '' });
    try {
      const data = await api.exportBook(this.data.personId);
      const book = data.book || {};
      const url = book.downloadUrl || book.docxUrl || '';
      this.setData({
        result: book.summary || '书稿已生成。',
        outline: book.outline || [],
        downloadUrl: url ? `${FILE_BASE}${url}` : '',
        generating: false
      });
    } catch (error) {
      this.setData({ generating: false, result: '' });
      wx.showToast({ title: error.message || '生成失败', icon: 'none' });
    }
  },

  downloadBook() {
    if (!this.data.downloadUrl) {
      return;
    }
    wx.showLoading({ title: '下载中...' });
    wx.downloadFile({
      url: this.data.downloadUrl,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode !== 200) {
          wx.showToast({ title: '下载失败', icon: 'none' });
          return;
        }
        wx.openDocument({
          filePath: res.tempFilePath,
          fileType: 'docx',
          showMenu: true,
          fail: () => wx.showToast({ title: '无法打开文档', icon: 'none' })
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败', icon: 'none' });
      }
    });
  }
});
