Page({
  goConversation() {
    wx.navigateTo({
      url: '/pages/conversation/conversation'
    });
  },

  goRecord() {
    wx.navigateTo({
      url: '/pages/record/record'
    });
  },

  goStories() {
    wx.navigateTo({
      url: '/pages/story/story'
    });
  },

  goFamily() {
    wx.navigateTo({
      url: '/pages/family/family'
    });
  }
});
