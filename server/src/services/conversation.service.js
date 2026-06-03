const store = require('../db/memory-store');
const asr = require('./asr.service');
const llm = require('./llm.service');
const speech = require('./speech.service');

const allowedModes = ['dialogue', 'vent'];

async function startConversation(personId, mode = 'dialogue') {
  if (!allowedModes.includes(mode)) {
    const error = new Error('mode must be dialogue or vent');
    error.statusCode = 400;
    throw error;
  }

  const person = await store.getPerson(personId);
  if (!person) {
    const error = new Error('Person not found');
    error.statusCode = 404;
    throw error;
  }

  const stories = await store.listStories(personId);
  const opening = await llm.createConversationOpening({ mode, person, stories });
  const conversation = await store.createConversation({
    personId,
    mode,
    summary: '',
    lastQuestion: opening.nextQuestion
  });
  const openingSpeech = await speech.synthesizeSpeech(opening.replyText);

  const assistantMessage = await store.addConversationMessage({
    conversationId: conversation.id,
    personId,
    role: 'assistant',
    text: opening.replyText,
    nextQuestion: opening.nextQuestion,
    audioUrl: openingSpeech.audioUrl
  });

  return {
    conversation,
    assistantMessage
  };
}

async function addTurn(conversationId, payload) {
  const conversation = await store.getConversation(conversationId);
  if (!conversation) {
    const error = new Error('Conversation not found');
    error.statusCode = 404;
    throw error;
  }

  const personId = conversation.personId;
  const text = await resolveUserText(payload);
  const photos = await store.listPhotos({ conversationId });

  const userMessage = await store.addConversationMessage({
    conversationId,
    personId,
    role: 'user',
    text,
    recordingId: payload.recordingId || null,
    photoIds: payload.photoIds || []
  });

  const stories = await store.listStories(personId);
  const messages = await store.listConversationMessages(conversationId);
  const reply = await llm.createConversationReply({
    mode: conversation.mode,
    userText: text,
    stories,
    messages,
    photos
  });
  const replySpeech = await speech.synthesizeSpeech(reply.replyText);

  const storyDraft = await llm.polishStory(text);
  const story = await store.createStory({
    personId,
    conversationId,
    title: storyDraft.title,
    draftText: storyDraft.draftText,
    polishedText: storyDraft.polishedText,
    status: 'draft',
    topic: storyDraft.topic,
    happenedAt: storyDraft.happenedAt,
    photoIds: payload.photoIds || []
  });

  const assistantMessage = await store.addConversationMessage({
    conversationId,
    personId,
    role: 'assistant',
    text: reply.replyText,
    nextQuestion: reply.nextQuestion,
    audioUrl: replySpeech.audioUrl,
    storyId: story.id
  });

  await store.updateConversation(conversationId, {
    lastQuestion: reply.nextQuestion,
    summary: buildLightSummary(messages, text)
  });

  return {
    userMessage,
    assistantMessage,
    story
  };
}

async function resolveUserText(payload) {
  if (payload.text && payload.text.trim()) {
    return payload.text.trim();
  }

  if (!payload.recordingId) {
    const error = new Error('text or recordingId is required');
    error.statusCode = 400;
    throw error;
  }

  const recording = await store.getRecording(payload.recordingId);
  if (!recording) {
    const error = new Error('Recording not found');
    error.statusCode = 404;
    throw error;
  }

  const transcriptResult = await asr.transcribeRecording(recording);
  await store.createTranscript({
    recordingId: recording.id,
    rawText: transcriptResult.rawText,
    confidence: transcriptResult.confidence,
    asrProvider: transcriptResult.provider
  });

  return transcriptResult.rawText;
}

function buildLightSummary(messages, latestText) {
  const recentUserTexts = messages
    .filter((message) => message.role === 'user')
    .slice(-3)
    .map((message) => message.text);

  return [...recentUserTexts, latestText].join(' / ').slice(0, 240);
}

module.exports = {
  startConversation,
  addTurn
};
