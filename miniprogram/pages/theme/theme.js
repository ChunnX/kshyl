const api = require('../../services/api');

Page({
  data: {
    personId: '',
    personName: '家人',
    themes: [],
    title: '',
    description: '',
    mode: 'solo',
    currentTheme: null,
    inviteName: '',
    invitePrompt: '',
    sharePath: ''
  },

  onLoad(options) {
    this.setData({
      personId: options.personId || 'person_demo_001',
      personName: options.personName || '家人'
    });
    this.loadThemes();
  },

  async loadThemes() {
    const data = await api.listThemes(this.data.personId);
    this.setData({
      themes: data.themes || []
    });
  },

  onTitleInput(event) {
    this.setData({ title: event.detail.value });
  },

  onDescriptionInput(event) {
    this.setData({ description: event.detail.value });
  },

  setSolo() {
    this.setData({ mode: 'solo' });
  },

  setCoCreate() {
    this.setData({ mode: 'co_create' });
  },

  async createTheme() {
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请填写主题', icon: 'none' });
      return;
    }

    const data = await api.createTheme(this.data.personId, {
      title: this.data.title.trim(),
      description: this.data.description.trim(),
      mode: this.data.mode
    });

    this.setData({
      currentTheme: data.theme,
      title: '',
      description: '',
      sharePath: ''
    });
    await this.loadThemes();
  },

  async openTheme(event) {
    const data = await api.getTheme(event.currentTarget.dataset.id);
    this.setData({
      currentTheme: data.theme,
      sharePath: ''
    });
  },

  onInviteNameInput(event) {
    this.setData({ inviteName: event.detail.value });
  },

  onInvitePromptInput(event) {
    this.setData({ invitePrompt: event.detail.value });
  },

  async inviteToTheme() {
    if (!this.data.currentTheme || !this.data.inviteName.trim()) {
      wx.showToast({ title: '请选择主题并填写邀请人', icon: 'none' });
      return;
    }

    const data = await api.inviteToTheme(this.data.currentTheme.id, {
      targetName: this.data.inviteName.trim(),
      prompt: this.data.invitePrompt.trim()
    });

    this.setData({
      sharePath: data.sharePath,
      inviteName: '',
      invitePrompt: ''
    });
  }
});

