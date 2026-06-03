const CONFIG = require('../config');
const BASE_URL = CONFIG.BASE_URL;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...(options.header || {})
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(new Error(res.data && res.data.message ? res.data.message : '请求失败'));
      },
      fail: reject
    });
  });
}

module.exports = {
  request,
  getPerson(personId) {
    return request(`/persons/${personId}`);
  },
  updateConsent(personId, consentStatus) {
    return request(`/persons/${personId}/consent`, {
      method: 'PUT',
      data: { consentStatus }
    });
  },
  listPeople() {
    return request('/persons');
  },
  createPerson(payload) {
    return request('/persons', {
      method: 'POST',
      data: payload
    });
  },
  listThemes(personId) {
    return request(`/persons/${personId}/themes`);
  },
  createTheme(personId, payload) {
    return request(`/persons/${personId}/themes`, {
      method: 'POST',
      data: payload
    });
  },
  getTheme(themeId) {
    return request(`/themes/${themeId}`);
  },
  addThemeCollaborator(themeId, payload) {
    return request(`/themes/${themeId}/collaborators`, {
      method: 'POST',
      data: payload
    });
  },
  inviteToTheme(themeId, payload) {
    return request(`/themes/${themeId}/invitations`, {
      method: 'POST',
      data: payload
    });
  },
  inviteToStory(storyId, payload) {
    return request(`/stories/${storyId}/invitations`, {
      method: 'POST',
      data: payload
    });
  },
  getInvitation(inviteCode) {
    return request(`/invitations/${inviteCode}`);
  },
  submitContribution(inviteCode, payload) {
    return request(`/invitations/${inviteCode}/contributions`, {
      method: 'POST',
      data: payload
    });
  },
  getPersonStories(personId) {
    return request(`/persons/${personId}/stories`);
  },
  startConversation(personId, mode) {
    return request(`/persons/${personId}/conversations`, {
      method: 'POST',
      data: { mode }
    });
  },
  getConversationMessages(conversationId) {
    return request(`/conversations/${conversationId}/messages`);
  },
  addConversationTurn(conversationId, payload) {
    return request(`/conversations/${conversationId}/turns`, {
      method: 'POST',
      data: payload
    });
  },
  getStory(storyId) {
    return request(`/stories/${storyId}`);
  },
  createRecording(payload) {
    return request('/recordings', {
      method: 'POST',
      data: payload
    });
  },
  createStoryFromRecording(recordingId) {
    return request(`/recordings/${recordingId}/stories`, {
      method: 'POST'
    });
  },
  updateStory(storyId, payload) {
    return request(`/stories/${storyId}`, {
      method: 'PUT',
      data: payload
    });
  },
  exportBook(personId) {
    return request(`/persons/${personId}/book/export`, {
      method: 'POST'
    });
  },
  getBooks(personId) {
    return request(`/persons/${personId}/books`);
  },
  chat(personId, message) {
    return request(`/persons/${personId}/chat`, {
      method: 'POST',
      data: { message }
    });
  },
  listAllThemes() {
    return request('/themes');
  },
  createGlobalTheme(payload) {
    return request('/themes', {
      method: 'POST',
      data: payload
    });
  }
};
