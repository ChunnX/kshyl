function currentPagePath() {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  if (!page) {
    return '/pages/home/home';
  }
  const route = `/${page.route}`;
  const options = page.options || {};
  const query = Object.keys(options)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
    .join('&');
  return query ? `${route}?${query}` : route;
}

function getStoredUser() {
  try {
    return wx.getStorageSync('user') || null;
  } catch (error) {
    return null;
  }
}

function isRegistered(user) {
  return Boolean(user && user.profileCompleted && user.username);
}

function requireRegistration(redirectPath) {
  const user = getStoredUser();
  if (isRegistered(user)) {
    return Promise.resolve(user);
  }

  const redirect = redirectPath || currentPagePath();
  wx.redirectTo({
    url: `/pages/register/register?redirect=${encodeURIComponent(redirect)}`
  });
  return Promise.reject(new Error('needs registration'));
}

function saveSession(data) {
  wx.setStorageSync('token', data.token);
  wx.setStorageSync('user', data.user);
  const app = getApp();
  app.globalData.token = data.token;
  app.globalData.user = data.user;
}

module.exports = {
  requireRegistration,
  saveSession,
  getStoredUser,
  isRegistered
};
