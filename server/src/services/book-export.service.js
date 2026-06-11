const { randomUUID } = require('crypto');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType
} = require('docx');
const store = require('../db/memory-store');
const storage = require('./storage.service');

// A CJK-friendly default so Word renders Chinese cleanly across platforms.
const BODY_FONT = '宋体';
const TITLE_FONT = '黑体';

function splitParagraphs(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildDocChildren({ title, subtitle, stories }) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, font: TITLE_FONT, bold: true, size: 56 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [new TextRun({ text: subtitle, font: BODY_FONT, size: 24, color: '666666' })]
    })
  ];

  stories.forEach((story, index) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 120 },
        children: [
          new TextRun({
            text: `第${index + 1}章　${story.title || '未命名故事'}`,
            font: TITLE_FONT,
            bold: true,
            size: 32
          })
        ]
      })
    );

    const caption = [story.topic, story.happenedAt].filter(Boolean).join(' · ');
    if (caption) {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: caption, font: BODY_FONT, italics: true, size: 22, color: '999999' })]
        })
      );
    }

    const body = story.polishedText || story.draftText || '（这段故事还没有整理好的正文。）';
    splitParagraphs(body).forEach((line) => {
      children.push(
        new Paragraph({
          spacing: { after: 120, line: 360 },
          indent: { firstLine: 480 },
          children: [new TextRun({ text: line, font: BODY_FONT, size: 24 })]
        })
      );
    });
  });

  if (!stories.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '还没有可收录的故事，先去记录并校对几段回忆吧。', font: BODY_FONT, size: 24 })]
      })
    );
  }

  return children;
}

async function exportBook(personId) {
  const person = await store.getPerson(personId);

  // Prefer family-approved stories; fall back to drafts so a demo never exports an empty book.
  const allStories = await store.listStories(personId);
  const approved = allStories.filter((story) => story.status === 'approved');
  const stories = approved.length ? approved : allStories;

  const title = `${(person && person.name) || '家人'}的回忆故事集`;
  const subtitle = `共收录 ${stories.length} 个故事 · 生成于 ${new Date().toLocaleDateString('zh-CN')}`;
  const outline = stories.map((story, index) => ({ chapter: index + 1, title: story.title }));

  const doc = new Document({
    creator: '家庭语音记忆',
    title,
    sections: [{ children: buildDocChildren({ title, subtitle, stories }) }]
  });
  const buffer = await Packer.toBuffer(doc);

  const filename = `book_${randomUUID()}.docx`;
  const saved = await storage.save({ buffer, key: `exports/${filename}` });

  const book = await store.createBook({
    personId,
    title,
    status: 'generated',
    summary: `已整理 ${stories.length} 个故事，可下载 Word 文档。`,
    outlineJson: outline,
    docxUrl: saved.url
  });

  // Normalize the response so it is identical under both stores (prisma stringifies outlineJson).
  return {
    ...book,
    title,
    summary: `已整理 ${stories.length} 个故事，可下载 Word 文档。`,
    outline,
    docxUrl: saved.url,
    downloadUrl: saved.url,
    format: 'docx'
  };
}

module.exports = {
  exportBook
};
