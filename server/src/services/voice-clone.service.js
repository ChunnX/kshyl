async function createVoiceProfile() {
  return {
    status: 'disabled',
    message: '声音克隆需要本人明确授权，MVP 默认关闭。'
  };
}

module.exports = {
  createVoiceProfile
};

