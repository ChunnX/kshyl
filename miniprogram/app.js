App({
  globalData: {
    user: null,
    currentPerson: {
      id: 'person_demo_001',
      name: '爸爸'
    }
  },

  onLaunch() {
    wx.setInnerAudioOption({
      obeyMuteSwitch: false
    });
  }
});

