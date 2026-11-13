# 萌兽德扑

2–8 人经典德州扑克，使用第一人称 3D 熊猫与小猪牌桌。房主可以添加机器人，牌局开始后可通过邀请码观战。真人行动不限时，断线 12 秒后由 AI 接管，重连后恢复操作。每手结束后暂停 5 秒。

## 开发

需要 Go 1.25+、Node.js 22.12+和 npm。

```bash
npm ci
go run ./server
```

另开终端启动 Vite。

```bash
npm run dev
```

打开 http://localhost:5173。Vite 将 `/ws` 转发给 3000 端口上的 Go 服务。用独立的浏览器窗口或无痕窗口测试不同玩家。

## 生产

```bash
npm ci
npm run build
go build -o bin/critter-holdem ./server
./bin/critter-holdem
```

从项目根目录启动后，Go 同时提供 `dist/` 中的网页和 `/ws` 游戏连接，默认监听 3000 端口。可通过 `PORT` 和 `STATIC_DIR` 覆盖。容器使用仓库内的 Dockerfile。反向代理需要转发 WebSocket Upgrade，并保留请求的 Host。

## 结构

- `src/components/` 包含 React 大厅和牌桌操作界面。
- `src/lib/panda3d/` 包含 Three.js 牌桌、熊猫和小猪的共享动作控制、座位和筹码布局。桌面画布保持 440 × 780 的设计尺寸，由外层 440px 设计舞台统一缩放。
- `server/poker/` 包含洗牌、行动校验、街道推进、摊牌和边池结算。
- `server/` 管理房间、连接和 AI 调度。不同房间可并发处理，同一房间顺序更新。
- `/ws` 使用 JSON。请求带 `id`，服务端用 `reply` 确认，并发送按观看者裁剪的 `state` 快照。下注请求附带行动版本 `turn`，防止迟到的请求作用于后续轮次。

房间状态保存在 Go 进程内存中。房间连续 2 小时无人连接时自动清理。重启会清空正在进行的房间，当前部署方式为单实例。

## 验证

```bash
go test -race ./...
npm test
npm run build
# 启动 Go 服务后运行
npm run test:integration
```
