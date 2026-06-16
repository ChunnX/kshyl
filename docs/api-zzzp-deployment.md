# api.zzzp.me 生产部署记录

本文记录当前小程序后端的生产访问方式，后续开发、排障、交接时优先看这里。

## 域名分工

`www.zzzp.me` 已经用于 PPT 网站，不要修改 `www.zzzp.me` 的 DNS、证书、Nginx 或站点配置。

小程序后端使用独立子域名：

```txt
api.zzzp.me
```

当前后端访问方式：

```txt
HTTP API:  https://api.zzzp.me/api
WebSocket: wss://api.zzzp.me/realtime/conversations
Health:    https://api.zzzp.me/health
```

## 云端服务

后端服务部署在腾讯云 CloudBase 云托管：

```txt
环境 ID: kshyl-d9gikdvfc6102c4a9
服务名: express-bth9
地域: ap-shanghai
服务端口: 3000
WebSocket: 开启
```

小程序配置文件：

```txt
miniprogram/config.js
```

当前关键配置：

```js
const MODE = 'cloud';
const CLOUD_ENV_ID = 'kshyl-d9gikdvfc6102c4a9';
const CLOUD_SERVICE_NAME = 'express-bth9';
const CLOUD_REGION = 'ap-shanghai';
const CLOUD_HOST = 'api.zzzp.me';
```

## 微信小程序后台配置

微信公众平台进入：

```txt
开发 -> 开发管理 -> 开发设置 -> 服务器域名
```

必须配置以下三项：

```txt
request 合法域名:    https://api.zzzp.me
socket 合法域名:     wss://api.zzzp.me
uploadFile 合法域名: https://api.zzzp.me
```

只填协议加域名，不要填 `/api` 或 `/realtime/conversations`。

## 账号系统环境变量

生产环境必须配置：

```txt
WECHAT_APPID=<小程序 AppID>
WECHAT_SECRET=<小程序密钥>
JWT_SECRET=<足够长且不可泄露的随机字符串>
```

如果 `NODE_ENV=production` 且未配置 `WECHAT_APPID` / `WECHAT_SECRET`，注册和登录会返回 503，不会回退到演示用户。

## 验证命令

验证小程序配置：

```powershell
node -e "const c=require('./miniprogram/config.js'); console.log(c); if(c.BASE_URL!=='https://api.zzzp.me/api') process.exit(1); if(c.WS_URL!=='wss://api.zzzp.me/realtime/conversations') process.exit(1);"
```

验证 HTTP：

```powershell
Invoke-WebRequest -Uri https://api.zzzp.me/health -UseBasicParsing -TimeoutSec 20
```

期望返回：

```json
{"ok":true,"service":"memory-miniapp-server"}
```
