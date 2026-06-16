# Light Registration And Legal Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight account registration flow that collects only a username, records acceptance of the user agreement and privacy policy, and requires invited collaborators to register before submitting contributions.

**Architecture:** Keep WeChat `openid` as the identity anchor and JWT as the session mechanism. Add registration completion fields to `User`, add contributor ownership to `Contribution`, route all protected mini program pages through a small registration guard, and keep invitation detail reads public while making contribution submission authenticated.

**Tech Stack:** WeChat Mini Program JavaScript/WXML/WXSS, Node.js Express, JSON file store, Prisma SQLite store, JWT, existing smoke/security scripts.

---

## File Structure

- Modify `server/prisma/schema.prisma`: add registration and agreement fields to `User`, add `contributorUserId` to `Contribution`.
- Create `server/prisma/migrations/20260616000000_light_registration/migration.sql`: SQLite migration for the new fields.
- Modify `server/src/db/memory-store.js`: persist new `User` fields and `contributorUserId`.
- Modify `server/src/db/prisma-store.js`: persist new `User` fields and `contributorUserId`.
- Modify `server/src/routes/auth.routes.js`: add `POST /api/auth/register`, `GET /api/auth/me`, and adjust `POST /api/auth/wechat-login` to avoid auto-registering incomplete accounts.
- Modify `server/src/routes/invitations.routes.js`: require auth only for contribution submission and attach current user to the contribution.
- Modify `server/scripts/smoke-test.js`: add registration and authenticated invitation contribution coverage.
- Modify `server/scripts/security-test.js`: assert production login does not silently create accounts and anonymous contribution submission is rejected.
- Create `docs/legal/user-agreement.md`: full user agreement draft.
- Create `docs/legal/privacy-policy.md`: full privacy policy draft.
- Create `miniprogram/utils/legal-content.js`: shared legal version constants and page text.
- Modify `miniprogram/services/api.js`: add `register`, `getMe`, and registration-aware login helpers.
- Create `miniprogram/services/auth.js`: small front-end registration guard.
- Modify `miniprogram/app.js`: stop automatic startup login and only hydrate local session.
- Create `miniprogram/pages/register/*`: username and agreement acceptance page.
- Create `miniprogram/pages/legal/user-agreement/*`: agreement display page.
- Create `miniprogram/pages/legal/privacy-policy/*`: privacy policy display page.
- Modify `miniprogram/app.json`: register new pages.
- Modify `miniprogram/pages/invite/invite.js`: require light registration before contribution submission and prefill contributor name from registered user.
- Modify primary protected pages (`home`, `family`, `theme`, `conversation`, `record`, `story`, `family-review`, `book`, `chat`) to call the registration guard in `onLoad`.
- Modify `docs/superpowers/specs/2026-06-16-light-registration-legal-design.md` only if implementation discovers a design contradiction.

---

### Task 1: Backend Registration Tests

**Files:**
- Modify: `server/scripts/smoke-test.js`
- Modify: `server/scripts/security-test.js`

- [ ] **Step 1: Add registration helpers to the smoke test**

Insert these helpers after the existing `request` function in `server/scripts/smoke-test.js`:

```js
async function register(baseUrl, username, suffix = 'demo') {
  const result = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      code: `smoke-code-${suffix}`,
      username,
      acceptedTermsVersion: '2026-06-16',
      acceptedPrivacyVersion: '2026-06-16'
    })
  });
  assert(result.response.status === 200, `registration failed for ${username}`);
  assert(result.data.token, 'registration token missing');
  assert(result.data.user.username === username, 'registered username mismatch');
  assert(result.data.user.profileCompleted === true, 'registered user should be complete');
  return result.data;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}
```

- [ ] **Step 2: Add smoke assertions for registration and authenticated contribution**

At the start of `main()` after `const { server, baseUrl } = await listen();`, add:

```js
const registered = await register(baseUrl, '测试用户', 'owner');
const auth = authHeaders(registered.token);
```

Then update authenticated protected requests in the smoke test to include `headers: auth` once `DEV_AUTH_BYPASS` is changed in Task 6. For the first test implementation, keep `DEV_AUTH_BYPASS = 'true'` so existing calls remain compatible, but add the following explicit registration checks:

```js
const me = await request(baseUrl, '/api/auth/me', {
  headers: auth
});
assert(me.response.status === 200, 'me endpoint should work after registration');
assert(me.data.user.username === '测试用户', 'me endpoint username mismatch');
```

Replace the invitation contribution call body with authenticated headers:

```js
const contribution = await request(baseUrl, `/api/invitations/${themeInvite.data.invitation.inviteCode}/contributions`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    contributorName: '妈妈',
    text: '那天他背着蓝色书包，进门前还回头看了一眼。',
    storyId: null
  })
});
assert(contribution.response.status === 201, 'contribution submit failed');
assert(
  contribution.data.contribution.contributorUserId === registered.user.id,
  'contribution should record registered contributor user id'
);
```

- [ ] **Step 3: Add security test assertions**

In `server/scripts/security-test.js`, after the unconfigured login assertion, add:

```js
const unconfiguredRegister = await request(baseUrl, '/api/auth/register', null, {
  method: 'POST',
  body: JSON.stringify({
    code: 'test-code',
    username: '安全测试',
    acceptedTermsVersion: '2026-06-16',
    acceptedPrivacyVersion: '2026-06-16'
  })
});
assert(
  unconfiguredRegister.response.status === 503,
  'production register must not fall back to demo user when WeChat secrets are missing'
);
```

After creating `themeInvite` coverage is not present in this security test, add a direct anonymous contribution assertion using a nonexistent code to verify auth runs before invitation processing:

```js
const anonymousContribution = await request(baseUrl, '/api/invitations/missing/contributions', null, {
  method: 'POST',
  body: JSON.stringify({
    contributorName: '匿名',
    text: '匿名提交不应通过'
  })
});
assert(anonymousContribution.response.status === 401, 'anonymous contribution should be 401');
```

- [ ] **Step 4: Run tests and verify they fail**

Run:

```powershell
cd D:\code\ksls\server
npm run smoke
npm run test:security
```

Expected:

- `npm run smoke` fails because `/api/auth/register` or `/api/auth/me` is missing.
- `npm run test:security` fails for the same missing route or unauthenticated contribution behavior.

- [ ] **Step 5: Commit failing tests**

```powershell
cd D:\code\ksls
git add server/scripts/smoke-test.js server/scripts/security-test.js
git commit -m "test: cover light registration"
```

---

### Task 2: Data Store And Schema Support

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20260616000000_light_registration/migration.sql`
- Modify: `server/src/db/memory-store.js`
- Modify: `server/src/db/prisma-store.js`

- [ ] **Step 1: Update Prisma schema**

Change `model User` in `server/prisma/schema.prisma` to:

```prisma
model User {
  id                String    @id @default(cuid())
  openid            String    @unique
  username          String?
  role              String
  phone             String?
  termsVersion      String?
  privacyVersion    String?
  termsAcceptedAt   DateTime?
  privacyAcceptedAt DateTime?
  registeredAt      DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

Change `model Contribution` to:

```prisma
model Contribution {
  id                String   @id @default(cuid())
  invitationId      String
  themeId           String?
  storyId           String?
  contributorUserId String?
  contributorName   String
  text              String
  status            String   @default("submitted")
  createdAt         DateTime @default(now())
}
```

- [ ] **Step 2: Add SQLite migration**

Create `server/prisma/migrations/20260616000000_light_registration/migration.sql`:

```sql
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "privacyVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "privacyAcceptedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "registeredAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Contribution" ADD COLUMN "contributorUserId" TEXT;
```

- [ ] **Step 3: Add user helpers to JSON store**

In `server/src/db/memory-store.js`, replace `upsertUserByOpenid` with:

```js
function normalizeUser(user) {
  return {
    ...user,
    profileCompleted: Boolean(user.username && user.termsAcceptedAt && user.privacyAcceptedAt)
  };
}

function upsertUserByOpenid(data) {
  let user = getUserByOpenid(data.openid);
  const now = new Date().toISOString();
  if (!user) {
    user = {
      id: data.openid === 'openid_demo' ? 'user_demo_001' : randomUUID(),
      openid: data.openid,
      username: data.username || '',
      role: data.role || 'family',
      termsVersion: data.termsVersion || '',
      privacyVersion: data.privacyVersion || '',
      termsAcceptedAt: data.termsAcceptedAt || null,
      privacyAcceptedAt: data.privacyAcceptedAt || null,
      registeredAt: data.registeredAt || null,
      createdAt: now,
      updatedAt: now
    };
    state.users.push(user);
    saveState();
    return normalizeUser(user);
  }

  Object.assign(user, {
    username: data.username !== undefined ? data.username : user.username,
    role: data.role || user.role || 'family',
    termsVersion: data.termsVersion !== undefined ? data.termsVersion : user.termsVersion,
    privacyVersion: data.privacyVersion !== undefined ? data.privacyVersion : user.privacyVersion,
    termsAcceptedAt: data.termsAcceptedAt !== undefined ? data.termsAcceptedAt : user.termsAcceptedAt,
    privacyAcceptedAt: data.privacyAcceptedAt !== undefined ? data.privacyAcceptedAt : user.privacyAcceptedAt,
    registeredAt: data.registeredAt !== undefined ? data.registeredAt : user.registeredAt,
    updatedAt: now
  });
  saveState();
  return normalizeUser(user);
}
```

Add:

```js
function getUserById(id) {
  const user = state.users.find((item) => item.id === id);
  return user ? normalizeUser(user) : null;
}
```

Export `getUserById`.

- [ ] **Step 4: Store contributor user id in JSON store**

In `createContribution(data)` in `server/src/db/memory-store.js`, add:

```js
contributorUserId: data.contributorUserId || null,
```

inside the `contribution` object before `contributorName`.

- [ ] **Step 5: Add matching Prisma store behavior**

In `server/src/db/prisma-store.js`, add a local serializer near the top:

```js
function withProfileCompleted(user) {
  if (!user) {
    return null;
  }
  return {
    ...user,
    profileCompleted: Boolean(user.username && user.termsAcceptedAt && user.privacyAcceptedAt)
  };
}
```

Update `getUserByOpenid`:

```js
async function getUserByOpenid(openid) {
  return withProfileCompleted(await prisma.user.findUnique({ where: { openid } }));
}
```

Add:

```js
async function getUserById(id) {
  return withProfileCompleted(await prisma.user.findUnique({ where: { id } }));
}
```

Replace `upsertUserByOpenid` with an implementation that creates incomplete users only when called without registration fields, and updates registration fields when provided:

```js
async function upsertUserByOpenid(data) {
  const existing = await prisma.user.findUnique({ where: { openid: data.openid } });
  const payload = {
    username: data.username !== undefined ? data.username : existing && existing.username,
    role: data.role || (existing && existing.role) || 'family',
    termsVersion:
      data.termsVersion !== undefined ? data.termsVersion : existing && existing.termsVersion,
    privacyVersion:
      data.privacyVersion !== undefined ? data.privacyVersion : existing && existing.privacyVersion,
    termsAcceptedAt:
      data.termsAcceptedAt !== undefined ? data.termsAcceptedAt : existing && existing.termsAcceptedAt,
    privacyAcceptedAt:
      data.privacyAcceptedAt !== undefined
        ? data.privacyAcceptedAt
        : existing && existing.privacyAcceptedAt,
    registeredAt: data.registeredAt !== undefined ? data.registeredAt : existing && existing.registeredAt
  };

  if (existing) {
    return withProfileCompleted(
      await prisma.user.update({
        where: { openid: data.openid },
        data: payload
      })
    );
  }

  return withProfileCompleted(
    await prisma.user.create({
      data: {
        id: data.openid === 'openid_demo' ? 'user_demo_001' : undefined,
        openid: data.openid,
        ...payload
      }
    })
  );
}
```

In Prisma `createContribution(data)`, include:

```js
contributorUserId: data.contributorUserId || null,
```

Export `getUserById`.

- [ ] **Step 6: Run failing tests again**

Run:

```powershell
cd D:\code\ksls\server
npm run smoke
npm run test:security
```

Expected: tests still fail because routes are not implemented yet, but schema/store errors should not be the first failure.

- [ ] **Step 7: Commit data layer**

```powershell
cd D:\code\ksls
git add server/prisma/schema.prisma server/prisma/migrations/20260616000000_light_registration/migration.sql server/src/db/memory-store.js server/src/db/prisma-store.js
git commit -m "feat: persist registration acceptance"
```

---

### Task 3: Auth Routes

**Files:**
- Modify: `server/src/routes/auth.routes.js`

- [ ] **Step 1: Add constants and serializers**

At the top of `server/src/routes/auth.routes.js` after `const router = express.Router();`, add:

```js
const CURRENT_TERMS_VERSION = '2026-06-16';
const CURRENT_PRIVACY_VERSION = '2026-06-16';

function publicUser(user) {
  return {
    id: user.id,
    openid: user.openid,
    username: user.username || '',
    role: user.role,
    profileCompleted: Boolean(user.username && user.termsAcceptedAt && user.privacyAcceptedAt),
    termsVersion: user.termsVersion || '',
    privacyVersion: user.privacyVersion || ''
  };
}

function validateUsername(username) {
  const normalized = String(username || '').trim();
  if (normalized.length < 2 || normalized.length > 20) {
    const error = new Error('用户名需为 2-20 个字符');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function assertAcceptedVersions(body) {
  if (body.acceptedTermsVersion !== CURRENT_TERMS_VERSION) {
    const error = new Error('请先阅读并同意当前版本用户协议');
    error.statusCode = 400;
    throw error;
  }
  if (body.acceptedPrivacyVersion !== CURRENT_PRIVACY_VERSION) {
    const error = new Error('请先阅读并同意当前版本隐私政策');
    error.statusCode = 400;
    throw error;
  }
}
```

- [ ] **Step 2: Extract openid resolver**

Add:

```js
async function resolveOpenidFromCode(code) {
  if (env.wechatAppId && env.wechatSecret) {
    if (!code) {
      const error = new Error('微信登录 code 不能为空');
      error.statusCode = 400;
      throw error;
    }
    const session = await code2Session(code);
    if (session.errcode) {
      const error = new Error(`微信登录失败：${session.errmsg}`);
      error.statusCode = 400;
      throw error;
    }
    if (!session.openid) {
      const error = new Error('微信登录响应缺少 openid');
      error.statusCode = 502;
      throw error;
    }
    return session.openid;
  }

  if (env.devAuthBypass) {
    return 'openid_demo';
  }

  const error = new Error('服务端未配置 WECHAT_APPID/WECHAT_SECRET');
  error.statusCode = 503;
  throw error;
}
```

- [ ] **Step 3: Implement register route**

Add before `router.post('/wechat-login', ...)`:

```js
router.post('/register', async (req, res, next) => {
  try {
    const username = validateUsername(req.body.username);
    assertAcceptedVersions(req.body);

    const openid = await resolveOpenidFromCode(req.body.code);
    const now = new Date();
    const user = await store.upsertUserByOpenid({
      openid,
      username,
      role: 'family',
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      registeredAt: now
    });

    res.json({
      user: publicUser(user),
      token: signToken(user)
    });
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 4: Implement me route**

Add:

```js
router.get('/me', async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ message: '未登录' });
      return;
    }
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await store.getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ message: '登录已过期，请重新登录' });
      return;
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 5: Adjust wechat-login**

Replace the openid resolution block inside `router.post('/wechat-login', ...)` with:

```js
const openid = await resolveOpenidFromCode(req.body.code);
let user = await store.getUserByOpenid(openid);
if (!user) {
  user = await store.upsertUserByOpenid({ openid, role: 'family' });
}
if (!user.profileCompleted) {
  res.status(409).json({
    message: '请先完成注册',
    needsRegistration: true
  });
  return;
}

res.json({
  user: publicUser(user),
  token: signToken(user)
});
```

Remove the old duplicate `res.json` at the end of the handler.

- [ ] **Step 6: Run tests**

Run:

```powershell
cd D:\code\ksls\server
npm run smoke
npm run test:security
```

Expected: registration route tests pass; contribution auth tests may still fail until Task 4.

- [ ] **Step 7: Commit auth route**

```powershell
cd D:\code\ksls
git add server/src/routes/auth.routes.js
git commit -m "feat: add light registration API"
```

---

### Task 4: Authenticated Invitation Contributions

**Files:**
- Modify: `server/src/routes/invitations.routes.js`

- [ ] **Step 1: Require auth on contribution submission**

At the top of `server/src/routes/invitations.routes.js`, ensure it imports `requireAuth`:

```js
const { requireAuth } = require('../middleware/auth');
```

Change:

```js
router.post('/:inviteCode/contributions', contributionLimiter, async (req, res) => {
```

to:

```js
router.post('/:inviteCode/contributions', requireAuth, contributionLimiter, async (req, res) => {
```

- [ ] **Step 2: Load current user for contributor defaults**

Inside the contribution route after invitation validation and before `store.createContribution`, add:

```js
const currentUser = await store.getUserById(req.userId);
if (!currentUser || !currentUser.profileCompleted) {
  res.status(403).json({ message: '请先完成注册后再提交共创内容' });
  return;
}
const contributorName = (req.body.contributorName || currentUser.username || invitation.targetName).trim();
if (!contributorName) {
  res.status(400).json({ message: '贡献者名称不能为空' });
  return;
}
```

Update the `store.createContribution` call to include:

```js
contributorUserId: req.userId,
contributorName,
```

and remove the old inline:

```js
contributorName: req.body.contributorName || invitation.targetName,
```

- [ ] **Step 3: Use the same display name for collaborator creation**

In the `store.addThemeCollaborator` block, set:

```js
name: contributorName,
```

instead of the previous fallback expression.

- [ ] **Step 4: Run tests**

Run:

```powershell
cd D:\code\ksls\server
npm run smoke
npm run test:security
```

Expected: both scripts pass.

- [ ] **Step 5: Commit invitation auth**

```powershell
cd D:\code\ksls
git add server/src/routes/invitations.routes.js
git commit -m "feat: require registration for contributions"
```

---

### Task 5: Legal Documents And Shared Legal Text

**Files:**
- Create: `docs/legal/user-agreement.md`
- Create: `docs/legal/privacy-policy.md`
- Create: `miniprogram/utils/legal-content.js`

- [ ] **Step 1: Create legal docs directory**

Run:

```powershell
cd D:\code\ksls
New-Item -ItemType Directory -Force docs\legal | Out-Null
New-Item -ItemType Directory -Force miniprogram\utils | Out-Null
```

- [ ] **Step 2: Write `docs/legal/user-agreement.md`**

Create `docs/legal/user-agreement.md` with the complete draft headed:

```md
# 用户协议

版本生效日期：2026-06-16

欢迎使用本小程序。本小程序用于帮助用户记录家庭回忆、通过语音转文字和人工智能辅助整理故事、邀请亲友共创内容，并导出可保存的回忆文本或书稿。

## 1. 服务内容

1. 本小程序提供家庭成员信息管理、语音录制、语音识别、故事草稿整理、家庭共创邀请、内容校对、书稿导出等功能。
2. 本小程序中的人工智能能力仅用于辅助整理和生成文本，生成结果可能存在不准确、不完整或不符合用户真实意图的情况，用户应自行审核、修改和确认。
3. 本小程序可能根据产品迭代调整功能、页面、服务范围或接入的技术服务。

## 2. 账号注册与使用

1. 用户通过微信小程序登录能力识别身份，并在首次使用时填写用户名。
2. 用户名用于页面展示、协作署名和共创记录，不要求为真实姓名。
3. 用户应妥善使用自己的微信账号，不得冒用他人身份，不得以误导方式填写用户名。
4. 用户不得将账号用于违法、侵权、骚扰、攻击系统或破坏服务稳定性的行为。

## 3. 用户内容

1. 用户通过本小程序上传或生成的录音、照片、文字、故事、共创贡献、书稿等内容，仍归用户或相关权利人所有。
2. 用户应确保自己有权上传、记录、分享和处理相关内容；涉及他人肖像、声音、家庭故事、个人经历或其他个人信息时，应取得相关人员的同意。
3. 用户授权本小程序在提供服务所必需的范围内，对用户内容进行存储、转写、整理、展示、协作分享和导出。
4. 用户不得上传违法、侵权、虚假恶意、侵犯隐私、侮辱诽谤、危害未成年人或违反公序良俗的内容。

## 4. 共创邀请

1. 用户可以将共创邀请链接分享给微信好友。
2. 受邀好友需要完成轻注册并同意本协议和隐私政策后，才能提交共创内容。
3. 受邀好友提交的内容会在邀请对应的主题或故事范围内展示给邀请发起人及相关协作成员。
4. 邀请发起人应确保邀请对象了解共创目的，并避免向无关人员传播包含个人或家庭隐私的邀请链接。

## 5. 隐私与授权

1. 本小程序会按照《隐私政策》处理用户个人信息。
2. 用户使用录音、上传照片、生成故事、邀请共创等功能时，可能涉及本人或他人的个人信息、声音、肖像和家庭经历。
3. 用户在使用涉及他人信息的功能前，应确认已获得必要授权。

## 6. 知识产权

1. 本小程序的页面、程序、交互、标识及相关技术成果归服务提供方或相关权利人所有。
2. 用户不得复制、反向工程、恶意抓取、干扰或未经授权使用本小程序的技术和内容。
3. 用户保留对其合法上传内容的权利，但授权本小程序为提供服务进行必要处理。

## 7. 服务变更、中止与风险提示

1. 本小程序可能因维护、升级、第三方服务异常、网络问题、不可抗力等原因中断或限制部分服务。
2. 用户应自行备份重要内容。本小程序会尽力保障数据安全，但不承诺服务永不中断或数据永不丢失。
3. AI 生成内容、语音识别结果和自动整理结果仅供参考，不构成事实确认、法律意见或其他专业建议。

## 8. 未成年人使用

未成年人应在监护人指导和同意下使用本小程序。监护人应关注未成年人上传、分享和查看的内容。

## 9. 协议更新

本协议可能根据法律法规、监管要求或产品功能变化进行更新。更新后如需要重新取得用户同意，小程序会通过页面提示、弹窗或注册流程等方式告知。

## 10. 联系方式

如对本协议或服务有疑问，可以通过小程序内反馈渠道或运营者公布的联系方式与我们联系。
```

- [ ] **Step 3: Write `docs/legal/privacy-policy.md`**

Create `docs/legal/privacy-policy.md` with the complete draft headed:

```md
# 隐私政策

版本生效日期：2026-06-16

本政策说明本小程序如何收集、使用、存储、共享和保护用户个人信息。请在使用前仔细阅读并确认理解。

## 1. 我们收集的信息

为提供家庭回忆记录和共创服务，我们会在必要范围内收集以下信息：

1. 账号信息：微信登录产生的 openid、用户填写的用户名、注册时间、协议同意版本和同意时间。
2. 家庭成员信息：用户创建的家庭成员姓名、关系、生日或用户主动填写的其他描述。
3. 录音与语音信息：用户主动录制或上传的语音、录音时长、语音识别文本、识别状态。
4. 图片信息：用户主动上传的照片、图片文件名、备注及其关联的故事或会话。
5. 文本内容：用户输入、AI 辅助生成或人工校对的故事、对话、共创贡献、书稿内容。
6. 协作信息：邀请链接、邀请对象称呼、贡献者用户名、贡献内容、提交时间。
7. 技术与日志信息：请求时间、接口状态、错误日志、必要的安全风控记录。

我们不主动要求用户提供手机号、身份证号、真实姓名、精确位置、通讯录等非必要个人信息。

## 2. 权限调用

1. 麦克风权限：仅在用户主动使用录音或实时语音对话功能时调用。
2. 相册或相机权限：仅在用户主动选择或拍摄照片并上传时调用。
3. 微信登录能力：用于识别同一微信用户并维护登录状态。

如用户拒绝相关权限，对应功能可能无法使用，但不影响其他不依赖该权限的功能。

## 3. 信息使用目的

我们使用上述信息用于：

1. 创建和维护用户账号。
2. 保存家庭成员、故事、录音、照片和书稿。
3. 提供语音转文字、AI 辅助整理、实时对话和书稿导出。
4. 支持用户向微信好友分享邀请链接并进行共创。
5. 保障账号安全、排查故障、防止滥用和改进服务体验。
6. 满足法律法规、监管要求或争议处理需要。

## 4. 第三方服务

为实现必要功能，我们可能使用以下第三方或基础服务：

1. 微信小程序平台：用于微信登录、小程序运行、分享能力和基础接口。
2. 腾讯云 CloudBase：用于后端服务部署、数据存储、文件访问和网络服务。
3. 腾讯云语音识别服务：用于将用户主动录制的语音转换为文字。
4. AI 文本服务商：用于根据用户内容辅助整理故事或生成回复。实际接入服务以产品配置为准。

我们会要求相关服务仅在实现功能所需范围内处理数据。

## 5. 信息共享与公开

1. 用户主动分享邀请链接后，收到链接的微信好友可以看到邀请相关信息，并在注册后提交共创内容。
2. 共创内容会在对应主题或故事范围内向邀请发起人及相关协作成员展示。
3. 未经用户主动操作或法律法规要求，我们不会向无关第三方出售或公开用户个人信息。

## 6. 存储与保护

1. 用户信息和内容会存储在后端服务和相关云服务中。
2. 我们会采取访问控制、身份校验、最小必要使用等措施保护数据安全。
3. 用户主动删除家庭成员、故事、录音、照片或书稿时，我们会在合理时间内删除相关数据或使其不可访问。
4. 由于互联网环境并非绝对安全，请用户谨慎上传高度敏感内容，并妥善保管分享链接。

## 7. 用户权利

用户可以在产品功能支持范围内访问、更正、删除自己的内容。用户也可以撤回授权、停止使用相关功能，或通过反馈渠道要求删除账号及相关数据。

## 8. 敏感个人信息提示

录音、照片、家庭故事、健康或人生经历等内容可能包含敏感个人信息。用户上传本人或他人相关内容前，应确认已取得必要授权，并谨慎分享邀请链接。

## 9. 未成年人保护

未成年人应在监护人同意和指导下使用本小程序。监护人如发现未成年人未经同意提供个人信息，可以联系我们处理。

## 10. 政策更新

本政策可能根据法律法规、监管要求或产品功能变化更新。涉及重要变更时，我们会通过页面提示、弹窗或注册流程等方式告知并在必要时重新取得同意。

## 11. 联系方式

如对个人信息处理有疑问、投诉或请求，可以通过小程序内反馈渠道或运营者公布的联系方式与我们联系。
```

- [ ] **Step 4: Create shared legal content module**

Create `miniprogram/utils/legal-content.js`:

```js
const TERMS_VERSION = '2026-06-16';
const PRIVACY_VERSION = '2026-06-16';

const USER_AGREEMENT_TITLE = '用户协议';
const PRIVACY_POLICY_TITLE = '隐私政策';

const USER_AGREEMENT_TEXT = `用户协议

版本生效日期：2026-06-16

欢迎使用本小程序。本小程序用于帮助用户记录家庭回忆、通过语音转文字和人工智能辅助整理故事、邀请亲友共创内容，并导出可保存的回忆文本或书稿。

一、服务内容
1. 本小程序提供家庭成员信息管理、语音录制、语音识别、故事草稿整理、家庭共创邀请、内容校对、书稿导出等功能。
2. 人工智能能力仅用于辅助整理和生成文本，生成结果可能存在不准确、不完整或不符合用户真实意图的情况，用户应自行审核、修改和确认。

二、账号注册与使用
1. 用户通过微信小程序登录能力识别身份，并在首次使用时填写用户名。
2. 用户名用于页面展示、协作署名和共创记录，不要求为真实姓名。
3. 用户不得冒用他人身份，不得上传违法、侵权或侵犯隐私的内容。

三、用户内容与共创邀请
1. 用户通过本小程序上传或生成的录音、照片、文字、故事、共创贡献、书稿等内容，仍归用户或相关权利人所有。
2. 用户应确保自己有权上传、记录、分享和处理相关内容；涉及他人肖像、声音、家庭故事、个人经历或其他个人信息时，应取得相关人员的同意。
3. 用户可以将共创邀请链接分享给微信好友。受邀好友需要完成轻注册并同意本协议和隐私政策后，才能提交共创内容。

四、AI 内容提示
AI 生成或整理的内容仅供参考，不构成事实确认、法律意见或其他专业建议，用户应自行审阅。

五、未成年人使用
未成年人应在监护人指导和同意下使用本小程序。

六、协议更新和联系
本协议可能根据法律法规、监管要求或产品功能变化进行更新。如对本协议或服务有疑问，可以通过小程序内反馈渠道或运营者公布的联系方式与我们联系。`;

const PRIVACY_POLICY_TEXT = `隐私政策

版本生效日期：2026-06-16

本政策说明本小程序如何收集、使用、存储、共享和保护用户个人信息。请在使用前仔细阅读并确认理解。

一、我们收集的信息
1. 账号信息：微信登录产生的 openid、用户填写的用户名、注册时间、协议同意版本和同意时间。
2. 家庭成员信息：用户创建的家庭成员姓名、关系、生日或用户主动填写的其他描述。
3. 录音与语音信息：用户主动录制或上传的语音、录音时长、语音识别文本、识别状态。
4. 图片信息：用户主动上传的照片、图片文件名、备注及其关联的故事或会话。
5. 文本内容：用户输入、AI 辅助生成或人工校对的故事、对话、共创贡献、书稿内容。
6. 协作信息：邀请链接、邀请对象称呼、贡献者用户名、贡献内容、提交时间。
7. 技术与日志信息：请求时间、接口状态、错误日志、必要的安全风控记录。

二、权限调用
麦克风权限仅在用户主动使用录音或实时语音对话功能时调用。相册或相机权限仅在用户主动选择或拍摄照片并上传时调用。微信登录能力用于识别同一微信用户并维护登录状态。

三、使用目的
我们使用信息用于创建和维护用户账号、保存家庭回忆内容、提供语音转文字和 AI 辅助整理、支持邀请共创、导出书稿、保障账号安全和排查故障。

四、第三方服务
本小程序可能使用微信小程序平台、腾讯云 CloudBase、腾讯云语音识别服务和实际接入的 AI 文本服务商。相关服务仅在实现功能所需范围内处理数据。

五、共享与删除
用户主动分享邀请链接后，收到链接的微信好友可以看到邀请相关信息，并在注册后提交共创内容。用户可以在产品功能支持范围内访问、更正、删除自己的内容，也可以通过反馈渠道要求删除账号及相关数据。

六、敏感个人信息提示
录音、照片、家庭故事、健康或人生经历等内容可能包含敏感个人信息。用户上传本人或他人相关内容前，应确认已取得必要授权，并谨慎分享邀请链接。

七、未成年人保护、政策更新和联系
未成年人应在监护人同意和指导下使用本小程序。本政策可能根据法律法规、监管要求或产品功能变化更新。如有疑问、投诉或请求，可以通过小程序内反馈渠道或运营者公布的联系方式与我们联系。`;

module.exports = {
  TERMS_VERSION,
  PRIVACY_VERSION,
  USER_AGREEMENT_TITLE,
  PRIVACY_POLICY_TITLE,
  USER_AGREEMENT_TEXT,
  PRIVACY_POLICY_TEXT
};
```

- [ ] **Step 5: Commit legal content**

```powershell
cd D:\code\ksls
git add docs/legal/user-agreement.md docs/legal/privacy-policy.md miniprogram/utils/legal-content.js
git commit -m "docs: add legal agreement drafts"
```

---

### Task 6: Mini Program Auth Service

**Files:**
- Modify: `miniprogram/services/api.js`
- Create: `miniprogram/services/auth.js`
- Modify: `miniprogram/app.js`

- [ ] **Step 1: Add API methods**

In `miniprogram/services/api.js`, require legal versions:

```js
const LEGAL = require('../utils/legal-content');
```

Add exported methods:

```js
register(username) {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('微信登录失败'));
          return;
        }
        rawRequest('/auth/register', {
          method: 'POST',
          data: {
            code: res.code,
            username,
            acceptedTermsVersion: LEGAL.TERMS_VERSION,
            acceptedPrivacyVersion: LEGAL.PRIVACY_VERSION
          }
        }).then((data) => {
          wx.setStorageSync('token', data.token);
          wx.setStorageSync('user', data.user);
          resolve(data);
        }).catch(reject);
      },
      fail: reject
    });
  });
},
getMe() {
  return request('/auth/me');
},
isRegisteredUser(user) {
  return Boolean(user && user.profileCompleted && user.username);
}
```

Adjust `ensureLogin()` so a `409 needsRegistration` does not loop forever. In the `.catch(reject)` branch after `rawRequest('/auth/wechat-login'...)`, keep the error object and let callers redirect to registration.

- [ ] **Step 2: Create auth guard**

Create `miniprogram/services/auth.js`:

```js
const api = require('./api');

function currentPagePath() {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  if (!page) {
    return '/pages/home/home';
  }
  const route = `/${page.route}`;
  const options = page.options || {};
  const query = Object.keys(options)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
    .join('&');
  return query ? `${route}?${query}` : route;
}

function getStoredUser() {
  try {
    return wx.getStorageSync('user') || null;
  } catch (error) {
    return null;
  }
}

function isRegistered(user) {
  return Boolean(user && user.profileCompleted && user.username);
}

function requireRegistration(redirectPath) {
  const user = getStoredUser();
  if (isRegistered(user)) {
    return Promise.resolve(user);
  }

  const redirect = redirectPath || currentPagePath();
  wx.redirectTo({
    url: `/pages/register/register?redirect=${encodeURIComponent(redirect)}`
  });
  return Promise.reject(new Error('needs registration'));
}

function saveSession(data) {
  wx.setStorageSync('token', data.token);
  wx.setStorageSync('user', data.user);
  const app = getApp();
  app.globalData.token = data.token;
  app.globalData.user = data.user;
}

module.exports = {
  requireRegistration,
  saveSession,
  getStoredUser,
  isRegistered
};
```

- [ ] **Step 3: Stop startup auto-login**

In `miniprogram/app.js`, remove `const api = require('./services/api');`.

Replace `onLaunch()` with:

```js
onLaunch() {
  wx.setInnerAudioOption({
    obeyMuteSwitch: false
  });
  this.globalData.token = wx.getStorageSync('token') || '';
  this.globalData.user = wx.getStorageSync('user') || null;
},
```

Remove the `login()` method entirely.

- [ ] **Step 4: Commit auth service**

```powershell
cd D:\code\ksls
git add miniprogram/services/api.js miniprogram/services/auth.js miniprogram/app.js
git commit -m "feat: add mini program registration guard"
```

---

### Task 7: Registration And Legal Pages

**Files:**
- Create: `miniprogram/pages/register/register.js`
- Create: `miniprogram/pages/register/register.wxml`
- Create: `miniprogram/pages/register/register.wxss`
- Create: `miniprogram/pages/register/register.json`
- Create: `miniprogram/pages/legal/user-agreement.js`
- Create: `miniprogram/pages/legal/user-agreement.wxml`
- Create: `miniprogram/pages/legal/user-agreement.wxss`
- Create: `miniprogram/pages/legal/user-agreement.json`
- Create: `miniprogram/pages/legal/privacy-policy.js`
- Create: `miniprogram/pages/legal/privacy-policy.wxml`
- Create: `miniprogram/pages/legal/privacy-policy.wxss`
- Create: `miniprogram/pages/legal/privacy-policy.json`
- Modify: `miniprogram/app.json`

- [ ] **Step 1: Add pages to app.json**

Add these before existing business pages in `miniprogram/app.json`:

```json
"pages/register/register",
"pages/legal/user-agreement",
"pages/legal/privacy-policy",
```

- [ ] **Step 2: Create registration page JS**

Create `miniprogram/pages/register/register.js`:

```js
const api = require('../../services/api');
const auth = require('../../services/auth');
const LEGAL = require('../../utils/legal-content');

Page({
  data: {
    username: '',
    acceptedTerms: false,
    acceptedPrivacy: false,
    loading: false,
    redirect: '/pages/home/home',
    termsVersion: LEGAL.TERMS_VERSION,
    privacyVersion: LEGAL.PRIVACY_VERSION
  },

  onLoad(options) {
    this.setData({
      redirect: options.redirect ? decodeURIComponent(options.redirect) : '/pages/home/home'
    });
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value });
  },

  toggleTerms(event) {
    this.setData({ acceptedTerms: event.detail.value.length > 0 });
  },

  togglePrivacy(event) {
    this.setData({ acceptedPrivacy: event.detail.value.length > 0 });
  },

  openTerms() {
    wx.navigateTo({ url: '/pages/legal/user-agreement' });
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/legal/privacy-policy' });
  },

  async submit() {
    const username = this.data.username.trim();
    if (username.length < 2 || username.length > 20) {
      wx.showToast({ title: '用户名需为 2-20 个字符', icon: 'none' });
      return;
    }
    if (!this.data.acceptedTerms || !this.data.acceptedPrivacy) {
      wx.showToast({ title: '请先阅读并勾选协议', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const data = await api.register(username);
      auth.saveSession(data);
      wx.redirectTo({ url: this.data.redirect });
    } catch (error) {
      wx.showToast({
        title: error.message || '注册失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});
```

- [ ] **Step 3: Create registration WXML**

Create `miniprogram/pages/register/register.wxml`:

```xml
<view class="page">
  <view class="header">
    <view class="title">开始使用家庭记忆</view>
    <view class="subtitle">只需要填写一个用户名，用于展示和共创署名。</view>
  </view>

  <view class="form">
    <view class="label">用户名</view>
    <input class="input" value="{{username}}" bindinput="onUsernameInput" maxlength="20" placeholder="例如：小明、妈妈、外孙女" />

    <checkbox-group bindchange="toggleTerms" class="check-row">
      <label>
        <checkbox value="terms" checked="{{acceptedTerms}}" />
        <text>我已阅读并同意</text>
      </label>
      <text class="link" bindtap="openTerms">《用户协议》</text>
    </checkbox-group>

    <checkbox-group bindchange="togglePrivacy" class="check-row">
      <label>
        <checkbox value="privacy" checked="{{acceptedPrivacy}}" />
        <text>我已阅读并同意</text>
      </label>
      <text class="link" bindtap="openPrivacy">《隐私政策》</text>
    </checkbox-group>

    <button class="primary-button" loading="{{loading}}" bindtap="submit">同意并开始</button>
  </view>
</view>
```

- [ ] **Step 4: Create registration WXSS**

Create `miniprogram/pages/register/register.wxss`:

```css
.page {
  min-height: 100vh;
  padding: 64rpx 36rpx;
  background: #f0f9ff;
  box-sizing: border-box;
}

.header {
  margin-bottom: 48rpx;
}

.title {
  font-size: 44rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #475569;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.label {
  font-size: 28rpx;
  color: #0f172a;
  font-weight: 600;
}

.input {
  height: 96rpx;
  padding: 0 28rpx;
  border-radius: 20rpx;
  background: #ffffff;
  border: 2rpx solid #bae6fd;
  font-size: 30rpx;
  box-sizing: border-box;
}

.check-row {
  font-size: 26rpx;
  color: #334155;
  line-height: 1.6;
}

.link {
  color: #0369a1;
  font-weight: 600;
}

.primary-button {
  margin-top: 20rpx;
}
```

- [ ] **Step 5: Create page JSON**

Create `miniprogram/pages/register/register.json`:

```json
{
  "navigationBarTitleText": "注册"
}
```

- [ ] **Step 6: Create legal pages**

Create `miniprogram/pages/legal/user-agreement.js`:

```js
const LEGAL = require('../../utils/legal-content');

Page({
  data: {
    title: LEGAL.USER_AGREEMENT_TITLE,
    content: LEGAL.USER_AGREEMENT_TEXT
  }
});
```

Create `miniprogram/pages/legal/privacy-policy.js`:

```js
const LEGAL = require('../../utils/legal-content');

Page({
  data: {
    title: LEGAL.PRIVACY_POLICY_TITLE,
    content: LEGAL.PRIVACY_POLICY_TEXT
  }
});
```

Create both WXML files with:

```xml
<view class="page">
  <view class="title">{{title}}</view>
  <text class="content">{{content}}</text>
</view>
```

Create both WXSS files with:

```css
.page {
  min-height: 100vh;
  padding: 36rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 28rpx;
}

.content {
  display: block;
  white-space: pre-wrap;
  font-size: 28rpx;
  line-height: 1.8;
  color: #334155;
}
```

Create `user-agreement.json`:

```json
{
  "navigationBarTitleText": "用户协议"
}
```

Create `privacy-policy.json`:

```json
{
  "navigationBarTitleText": "隐私政策"
}
```

- [ ] **Step 7: Commit pages**

```powershell
cd D:\code\ksls
git add miniprogram/app.json miniprogram/pages/register miniprogram/pages/legal
git commit -m "feat: add registration legal pages"
```

---

### Task 8: Route Guard Protected Pages And Invitation Flow

**Files:**
- Modify: `miniprogram/pages/invite/invite.js`
- Modify: `miniprogram/pages/home/home.js`
- Modify: `miniprogram/pages/family/family.js`
- Modify: `miniprogram/pages/theme/theme.js`
- Modify: `miniprogram/pages/conversation/conversation.js`
- Modify: `miniprogram/pages/record/record.js`
- Modify: `miniprogram/pages/story/story.js`
- Modify: `miniprogram/pages/family-review/family-review.js`
- Modify: `miniprogram/pages/book/book.js`
- Modify: `miniprogram/pages/chat/chat.js`

- [ ] **Step 1: Update invite page**

In `miniprogram/pages/invite/invite.js`, add:

```js
const auth = require('../../services/auth');
```

At the start of `onLoad(options)`, after setting `code`, add:

```js
try {
  const user = await auth.requireRegistration(`/pages/invite/invite?code=${encodeURIComponent(code)}`);
  if (user && user.username && !this.data.contributorName) {
    this.setData({ contributorName: user.username });
  }
} catch (error) {
  return;
}
```

When invitation data loads, set contributor name to current username first:

```js
const user = auth.getStoredUser();
this.setData({
  invitation: data.invitation,
  theme: data.theme,
  stories: data.stories || [],
  contributorName: this.data.contributorName || (user && user.username) || data.invitation.targetName || ''
});
```

- [ ] **Step 2: Guard protected pages**

For each protected page JS file, add near the top:

```js
const auth = require('../../services/auth');
```

Then add at the beginning of `onLoad`:

```js
try {
  await auth.requireRegistration();
} catch (error) {
  return;
}
```

If a page already has synchronous `onLoad()`, change it to `async onLoad(options)`. Preserve its existing body after the guard.

Do not guard the following pages:

```txt
pages/register/register
pages/legal/user-agreement
pages/legal/privacy-policy
```

- [ ] **Step 3: Commit guards**

```powershell
cd D:\code\ksls
git add miniprogram/pages/invite/invite.js miniprogram/pages/home/home.js miniprogram/pages/family/family.js miniprogram/pages/theme/theme.js miniprogram/pages/conversation/conversation.js miniprogram/pages/record/record.js miniprogram/pages/story/story.js miniprogram/pages/family-review/family-review.js miniprogram/pages/book/book.js miniprogram/pages/chat/chat.js
git commit -m "feat: require light registration in mini program"
```

---

### Task 9: Final Verification And Deployment Notes

**Files:**
- Modify: `docs/api-zzzp-deployment.md`

- [ ] **Step 1: Run backend verification**

Run:

```powershell
cd D:\code\ksls\server
npm run test
```

Expected:

```txt
Smoke test passed
Security test passed
```

- [ ] **Step 2: Verify mini program config**

Run:

```powershell
cd D:\code\ksls
node -e "const c=require('./miniprogram/config.js'); console.log(c); if(c.BASE_URL!=='https://api.zzzp.me/api') process.exit(1); if(c.WS_URL!=='wss://api.zzzp.me/realtime/conversations') process.exit(1);"
```

Expected output contains:

```txt
BASE_URL: 'https://api.zzzp.me/api'
WS_URL: 'wss://api.zzzp.me/realtime/conversations'
```

- [ ] **Step 3: Verify production domain**

Run:

```powershell
cd D:\code\ksls
Invoke-WebRequest -Uri https://api.zzzp.me/health -UseBasicParsing -TimeoutSec 20
```

Expected status:

```txt
200
```

- [ ] **Step 4: Update deployment doc**

Add this exact section to `docs/api-zzzp-deployment.md`:

    ## 账号系统环境变量

    生产环境必须配置：

    ```txt
    WECHAT_APPID=<小程序 AppID>
    WECHAT_SECRET=<小程序密钥>
    JWT_SECRET=<足够长且不可泄露的随机字符串>
    ```

    如果 `NODE_ENV=production` 且未配置 `WECHAT_APPID` / `WECHAT_SECRET`，注册和登录会返回 503，不会回退到演示用户。

- [ ] **Step 5: Commit final docs**

```powershell
cd D:\code\ksls
git add docs/api-zzzp-deployment.md
git commit -m "docs: document account deployment requirements"
```

- [ ] **Step 6: Manual mini program QA**

In WeChat DevTools:

1. Clear storage.
2. Open home page; expected: redirected to registration page.
3. Try submit without username; expected: toast.
4. Try submit without checking both agreements; expected: toast.
5. Open both legal pages; expected: readable content.
6. Register with a 2-20 character username; expected: redirected to home.
7. Open invite link; expected: if registered, invite page loads; if storage cleared, register first and return to invite.
8. Submit contribution; expected: success.
9. Upload development version and test on phone.

---

## Self-Review

- Spec coverage: covered strict light registration, username-only collection, agreement/privacy acceptance records, invited collaborator registration, public invitation detail reads, authenticated contribution submission, legal text, and tests.
- Placeholder scan: no placeholder markers or vague implementation-only steps remain.
- Type consistency: `username`, `profileCompleted`, `termsVersion`, `privacyVersion`, `termsAcceptedAt`, `privacyAcceptedAt`, `registeredAt`, and `contributorUserId` are consistent across API, stores, front-end guard, and tests.
