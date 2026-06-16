# CloudBase 云托管部署

这个后端适合部署到 CloudBase 云托管：它是 Express + WebSocket 服务，仓库里已经有 `server/Dockerfile` 和 `server/container.config.json`。

## 为什么要上云

本地访问腾讯实时 ASR 时，腾讯云可能把流量判为跨境调用并返回错误。部署到上海地域的 CloudBase 云托管后，后端在腾讯云内访问腾讯 ASR，实时语音链路更稳定，也不会占用本机资源。

## 部署目录

在 CloudBase 云托管里选择“从源代码部署”时，代码目录请选择：

```txt
server/
```

端口填写：

```txt
3000
```

Dockerfile 使用：

```txt
Dockerfile
```

WebSocket 需要开启。`container.config.json` 已声明：

```json
{
  "containerPort": 3000,
  "servicePath": "/",
  "hasWebSocket": true
}
```

## 云端环境变量

在 CloudBase 服务的环境变量里配置这些值，不要把真实密钥写进代码仓库或镜像：

```txt
PORT=3000
UPLOAD_DIR=uploads
DATA_FILE=data/dev-store.json
LLM_PROVIDER=mock
ASR_PROVIDER=mock
STREAMING_ASR_PROVIDER=tencent
VOICE_PROVIDER=mock
STREAMING_TTS_PROVIDER=mock
REALTIME_WS_PATH=/realtime/conversations

TENCENT_ASR_APP_ID=<your-app-id>
TENCENT_ASR_SECRET_ID=<your-secret-id>
TENCENT_ASR_SECRET_KEY=<your-secret-key>
TENCENT_ASR_REGION=ap-guangzhou
TENCENT_ASR_ENGINE_MODEL_TYPE=16k_zh_large
TENCENT_ASR_DIALECT=auto
```

当前 MVP 可以不配置 `DATABASE_URL`，会使用本地 JSON 存储。这样适合演示，但容器重启后数据可能丢失；正式使用应接入云数据库或托管 PostgreSQL。

## 小程序切到云端

部署完成后，给 CloudBase 云托管绑定一个已备案的自有子域名，例如：

```txt
api.zzzp.me
```

不要使用 `www.zzzp.me`：这个域名已经给 PPT 网站使用，DNS 解析和站点配置都不要改。只新增 `api.zzzp.me` 这一条解析/绑定，不会影响现有 PPT 网站。

更新 `miniprogram/config.js`：

```js
const MODE = 'cloud';
const CLOUD_ENV_ID = '你的环境 ID';
const CLOUD_SERVICE_NAME = '你的服务名';
const CLOUD_REGION = 'ap-shanghai';
const CLOUD_HOST = 'api.zzzp.me';
```

然后在微信公众平台配置服务器域名：

```txt
request 合法域名: https://api.zzzp.me
socket 合法域名: wss://api.zzzp.me
uploadFile 合法域名: https://api.zzzp.me
```

小程序必须使用 `https://` 和 `wss://`，并在微信公众平台配置 request / socket / uploadFile 合法域名。
