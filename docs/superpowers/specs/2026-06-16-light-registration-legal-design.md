# 轻注册、协议与隐私政策设计

日期：2026-06-16

## 背景

当前小程序已经有微信登录链路：前端调用 `wx.login`，后端用 `code2Session` 换取 `openid`，再签发 JWT。后端用 `ownerUserId` 隔离每个用户的家庭成员、故事、主题、会话和文件。邀请共创链接目前是公开访问，受邀人可以不登录，只填写贡献者名字提交内容。

下一阶段需要完善账号系统，同时在注册时要求用户勾选《用户协议》和《隐私政策》。产品约束是只采集用户名，不采集手机号等额外身份信息；受邀微信好友也需要轻注册后才能参与共创。

## 目标

- 首次使用时完成轻注册：用户名 + 勾选《用户协议》和《隐私政策》。
- 微信 `openid` 仍作为唯一登录身份，用户名只作为展示和协作署名。
- 注册同意记录需要落库，包含协议版本和同意时间。
- 受邀好友打开邀请链接时，也先轻注册，再继续进入邀请页。
- 共创贡献内容能归属到当前注册用户，同时保留提交时显示的贡献者名称。
- 用户协议和隐私政策以仓库文档和小程序页面双形态维护。
- 不引入手机号、身份证、真实姓名等非必要个人信息。

## 非目标

- 不做手机号登录、短信验证码或账号密码登录。
- 不做复杂组织/家庭空间权限模型。
- 不做支付、会员、商业化条款。
- 不做专业法律审查替代；文案作为产品上线草案，正式商用前仍建议由法律专业人士复核。

## 推荐方案

采用严格轻注册。

用户第一次打开任何受保护页面时，如果没有已完成注册的账号，跳转到注册页。注册页要求输入用户名，并勾选两个独立选项：

- 我已阅读并同意《用户协议》
- 我已阅读并同意《隐私政策》

提交后，前端调用 `wx.login` 获取 code，再调用后端注册接口。后端通过微信 `code2Session` 获取 `openid`，创建或更新用户，保存用户名、协议版本和同意时间，返回 JWT 和用户信息。

受邀好友打开 `/pages/invite/invite?code=xxx` 时，如果未注册，先跳转注册页，并带上原始邀请页作为 redirect。注册完成后回到邀请页继续查看和提交共创内容。

## 前端流程

### 启动与登录

当前 `miniprogram/app.js` 启动时会自动登录。新流程中，启动阶段不主动调用后端注册或登录接口，只读取本地 token 和 user。

页面需要账号时调用统一守卫：

```txt
ensureRegistered(redirectPath)
```

如果本地没有 token，或本地 user 缺少 `username` / `profileCompleted`，跳转：

```txt
/pages/register/register?redirect=<encoded-path>
```

### 注册页

新增页面：

```txt
miniprogram/pages/register/register
```

页面字段：

- 用户名输入框
- 用户协议勾选框
- 隐私政策勾选框
- 用户协议链接
- 隐私政策链接
- “同意并开始”按钮

校验规则：

- 用户名必填。
- 用户名建议长度 2-20 个字符。
- 去除首尾空格。
- 必须同时勾选两个协议。
- 提交时按钮进入 loading，避免重复注册。

注册成功后：

- 保存 token 到 `wx.setStorageSync('token')`。
- 保存 user 到 `wx.setStorageSync('user')`。
- 更新 `getApp().globalData.user/token`。
- 跳回 redirect，缺省回到首页。

### 协议页面

新增页面：

```txt
miniprogram/pages/legal/user-agreement
miniprogram/pages/legal/privacy-policy
```

页面展示当前版本协议正文。正文可以先内置在页面 JS 或单独的公共模块中；仓库文档作为源文本：

```txt
docs/legal/user-agreement.md
docs/legal/privacy-policy.md
```

## 后端设计

### User 模型

当前 Prisma `User`：

```txt
id
openid
role
phone?
createdAt
```

扩展为：

```txt
id
openid
username
role
phone?
termsVersion
privacyVersion
termsAcceptedAt
privacyAcceptedAt
registeredAt
createdAt
updatedAt
```

JSON store 中的 `users` 也保持同样字段。

`username` 是产品要求的唯一用户输入字段。后端不要求全局唯一，避免同名家人注册受阻。

### Contribution 模型

当前贡献记录有 `contributorName`，新增：

```txt
contributorUserId
```

提交邀请贡献时，优先从当前登录用户读取 `user.id` 和 `user.username`。前端仍可提交一个显示名；如果为空则默认使用注册用户名。

### API

新增或调整接口：

```txt
POST /api/auth/register
```

请求：

```json
{
  "code": "wx.login 返回的 code",
  "username": "小明",
  "acceptedTermsVersion": "2026-06-16",
  "acceptedPrivacyVersion": "2026-06-16"
}
```

响应：

```json
{
  "user": {
    "id": "...",
    "openid": "...",
    "username": "小明",
    "role": "family",
    "profileCompleted": true,
    "termsVersion": "2026-06-16",
    "privacyVersion": "2026-06-16"
  },
  "token": "..."
}
```

保留现有：

```txt
POST /api/auth/wechat-login
```

但它只用于已有用户静默恢复会话。如果用户不存在或未完成注册，返回明确状态，前端跳转注册页。

建议新增：

```txt
GET /api/auth/me
```

用于 token 恢复后读取当前用户和注册状态。

### 邀请接口

邀请详情读取可以继续允许公开访问：

```txt
GET /api/invitations/:inviteCode
```

这样受邀人注册前可以保留 redirect，也能在必要时展示邀请标题。

贡献提交改为需要登录：

```txt
POST /api/invitations/:inviteCode/contributions
```

该接口使用 `requireAuth`，提交内容归属到当前用户。

## 协议与隐私政策草案要求

### 用户协议覆盖范围

用户协议应覆盖：

- 服务说明：家庭回忆记录、语音转文字、AI 整理、家庭共创、书稿导出。
- 账号规则：微信授权登录，用户名作为展示名称。
- 用户内容：录音、照片、文字、故事、共创贡献由用户自行保证有权上传。
- 共创邀请：用户可以将邀请链接分享给微信好友，受邀人需轻注册后提交内容。
- AI 内容提示：AI 生成或整理内容可能不准确，需要用户自行审阅。
- 禁止行为：违法侵权、冒用他人、上传无权内容、攻击服务等。
- 知识产权：用户保留原始内容权利，授权平台为提供服务进行处理、存储、展示和导出。
- 服务变更与免责声明。
- 未成年人：未成年人应在监护人指导下使用。
- 联系方式与更新。

### 隐私政策覆盖范围

隐私政策应覆盖：

- 收集信息：微信 openid、用户名、录音、语音识别文本、照片、故事文本、共创内容、书稿文件、必要日志。
- 权限调用：麦克风、相册/相机，仅在用户主动录音或上传照片时使用。
- 使用目的：账号识别、内容存储、语音识别、AI 整理、协作分享、导出书稿、安全风控。
- 第三方处理：微信登录、腾讯云/CloudBase、腾讯实时语音识别、后续可能的 AI 服务商。
- 共享范围：邀请链接接收者可看到邀请相关内容；家庭成员/共创人可看到协作范围内内容。
- 保存期限：用户主动删除或账号注销前保存；删除后在合理时间内清理。
- 用户权利：访问、更正、删除、撤回授权、注销或要求删除数据。
- 敏感个人信息提示：录音、照片、家庭故事可能包含敏感信息，用户应确认获得相关人员授权。
- 儿童/未成年人保护。
- 联系方式与政策更新。

## 测试策略

后端：

- 新用户注册成功，保存用户名和协议版本。
- 用户名为空、协议版本缺失时注册失败。
- 已注册用户重复注册时更新用户名和协议同意记录。
- 未注册用户调用受保护接口时被拒绝或提示未注册。
- 邀请详情仍可公开读取。
- 邀请贡献提交必须登录，且保存 `contributorUserId`。
- JSON store 和 Prisma store 行为一致。

前端：

- 首次打开首页跳注册页。
- 首次打开邀请链接跳注册页，注册后回到原邀请链接。
- 未勾选协议无法提交。
- 协议链接可打开正文页面。
- 注册成功后首页、录音页、邀请页使用同一 token。

回归：

- `npm run smoke`
- `npm run test:security`
- 小程序配置仍指向 `api.zzzp.me`。

## 上线注意

- 后端生产环境需要设置 `WECHAT_APPID`、`WECHAT_SECRET` 和安全的 `JWT_SECRET`。
- 如果生产环境仍使用 JSON store，重启可能丢注册数据；正式上线建议启用数据库。
- 更新协议版本时，新版本应写入常量并在注册/重新同意时保存。
- 本文档不替代正式法律意见，公开发布前建议复核协议和隐私政策文本。
