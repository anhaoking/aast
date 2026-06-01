/**
 * 爱因斯坦棋游戏引擎
 * 
 * 棋盘: 5x5
 * 红方: 编号 1~6（正数），从左上角出发，目标右下角
 * 蓝方: 编号 1~6（负数），从右下角出发，目标左上角
 * 
 * 红方只能向: DOWN, RIGHT, RIGHTDOWN
 * 蓝方只能向: UP, LEFT, LEFTUP
 * 
 * 骰子: 1~6
 * 
 * 胜负:
 * 1. 某方棋子全部到达对方出发区域
 * 2. 某方棋子全部被吃光
 * 3. 某方无法移动（判负）
 */

const BOARD_SIZE = 5;

const DIRECTIONS = {
  UP: [-1, 0],
  DOWN: [1, 0],
  LEFT: [0, -1],
  RIGHT: [0, 1],
  LEFTUP: [-1, -1],
  RIGHTDOWN: [1, 1]
};

const RED_DIRECTIONS = ['DOWN', 'RIGHT', 'RIGHTDOWN'];
const BLUE_DIRECTIONS = ['UP', 'LEFT', 'LEFTUP'];

// 红方初始区域（左上角6格）
const RED_START_ZONE = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [2, 0]];
// 蓝方初始区域（右下角6格，镜像对称）
const BLUE_START_ZONE = [[4, 4], [4, 3], [4, 2], [3, 4], [3, 3], [2, 4]];

// 红方目标: (4,4) — 先到蓝方初始大本营即胜
const RED_TARGET = [[4, 4]];
// 蓝方目标: (0,0) — 先到红方初始大本营即胜
const BLUE_TARGET = [[0, 0]];

function initBoard(redLayout, blueLayout) {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  if (redLayout) {
    for (let k = 0; k < 6; k++) {
      board[redLayout[k][0]][redLayout[k][1]] = k + 1;
    }
  } else {
    board[0][0] = 1;  board[0][1] = 2;  board[0][2] = 3;
    board[1][0] = 4;  board[1][1] = 5;  board[2][0] = 6;
  }
  if (blueLayout) {
    for (let k = 0; k < 6; k++) {
      board[blueLayout[k][0]][blueLayout[k][1]] = -(k + 1);
    }
  } else {
    board[4][4] = -1; board[4][3] = -2; board[4][2] = -3;
    board[3][4] = -4; board[3][3] = -5; board[2][4] = -6;
  }
  return board;
}

function initEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function initDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function isRed(piece) {
  return piece > 0;
}

function isBlue(piece) {
  return piece < 0;
}

function pieceNum(piece) {
  return Math.abs(piece);
}

function findPiece(board, piece) {
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === piece) return [i, j];
    }
  }
  return null;
}

function getMovablePiece(board, dice, player) {
  const targetAbs = dice;
  const targetPiece = player === 1 ? targetAbs : -targetAbs;

  if (findPiece(board, targetPiece)) return targetPiece;

  if (player === 1) {
    for (let offset = 1; offset <= 6; offset++) {
      const up = targetAbs + offset;
      const down = targetAbs - offset;
      if (up <= 6 && findPiece(board, up)) return up;
      if (down >= 1 && findPiece(board, down)) return down;
    }
  } else {
    for (let offset = 1; offset <= 6; offset++) {
      const up = -(targetAbs + offset);
      const down = -(targetAbs - offset);
      if (up >= -6 && findPiece(board, up)) return up;
      if (down <= -1 && findPiece(board, down)) return down;
    }
  }
  return null;
}

function getLegalDirections(piece) {
  if (isRed(piece)) return RED_DIRECTIONS;
  if (isBlue(piece)) return BLUE_DIRECTIONS;
  return [];
}

function validateMove(board, dice, piece, direction, player) {
  const pos = findPiece(board, piece);
  if (!pos) {
    return { valid: false, message: '棋子不存在' };
  }

  if (player === 1 && !isRed(piece)) {
    return { valid: false, message: '这不是你的棋子（红方）' };
  }
  if (player === 2 && !isBlue(piece)) {
    return { valid: false, message: '这不是你的棋子（蓝方）' };
  }

  const legalDirs = getLegalDirections(piece);
  if (!legalDirs.includes(direction)) {
    return { valid: false, message: `该棋子不能向 ${direction} 方向移动` };
  }

  const [dx, dy] = DIRECTIONS[direction];
  const [x, y] = pos;
  const nx = x + dx;
  const ny = y + dy;

  if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
    return { valid: false, message: '移动超出棋盘边界' };
  }

  const movablePiece = getMovablePiece(board, dice, player);
  if (movablePiece !== piece) {
    return { valid: false, message: `当前骰子(${dice})不可移动该棋子，请移动棋子${pieceNum(movablePiece)}` };
  }

  return { valid: true };
}

function applyMove(board, piece, direction) {
  const newBoard = board.map(row => [...row]);
  const pos = findPiece(newBoard, piece);
  if (!pos) return newBoard;
  const [x, y] = pos;
  const [dx, dy] = DIRECTIONS[direction];
  const nx = x + dx;
  const ny = y + dy;
  newBoard[x][y] = 0;
  newBoard[nx][ny] = piece;
  return newBoard;
}

function checkWin(board) {
  let redAlive = 0, blueAlive = 0;

  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      const piece = board[i][j];
      if (isRed(piece)) {
        redAlive++;
        if (i === 4 && j === 4) return { gameOver: true, winner: 1, message: '红方先到达(4,4)，红方获胜！' };
      }
      if (isBlue(piece)) {
        blueAlive++;
        if (i === 0 && j === 0) return { gameOver: true, winner: 2, message: '蓝方先到达(0,0)，蓝方获胜！' };
      }
    }
  }

  if (redAlive === 0) return { gameOver: true, winner: 2, message: '红方棋子全部被吃，蓝方获胜！' };
  if (blueAlive === 0) return { gameOver: true, winner: 1, message: '蓝方棋子全部被吃，红方获胜！' };

  return { gameOver: false, winner: 0, message: '' };
}

function getAllLegalMoves(board, dice, player) {
  const moves = [];
  const piece = getMovablePiece(board, dice, player);
  if (!piece) return moves;

  const pos = findPiece(board, piece);
  if (!pos) return moves;

  const [x, y] = pos;
  const legalDirs = getLegalDirections(piece);

  for (const dir of legalDirs) {
    const [dx, dy] = DIRECTIONS[dir];
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      moves.push({ piece, direction: dir, nx, ny });
    }
  }
  return moves;
}

function hasLegalMove(board, dice, player) {
  return getAllLegalMoves(board, dice, player).length > 0;
}

module.exports = {
  initBoard,
  initEmptyBoard,
  initDice,
  findPiece,
  isRed,
  isBlue,
  pieceNum,
  getMovablePiece,
  getLegalDirections,
  validateMove,
  applyMove,
  checkWin,
  getAllLegalMoves,
  hasLegalMove,
  BOARD_SIZE,
  DIRECTIONS,
  RED_DIRECTIONS,
  BLUE_DIRECTIONS,
  RED_START_ZONE,
  BLUE_START_ZONE,
  RED_TARGET,
  BLUE_TARGET
};
