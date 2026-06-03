const store = require('../db/memory-store');

async function exportBook(personId) {
  const stories = (await store.listStories(personId)).filter((story) => story.status === 'approved' || story.status === 'draft');

  return store.createBook({
    personId,
    title: '一生的故事',
    status: 'generated',
    summary: `已整理 ${stories.length} 个故事。真实版本会在这里生成 PDF 和 DOCX 文件。`,
    outline: stories.map((story, index) => ({
      chapter: index + 1,
      title: story.title
    }))
  });
}

module.exports = {
  exportBook
};
