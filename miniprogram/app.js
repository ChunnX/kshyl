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
    wx.login({
      success: (res) => {
        if (!res.code) {
          return;
        }
        api
          .wechatLogin(res.code)
          .then((data) => {
            if (data && data.token) {
              wx.setStorageSync('token', data.token);
              this.globalData.token = data.token;
              this.globalData.user = data.user;
            }
          })
          .catch(() => {
            // Offline/dev backend may run with auth bypass; ignore login failure.
          });
      }
    });
  }
});
