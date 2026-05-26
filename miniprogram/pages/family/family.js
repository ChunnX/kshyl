const api = require('../../services/api');

Page({
  data: {
    people: [],
    newName: '',
    newRelation: ''
  },

  onLoad() {
    this.loadPeople();
  },

  async loadPeople() {
    const data = await api.listPeople();
    this.setData({
      people: data.people || []
    });
  },

  onNameInput(event) {
    this.setData({ newName: event.detail.value });
  },

  onRelationInput(event) {
    this.setData({ newRelation: event.detail.value });
  },

  async createPerson() {
    if (!this.data.newName.trim()) {
      wx.showToast({ title: '请填写名字', icon: 'none' });
      return;
    }

    await api.createPerson({
      name: this.data.newName.trim(),
      relation: this.data.newRelation.trim(),
      kind: 'family'
    });

    this.setData({
      newName: '',
      newRelation: ''
    });
    await this.loadPeople();
  },

  openThemes(event) {
    wx.navigateTo({
      url: `/pages/theme/theme?personId=${event.currentTarget.dataset.id}&personName=${event.currentTarget.dataset.name}`
    });
  }
});

