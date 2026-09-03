# 萌兽德扑（Critter Hold'em）

萌系多人德州扑克派对游戏，面向手机体验设计。支持最多 10 名玩家、单人 AI、观战、断线后 AI 接管，以及经典模式和技能模式。

## 功能概览

- 创建和加入多人房间
- 德州扑克发牌、下注、街道推进、摊牌和底池结算
- AI 玩家与掉线玩家接管
- 经典规则和动物技能模式
- 基于 Socket.IO 的实时房间状态同步

## 技术栈

- Next.js 15、React 19、TypeScript
- 自定义 Node HTTP 服务
- Socket.IO / Socket.IO Client
- Tailwind CSS 4

## 项目结构

```text
src/
├── app/                 Next.js 页面入口、布局和全局样式
├── components/          大厅、牌桌、玩家、弹窗和技能 UI
└── lib/                 类型、Socket 客户端、状态同步、牌力和会话

server/
├── index.ts             HTTP、Next.js 和 Socket.IO 服务入口
├── room-manager.ts      房间生命周期、玩家、断线和广播协调
├── games/texas-holdem/  德州扑克引擎、牌堆、AI 和牌力计算
├── games/skill-mode/    动物技能运行时
└── persistence/         房间快照与进程内 Repository

scripts/                 集成冒烟测试
public/                  卡牌、动物和 Logo 等静态资源
docs/                    技能模式与布局缩放规范文档
```

## 布局与多机型适配

页面在一个固定 440px 宽（iPhone 17 Pro Max）的设计舞台内编写，再整体等比缩放到真实屏幕，所有机型上的构图保持一致。修改任何布局或尺寸前请先阅读 [docs/layout-scaling.md](docs/layout-scaling.md)。

## 本地开发

安装依赖并启动开发服务：

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。使用两个浏览器窗口（或一个普通窗口和一个无痕窗口）即可测试联机房间。

房间状态保存在当前进程内存中。服务重启后，进行中的房间不会保留。部署时请保持单实例，避免多个副本各自持有不同房间。

## 生产运行

```bash
npm run build
npm start
```

## 核心架构

```text
页面与组件
  → Socket.IO 客户端
  → server/index.ts
  → RoomManager
  → 德州扑克引擎 / 技能运行时
  → 进程内房间状态
  → room_state / room_patch 广播
```

房间状态通过修订号 `rev` 同步。客户端要求 Patch 连续；检测到修订号跳跃时，会重新执行完整重连以恢复状态。

## 测试与检查

```bash
npm run lint
npm run test:engine
npm run test:rooms
npm run test:room-sync
npm run test:layout
npm run test:stage
npm run test:cards
npm run test:reveal
npm run test:equity
npm run build
```
