# 语音转文字 ASR 配置

语音转文字 API 只能配置在后端，不能写进微信小程序代码。小程序代码可以被反编译，ASR 密钥放前端会泄露。

## 配置位置

开发环境配置文件：

```txt
server/.env
```

示例配置文件：

```txt
server/.env.example
```

后端适配代码：

```txt
server/src/services/asr.service.js
```

## 当前默认

当前默认使用 mock：

```txt
ASR_PROVIDER=mock
```

这会返回一段模拟转写文本，方便先开发 UI 和故事整理流程。

## 腾讯云 ASR

把 `server/.env.example` 复制为 `server/.env`，然后设置：

```txt
ASR_PROVIDER=tencent
TENCENT_ASR_SECRET_ID=你的 SecretId
TENCENT_ASR_SECRET_KEY=你的 SecretKey
TENCENT_ASR_APP_ID=你的 AppId
TENCENT_ASR_REGION=ap-guangzhou
```

然后在 `server/src/services/asr.service.js` 的 `transcribeWithTencent` 中接入腾讯云 SDK 或 REST API。

## 阿里云 ASR

```txt
ASR_PROVIDER=aliyun
ALIYUN_ASR_ACCESS_KEY_ID=你的 AccessKeyId
ALIYUN_ASR_ACCESS_KEY_SECRET=你的 AccessKeySecret
ALIYUN_ASR_APP_KEY=你的 AppKey
```

然后在 `server/src/services/asr.service.js` 的 `transcribeWithAliyun` 中接入阿里云 SDK 或 REST API。

## 推荐顺序

MVP 阶段建议先接腾讯云 ASR，原因是微信小程序、腾讯云存储、腾讯云语音识别的链路更顺。

## AI 回答朗读

语音对话除了 ASR，还需要 TTS。当前预留位置：

```txt
server/src/services/speech.service.js
```

小程序陪聊页已经支持：如果后端返回 `assistantMessage.audioUrl`，会自动播放 AI 的语音回答。当前 `VOICE_PROVIDER=mock` 时没有真实音频，只显示文字。
