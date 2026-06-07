const CONFIG = require('../config');
const BASE_URL = CONFIG.BASE_URL;

function authHeader() {
  try {
    const token = wx.getStorageSync('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (error) {
    return {};
  }
}

function uploadRecording(filePath, personId) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}/recordings/upload`,
      filePath,
      name: 'audio',
      header: authHeader(),
      formData: {
        personId
      },
      success(res) {
        try {
          const data = JSON.parse(res.data);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      },
      fail: reject
    });
  });
}

function uploadPhoto(filePath, data = {}) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}/photos/upload`,
      filePath,
      name: 'photo',
      header: authHeader(),
      formData: data,
      success(res) {
        try {
          const parsed = JSON.parse(res.data);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      },
      fail: reject
    });
  });
}

module.exports = {
  uploadRecording,
  uploadPhoto
};
