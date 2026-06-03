Page({
  goConversation() {
    wx.navigateTo({
      url: '/pages/conversation/conversation'
    });
  },

  goBook() {
    wx.navigateTo({
      url: '/pages/book/book'
    });
  },

  goStories() {
    wx.navigateTo({
      url: '/pages/story/story'
    });
  },

  goFamily() {
    wx.navigateTo({
      url: '/pages/theme/theme'
    });
  }
});
