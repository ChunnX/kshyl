const BASE_URL = 'http://localhost:3000/api';

function uploadRecording(filePath, personId) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}/recordings/upload`,
      filePath,
      name: 'audio',
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
