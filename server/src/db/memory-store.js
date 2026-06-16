if (process.env.DATABASE_URL) {
  module.exports = require('./prisma-store');
  return;
}

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const env = require('../config/env');

const initialState = {
  users: [],
  people: [
    {
      id: 'person_demo_001',
      ownerUserId: 'user_demo_001',
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
  photos: [],
  themes: [],
  themeCollaborators: [],
  invitations: [],
  contributions: []
};

const dataFilePath = path.resolve(process.cwd(), env.dataFile);
let state = loadState();

function loadState() {
  if (!fs.existsSync(dataFilePath)) {
    return structuredClone(initialState);
  }

  try {
    const stored = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    const people = (stored.people || initialState.people).map((person) => ({
      ...person,
      ownerUserId: person.ownerUserId || 'user_demo_001'
    }));
    return {
      ...structuredClone(initialState),
      ...stored,
      people
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

function normalizeUser(user) {
  return {
    ...user,
    profileCompleted: Boolean(user.username && user.termsAcceptedAt && user.privacyAcceptedAt)
  };
}

function getUserByOpenid(openid) {
  const user = state.users.find((item) => item.openid === openid);
  return user ? normalizeUser(user) : null;
}

function getUserById(id) {
  const user = state.users.find((item) => item.id === id);
  return user ? normalizeUser(user) : null;
}

function upsertUserByOpenid(data) {
  let user = state.users.find((item) => item.openid === data.openid);
  const now = new Date().toISOString();
  if (!user) {
    user = {
      // Keep the demo identity stable so it owns the seeded demo person.
      id: data.openid === 'openid_demo' ? 'user_demo_001' : randomUUID(),
      openid: data.openid,
      username: data.username || '',
      role: data.role || 'family',
      termsVersion: data.termsVersion || '',
      privacyVersion: data.privacyVersion || '',
      termsAcceptedAt: data.termsAcceptedAt || null,
      privacyAcceptedAt: data.privacyAcceptedAt || null,
      registeredAt: data.registeredAt || null,
      createdAt: now,
      updatedAt: now
    };
    state.users.push(user);
    saveState();
    return normalizeUser(user);
  }

  Object.assign(user, {
    username: data.username !== undefined ? data.username : user.username,
    role: data.role || user.role || 'family',
    termsVersion: data.termsVersion !== undefined ? data.termsVersion : user.termsVersion,
    privacyVersion: data.privacyVersion !== undefined ? data.privacyVersion : user.privacyVersion,
    termsAcceptedAt: data.termsAcceptedAt !== undefined ? data.termsAcceptedAt : user.termsAcceptedAt,
    privacyAcceptedAt:
      data.privacyAcceptedAt !== undefined ? data.privacyAcceptedAt : user.privacyAcceptedAt,
    registeredAt: data.registeredAt !== undefined ? data.registeredAt : user.registeredAt,
    updatedAt: now
  });
  saveState();
  return normalizeUser(user);
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

function listRecordings(personId) {
  return state.recordings.filter((recording) => recording.personId === personId);
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

function createPerson(data) {
  const person = {
    id: randomUUID(),
    ownerUserId: data.ownerUserId || 'user_demo_001',
    name: data.name,
    relation: data.relation || '',
    kind: data.kind || 'family',
    consentStatus: 'pending',
    voiceCloneStatus: 'disabled',
    createdAt: new Date().toISOString()
  };
  state.people.push(person);
  saveState();
  return person;
}

function listPeople(ownerUserId = 'user_demo_001') {
  return state.people
    .filter((person) => !person.ownerUserId || person.ownerUserId === ownerUserId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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

function deleteRecording(id) {
  state.recordings = state.recordings.filter((recording) => recording.id !== id);
  state.transcripts = state.transcripts.filter((transcript) => transcript.recordingId !== id);
  saveState();
  return { id };
}

function deleteStory(id) {
  const invitationIds = state.invitations
    .filter((invitation) => invitation.storyId === id)
    .map((invitation) => invitation.id);
  state.stories = state.stories.filter((story) => story.id !== id);
  state.storyVersions = state.storyVersions.filter((version) => version.storyId !== id);
  state.invitations = state.invitations.filter((invitation) => invitation.storyId !== id);
  state.contributions = state.contributions.filter(
    (contribution) =>
      contribution.storyId !== id && !invitationIds.includes(contribution.invitationId)
  );
  saveState();
  return { id };
}

function getBook(id) {
  return state.books.find((book) => book.id === id);
}

function deleteBook(id) {
  state.books = state.books.filter((book) => book.id !== id);
  saveState();
  return { id };
}

function deletePerson(id) {
  const stories = state.stories.filter((story) => story.personId === id).map((story) => story.id);
  const themes = state.themes.filter((theme) => theme.personId === id).map((theme) => theme.id);
  const invitations = state.invitations
    .filter(
      (invitation) =>
        themes.includes(invitation.themeId) || stories.includes(invitation.storyId)
    )
    .map((invitation) => invitation.id);
  state.stories = state.stories.filter((story) => story.personId !== id);
  state.storyVersions = state.storyVersions.filter((version) => !stories.includes(version.storyId));
  state.recordings = state.recordings.filter((recording) => recording.personId !== id);
  state.books = state.books.filter((book) => book.personId !== id);
  const conversationIds = state.conversations.filter((c) => c.personId === id).map((c) => c.id);
  state.conversations = state.conversations.filter((c) => c.personId !== id);
  state.conversationMessages = state.conversationMessages.filter((m) => !conversationIds.includes(m.conversationId));
  state.photos = state.photos.filter((photo) => photo.personId !== id);
  state.themeCollaborators = state.themeCollaborators.filter(
    (collaborator) => !themes.includes(collaborator.themeId)
  );
  state.invitations = state.invitations.filter(
    (invitation) =>
      !themes.includes(invitation.themeId) && !stories.includes(invitation.storyId)
  );
  state.contributions = state.contributions.filter(
    (contribution) =>
      !themes.includes(contribution.themeId) &&
      !stories.includes(contribution.storyId) &&
      !invitations.includes(contribution.invitationId)
  );
  state.themes = state.themes.filter((theme) => theme.personId !== id);
  state.voiceProfiles = state.voiceProfiles.filter((profile) => profile.personId !== id);
  state.people = state.people.filter((person) => person.id !== id);
  saveState();
  return { id };
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

function getPhoto(id) {
  return state.photos.find((photo) => photo.id === id);
}

function deletePhoto(id) {
  state.photos = state.photos.filter((photo) => photo.id !== id);
  saveState();
  return { id };
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

function createTheme(data) {
  const theme = {
    id: randomUUID(),
    ownerUserId: data.ownerUserId || 'user_demo_001',
    personId: data.personId || null,
    title: data.title,
    description: data.description || '',
    mode: data.mode || 'solo',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.themes.push(theme);
  saveState();
  return theme;
}

function getTheme(id) {
  return state.themes.find((theme) => theme.id === id);
}

function listThemes(filter = {}) {
  return state.themes
    .filter((theme) => {
      if (filter.personId && theme.personId !== filter.personId) {
        return false;
      }
      if (filter.ownerUserId && theme.ownerUserId !== filter.ownerUserId) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function updateTheme(id, patch) {
  const theme = getTheme(id);
  if (!theme) {
    return null;
  }
  Object.assign(theme, patch, {
    updatedAt: new Date().toISOString()
  });
  saveState();
  return theme;
}

function addThemeCollaborator(data) {
  const collaborator = {
    id: randomUUID(),
    themeId: data.themeId,
    name: data.name,
    relation: data.relation || '',
    role: data.role || 'contributor',
    status: data.status || 'invited',
    createdAt: new Date().toISOString()
  };
  state.themeCollaborators.push(collaborator);
  saveState();
  return collaborator;
}

function listThemeCollaborators(themeId) {
  return state.themeCollaborators.filter((collaborator) => collaborator.themeId === themeId);
}

function createInvitation(data) {
  const invitation = {
    id: randomUUID(),
    inviteCode: randomUUID().slice(0, 8),
    type: data.type || 'theme',
    themeId: data.themeId || null,
    storyId: data.storyId || null,
    targetName: data.targetName,
    relation: data.relation || '',
    prompt: data.prompt || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  state.invitations.push(invitation);
  saveState();
  return invitation;
}

function getInvitationByCode(inviteCode) {
  return state.invitations.find((invitation) => invitation.inviteCode === inviteCode);
}

function revokeInvitation(inviteCode) {
  const invitation = getInvitationByCode(inviteCode);
  if (!invitation) {
    return null;
  }
  invitation.status = 'revoked';
  invitation.updatedAt = new Date().toISOString();
  saveState();
  return invitation;
}

function listInvitations(filter = {}) {
  return state.invitations
    .filter((invitation) => {
      if (filter.themeId && invitation.themeId !== filter.themeId) {
        return false;
      }
      if (filter.storyId && invitation.storyId !== filter.storyId) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function createContribution(data) {
  const contribution = {
    id: randomUUID(),
    invitationId: data.invitationId,
    themeId: data.themeId || null,
    storyId: data.storyId || null,
    contributorUserId: data.contributorUserId || null,
    contributorName: data.contributorName,
    text: data.text,
    status: 'submitted',
    createdAt: new Date().toISOString()
  };
  state.contributions.push(contribution);

  const invitation = state.invitations.find((item) => item.id === data.invitationId);
  if (invitation) {
    invitation.status = 'submitted';
    invitation.updatedAt = new Date().toISOString();
  }

  saveState();
  return contribution;
}

function listContributions(filter = {}) {
  return state.contributions.filter((contribution) => {
    if (filter.themeId && contribution.themeId !== filter.themeId) {
      return false;
    }
    if (filter.storyId && contribution.storyId !== filter.storyId) {
      return false;
    }
    return true;
  });
}

module.exports = {
  getUserByOpenid,
  getUserById,
  upsertUserByOpenid,
  createRecording,
  getRecording,
  listRecordings,
  deleteRecording,
  createTranscript,
  createStory,
  listStories,
  getStory,
  updateStory,
  deleteStory,
  getPerson,
  createPerson,
  listPeople,
  updatePerson,
  deletePerson,
  createBook,
  listBooks,
  getBook,
  deleteBook,
  createConversation,
  getConversation,
  updateConversation,
  listConversations,
  addConversationMessage,
  listConversationMessages,
  createPhoto,
  getPhoto,
  deletePhoto,
  listPhotos,
  createTheme,
  getTheme,
  listThemes,
  updateTheme,
  addThemeCollaborator,
  listThemeCollaborators,
  createInvitation,
  getInvitationByCode,
  revokeInvitation,
  listInvitations,
  createContribution,
  listContributions
};
