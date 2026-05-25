const recorder = wx.getRecorderManager();
let stopHandler = null;
let errorHandler = null;

const options = {
  duration: 10 * 60 * 1000,
  sampleRate: 16000,
  numberOfChannels: 1,
  encodeBitRate: 48000,
  format: 'mp3'
};
let frameHandler = null;

function start(customOptions = {}) {
  recorder.start({
    ...options,
    ...customOptions
  });
}

function stop() {
  recorder.stop();
}

function onStop(callback) {
  if (stopHandler && recorder.offStop) {
    recorder.offStop(stopHandler);
  }
  stopHandler = callback;
  recorder.onStop(callback);
}

function onError(callback) {
  if (errorHandler && recorder.offError) {
    recorder.offError(errorHandler);
  }
  errorHandler = callback;
  recorder.onError(callback);
}

function onFrameRecorded(callback) {
  if (frameHandler && recorder.offFrameRecorded) {
    recorder.offFrameRecorded(frameHandler);
  }
  frameHandler = callback;
  if (recorder.onFrameRecorded) {
    recorder.onFrameRecorded(callback);
  }
}

module.exports = {
  start,
  stop,
  onStop,
  onError,
  onFrameRecorded
};
