/**
 * 🧠 多模型语义分析与智能对话引擎 (LLM Service)
 * 支持多通道动态路由适配：Mock (离线开发), Google Gemini, 腾讯混元 (Hunyuan), 以及 OpenAI/DeepSeek 兼容通道
 */
const https = require('https');

// 1. 离线本地规则 Mock 数据（在没有配 Key 时，保证整个系统以极高仿真度离线运行）
function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function mockConversationOpening({ mode, stories }) {
  if (mode === 'vent') {
    return {
      replyText: `我在听。今天不一定要讲完整故事，您想从心里最想说的那件事开始也可以。`,
      nextQuestion: '今天让您最想说一说的，是哪件事？'
    };
  }
  if (stories.length) {
    return {
      replyText: `我们接着慢慢聊。前面已经记下了一些回忆，今天可以补一段新的。`,
      nextQuestion: '今天想从小时候、工作、家人，还是一张老照片讲起？'
    };
  }
  return {
    replyText: `您好，我想先大概认识一下您。您不用讲得很完整，想到哪儿说到哪儿就好。`,
    nextQuestion: `您可以先说说：您在哪里长大？年轻时主要做过什么？`
  };
}

function mockConversationReply({ mode, userText, stories, messages, photos }) {
  const userTurns = messages.filter((message) => message.role === 'user').length;
  const hasPhoto = photos.length > 0 || includesAny(userText, ['照片', '相片', '合影']);

  if (mode === 'vent') {
    return {
      replyText: `嗯，我听到了。您刚才说的这段，我会先好好记下来。`,
      nextQuestion: hasPhoto
        ? '这张照片让您想到的第一个人是谁？'
        : '您愿意再说说，当时最让您放不下的是什么吗？'
    };
  }
  if (hasPhoto) {
    return {
      replyText: `这张老照片很适合放进回忆里。我们可以围着照片慢慢讲。`,
      nextQuestion: '照片里都有谁？当时是在什么地方拍的？'
    };
  }
  if (userTurns === 0) {
    return {
      replyText: `这段很重要，我先帮您记下大体经历。`,
      nextQuestion: '那您年轻时最重要的一个转折是什么？比如搬家、工作、结婚，或者遇到某个人。'
    };
  }
  if (includesAny(userText, ['工作', '上班', '单位'])) {
    return {
      replyText: `听起来那段工作经历对您影响很深。`,
      nextQuestion: '那时候单位里有没有一个您一直记得的人？'
    };
  }
  if (includesAny(userText, ['妈妈', '爸爸', '孩子', '家里', '家人'])) {
    return {
      replyText: `家人的部分我会特别小心地记下来。`,
      nextQuestion: '这件事里，您最想让后辈记住的是什么？'
    };
  }
  return {
    replyText: `我明白了。这段先记下来，我们再补一点细节。`,
    nextQuestion: '您还记得当时的地点、天气，或者旁边有什么人吗？'
  };
}

// 2. 核心通用 HTTP 请求工具
function postRequest(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 10000 // 10秒超时
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API responded with code ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API request timeout'));
    });

    req.write(JSON.stringify(body));
    req.end();
  });
}

// 3. 各大主流模型 API 适配器实现 (Google Gemini, Tencent Hunyuan, OpenAI/DeepSeek)
async function callLLM(systemPrompt, userPrompt, provider, modelName) {
  const currentProvider = provider || process.env.LLM_PROVIDER || 'mock';
  
  if (currentProvider === 'mock') {
    return null; // 触发 Fallback
  }

  // 💎 3.1 Google Gemini 适配器 (极力推荐，免费额度大，超长上下文)
  if (currentProvider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in .env');
    
    const selectedModel = modelName || 'gemini-1.5-flash'; // 默认极速闪电模型
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
    
    const body = {
      contents: [{
        parts: [
          { text: systemPrompt },
          { text: userPrompt }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json" // 强约束返回 JSON 格式
      }
    };
    
    const res = await postRequest(url, {}, body);
    try {
      const responseText = res.candidates[0].content.parts[0].text;
      return JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Failed to parse Gemini JSON response: ${e.message}`);
    }
  }

  // 3.2 腾讯混元 OpenAI 兼容适配器
  if (currentProvider === 'hunyuan') {
    const apiKey = process.env.HUNYUAN_API_KEY;
    if (!apiKey) throw new Error('HUNYUAN_API_KEY is not configured in .env');

    const selectedModel = modelName || 'hunyuan-standard';
    const url = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';
    
    const headers = {
      'Authorization': `Bearer ${apiKey}`
    };

    const body = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: "json_object" } // 强约束 JSON 返回
    };

    const res = await postRequest(url, headers, body);
    try {
      const responseText = res.choices[0].message.content;
      return JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Failed to parse Hunyuan JSON response: ${e.message}`);
    }
  }

  // 💎 3.3 OpenAI / DeepSeek (极廉价极速首选) 兼容适配器
  if (currentProvider === 'openai' || currentProvider === 'deepseek') {
    const apiKey = currentProvider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
    const url = currentProvider === 'deepseek' 
      ? 'https://api.deepseek.com/v1/chat/completions' 
      : 'https://api.openai.com/v1/chat/completions';
      
    if (!apiKey) throw new Error(`${currentProvider.toUpperCase()}_API_KEY is not configured`);

    const selectedModel = modelName || (currentProvider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
    
    const headers = {
      'Authorization': `Bearer ${apiKey}`
    };

    const body = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: "json_object" }
    };

    const res = await postRequest(url, headers, body);
    try {
      const responseText = res.choices[0].message.content;
      return JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Failed to parse OpenAI-compatible JSON: ${e.message}`);
    }
  }

  throw new Error(`Unknown LLM provider: ${currentProvider}`);
}

// 4. 对外导出的核心功能层 (内置 Mock 优雅降级)

async function createConversationOpening({ mode, stories, modelProvider, modelName }) {
  const provider = modelProvider || process.env.LLM_PROVIDER || 'mock';
  if (provider === 'mock') {
    return mockConversationOpening({ mode, stories });
  }

  const systemPrompt = `你是一个温暖、贴心的家庭回忆录整理助手。你的任务是根据当前对话模式，生成一句自然的开场白，并提出一个温和的引导问题。
请必须使用 JSON 格式回复，JSON 结构如下：
{
  "replyText": "给老人的温柔问候开场白",
  "nextQuestion": "引导老人开始回忆的温和问题"
}`;

  const userPrompt = `模式：${mode === 'vent' ? '倾诉模式' : '对话模式'}, 已存回忆数量：${stories.length}`;

  try {
    const json = await callLLM(systemPrompt, userPrompt, provider, modelName);
    if (json) return json;
  } catch (err) {
    console.error('LLM Opening Error, falling back to mock:', err.message);
  }
  return mockConversationOpening({ mode, stories });
}

async function createConversationReply({ mode, userText, stories, messages, photos, modelProvider, modelName }) {
  const provider = modelProvider || process.env.LLM_PROVIDER || 'mock';
  if (provider === 'mock') {
    return mockConversationReply({ mode, userText, stories, messages, photos });
  }

  const systemPrompt = `你是一个温暖、善于倾听的家庭回忆整理助手。
你的任务是：根据老人的最新讲述 (userText)，给出一段温暖的、富有同理心的情感回应，并针对口述内容顺着话题提出一个“细节追问”问题（如时间、地点、重要的人、感受等），引导老人慢慢道出完整的人生经历。
如果是“倾诉模式 (vent)”，请多倾听，追问必须极其温和少打扰。
请必须使用 JSON 格式回复，结构如下：
{
  "replyText": "富有同理心且温暖的情感共鸣回应",
  "nextQuestion": "顺应话题的细节追问问题"
}`;

  const historySummary = messages.slice(-4).map(m => `${m.role === 'assistant' ? 'AI' : '老人'}: ${m.text}`).join('\n');
  const userPrompt = `模式：${mode}
老人最新口述：${userText}
已带照片数量：${photos.length}
最近几轮对话历史：\n${historySummary}`;

  try {
    const json = await callLLM(systemPrompt, userPrompt, provider, modelName);
    if (json) return json;
  } catch (err) {
    console.error('LLM Reply Error, falling back to mock:', err.message);
  }
  return mockConversationReply({ mode, userText, stories, messages, photos });
}

async function polishStory(rawText, modelProvider, modelName) {
  const provider = modelProvider || process.env.LLM_PROVIDER || 'mock';
  
  if (provider === 'mock') {
    const title = includesAny(rawText, ['工作', '上班', '单位'])
      ? '工作里的难忘日子'
      : includesAny(rawText, ['照片', '相片', '老照片'])
        ? '一张老照片里的回忆'
        : '院子里的小时候';

    return {
      title,
      draftText: rawText,
      polishedText: `我记得：${rawText} 这段回忆先按原话保存下来，后面家人可以再补充细节。`,
      topic: title.includes('工作') ? '工作' : title.includes('照片') ? '照片' : '童年',
      happenedAt: null
    };
  }

  const systemPrompt = `你是一个专业的家庭回忆录编辑。你的任务是根据老人杂乱的口述文字 (rawText)，进行错字订正、语序整理，提炼润色出一段流畅、温暖、保留原话情感的第三人称回忆故事。同时，提取出一个富有诗意的标题，分类标签（如：童年/工作/爱情/日常/旅行），以及可能的发生年份或日期（无法提取则返回 null）。
请必须使用 JSON 格式回复，结构如下：
{
  "title": "富有诗意的标题",
  "draftText": "原始口述内容",
  "polishedText": "整理润色后的故事正文",
  "topic": "核心分类标签",
  "happenedAt": "例如 1978-05-01 或 null"
}`;

  try {
    const json = await callLLM(systemPrompt, rawText, provider, modelName);
    if (json) return json;
  } catch (err) {
    console.error('LLM Polish Error, falling back to mock:', err.message);
  }

  return {
    title: '温馨家庭片段',
    draftText: rawText,
    polishedText: rawText,
    topic: '家庭',
    happenedAt: null
  };
}

async function chatWithMemory(message, stories, modelProvider, modelName) {
  const provider = modelProvider || process.env.LLM_PROVIDER || 'mock';
  if (!stories.length) {
    return '我现在还没有足够的已确认故事，所以不能乱猜。可以先请家人帮忙校对几段回忆。';
  }

  if (provider === 'mock') {
    const firstStory = stories[0];
    return `我记得有一段故事是关于“${firstStory.title}”的。按已经保存的内容看，那是一段朴素但很温暖的日子。`;
  }

  const systemPrompt = `你扮演已确认授权的老人数字记忆化身。你只能基于给定的真实故事库(stories)中的事实来回答问题。如果问题无法在故事库中找到事实支撑，请温柔地告诉用户您记不清了，千万不能捏造事实，保持真实与温情。`;
  
  const storiesContext = stories.map((s, i) => `[故事 ${i+1}] 标题:${s.title}\n正文:${s.polishedText}`).join('\n\n');
  const userPrompt = `用户的问题：${message}\n\n已确认的故事数据库：\n${storiesContext}`;

  try {
    const json = await callLLM(systemPrompt, userPrompt, provider, modelName);
    if (json && json.replyText) return json.replyText;
    if (json && typeof json === 'string') return json;
  } catch (err) {
    console.error('LLM Memory Chat Error, falling back to mock:', err.message);
  }

  const firstStory = stories[0];
  return `我记得有一段故事是关于“${firstStory.title}”的。按已经保存的内容看，那是一段朴素但很温暖的日子。`;
}

async function createFollowUpQuestion(text, modelProvider, modelName) {
  const provider = modelProvider || process.env.LLM_PROVIDER || 'mock';
  if (provider === 'mock') {
    if (includesAny(text, ['小时候', '童年', '小时'])) {
      return '那时候您最常一起玩的人是谁？';
    }
    if (includesAny(text, ['工作', '上班', '单位'])) {
      return '您还记得第一份工作里最难忘的一天吗？';
    }
    if (includesAny(text, ['照片', '相片', '老照片'])) {
      return '这张照片大概是哪一年拍的？照片里都有谁？';
    }
    return '这件事后来对您有什么影响？';
  }

  const systemPrompt = `你是一个家庭故事追问助手。请针对老人的口述片段 (text)，生成一个相关的、温暖细致的追问问题。只返回一个普通问题文本，不要有多余的话。`;
  try {
    const json = await callLLM(systemPrompt, text, provider, modelName);
    if (json && json.nextQuestion) return json.nextQuestion;
    if (json && typeof json === 'string') return json;
  } catch (err) {
    console.error('LLM FollowUp Error, falling back to mock:', err.message);
  }

  return '这件事后来对您有什么影响？';
}

module.exports = {
  createConversationOpening,
  createConversationReply,
  polishStory,
  chatWithMemory,
  createFollowUpQuestion
};
