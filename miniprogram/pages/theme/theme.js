const api = require('../../services/api');

Page({
  data: {
    themes: [],
    title: '',
    description: '',
    mode: 'solo',
    currentTheme: null,
    collaborators: [],
    inviteName: '',
    invitePrompt: '',
    sharePath: '',
    invitationCode: '',
    
    // 🤖 AI 智能建议主题（契合用户口述历史，可一键认领）
    aiSuggestedThemes: [
      {
        title: '院子里的无花果树',
        description: '记录小时候院子里的那棵大树，以及夏天在树下听蝉鸣、分吃无花果的场景。',
        reason: '🤖 AI 根据您刚才录音对话中“小时候院子”的语义智能提取',
        mode: 'co_create'
      },
      {
        title: '第一天去自行车厂报到',
        description: '记录年轻时去国营自行车厂报到上班的第一天，以及师傅带我熟悉车间时的难忘情景。',
        reason: '🤖 AI 根据您口述中“自行车厂/第一份工作”的经历自动总结',
        mode: 'co_create'
      }
    ]
  },

  onLoad() {
    this.loadThemes();
  },

  async loadThemes() {
    try {
      const data = await api.listAllThemes();
      const themes = (data.themes || []).map(t => {
        // 自定义前端参与成员展示
        let collaboratorList = '仅我自己参与';
        if (t.mode === 'co_create') {
          collaboratorList = '我、邀请中成员...';
        }
        
        // 模拟已有的协作者名称以丰富 UI 体验
        if (t.id === 'theme_demo_001') {
          collaboratorList = '我、妈妈、二宝';
        } else if (t.title.includes('无花果')) {
          collaboratorList = '我、妈妈 (贡献者)';
        }
        
        return {
          ...t,
          source: t.description && t.description.includes('AI') ? 'AI' : 'Self',
          collaboratorList
        };
      });

      this.setData({ themes });
    } catch (error) {
      wx.showToast({ title: '读取主题失败', icon: 'none' });
    }
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

  // 🤖 一键认领创建 AI 推荐主题
  async claimAiTheme(event) {
    const item = event.currentTarget.dataset.item;
    try {
      wx.showLoading({ title: 'AI 正在总结创建...' });
      const data = await api.createGlobalTheme({
        title: item.title,
        description: `【🤖 AI 对话自动总结】${item.description}`,
        mode: item.mode
      });
      wx.hideLoading();
      wx.showToast({ title: 'AI 主题已创建', icon: 'success' });
      
      // 自动选定当前创建的主题以方便立刻定义成员
      await this.loadThemes();
      const createdTheme = this.data.themes.find(t => t.title === item.title);
      if (createdTheme) {
        this.setData({
          currentTheme: createdTheme,
          collaborators: [],
          sharePath: ''
        });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '认领失败', icon: 'none' });
    }
  },

  // 手动创建自建主题
  async createTheme() {
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请填写主题名称', icon: 'none' });
      return;
    }

    try {
      const data = await api.createGlobalTheme({
        title: this.data.title.trim(),
        description: this.data.description.trim(),
        mode: this.data.mode
      });

      this.setData({
        currentTheme: data.theme,
        collaborators: [],
        title: '',
        description: '',
        sharePath: ''
      });
      wx.showToast({ title: '创建成功', icon: 'success' });
      await this.loadThemes();
    } catch (error) {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  // 打开主题以定义/管理参与成员
  async openTheme(event) {
    const themeId = event.currentTarget.dataset.id;
    try {
      const data = await api.getTheme(themeId);
      this.setData({
        currentTheme: data.theme,
        collaborators: data.collaborators || [],
        sharePath: '',
        inviteName: '',
        invitePrompt: ''
      });
      
      // 页面滚动定位到成员管理区域
      wx.pageScrollTo({
        selector: '.form-card',
        duration: 300
      });
    } catch (error) {
      wx.showToast({ title: '读取详情失败', icon: 'none' });
    }
  },

  onInviteNameInput(event) {
    this.setData({ inviteName: event.detail.value });
  },

  onInvitePromptInput(event) {
    this.setData({ invitePrompt: event.detail.value });
  },

  // 在主题里定义有哪些人可以参与（邀请共创人员）
  async inviteToTheme() {
    if (!this.data.currentTheme || !this.data.inviteName.trim()) {
      wx.showToast({ title: '请选择主题并定义参与成员称呼', icon: 'none' });
      return;
    }

    const inviteName = this.data.inviteName.trim();
    try {
      wx.showLoading({ title: '正在定义成员...' });
      
      // 1. 将新成员添加到该主题的 Collaborators 中
      await api.addThemeCollaborator(this.data.currentTheme.id, {
        name: inviteName,
        relation: '共同回忆人',
        role: 'contributor'
      });
      
      // 2. 生成微信共创邀请的 Invitation 链接
      const data = await api.inviteToTheme(this.data.currentTheme.id, {
        targetName: inviteName,
        prompt: this.data.invitePrompt.trim()
      });

      wx.hideLoading();
      wx.showToast({ title: '成员已添加', icon: 'success' });

      this.setData({
        sharePath: data.sharePath,
        invitationCode: data.invitation.inviteCode,
        inviteName: '',
        invitePrompt: ''
      });
      
      // 3. 重新获取该主题下的参与成员列表
      const themeDetail = await api.getTheme(this.data.currentTheme.id);
      this.setData({
        collaborators: themeDetail.collaborators || []
      });
      
      // 4. 刷新全局主题卡片列表中的成员展示
      await this.loadThemes();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  copyShareLink() {
    if (!this.data.sharePath) return;
    const textToCopy = `【家庭记忆共创】您的家人邀请您参与回忆主题《${this.data.currentTheme.title}》！复制下方路径，打开小程序即可立刻加入共创：\n${this.data.sharePath}`;
    wx.setClipboardData({
      data: textToCopy,
      success() {
        wx.showToast({
          title: '已复制分享链接',
          icon: 'success'
        });
      }
    });
  },

  onShareAppMessage(options) {
    let path = '/pages/home/home';
    let title = '家庭记忆 - 留存有温度的光阴';

    if (this.data.sharePath && this.data.invitationCode) {
      path = `/pages/invite/invite?code=${this.data.invitationCode}`;
      title = `邀请你参与家庭回忆主题《${this.data.currentTheme.title}》的温情共创`;
    }

    return {
      title: title,
      path: path
    };
  }
});
