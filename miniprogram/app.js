App({
  globalData: {
    user: null,
    token: '',
    currentPerson: {
      id: 'person_demo_001',
      name: '爸爸'
    }
  },

  onLaunch() {
    wx.setInnerAudioOption({
      obeyMuteSwitch: false
    });
    this.globalData.token = wx.getStorageSync('token') || '';
    this.globalData.user = wx.getStorageSync('user') || null;
  }
});
