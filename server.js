const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const engine = require('./src/engine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 数据存储（内存 + 文件） ====================
const DB_FILE = path.join(__dirname, 'db', 'users.json');
const RECORDS_FILE = path.join(__dirname, 'db', 'games.json');
let userDB = { users: {} }; // username -> { password, token, wins, losses, games }
let gameRecordsDB = { records: [] }; // 已完结对局棋谱归档

function loadUsers() {
  try { if (fs.existsSync(DB_FILE)) userDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch(e) { console.log('用户数据读取失败，使用空数据'); }
}
function saveUsers() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(userDB, null, 2), 'utf8'); }
  catch(e) { console.log('用户数据保存失败'); }
}
function loadGameRecords() {
  try { if (fs.existsSync(RECORDS_FILE)) gameRecordsDB = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8')); }
  catch(e) { console.log('棋谱数据读取失败，使用空数据'); }
}
function saveGameRecords() {
  try { fs.writeFileSync(RECORDS_FILE, JSON.stringify(gameRecordsDB, null, 2), 'utf8'); }
  catch(e) { console.log('棋谱数据保存失败'); }
}
loadUsers();
loadGameRecords();

// token -> username 映射
const sessions = new Map();

// 配对队列: [{ socketId, username, queuedAt }]
let matchQueue = [];

// 活跃对局: gameId -> { id, redSocket, blueSocket, redName, blueName, board, dice, currentPlayer, diceRolled, firstPlayer, redLayout, blueLayout, moveHistory, startedAt, status:'active'|'finished', winner, winReason, rematchRequests:Set }
const activeGames = new Map();

// ==================== 工具函数 ====================
function genToken() {
  return crypto.randomBytes(24).toString('hex');
}

function gameId() {
  return crypto.randomBytes(4).toString('hex');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getUsername(socketId) {
  return sessions.get(socketId) || null;
}

// ==================== REST API ====================

// 注册
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, msg: '用户名和密码不能为空' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ ok: false, msg: '用户名2~20个字符' });
  if (password.length < 4) return res.status(400).json({ ok: false, msg: '密码至少4个字符' });
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) return res.status(400).json({ ok: false, msg: '用户名只能包含字母、数字、下划线、中文' });
  if (userDB.users[username]) return res.status(400).json({ ok: false, msg: '用户名已存在' });

  userDB.users[username] = { password, wins: 0, losses: 0, games: 0, createdAt: new Date().toISOString() };
  saveUsers();
  res.json({ ok: true, msg: '注册成功！' });
});

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, msg: '请输入用户名和密码' });
  const user = userDB.users[username];
  if (!user || user.password !== password) return res.status(400).json({ ok: false, msg: '用户名或密码错误' });

  const token = genToken();
  sessions.set(token, username);
  res.json({ ok: true, token, username, stats: { wins: user.wins || 0, losses: user.losses || 0, games: user.games || 0 } });
});

// 查询游客槽位状态
app.get('/api/guest-slots', (req, res) => {
  const slots = [];
  for (let i = 1; i <= GUEST_SLOTS; i++) {
    const info = guestSlots.get(i);
    slots.push({ slot: i, name: `游客${i}`, occupied: !!info, occupiedBy: info?.username || null });
  }
  res.json({ ok: true, slots });
});

// Token 验证
app.get('/api/me', (req, res) => {
  const token = req.query.token || req.headers['x-token'];
  const username = sessions.get(token);
  if (!username) return res.status(401).json({ ok: false, msg: '未登录' });
  const user = userDB.users[username];
  res.json({ ok: true, username, stats: { wins: user.wins || 0, losses: user.losses || 0, games: user.games || 0 } });
});

// 查询历史棋谱（REST 分页）
app.get('/api/game-records', (req, res) => {
  const token = req.query.token || req.headers['x-token'];
  const username = sessions.get(token);
  if (!username) return res.status(401).json({ ok: false, msg: '未登录' });

  const page = parseInt(req.query.page) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize) || 10, 50);

  // 筛选该用户参与的对局
  let myRecords = gameRecordsDB.records.filter(r =>
    r.redName === username || r.blueName === username
  );
  // 按时间倒序
  myRecords.sort((a, b) => new Date(b.endedAt || b.startedAt) - new Date(a.endedAt || a.startedAt));

  const total = myRecords.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = myRecords.slice(start, start + pageSize).map(r => ({
    gameId: r.gameId,
    redName: r.redName,
    blueName: r.blueName,
    winner: r.winner,
    winReason: r.winReason,
    winnerName: r.winnerName,
    totalSteps: r.moveHistory ? r.moveHistory.filter(m => m.type === 'move').length : 0,
    startedAt: r.startedAt,
    endedAt: r.endedAt
  }));

  res.json({ ok: true, page, pageSize, total, totalPages, records: items });
});

// 查询单局棋谱详情
app.get('/api/game-record/:gameId', (req, res) => {
  const token = req.query.token || req.headers['x-token'];
  const username = sessions.get(token);
  if (!username) return res.status(401).json({ ok: false, msg: '未登录' });

  const gid = req.params.gameId;
  const record = gameRecordsDB.records.find(r => r.gameId === gid);
  if (!record) return res.status(404).json({ ok: false, msg: '棋谱不存在' });
  // 仅允许对局参与者查看
  if (record.redName !== username && record.blueName !== username) {
    return res.status(403).json({ ok: false, msg: '无权查看此棋谱' });
  }
  res.json({ ok: true, record });
});

// ==================== WebSocket 事件处理 ====================

// 游客槽位管理: 5 个固定编号 1~5
const GUEST_SLOTS = 5;
const guestSlots = new Map(); // slotNumber -> { socketId, username, occupiedAt }

io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id} 已连接`);

  // --- 注册/登录 ---
  socket.on('register', (data, callback) => {
    const { username, password } = data || {};
    if (!username || !password) return callback?.({ ok: false, msg: '用户名和密码不能为空' });
    if (username.length < 2 || username.length > 20) return callback?.({ ok: false, msg: '用户名2~20字符' });
    if (password.length < 4) return callback?.({ ok: false, msg: '密码至少4个字符' });
    if (userDB.users[username]) return callback?.({ ok: false, msg: '用户名已存在' });

    userDB.users[username] = { password, wins: 0, losses: 0, games: 0, createdAt: new Date().toISOString() };
    saveUsers();

    const token = genToken();
    sessions.set(token, username);
    socket.username = username;
    callback?.({ ok: true, token, username, stats: { wins: 0, losses: 0, games: 0 } });
  });

  socket.on('login', (data, callback) => {
    const { username, password } = data || {};
    if (!username || !password) return callback?.({ ok: false, msg: '请输入用户名和密码' });
    const user = userDB.users[username];
    if (!user || user.password !== password) return callback?.({ ok: false, msg: '用户名或密码错误' });

    const token = genToken();
    sessions.set(token, username);
    socket.username = username;
    callback?.({ ok: true, token, username, stats: { wins: user.wins || 0, losses: user.losses || 0, games: user.games || 0 } });
  });

  // 游客登录（选择编号 1~5）
  socket.on('guest_login', (data, callback) => {
    const slot = parseInt(data?.slot);
    if (!slot || slot < 1 || slot > GUEST_SLOTS) return callback?.({ ok: false, msg: '请选择有效的游客编号 (1~5)' });

    // 检查槽位是否已被占用（连接的 socket 仍在线）
    const existing = guestSlots.get(slot);
    if (existing) {
      const s = io.sockets.sockets.get(existing.socketId);
      if (s && s.connected) {
        return callback?.({ ok: false, msg: `游客${slot}已被占用，请选择其他编号` });
      }
      // 原 socket 已断开，清理旧记录
      guestSlots.delete(slot);
    }

    const guestName = `游客${slot}`;
    const token = genToken();
    sessions.set(token, guestName);
    socket.username = guestName;
    guestSlots.set(slot, { socketId: socket.id, username: guestName, occupiedAt: Date.now() });
    console.log(`[游客] ${guestName} 上线 (槽位#${slot})`);
    callback?.({ ok: true, token, username: guestName, stats: { wins: 0, losses: 0, games: 0 }, isGuest: true, slot });
  });

  socket.on('auth_token', (data, callback) => {
    const { token } = data || {};
    const username = sessions.get(token);
    if (!username) return callback?.({ ok: false, msg: '登录已过期' });
    socket.username = username;
    const user = userDB.users[username];
    if (user) {
      callback?.({ ok: true, username, token, stats: { wins: user.wins || 0, losses: user.losses || 0, games: user.games || 0 } });
    } else {
      // 游客账户（不在 users.json 中）
      callback?.({ ok: true, username, token, stats: { wins: 0, losses: 0, games: 0 }, isGuest: true });
    }
  });

  // --- 历史棋谱查询 ---
  socket.on('query_records', (data, callback) => {
    const username = socket.username || getUsername(data?.token);
    if (!username) return callback?.({ ok: false, msg: '请先登录' });

    const page = parseInt(data?.page) || 1;
    const pageSize = Math.min(parseInt(data?.pageSize) || 10, 50);

    let myRecords = gameRecordsDB.records.filter(r =>
      r.redName === username || r.blueName === username
    );
    myRecords.sort((a, b) => new Date(b.endedAt || b.startedAt) - new Date(a.endedAt || a.startedAt));

    const total = myRecords.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = myRecords.slice(start, start + pageSize).map(r => ({
      gameId: r.gameId,
      redName: r.redName,
      blueName: r.blueName,
      winner: r.winner,
      winReason: r.winReason,
      winnerName: r.winnerName,
      totalSteps: r.moveHistory ? r.moveHistory.filter(m => m.type === 'move').length : 0,
      startedAt: r.startedAt,
      endedAt: r.endedAt
    }));

    callback?.({ ok: true, page, pageSize, total, totalPages, records: items });
  });

  socket.on('get_record', (data, callback) => {
    const username = socket.username || getUsername(data?.token);
    if (!username) return callback?.({ ok: false, msg: '请先登录' });

    const gid = data?.gameId;
    if (!gid) return callback?.({ ok: false, msg: '请指定对局ID' });

    const record = gameRecordsDB.records.find(r => r.gameId === gid);
    if (!record) return callback?.({ ok: false, msg: '棋谱不存在' });
    if (record.redName !== username && record.blueName !== username) {
      return callback?.({ ok: false, msg: '无权查看此棋谱' });
    }
    callback?.({ ok: true, record });
  });

  // --- 配对 ---
  socket.on('queue_join', (data, callback) => {
    const username = socket.username || getUsername(data?.token);
    if (!username) return callback?.({ ok: false, msg: '请先登录' });
    socket.username = username;

    // 检查是否已在队列
    if (matchQueue.find(m => m.socketId === socket.id)) return callback?.({ ok: false, msg: '已在配对队列中' });

    matchQueue.push({ socketId: socket.id, username, queuedAt: Date.now() });
    socket.emit('queue_status', { status: 'waiting', position: matchQueue.length });
    console.log(`[配对] ${username} 加入队列 (${matchQueue.length}人)`);

    callback?.({ ok: true, msg: '正在寻找对手...' });

    // 尝试配对
    tryMatch();
  });

  socket.on('queue_leave', () => {
    const username = socket.username;
    // 从配对队列移除
    matchQueue = matchQueue.filter(m => m.socketId !== socket.id);
    // 如果已匹配但未开局，清理活跃对局
    if (username) {
      for (const [gid, game] of activeGames) {
        if (game.redName === username || game.blueName === username) {
          const opponentSide = game.redName === username ? 'blue' : 'red';
          const opponentSocket = game.redName === username ? game.blueSocket : game.redSocket;
          io.to(opponentSocket).emit('game_over', {
            msg: `对手(${username})取消了对局`,
            winner: opponentSide === 'red' ? 1 : 2,
            reason: '对手取消对局'
          });
          activeGames.delete(gid);
          console.log(`[取消对局] ${gid}: ${username} 取消匹配`);
        }
      }
    }
    socket.emit('queue_status', { status: 'cancelled' });
  });

  // --- 游戏操作 ---
  socket.on('game_roll_dice', (data, callback) => {
    const username = socket.username;
    if (!username) return callback?.({ ok: false, msg: '未登录' });

    const gid = data?.gameId;
    const game = activeGames.get(gid);
    if (!game) return callback?.({ ok: false, msg: '对局不存在' });
    if (game.status === 'finished') return callback?.({ ok: false, msg: '对局已结束' });

    // 确定玩家阵营
    const mySide = game.redName === username ? 1 : (game.blueName === username ? 2 : null);
    if (!mySide) return callback?.({ ok: false, msg: '你不是此对局的玩家' });
    if (game.currentPlayer !== mySide) return callback?.({ ok: false, msg: '还没轮到你' });
    if (game.diceRolled) return callback?.({ ok: false, msg: '已投过骰子了' });

    game.dice = Math.floor(Math.random() * 6) + 1;
    game.diceRolled = true;
    game.moveHistory.push({ type:'dice', dice: game.dice, player: mySide });

    // 广播骰子结果
    io.to(game.redSocket).emit('game_dice', { gameId: gid, dice: game.dice, player: mySide, currentPlayer: game.currentPlayer });
    io.to(game.blueSocket).emit('game_dice', { gameId: gid, dice: game.dice, player: mySide, currentPlayer: game.currentPlayer });

    // 检查是否有可走棋
    const hasMoves = engine.hasLegalMove(game.board, game.dice, game.currentPlayer);
    if (!hasMoves) {
      const winner = mySide === 1 ? 2 : 1;
      endGame(gid, winner, `(${mySide===1?'红':'蓝'}方)无棋可走`);
      return;
    }

    callback?.({ ok: true, dice: game.dice });
  });

  socket.on('game_move', (data, callback) => {
    const username = socket.username;
    if (!username) return callback?.({ ok: false, msg: '未登录' });

    const { gameId: gid, piece, direction } = data || {};
    const game = activeGames.get(gid);
    if (!game) return callback?.({ ok: false, msg: '对局不存在' });
    if (game.status === 'finished') return callback?.({ ok: false, msg: '对局已结束' });

    const mySide = game.redName === username ? 1 : (game.blueName === username ? 2 : null);
    if (!mySide) return callback?.({ ok: false, msg: '你不是此对局的玩家' });
    if (game.currentPlayer !== mySide) return callback?.({ ok: false, msg: '还没轮到你' });
    if (!game.diceRolled) return callback?.({ ok: false, msg: '请先投骰子' });

    // 服务端验证
    const validation = engine.validateMove(game.board, game.dice, piece, direction, mySide);
    if (!validation.valid) return callback?.({ ok: false, msg: validation.message });

    // 执行移动
    const result = engine.applyMove(game.board, piece, direction);
    game.board = result;
    game.moveHistory.push({ type:'move', piece, direction, dice: game.dice, player: mySide });

    // 检查胜负
    const winResult = engine.checkWin(result);

    // 切换回合（如果未结束）
    if (!winResult.gameOver) {
      game.currentPlayer = mySide === 1 ? 2 : 1;
      game.diceRolled = false;
      game.dice = 0;
    }

    // 广播移动 + 最新状态
    const syncData = {
      gameId: gid, piece, direction, board: result,
      dice: game.dice, player: mySide,
      currentPlayer: game.currentPlayer,
      diceRolled: game.diceRolled,
      gameOver: winResult.gameOver,
      winner: winResult.winner,
      msg: winResult.message
    };
    io.to(game.redSocket).emit('game_move_result', syncData);
    io.to(game.blueSocket).emit('game_move_result', syncData);

    if (winResult.gameOver) {
      endGame(gid, winResult.winner, winResult.message);
      callback?.({ ok: true, gameOver: true, winner: winResult.winner, msg: winResult.message });
    } else {
      callback?.({ ok: true });
    }
  });

  // --- 再来一局 ---
  socket.on('rematch_request', (data, callback) => {
    const username = socket.username;
    if (!username) return callback?.({ ok: false, msg: '未登录' });

    const gid = data?.gameId;
    const game = activeGames.get(gid);
    if (!game) return callback?.({ ok: false, msg: '对局不存在' });
    if (game.status !== 'finished') return callback?.({ ok: false, msg: '对局未结束' });
    if (game.redName !== username && game.blueName !== username) return callback?.({ ok: false, msg: '你不是此对局的玩家' });

    game.rematchRequests.add(username);

    if (game.rematchRequests.size >= 2) {
      // 双方都同意 → 开始新对局
      startRematchGame(gid, game);
      callback?.({ ok: true, msg: '双方同意，新对局开始！' });
    } else {
      // 通知对方"对手请求再来一局"
      const opponentSocket = game.redName === username ? game.blueSocket : game.redSocket;
      io.to(opponentSocket).emit('rematch_requested', { gameId: gid, from: username });
      callback?.({ ok: true, msg: '已发送再来一局请求，等待对手同意' });
    }
  });

  socket.on('rematch_decline', (data, callback) => {
    const username = socket.username;
    if (!username) return callback?.({ ok: false, msg: '未登录' });

    const gid = data?.gameId;
    const game = activeGames.get(gid);
    if (!game) return callback?.({ ok: false, msg: '对局不存在' });
    if (game.redName !== username && game.blueName !== username) return callback?.({ ok: false, msg: '你不是此对局的玩家' });

    const opponentSocket = game.redName === username ? game.blueSocket : game.redSocket;
    io.to(opponentSocket).emit('rematch_declined', { gameId: gid, from: username, msg: `对手(${username})拒绝了再来一局` });
    activeGames.delete(gid);
    console.log(`[再来一局] ${gid}: ${username} 拒绝，对局清理`);
    callback?.({ ok: true });
  });

  socket.on('game_leave', () => {
    const username = socket.username;
    if (!username) return;

    // 找到玩家所在的对局
    for (const [gid, game] of activeGames) {
      if (game.redName === username || game.blueName === username) {
        if (game.status === 'finished') {
          // 已结束但对手可能在等再来一局 → 通知并清理
          const opponentSocket = game.redName === username ? game.blueSocket : game.redSocket;
          const opponentName = game.redName === username ? game.blueName : game.redName;
          io.to(opponentSocket).emit('rematch_declined', { gameId: gid, from: username, msg: `对手(${username})已离开` });
          activeGames.delete(gid);
          console.log(`[离开] ${gid}: ${username} 离开(已结束对局)`);
        } else {
          // 活跃对局 → 对手获胜
          const opponentSide = game.redName === username ? 'blue' : 'red';
          const opponentSocket = game.redName === username ? game.blueSocket : game.redSocket;
          io.to(opponentSocket).emit('game_over', { msg: '对手已离开', winner: opponentSide === 'red' ? 1 : 2, reason: '对手断开连接' });
          activeGames.delete(gid);
          console.log(`[离开] ${gid}: ${username} 离开(活跃对局)`);
        }
      }
    }
    // 从配对队列移除
    matchQueue = matchQueue.filter(m => m.socketId !== socket.id);
  });

  // --- 断开连接 ---
  socket.on('disconnect', () => {
    console.log(`[断开] ${socket.id} (${socket.username || '未登录'})`);

    // 释放游客槽位
    for (const [slot, info] of guestSlots) {
      if (info.socketId === socket.id) {
        guestSlots.delete(slot);
        console.log(`[游客] 释放槽位 #${slot}`);
        break;
      }
    }

    // 从配对队列移除
    matchQueue = matchQueue.filter(m => m.socketId !== socket.id);

    // 处理活跃对局
    const username = socket.username;
    for (const [gid, game] of activeGames) {
      if (game.redName === username || game.blueName === username) {
        if (game.status === 'finished') {
          const opponentSocket = game.redName === username ? game.blueSocket : game.redSocket;
          const opponentName = game.redName === username ? game.blueName : game.redName;
          io.to(opponentSocket).emit('rematch_declined', { gameId: gid, from: username, msg: `对手(${username})已断开连接` });
          activeGames.delete(gid);
        } else {
          const opponentSide = game.redName === username ? 'blue' : 'red';
          const opponentSocket = game.redName === username ? game.blueSocket : game.redSocket;
          io.to(opponentSocket).emit('game_over', { msg: '对手已断开连接', winner: opponentSide === 'red' ? 1 : 2, reason: '对手断开连接' });
          activeGames.delete(gid);
        }
      }
    }
  });
});

// ==================== 配对逻辑 ====================
function tryMatch() {
  while (matchQueue.length >= 2) {
    const p1 = matchQueue.shift();
    const p2 = matchQueue.shift();
    if (!p1 || !p2) break;

    // 检查两个玩家是否都还在线
    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);
    if (!s1) { matchQueue.unshift(p2); continue; }
    if (!s2) { matchQueue.unshift(p1); continue; }

    // 创建对局（使用随机排布确保双方一致）
    const redLayout = shuffle(engine.RED_START_ZONE.map(p => [...p]));
    const blueLayout = shuffle(engine.BLUE_START_ZONE.map(p => [...p]));
    const gid = gameId();
    const board = engine.initBoard(redLayout, blueLayout);
    const dice = 0;

    // 随机分配红蓝方
    const redFirst = Math.random() < 0.5;
    const redSocket = redFirst ? p1.socketId : p2.socketId;
    const blueSocket = redFirst ? p2.socketId : p1.socketId;
    const redName = redFirst ? p1.username : p2.username;
    const blueName = redFirst ? p2.username : p1.username;

    // 随机先手: 1=红先, 2=蓝先
    const firstPlayer = Math.random() < 0.5 ? 1 : 2;

    const game = {
      id: gid,
      redSocket, blueSocket,
      redName, blueName,
      board,
      dice,
      diceRolled: false,
      currentPlayer: firstPlayer,
      firstPlayer,
      redLayout,
      blueLayout,
      moveHistory: [],
      startedAt: Date.now(),
      status: 'active'
    };

    activeGames.set(gid, game);
    console.log(`[对局] ${gid}: 红=${redName} 蓝=${blueName} | ${firstPlayer===1?'红':'蓝'}方先手`);

    // 通知双方
    io.to(redSocket).emit('match_found', { gameId: gid, side: 1, opponent: blueName });
    io.to(blueSocket).emit('match_found', { gameId: gid, side: 2, opponent: redName });

    // 游戏开始
    const startData = { gameId: gid, board, currentPlayer: firstPlayer, firstPlayer, redLayout, blueLayout };
    io.to(redSocket).emit('game_start', { ...startData, side: 1, opponent: blueName });
    io.to(blueSocket).emit('game_start', { ...startData, side: 2, opponent: redName });

    // 清除等待状态
    io.to(redSocket).emit('queue_status', { status: 'matched' });
    io.to(blueSocket).emit('queue_status', { status: 'matched' });
  }
}

// ==================== 对局结束 ====================
function endGame(gid, winner, reason) {
  const game = activeGames.get(gid);
  if (!game) return;

  const winnerName = winner === 1 ? game.redName : game.blueName;
  const loserName = winner === 1 ? game.blueName : game.redName;

  // 更新战绩
  if (userDB.users[winnerName]) {
    userDB.users[winnerName].wins = (userDB.users[winnerName].wins || 0) + 1;
    userDB.users[winnerName].games = (userDB.users[winnerName].games || 0) + 1;
  }
  if (userDB.users[loserName]) {
    userDB.users[loserName].losses = (userDB.users[loserName].losses || 0) + 1;
    userDB.users[loserName].games = (userDB.users[loserName].games || 0) + 1;
  }
  saveUsers();

  // 归档棋谱到文件
  gameRecordsDB.records.push({
    gameId: gid,
    redName: game.redName,
    blueName: game.blueName,
    winner,
    winnerName,
    winReason: reason,
    redLayout: game.redLayout,
    blueLayout: game.blueLayout,
    firstPlayer: game.firstPlayer,
    moveHistory: game.moveHistory ? [...game.moveHistory] : [],
    finalBoard: game.board ? game.board.map(r => [...r]) : [],
    startedAt: new Date(game.startedAt).toISOString(),
    endedAt: new Date().toISOString()
  });
  saveGameRecords();

  // 标记为已结束（不删除，供再来一局使用）
  game.status = 'finished';
  game.winner = winner;
  game.winReason = reason;
  game.rematchRequests = new Set();

  io.to(game.redSocket).emit('game_over', { gameId: gid, msg: reason, winner, winnerName });
  io.to(game.blueSocket).emit('game_over', { gameId: gid, msg: reason, winner, winnerName });

  console.log(`[对局结束] ${gid}: ${reason}, 胜者=${winnerName}`);
}

// ==================== 再来一局 ====================
function startRematchGame(gid, oldGame) {
  // 新对局使用新的随机参数
  const redLayout = shuffle(engine.RED_START_ZONE.map(p => [...p]));
  const blueLayout = shuffle(engine.BLUE_START_ZONE.map(p => [...p]));
  const newGid = gameId();
  const board = engine.initBoard(redLayout, blueLayout);
  const firstPlayer = Math.random() < 0.5 ? 1 : 2;

  const newGame = {
    id: newGid,
    redSocket: oldGame.redSocket, blueSocket: oldGame.blueSocket,
    redName: oldGame.redName, blueName: oldGame.blueName,
    board,
    dice: 0,
    diceRolled: false,
    currentPlayer: firstPlayer,
    firstPlayer,
    redLayout,
    blueLayout,
    moveHistory: [],
    startedAt: Date.now(),
    status: 'active'
  };

  activeGames.set(newGid, newGame);

  // 清理旧对局（双方已确认再来一局）
  activeGames.delete(gid);

  console.log(`[再来一局] ${gid} → ${newGid}: 红=${oldGame.redName} 蓝=${oldGame.blueName} | ${firstPlayer===1?'红':'蓝'}方先手`);

  const startData = { gameId: newGid, board, currentPlayer: firstPlayer, firstPlayer, redLayout, blueLayout };
  io.to(oldGame.redSocket).emit('game_start', { ...startData, side: 1, opponent: oldGame.blueName, isRematch: true });
  io.to(oldGame.blueSocket).emit('game_start', { ...startData, side: 2, opponent: oldGame.redName, isRematch: true });
}

// ==================== 启动服务器 ====================
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`========================================`);
  console.log(`  爱因斯坦棋服务器运行在 ${url}`);
  console.log(`  支持: 人机/人人/联机对战`);
  console.log(`========================================`);

  const platform = process.platform;
  let cmd;
  if (platform === 'win32') cmd = `start ${url}`;
  else if (platform === 'darwin') cmd = `open ${url}`;
  else cmd = `xdg-open ${url}`;
  exec(cmd);
});
