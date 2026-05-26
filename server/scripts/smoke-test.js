const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

process.env.DATA_FILE = 'data/smoke-test-store.json';

function listen() {
  return new Promise((resolve) => {
    const app = require('../src/app');
    const { attachConversationRealtime } = require('../src/realtime/conversation-realtime');
    const server = http.createServer(app);
    attachConversationRealtime(server);
    server.listen(0, () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function request(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json();
  return { response, data };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const dataPath = path.resolve(process.cwd(), process.env.DATA_FILE);
  fs.rmSync(dataPath, { force: true });

  const { server, baseUrl } = await listen();

  try {
    const health = await request(baseUrl, '/health');
    assert(health.data.ok === true, 'health check failed');

    const createdRecording = await request(baseUrl, '/api/recordings', {
      method: 'POST',
      body: JSON.stringify({
        personId: 'person_demo_001',
        duration: 42,
        mockText: '我小时候住在一个很热闹的院子里。'
      })
    });
    assert(createdRecording.response.status === 201, 'recording creation failed');

    const recordingId = createdRecording.data.recording.id;
    const createdStory = await request(baseUrl, `/api/recordings/${recordingId}/stories`, {
      method: 'POST'
    });
    assert(createdStory.response.status === 201, 'story creation failed');
    assert(createdStory.data.story.title, 'story title missing');

    const storyId = createdStory.data.story.id;
    const updatedStory = await request(baseUrl, `/api/stories/${storyId}`, {
      method: 'PUT',
      body: JSON.stringify({
        polishedText: '校对后的故事正文。',
        status: 'approved'
      })
    });
    assert(updatedStory.data.story.status === 'approved', 'story approval failed');

    const blockedChat = await request(baseUrl, '/api/persons/person_demo_001/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: '小时候住在哪里？'
      })
    });
    assert(blockedChat.response.status === 403, 'chat should require consent');

    const consent = await request(baseUrl, '/api/persons/person_demo_001/consent', {
      method: 'PUT',
      body: JSON.stringify({
        consentStatus: 'granted'
      })
    });
    assert(consent.data.person.consentStatus === 'granted', 'consent update failed');

    const chat = await request(baseUrl, '/api/persons/person_demo_001/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: '小时候住在哪里？'
      })
    });
    assert(chat.response.status === 200, 'chat after consent failed');
    assert(chat.data.reply, 'chat reply missing');

    const book = await request(baseUrl, '/api/persons/person_demo_001/book/export', {
      method: 'POST'
    });
    assert(book.data.book.summary, 'book summary missing');

    const conversation = await request(baseUrl, '/api/persons/person_demo_001/conversations', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'dialogue'
      })
    });
    assert(conversation.response.status === 201, 'conversation creation failed');
    assert(conversation.data.assistantMessage.nextQuestion, 'conversation opening question missing');

    const turn = await request(baseUrl, `/api/conversations/${conversation.data.conversation.id}/turns`, {
      method: 'POST',
      body: JSON.stringify({
        text: '我年轻时在工厂上班，第一天特别紧张。'
      })
    });
    assert(turn.response.status === 201, 'conversation turn failed');
    assert(turn.data.assistantMessage.nextQuestion, 'conversation follow-up missing');
    assert(turn.data.story.id, 'conversation story draft missing');

    await smokeRealtimeConversation(baseUrl);

    const child = await request(baseUrl, '/api/persons', {
      method: 'POST',
      body: JSON.stringify({
        name: '大宝',
        relation: '儿子',
        kind: 'child'
      })
    });
    assert(child.response.status === 201, 'person creation failed');

    const theme = await request(baseUrl, `/api/persons/${child.data.person.id}/themes`, {
      method: 'POST',
      body: JSON.stringify({
        title: '三岁这一年',
        description: '记录孩子三岁时说过的话和成长瞬间',
        mode: 'co_create'
      })
    });
    assert(theme.response.status === 201, 'theme creation failed');

    const collaborator = await request(baseUrl, `/api/themes/${theme.data.theme.id}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({
        name: '妈妈',
        relation: '母亲'
      })
    });
    assert(collaborator.response.status === 201, 'theme collaborator creation failed');

    const themeInvite = await request(baseUrl, `/api/themes/${theme.data.theme.id}/invitations`, {
      method: 'POST',
      body: JSON.stringify({
        targetName: '妈妈',
        relation: '母亲',
        prompt: '请补充大宝第一次去幼儿园那天的细节。'
      })
    });
    assert(themeInvite.response.status === 201, 'theme invitation failed');
    assert(themeInvite.data.sharePath.includes(themeInvite.data.invitation.inviteCode), 'share path missing invite code');

    const contribution = await request(baseUrl, `/api/invitations/${themeInvite.data.invitation.inviteCode}/contributions`, {
      method: 'POST',
      body: JSON.stringify({
        contributorName: '妈妈',
        text: '那天他背着蓝色书包，进门前还回头看了一眼。'
      })
    });
    assert(contribution.response.status === 201, 'contribution submit failed');

    const storyInvite = await request(baseUrl, `/api/stories/${storyId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({
        targetName: '舅舅',
        prompt: '请补充这段故事里你记得的细节。'
      })
    });
    assert(storyInvite.response.status === 201, 'story invitation failed');

    console.log('Smoke test passed');
  } finally {
    server.close();
  }
}

function smokeRealtimeConversation(baseUrl) {
  return new Promise((resolve, reject) => {
    const wsUrl = `${baseUrl.replace('http://', 'ws://')}/realtime/conversations?personId=person_demo_001&mode=dialogue&dialect=auto`;
    const ws = new WebSocket(wsUrl);
    const seen = new Set();

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('realtime smoke test timed out'));
    }, 5000);

    ws.on('message', (data) => {
      const event = JSON.parse(data.toString());
      seen.add(event.type);

      if (event.type === 'conversation_started') {
        ws.send(JSON.stringify({ type: 'start_turn' }));
        ws.send(Buffer.from([1, 2, 3, 4]));
        ws.send(Buffer.from([5, 6, 7, 8]));
        ws.send(Buffer.from([9, 10, 11, 12]));
        ws.send(Buffer.from([13, 14, 15, 16]));
        ws.send(JSON.stringify({ type: 'end_turn' }));
      }

      if (event.type === 'assistant_reply') {
        clearTimeout(timeout);
        ws.close();
        try {
          assert(seen.has('asr_partial'), 'realtime partial ASR missing');
          assert(seen.has('asr_final'), 'realtime final ASR missing');
          assert(event.assistantMessage.nextQuestion, 'realtime assistant follow-up missing');
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    });

    ws.on('error', reject);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
