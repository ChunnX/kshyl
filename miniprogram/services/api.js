const CONFIG = require('../config');
const LEGAL = require('../utils/legal-content');
const BASE_URL = CONFIG.BASE_URL;
let loginPromise = null;

function getToken() {
  try {
    return wx.getStorageSync('token') || '';
  } catch (error) {
    return '';
  }
}

function rawRequest(path, options = {}) {
  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {})
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        const error = new Error(res.data && res.data.message ? res.data.message : '请求失败');
        error.statusCode = res.statusCode;
        reject(error);
      },
      fail: reject
    });
  });
}

function ensureLogin(force = false) {
  const token = getToken();
  if (token && !force) {
    return Promise.resolve({ token });
  }
  if (loginPromise) {
    return loginPromise;
  }

  if (force) {
    wx.removeStorageSync('token');
  }

  loginPromise = new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('微信登录失败'));
          return;
        }
        rawRequest('/auth/wechat-login', {
          method: 'POST',
          data: { code: res.code }
        }).then((data) => {
          if (!data || !data.token) {
            throw new Error('登录响应缺少 token');
          }
          wx.setStorageSync('token', data.token);
          if (data.user) {
            wx.setStorageSync('user', data.user);
          }
          resolve(data);
        }).catch(reject);
      },
      fail: reject
    });
  });

  loginPromise.then(
    () => {
      loginPromise = null;
    },
    () => {
      loginPromise = null;
    }
  );
  return loginPromise;
}

function request(path, options = {}) {
  if (options.auth === false) {
    return rawRequest(path, options);
  }

  return ensureLogin()
    .catch(() => null)
    .then(() => rawRequest(path, options))
    .catch((error) => {
      if (error.statusCode !== 401 || options._retried) {
        throw error;
      }
      return ensureLogin(true).then(() =>
        rawRequest(path, {
          ...options,
          _retried: true
        })
      );
    });
}

module.exports = {
  request,
  ensureLogin,
  register(username) {
    return new Promise((resolve, reject) => {
      wx.login({
        success(res) {
          if (!res.code) {
            reject(new Error('微信登录失败'));
            return;
          }
          rawRequest('/auth/register', {
            method: 'POST',
            data: {
              code: res.code,
              username,
              acceptedTermsVersion: LEGAL.TERMS_VERSION,
              acceptedPrivacyVersion: LEGAL.PRIVACY_VERSION
            }
          }).then((data) => {
            wx.setStorageSync('token', data.token);
            wx.setStorageSync('user', data.user);
            resolve(data);
          }).catch(reject);
        },
        fail: reject
      });
    });
  },
  getMe() {
    return request('/auth/me');
  },
  isRegisteredUser(user) {
    return Boolean(user && user.profileCompleted && user.username);
  },
  wechatLogin(code) {
    return rawRequest('/auth/wechat-login', {
      method: 'POST',
      data: { code }
    });
  },
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
    return request(`/invitations/${inviteCode}`, { auth: false });
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
