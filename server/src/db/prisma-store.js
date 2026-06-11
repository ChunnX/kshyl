const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { randomUUID } = require('crypto');

async function ensureDemoPerson() {
  const existing = await prisma.person.findUnique({ where: { id: 'person_demo_001' } });
  if (existing) {
    return existing;
  }

  return prisma.person.create({
    data: {
      id: 'person_demo_001',
      ownerUserId: 'user_demo_001',
      name: '爸爸',
      relation: 'father',
      consentStatus: 'pending',
      voiceCloneStatus: 'disabled'
    }
  });
}

// --- User ---
async function getUserByOpenid(openid) {
  return prisma.user.findUnique({ where: { openid } });
}

async function upsertUserByOpenid(data) {
  const existing = await prisma.user.findUnique({ where: { openid: data.openid } });
  if (existing) {
    return existing;
  }
  return prisma.user.create({
    data: {
      // Keep the demo identity stable so it owns the seeded demo person.
      id: data.openid === 'openid_demo' ? 'user_demo_001' : undefined,
      openid: data.openid,
      role: data.role || 'family'
    }
  });
}

// --- Recording ---
async function createRecording(data) {
  return prisma.recording.create({
    data: {
      personId: data.personId,
      userId: data.userId || null,
      audioUrl: data.audioUrl || '',
      duration: data.duration || 0,
      status: 'uploaded'
    }
  });
}

async function getRecording(id) {
  return prisma.recording.findUnique({ where: { id } });
}

async function listRecordings(personId) {
  return prisma.recording.findMany({ where: { personId } });
}

// --- Transcript ---
async function createTranscript(data) {
  return prisma.transcript.create({
    data: {
      recordingId: data.recordingId,
      rawText: data.rawText,
      confidence: data.confidence || null,
      asrProvider: data.asrProvider || 'mock'
    }
  });
}

// --- Story ---
async function createStory(data) {
  return prisma.story.create({
    data: {
      personId: data.personId,
      themeId: data.themeId || null,
      title: data.title,
      rawTranscriptId: data.rawTranscriptId || null,
      draftText: data.draftText || '',
      polishedText: data.polishedText || '',
      status: 'draft',
      topic: data.topic || null,
      happenedAt: data.happenedAt ? new Date(data.happenedAt) : null
    }
  });
}

async function listStories(personId) {
  return prisma.story.findMany({
    where: { personId },
    orderBy: { createdAt: 'desc' }
  });
}

async function getStory(id) {
  return prisma.story.findUnique({ where: { id } });
}

async function updateStory(id, patch) {
  const { editorUserId, ...storyPatch } = patch;
  
  // Format dates if provided
  if (storyPatch.happenedAt) {
    storyPatch.happenedAt = new Date(storyPatch.happenedAt);
  }

  const story = await prisma.story.update({
    where: { id },
    data: storyPatch
  });

  if (patch.polishedText !== undefined) {
    const count = await prisma.storyVersion.count({ where: { storyId: id } });
    await prisma.storyVersion.create({
      data: {
        storyId: id,
        editorUserId: editorUserId || null,
        content: patch.polishedText,
        version: count + 1
      }
    });
  }

  return story;
}

// --- Person ---
async function getPerson(id) {
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person && id === 'person_demo_001') {
    return ensureDemoPerson();
  }
  return person;
}

async function updatePerson(id, patch) {
  if (patch.birthday) {
    patch.birthday = new Date(patch.birthday);
  }
  return prisma.person.update({
    where: { id },
    data: patch
  });
}

async function createPerson(data) {
  return prisma.person.create({
    data: {
      ownerUserId: data.ownerUserId || 'user_demo_001',
      name: data.name,
      relation: data.relation || '',
      consentStatus: 'pending',
      voiceCloneStatus: 'disabled',
      birthday: data.birthday ? new Date(data.birthday) : null
    }
  });
}

async function listPeople(ownerUserId = 'user_demo_001') {
  await ensureDemoPerson();
  return prisma.person.findMany({
    where: {
      OR: [
        { ownerUserId },
        { ownerUserId: '' }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });
}

// --- Book ---
async function createBook(data) {
  return prisma.book.create({
    data: {
      personId: data.personId,
      title: data.title,
      summary: data.summary || '',
      outlineJson: data.outlineJson ? JSON.stringify(data.outlineJson) : '{}',
      pdfUrl: data.pdfUrl || null,
      docxUrl: data.docxUrl || null,
      status: data.status || 'generated'
    }
  });
}

async function listBooks(personId) {
  const books = await prisma.book.findMany({
    where: { personId },
    orderBy: { createdAt: 'desc' }
  });
  return books.map(book => ({
    ...book,
    outlineJson: book.outlineJson ? JSON.parse(book.outlineJson) : {}
  }));
}

// --- Conversation ---
async function createConversation(data) {
  return prisma.conversation.create({
    data: {
      personId: data.personId,
      mode: data.mode || 'dialogue',
      status: 'active',
      summary: data.summary || '',
      lastQuestion: data.lastQuestion || null
    }
  });
}

async function getConversation(id) {
  return prisma.conversation.findUnique({ where: { id } });
}

async function updateConversation(id, patch) {
  const data = {};
  ['mode', 'status', 'summary', 'lastQuestion'].forEach((field) => {
    if (patch[field] !== undefined) {
      data[field] = patch[field];
    }
  });
  return prisma.conversation.update({
    where: { id },
    data
  });
}

async function listConversations(personId) {
  return prisma.conversation.findMany({
    where: { personId },
    orderBy: { updatedAt: 'desc' }
  });
}

// --- ConversationMessage ---
async function addConversationMessage(data) {
  const message = await prisma.conversationMessage.create({
    data: {
      conversationId: data.conversationId,
      personId: data.personId || null,
      role: data.role,
      text: data.text,
      nextQuestion: data.nextQuestion || null,
      audioUrl: data.audioUrl || null,
      recordingId: data.recordingId || null,
      storyId: data.storyId || null,
      photoIds: data.photoIds ? JSON.stringify(data.photoIds) : null
    }
  });
  
  // Touch conversation to update its updatedAt timestamp
  await prisma.conversation.update({
    where: { id: data.conversationId },
    data: {}
  });

  return {
    ...message,
    photoIds: message.photoIds ? JSON.parse(message.photoIds) : null
  };
}

async function listConversationMessages(conversationId) {
  const messages = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' }
  });
  return messages.map(message => ({
    ...message,
    photoIds: message.photoIds ? JSON.parse(message.photoIds) : null
  }));
}

// --- Photo ---
async function createPhoto(data) {
  return prisma.photo.create({
    data: {
      personId: data.personId || null,
      conversationId: data.conversationId || null,
      storyId: data.storyId || null,
      url: data.imageUrl || data.url,
      note: data.note || '',
      originalName: data.originalName || ''
    }
  });
}

async function listPhotos(filter = {}) {
  const where = {};
  if (filter.personId) {
    where.personId = filter.personId;
  }
  if (filter.conversationId) {
    where.conversationId = filter.conversationId;
  }
  if (filter.storyId) {
    where.storyId = filter.storyId;
  }
  return prisma.photo.findMany({ where });
}

// --- Theme ---
async function createTheme(data) {
  return prisma.theme.create({
    data: {
      ownerUserId: data.ownerUserId || 'user_demo_001',
      personId: data.personId || null,
      title: data.title,
      description: data.description || '',
      mode: data.mode || 'solo',
      status: 'active'
    }
  });
}

async function getTheme(id) {
  return prisma.theme.findUnique({ where: { id } });
}

async function listThemes(filter = {}) {
  const where = {};
  if (filter.personId) {
    where.personId = filter.personId;
  }
  if (filter.ownerUserId) {
    where.ownerUserId = filter.ownerUserId;
  }
  return prisma.theme.findMany({
    where,
    orderBy: { updatedAt: 'desc' }
  });
}

async function updateTheme(id, patch) {
  return prisma.theme.update({
    where: { id },
    data: patch
  });
}

// --- ThemeCollaborator ---
async function addThemeCollaborator(data) {
  return prisma.themeCollaborator.create({
    data: {
      themeId: data.themeId,
      name: data.name,
      relation: data.relation || '',
      role: data.role || 'contributor',
      status: data.status || 'invited'
    }
  });
}

async function listThemeCollaborators(themeId) {
  return prisma.themeCollaborator.findMany({ where: { themeId } });
}

// --- Invitation ---
async function createInvitation(data) {
  return prisma.invitation.create({
    data: {
      inviteCode: randomUUID().slice(0, 8),
      type: data.type || 'theme',
      themeId: data.themeId || null,
      storyId: data.storyId || null,
      targetName: data.targetName,
      relation: data.relation || '',
      prompt: data.prompt || '',
      status: 'pending'
    }
  });
}

async function getInvitationByCode(inviteCode) {
  return prisma.invitation.findUnique({ where: { inviteCode } });
}

async function listInvitations(filter = {}) {
  const where = {};
  if (filter.themeId) {
    where.themeId = filter.themeId;
  }
  if (filter.storyId) {
    where.storyId = filter.storyId;
  }
  return prisma.invitation.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
}

// --- Contribution ---
async function createContribution(data) {
  const contribution = await prisma.contribution.create({
    data: {
      invitationId: data.invitationId,
      themeId: data.themeId || null,
      storyId: data.storyId || null,
      contributorName: data.contributorName,
      text: data.text,
      status: 'submitted'
    }
  });

  // Update invitation status
  await prisma.invitation.update({
    where: { id: data.invitationId },
    data: { status: 'submitted' }
  });

  return contribution;
}

async function listContributions(filter = {}) {
  const where = {};
  if (filter.themeId) {
    where.themeId = filter.themeId;
  }
  if (filter.storyId) {
    where.storyId = filter.storyId;
  }
  return prisma.contribution.findMany({ where });
}

// --- Deletes (privacy) ---
async function deleteRecording(id) {
  await prisma.$transaction([
    prisma.transcript.deleteMany({ where: { recordingId: id } }),
    prisma.recording.delete({ where: { id } })
  ]);
  return { id };
}

async function deleteStory(id) {
  const invitations = await prisma.invitation.findMany({
    where: { storyId: id },
    select: { id: true }
  });
  const invitationIds = invitations.map((invitation) => invitation.id);
  await prisma.$transaction([
    prisma.contribution.deleteMany({
      where: {
        OR: [
          { storyId: id },
          { invitationId: { in: invitationIds } }
        ]
      }
    }),
    prisma.invitation.deleteMany({ where: { storyId: id } }),
    prisma.storyVersion.deleteMany({ where: { storyId: id } }),
    prisma.story.delete({ where: { id } })
  ]);
  return { id };
}

async function getBook(id) {
  return prisma.book.findUnique({ where: { id } });
}

async function deleteBook(id) {
  await prisma.book.delete({ where: { id } });
  return { id };
}

async function getPhoto(id) {
  return prisma.photo.findUnique({ where: { id } });
}

async function deletePhoto(id) {
  await prisma.photo.delete({ where: { id } });
  return { id };
}

async function deletePerson(id) {
  const recordings = await prisma.recording.findMany({ where: { personId: id }, select: { id: true } });
  const recordingIds = recordings.map((r) => r.id);
  const stories = await prisma.story.findMany({ where: { personId: id }, select: { id: true } });
  const storyIds = stories.map((s) => s.id);
  const conversations = await prisma.conversation.findMany({ where: { personId: id }, select: { id: true } });
  const conversationIds = conversations.map((c) => c.id);
  const themes = await prisma.theme.findMany({ where: { personId: id }, select: { id: true } });
  const themeIds = themes.map((theme) => theme.id);
  const invitations = await prisma.invitation.findMany({
    where: {
      OR: [
        { themeId: { in: themeIds } },
        { storyId: { in: storyIds } }
      ]
    },
    select: { id: true }
  });
  const invitationIds = invitations.map((invitation) => invitation.id);

  await prisma.$transaction([
    prisma.transcript.deleteMany({ where: { recordingId: { in: recordingIds } } }),
    prisma.storyVersion.deleteMany({ where: { storyId: { in: storyIds } } }),
    prisma.memoryEmbedding.deleteMany({ where: { personId: id } }),
    prisma.contribution.deleteMany({
      where: {
        OR: [
          { themeId: { in: themeIds } },
          { storyId: { in: storyIds } },
          { invitationId: { in: invitationIds } }
        ]
      }
    }),
    prisma.invitation.deleteMany({
      where: {
        OR: [
          { themeId: { in: themeIds } },
          { storyId: { in: storyIds } }
        ]
      }
    }),
    prisma.themeCollaborator.deleteMany({ where: { themeId: { in: themeIds } } }),
    prisma.story.deleteMany({ where: { personId: id } }),
    prisma.recording.deleteMany({ where: { personId: id } }),
    prisma.book.deleteMany({ where: { personId: id } }),
    prisma.conversationMessage.deleteMany({ where: { conversationId: { in: conversationIds } } }),
    prisma.conversation.deleteMany({ where: { personId: id } }),
    prisma.photo.deleteMany({ where: { personId: id } }),
    prisma.theme.deleteMany({ where: { personId: id } }),
    prisma.voiceProfile.deleteMany({ where: { personId: id } }),
    prisma.person.delete({ where: { id } })
  ]);
  return { id };
}

async function revokeInvitation(inviteCode) {
  try {
    return await prisma.invitation.update({
      where: { inviteCode },
      data: { status: 'revoked' }
    });
  } catch (error) {
    return null;
  }
}

module.exports = {
  getUserByOpenid,
  upsertUserByOpenid,
  createRecording,
  getRecording,
  listRecordings,
  deleteRecording,
  deleteStory,
  getBook,
  deleteBook,
  getPhoto,
  deletePhoto,
  deletePerson,
  revokeInvitation,
  createTranscript,
  createStory,
  listStories,
  getStory,
  updateStory,
  getPerson,
  createPerson,
  listPeople,
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
  listPhotos,
  createTheme,
  getTheme,
  listThemes,
  updateTheme,
  addThemeCollaborator,
  listThemeCollaborators,
  createInvitation,
  getInvitationByCode,
  listInvitations,
  createContribution,
  listContributions,
  prisma // Expose client for direct usage if needed
};
