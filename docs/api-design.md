# API 设计草案

## 健康检查

`GET /health`

## 登录

`POST /api/auth/wechat-login`

开发阶段返回 mock 用户和 token。生产版本使用微信 `code2Session` 换取 `openid`。

## 人物

`GET /api/persons/:personId`

返回被记录者信息。

`PUT /api/persons/:personId/consent`

更新本人授权状态。

```json
{
  "consentStatus": "granted"
}
```

允许值：

- `pending`
- `granted`
- `revoked`

## 故事

`GET /api/persons/:personId/stories`

返回某个人的故事列表。

`GET /api/stories/:storyId`

返回单篇故事。

`PUT /api/stories/:storyId`

更新家人校对后的故事。

```json
{
  "polishedText": "校对后的正文",
  "status": "approved"
}
```

## 录音

`POST /api/recordings/upload`

表单上传音频文件。

字段：

- `audio`: 音频文件
- `personId`: 被记录者 ID

`POST /api/recordings/:recordingId/stories`

将录音转写并整理成故事。

## 成书

`POST /api/persons/:personId/book/export`

根据故事生成书稿。MVP 当前返回 mock 结果，生产版本返回 PDF / DOCX 文件地址。

`GET /api/persons/:personId/books`

返回历史生成的书稿记录。

## 纪念对话

`POST /api/persons/:personId/chat`

```json
{
  "message": "我想问的问题"
}
```

只允许基于已授权、已校对故事回答。

## 语音陪聊会话

`POST /api/persons/:personId/conversations`

创建一段陪聊会话。

```json
{
  "mode": "dialogue"
}
```

允许值：

- `dialogue`：对话模式，适合整理生平、经历和具体故事。
- `vent`：倾诉模式，适合先听使用者说心里话。

`GET /api/persons/:personId/conversations`

返回某个人的会话列表。

`GET /api/conversations/:conversationId/messages`

返回会话消息。

`POST /api/conversations/:conversationId/turns`

提交一轮对话。可以传文字，也可以传录音 ID。

```json
{
  "recordingId": "录音 ID",
  "photoIds": ["照片 ID"]
}
```

或：

```json
{
  "text": "我年轻时在工厂上班，第一天特别紧张。"
}
```

后端会转写录音、保存用户消息、生成故事草稿，并返回 AI 回应和下一句追问。

## 照片

`POST /api/photos/upload`

表单上传照片，可用于老照片、孩子成长照、家庭旅行照等场景。

字段：

- `photo`: 图片文件
- `personId`: 被记录者 ID
- `conversationId`: 可选，会话 ID
- `storyId`: 可选，故事 ID
- `note`: 可选，照片备注

`GET /api/photos/persons/:personId/photos`

返回某个人上传过的照片。

## 人物关系、主题与共创

`GET /api/persons`

返回当前用户定义的家庭成员或记录对象。

`POST /api/persons`

创建一个人物关系。

```json
{
  "name": "大宝",
  "relation": "儿子",
  "kind": "child"
}
```

`GET /api/persons/:personId/themes`

返回某个人相关的主题。

`POST /api/persons/:personId/themes`

创建主题。

```json
{
  "title": "三岁这一年",
  "description": "记录孩子三岁时说过的话和成长瞬间",
  "mode": "co_create"
}
```

`mode` 可为 `solo` 或 `co_create`。

`GET /api/themes/:themeId`

返回主题、共创人、邀请和补充记录。

`POST /api/themes/:themeId/collaborators`

添加主题共创人。

```json
{
  "name": "妈妈",
  "relation": "母亲",
  "role": "contributor"
}
```

`POST /api/themes/:themeId/invitations`

邀请某人补充主题。

```json
{
  "targetName": "妈妈",
  "relation": "母亲",
  "prompt": "请补充大宝第一次去幼儿园那天的细节。"
}
```

`POST /api/stories/:storyId/invitations`

邀请某人补充某一段故事。

`GET /api/invitations/:inviteCode`

读取邀请。

`POST /api/invitations/:inviteCode/contributions`

提交补充。

```json
{
  "contributorName": "妈妈",
  "text": "那天他背着蓝色书包，进门前还回头看了一眼。"
}
```
