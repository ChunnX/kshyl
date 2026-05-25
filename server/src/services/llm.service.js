function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

async function createFollowUpQuestion(text) {
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

async function polishStory(rawText) {
  const title = includesAny(rawText, ['工作', '上班', '单位'])
    ? '工作里的难忘日子'
    : includesAny(rawText, ['照片', '相片', '老照片'])
      ? '一张老照片里的回忆'
      : '院子里的小时候';

  return {
    title,
    draftText: rawText,
    polishedText: `我记得：${rawText} 这段回忆先按原话保存下来，后面家人可以再帮忙补充时间、地点和人名。`,
    topic: title.includes('工作') ? '工作' : title.includes('照片') ? '照片' : '童年',
    happenedAt: null
  };
}

async function createConversationOpening({ mode, person, stories }) {
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

async function createConversationReply({ mode, userText, stories, messages, photos }) {
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
      replyText: `这段很重要，我先帮您记下大概经历。`,
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

  if (stories.length) {
    return {
      replyText: `我想起前面也保存过一些回忆，可以和今天这段连起来看。`,
      nextQuestion: '这件事发生时，您大概多大年纪？'
    };
  }

  return {
    replyText: `我明白了。这段先记下来，我们再补一点细节。`,
    nextQuestion: '您还记得当时的地点、天气，或者旁边有什么人吗？'
  };
}

async function chatWithMemory(message, stories) {
  if (!stories.length) {
    return '我现在还没有足够的已确认故事，所以不能乱猜。可以先请家人帮忙校对几段回忆。';
  }

  const firstStory = stories[0];
  return `我记得有一段故事是关于“${firstStory.title}”的。按已经保存的内容看，那是一段朴素但很温暖的日子。`;
}

module.exports = {
  createFollowUpQuestion,
  polishStory,
  createConversationOpening,
  createConversationReply,
  chatWithMemory
};
