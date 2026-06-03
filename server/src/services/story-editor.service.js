const store = require('../db/memory-store');
const asr = require('./asr.service');
const llm = require('./llm.service');

async function createStoryFromRecording(recordingId) {
  const recording = await store.getRecording(recordingId);
  if (!recording) {
    const error = new Error('Recording not found');
    error.statusCode = 404;
    throw error;
  }

  const transcriptResult = await asr.transcribeRecording(recording);
  const transcript = await store.createTranscript({
    recordingId: recording.id,
    rawText: transcriptResult.rawText,
    confidence: transcriptResult.confidence,
    asrProvider: transcriptResult.provider
  });

  const storyDraft = await llm.polishStory(transcript.rawText);
  const followUpQuestion = await llm.createFollowUpQuestion(transcript.rawText);

  const story = await store.createStory({
    personId: recording.personId,
    rawTranscriptId: transcript.id,
    title: storyDraft.title,
    draftText: storyDraft.draftText,
    polishedText: storyDraft.polishedText,
    topic: storyDraft.topic,
    happenedAt: storyDraft.happenedAt,
    followUpQuestion
  });

  return {
    transcript,
    story
  };
}

module.exports = {
  createStoryFromRecording
};
