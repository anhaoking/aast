# 🎲 爱因斯坦棋 · Einstein Chess

<div align="center">

**基于 Node.js + Socket.IO 的爱因斯坦棋在线对弈平台**

支持人机对战 | 本地双人对战 | 在线联机对战

适用于 [安徽省计算机博弈大赛](https://computer-games.cn/) 及相关棋类 AI 研究

[![GitHub stars](https://img.shields.io/github/stars/anhaoking/aast?style=social)](https://github.com/anhaoking/aast)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D14-green.svg)](https://nodejs.org)

</div>

---

## 📖 项目简介

**爱因斯坦棋**（EinStein würfelt nicht! / Einstein's Dice Chess）是一种使用骰子决定移动的二人策略棋盘游戏。双方各有 6 枚棋子，在 5×5 的棋盘上通过掷骰子的方式决定可移动的棋子编号，目标是将所有棋子移至对方起点区域。

本项目实现了完整的爱因斯坦棋对弈系统，涵盖前端交互界面、后端游戏引擎和实时联机通信，可作为棋类博弈竞赛、AI 算法研究、WebSocket 通信教学等多场景使用。

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🎮 **三种对战模式** | 人机对战（AI 随机策略）、本地人人对战、在线联机匹配对战 |
| 🔴🔵 **随机阵营** | 服务器自动随机分配红蓝双方，确保公平 |
| 🎲 **骰子系统** | 完整骰子机制——掷骰→选子→走棋，规则严谨 |
| 📋 **棋谱导出** | 支持导出完整对局棋谱（含每一步走法详情） |
| 📚 **历史棋谱** | 查询和回放已完结对局，包含完整步列表和终局棋盘 |
| 👥 **用户系统** | 支持账号注册/登录 + 游客编号登录（1~5 号槽位） |
| 🔄 **再来一局** | 联机结束后双方确认即可快速重开对局 |
| ↩️ **悔棋功能** | 本地模式下支持撤销上一步操作 |
| 🌐 **实时通信** | 基于 WebSocket 的低延迟双向通信 |

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 14.x（推荐 18.x LTS）
- **npm** >= 6.x
- 操作系统：Windows / macOS / Linux

### 安装

```bash
# 克隆仓库
git clone https://github.com/anhaoking/aast.git
cd aast

# 安装依赖
npm install
```

### 运行

```bash
# 方式一：npm 命令启动
npm start

# 方式二：Windows 一键启动（双击运行）
start.bat
```

启动后浏览器自动打开 `http://localhost:3000`，即可进入游戏。

---

## 🎯 游戏规则

### 棋盘与棋子

```
       蓝方起点（目标区）
    ┌───┬───┬───┬───┬───┐
  0 │   │   │   │   │   │
    ├───┼───┼───┼───┼───┤
  1 │   │   │   │   │   │
    ├───┼───┼───┼───┼───┤
  2 │   │   │   │   │   │
    ├───┼───┼───┼───┼───┤
  3 │   │   │   │   │   │
    ├───┼───┼───┼───┼───┤
  4 │   │   │   │   │   │
    └───┴───┴───┴───┴───┘
       红方起点（目标区）
```

- **棋盘**：5 行 × 5 列
- **棋子**：红蓝双方各 6 枚，编号 1 ~ 6
- **起始位置**：红方从左侧第 1、2 列出发，蓝方从右侧第 3、4 列出发（可随机排布）

### 走棋规则

1. **掷骰子**：当前回合玩家掷 6 面骰子（点数 1~6）
2. **选子**：必须移动与骰子点数**编号相同**的棋子
3. **方向**：红方向 **→ 右 / ↘ 右下 / ↓ 下** 三个方向移动；蓝方向 **← 左 / ↖ 左上 / ↑ 上** 移动
4. **目标**：将自己的所有棋子移动到**对方起点区域**

### 胜负判定

- ✅ 某一方全部 6 枚棋子到达目标区域 → **立即获胜**
- ❌ 掷骰后对应编号的棋子无合法走法 → **对手获胜**
- ⏱️ 对手断开连接 → **另一方获胜**

---

## 🏗️ 技术架构

```
┌──────────────────────────────────────┐
│            Browser (客户端)           │
│   index.html                         │
│   HTML/CSS/JS + Socket.IO Client     │
└──────────────┬───────────────────────┘
               │ WebSocket
┌──────────────▼───────────────────────┐
│         server.js (服务端)            │
│   Express + Socket.IO                │
│   用户认证 · 配对匹配 · 游戏逻辑      │
└──────┬───────────────────────────────┘
       │
┌──────▼───────┐   ┌─────────────────┐
│  engine.js   │   │   数据持久化     │
│  棋盘 · 规则 │   │  users.json     │
│  胜负判定    │   │  games.json     │
└──────────────┘   └─────────────────┘
```

| 技术层 | 技术选型 | 说明 |
|--------|----------|------|
| 前端 UI | Vanilla HTML/CSS/JS | 零框架依赖，纯原生实现 |
| 实时通信 | Socket.IO | WebSocket 双向通信，低延迟 |
| 后端框架 | Express.js | HTTP API + 静态资源服务 |
| 游戏引擎 | `src/engine.js` | 棋盘初始化、走法验证、胜负判定 |
| 数据存储 | JSON 文件 | `users.json` 用户数据、`games.json` 棋谱归档 |
| 用户认证 | Token 机制 | 基于 crypto 随机 Token 的会话管理 |

---

## 📁 项目结构

```
aast/
├── public/
│   └── index.html       # 完整前端页面（含样式和 WebSocket 客户端）
├── src/
│   └── engine.js        # 核心游戏引擎
├── db/
│   ├── init.sql         # 数据库初始化（可扩展 MySQL/PG）
│   ├── users.json       # 用户数据（运行时生成）
│   └── games.json       # 历史棋谱归档（运行时生成）
├── server.js            # 主服务器（Express + Socket.IO）
├── package.json         # 依赖配置
├── start.bat            # Windows 一键启动
├── .gitignore
└── README.md
```

---

## 🔌 API 接口

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 用户注册 |
| POST | `/api/login` | 用户登录 |
| GET | `/api/me` | Token 验证 & 获取用户信息 |
| GET | `/api/guest-slots` | 查询游客槽位占用状态 |
| GET | `/api/game-records` | 分页查询历史棋谱列表 |
| GET | `/api/game-record/:gameId` | 查询单局棋谱详情 |

### WebSocket 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `register` / `login` / `guest_login` | 客户端→服务端 | 用户认证 |
| `queue_join` / `queue_leave` | 客户端→服务端 | 联机配对 |
| `game_roll_dice` / `game_move` | 客户端→服务端 | 游戏操作 |
| `match_found` / `game_start` | 服务端→客户端 | 对局开始通知 |
| `game_dice` / `game_move_result` | 服务端→客户端 | 游戏状态同步 |
| `game_over` | 服务端→客户端 | 对局结束 |
| `rematch_request` / `rematch_declined` | 双向 | 再来一局 |
| `query_records` / `get_record` | 客户端→服务端 | 历史棋谱查询 |

---

## 🧠 AI 扩展

当前版本 AI 采用**随机策略**（从合法走法中随机选择）。如需接入更强的 AI 算法，可修改 `src/engine.js` 或增加独立的 AI 模块：

```js
// 在 engine.js 中替换随机策略为你的 AI 算法
function aiMove(board, dice, player) {
  const moves = getAllLegalMoves(board, dice, player);
  // 随机选择 → 替换为你的 Minimax / MCTS / 神经网络策略
  return moves[Math.floor(Math.random() * moves.length)];
}
```

---

## 📌 关键词

`爱因斯坦棋` `Einstein Chess` `EinStein würfelt nicht` `棋盘游戏` `博弈大赛` `计算机博弈` `Socket.IO` `Node.js` `实时对战` `WebSocket` `棋类游戏` `在线对弈` `多人游戏` `桌面游戏` `棋类AI`

---

## 📄 License

MIT © 2025

