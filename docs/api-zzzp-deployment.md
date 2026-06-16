# api.zzzp.me 生产部署记录

本文记录当前小程序后端的生产访问方式，后续开发、排障、交接时优先看这里。

## 域名分工

`www.zzzp.me` 已经用于 PPT 网站，当前解析到阿里云服务器：

```txt
www.zzzp.me -> 8.160.171.131
```

不要修改 `www.zzzp.me` 的 DNS、证书、Nginx 或站点配置。

小程序后端使用独立子域名：

```txt
api.zzzp.me
```

当前 DNS 解析：

```txt
api.zzzp.me CNAME api.zzzp.me.tcbaccess.tencentcloudbase.com
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

## CloudBase 自定义域名

CloudBase 自定义域名绑定：

```txt
域名: api.zzzp.me
协议: HTTPS
证书: api.zzzp.me 对应 SSL 证书
路由: / -> 云托管服务 express-bth9
```

不要把 `www.zzzp.me` 绑定到 CloudBase。`www` 保持给 PPT 网站使用。

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

注意：

- 只填协议加域名，不要填 `/api` 或 `/realtime/conversations`。
- `socket 合法域名` 必须是 `wss://api.zzzp.me`，否则录音页会显示实时连接失败。
- 修改服务器域名后，重新打开微信开发者工具并重新编译/上传开发版或体验版。

## 账号系统环境变量

生产环境必须配置：

```txt
WECHAT_APPID=<小程序 AppID>
WECHAT_SECRET=<小程序密钥>
JWT_SECRET=<足够长且不可泄露的随机字符串>
```

如果 `NODE_ENV=production` 且未配置 `WECHAT_APPID` / `WECHAT_SECRET`，注册和登录会返回 503，不会回退到演示用户。

## 验证命令

在本机验证 DNS：

```powershell
Resolve-DnsName api.zzzp.me
Resolve-DnsName www.zzzp.me
```

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

验证 WebSocket：

```powershell
@'
const WebSocket = require('./server/node_modules/ws');
const url = 'wss://api.zzzp.me/realtime/conversations?personId=person_demo_001&mode=dialogue&dialect=auto';
const ws = new WebSocket(url, { handshakeTimeout: 15000 });
ws.on('open', () => console.log('open'));
ws.on('message', data => {
  console.log(data.toString());
  ws.close();
});
ws.on('error', err => {
  console.error(err.message);
  process.exit(1);
});
'@ | node -
```

期望收到 `conversation_started`。

## “开发版”和“实时连接失败”

打开小程序时显示“开发版”是微信自己的版本标识，说明你现在打开的是开发版二维码或开发者工具上传的开发版。它不代表部署失败。要给同事稳定测试，可以上传为体验版并添加体验成员；正式对外则需要提交审核并发布。

如果录音页显示“实时连接失败”，按顺序检查：

1. 微信公众平台是否配置了 `socket 合法域名: wss://api.zzzp.me`。
2. 微信开发者工具是否重新编译，并上传了包含 `CLOUD_HOST = 'api.zzzp.me'` 的最新代码。
3. 手机上是否打开了最新开发版/体验版，而不是旧二维码。
4. CloudBase 自定义域名路由是否是 `/ -> express-bth9`，并且开启 WebSocket。
5. 用上面的 WebSocket 验证命令确认云端是否能返回 `conversation_started`。

如果本机 WebSocket 能通，但手机小程序失败，优先检查微信后台合法域名和当前打开的小程序版本。
