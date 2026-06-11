const api = require('./services/api');

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
    this.login();
  },

  // wx.login -> backend code2Session -> JWT stored for subsequent requests.
  login() {
    api
      .ensureLogin()
      .then((data) => {
        this.globalData.token = data.token || wx.getStorageSync('token') || '';
        this.globalData.user = data.user || this.globalData.user;
      })
      .catch(() => {
        // Protected requests surface a useful error if login remains unavailable.
      });
  }
});
