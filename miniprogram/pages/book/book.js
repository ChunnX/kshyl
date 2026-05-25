const api = require('../../services/api');

Page({
  data: {
    personId: 'person_demo_001',
    result: '准备好后，点击下面按钮。'
  },

  onLoad() {
    const app = getApp();
    this.setData({
      personId: app.globalData.currentPerson.id
    });
  },

  async exportBook() {
    this.setData({
      result: '正在生成书稿...'
    });
    const data = await api.exportBook(this.data.personId);
    this.setData({
      result: data.book.summary
    });
  }
});

