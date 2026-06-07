# 更新日志

本文件记录对「家庭语音记忆小程序」的重要改动。

## [Unreleased] - 2026-06-07

把项目从「功能演示」补强到可演示版本：成书能下载、语音能出声、数据可持久化、有真实登录与越权防护、可删除数据与撤销分享、并接入 CI。

### 新增 (Added)

**核心功能闭环**
- 成书导出生成真实可下载的 Word（.docx）文档：封面、分章节、正文，中文字体；通过后端 `/files` 提供下载。成书页新增章节大纲与「下载 Word」按钮。
- 语音陪聊接入腾讯 TTS：AI 回复可朗读（整段合成 mp3 → 存储 → 返回 URL）；mock 模式保持静默，离线开发不受影响。

**数据底座**
- 接入 Prisma 持久化（SQLite，重启不丢数据）：补全 migration、seed 脚本与 `prisma:migrate` / `prisma:migrate:dev` / `db:seed` 命令。Postgres 作为可切换项保留在文档中。
- 新增文件存储抽象 `storage.service.js`（本地磁盘可用，腾讯 COS 预留接口），录音 / 照片 / 成书统一走存储层。
- 上传增加文件类型与大小校验（`middleware/upload.js`）。

**安全与鉴权**
- 真实微信登录：`code2Session` 换 openid + 签发 JWT；未配置微信密钥时回退演示身份。
- 鉴权中间件守卫全部 `/api/*`（登录与分享链接除外）；`DEV_AUTH_BYPASS` 保证离线 / 测试免登录。
- 人物 / 故事 / 会话 / 主题加归属校验，关闭越权（IDOR）漏洞：访问非本人资源返回 404。
- 小程序启动自动登录并存储 token，所有请求与上传自动携带 `Authorization` 头。

**隐私合规**
- 新增删除能力：删除录音 / 故事 / 照片 / 书稿，以及「删除整个人物及其全部数据」级联删除。
- 纪念对话返回「AI 生成、非本人」免责声明并在页面展示；接口加限流。
- 分享邀请链接可撤销，撤销后读取与补充返回 410。

**工程化**
- 新增 GitHub Actions CI：每次提交对「内存」与「Prisma/SQLite」两套后端各跑一遍 smoke。
- 扩展 smoke：校验成书文件确实生成、删除后变 404。

### 变更 (Changed)

- `book-export.service.js`、`speech.service.js`、`streaming-tts.service.js` 从占位实现改为真实实现。
- `memory-store.js` / `prisma-store.js` 同步新增 User、删除、撤销邀请等方法，保持两套后端接口一致。
- 各路由统一改用 `req.userId` 并加归属校验，取代写死的 `user_demo_001`。
- `miniprogram/config.js`：默认 `MODE` 改为 `local`（开发者工具模拟器走 127.0.0.1）。
- 文档更新：`api-design.md`（鉴权与新接口）、`privacy-and-consent.md`（落地状态）、`.env.example`（补全 TTS / 存储 / 鉴权 / 数据库变量）、新增 `CLAUDE.md`。
- 新增依赖：`docx`、`jsonwebtoken`。

### 移除 (Removed)

- 删除过时且与 active schema 冲突的 `server/src/db/prisma.schema`（postgres 草稿）。

### 安全 (Security)

- 关闭越权（IDOR）：跨用户访问人物作用域数据返回 404。
- 全量接口需登录鉴权（除登录与公开分享链接）。
- 清除部署文档中疑似真实的 `TENCENT_ASR_APP_ID`，改为占位符。
- 纪念对话加入限流，降低滥用风险。
