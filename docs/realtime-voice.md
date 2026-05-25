# 实时语音对话与方言识别

## 当前实现

小程序陪聊页已经改为实时语音架构：

- 小程序通过 `RecorderManager.onFrameRecorded` 获取录音帧。
- 小程序通过 WebSocket 把音频帧发给后端。
- 后端 WebSocket 地址：`/realtime/conversations`。
- 后端返回 `asr_partial`、`asr_final` 和 `assistant_reply`。
- 小程序会显示实时识别文本，并在 AI 回复后继续追问。

开发环境默认使用 mock：

```txt
STREAMING_ASR_PROVIDER=mock
STREAMING_TTS_PROVIDER=mock
```

## 生产建议

方言识别建议优先接腾讯云实时 ASR：

```txt
STREAMING_ASR_PROVIDER=tencent
TENCENT_ASR_ENGINE_MODEL_TYPE=16k_zh_large
TENCENT_ASR_DIALECT=auto
```

腾讯云实时 ASR 官方文档说明其 WebSocket 接口支持“边说边出文字”，并支持普通话、粤语和多种中文方言。阿里云智能语音交互也支持实时语音识别和方言/多语种能力，可作为备选 provider。

## 代码位置

- 小程序实时连接：`miniprogram/services/realtime.js`
- 小程序录音帧：`miniprogram/services/recorder.js`
- 陪聊页面：`miniprogram/pages/conversation/conversation.js`
- 后端 WebSocket：`server/src/realtime/conversation-realtime.js`
- 流式 ASR provider：`server/src/services/streaming-asr.service.js`
- 流式 TTS provider：`server/src/services/streaming-tts.service.js`

## WebSocket 协议

客户端发送：

- `start_turn`：开始一轮说话。
- binary audio frame：录音帧。
- `end_turn`：结束一轮说话。

服务端发送：

- `conversation_started`
- `turn_started`
- `asr_partial`
- `asr_final`
- `assistant_reply`
- `error`

