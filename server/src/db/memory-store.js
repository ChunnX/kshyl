const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const env = require('../config/env');

const initialState = {
  people: [
    {
      id: 'person_demo_001',
      name: '爸爸',
      relation: 'father',
      consentStatus: 'pending',
      voiceCloneStatus: 'disabled',
      createdAt: new Date().toISOString()
    }
  ],
  recordings: [],
  transcripts: [],
  stories: [],
  storyVersions: [],
  books: [],
  voiceProfiles: [],
  conversations: [],
  conversationMessages: [],
  photos: []
};

const dataFilePath = path.resolve(process.cwd(), env.dataFile);
let state = loadState();

function loadState() {
  if (!fs.existsSync(dataFilePath)) {
    return structuredClone(initialState);
  }

  try {
    const stored = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    return {
      ...structuredClone(initialState),
      ...stored
    };
  } catch (error) {
    console.warn(`Failed to read data file, using fresh state: ${error.message}`);
    return structuredClone(initialState);
  }
}

function saveState() {
  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
  const tempPath = `${dataFilePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tempPath, dataFilePath);
}

function createRecording(data) {
  const recording = {
    id: randomUUID(),
    status: 'uploaded',
    createdAt: new Date().toISOString(),
    ...data
  };
  state.recordings.push(recording);
  saveState();
  return recording;
}

function getRecording(id) {
  return state.recordings.find((recording) => recording.id === id);
}

function createTranscript(data) {
  const transcript = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...data
  };
  state.transcripts.push(transcript);
  saveState();
  return transcript;
}

function createStory(data) {
  const story = {
    id: randomUUID(),
    status: 'draft',
    createdAt: new Date().toISOString(),
    ...data
  };
  state.stories.push(story);
  saveState();
  return story;
}

function listStories(personId) {
  return state.stories
    .filter((story) => story.personId === personId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getStory(id) {
  return state.stories.find((story) => story.id === id);
}

function updateStory(id, patch) {
  const story = getStory(id);
  if (!story) {
    return null;
  }

  Object.assign(story, patch, {
    updatedAt: new Date().toISOString()
  });

  if (patch.polishedText !== undefined) {
    state.storyVersions.push({
      id: randomUUID(),
      storyId: id,
      editorUserId: patch.editorUserId || null,
      content: patch.polishedText,
      version: state.storyVersions.filter((version) => version.storyId === id).length + 1,
      createdAt: new Date().toISOString()
    });
  }

  saveState();
  return story;
}

function getPerson(id) {
  return state.people.find((person) => person.id === id);
}

function updatePerson(id, patch) {
  const person = getPerson(id);
  if (!person) {
    return null;
  }
  Object.assign(person, patch, {
    updatedAt: new Date().toISOString()
  });
  saveState();
  return person;
}

function createBook(data) {
  const book = {
    id: randomUUID(),
    status: 'generated',
    createdAt: new Date().toISOString(),
    ...data
  };
  state.books.push(book);
  saveState();
  return book;
}

function listBooks(personId) {
  return state.books
    .filter((book) => book.personId === personId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function createConversation(data) {
  const conversation = {
    id: randomUUID(),
    mode: 'dialogue',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data
  };
  state.conversations.push(conversation);
  saveState();
  return conversation;
}

function getConversation(id) {
  return state.conversations.find((conversation) => conversation.id === id);
}

function updateConversation(id, patch) {
  const conversation = getConversation(id);
  if (!conversation) {
    return null;
  }
  Object.assign(conversation, patch, {
    updatedAt: new Date().toISOString()
  });
  saveState();
  return conversation;
}

function listConversations(personId) {
  return state.conversations
    .filter((conversation) => conversation.personId === personId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function addConversationMessage(data) {
  const message = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...data
  };
  state.conversationMessages.push(message);
  updateConversation(data.conversationId, {});
  saveState();
  return message;
}

function listConversationMessages(conversationId) {
  return state.conversationMessages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function createPhoto(data) {
  const photo = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...data
  };
  state.photos.push(photo);
  saveState();
  return photo;
}

function listPhotos(filter = {}) {
  return state.photos.filter((photo) => {
    if (filter.personId && photo.personId !== filter.personId) {
      return false;
    }
    if (filter.conversationId && photo.conversationId !== filter.conversationId) {
      return false;
    }
    if (filter.storyId && photo.storyId !== filter.storyId) {
      return false;
    }
    return true;
  });
}

module.exports = {
  createRecording,
  getRecording,
  createTranscript,
  createStory,
  listStories,
  getStory,
  updateStory,
  getPerson,
  updatePerson,
  createBook,
  listBooks,
  createConversation,
  getConversation,
  updateConversation,
  listConversations,
  addConversationMessage,
  listConversationMessages,
  createPhoto,
  listPhotos
};
