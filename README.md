# 家庭语音记忆小程序

一个微信原生小程序 + Node.js Express 后端的 MVP 骨架，用于帮助家庭成员通过语音记录人生故事、孩子成长、家庭日常，并由 AI 辅助整理、家人校对、导出成册。

## 当前包含

- 微信原生小程序：WXML / WXSS / JS
- 全龄友好界面：大字号、大按钮、极简流程，兼顾长辈、伴侣和孩子成长记录
- Node.js Express 后端
- 录音、故事、校对、成书、纪念对话的核心 API 骨架
- 人物关系、主题记录、邀请共创与补充提交
- ASR / LLM / 声音克隆 provider 抽象与 mock 实现
- Prisma 数据模型草案

## 快速启动后端

```bash
cd server
npm install
npm run dev
```

默认服务地址：

```txt
http://localhost:3000
```

健康检查：

```txt
GET http://localhost:3000/health
```

后端烟测：

```bash
cd server
npm run smoke
```

烟测会覆盖以下链路：

- 创建录音
- 生成故事
- 家人校对
- 未授权时禁止纪念对话
- 授权后允许纪念对话
- 生成书稿记录

## 小程序导入

使用微信开发者工具导入 `miniprogram/` 目录。

开发阶段请先在微信开发者工具中关闭域名校验，或将后端部署到 HTTPS 域名后配置到 `miniprogram/services/api.js`。

## 真实服务替换位置

- ASR：`server/src/services/asr.service.js`
- 大模型：`server/src/services/llm.service.js`
- 声音克隆 / TTS：`server/src/services/voice-clone.service.js`
- 书籍导出：`server/src/services/book-export.service.js`

语音转文字 API 的配置说明见：

```txt
docs/asr-provider-setup.md
```

实时语音和方言识别说明见：

```txt
docs/realtime-voice.md
```

## 开发数据

当前使用本地 JSON 文件模拟数据库：

```txt
server/data/dev-store.json
```

这个目录不会提交到仓库。后续接 PostgreSQL/Prisma 时，保持现有 route 和 service 接口即可。
