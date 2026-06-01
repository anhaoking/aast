/**
 * 爱因斯坦棋 AI 引擎
 * 使用 Minimax + Alpha-Beta 剪枝 + 评估函数
 * 棋子: 正数=红方1~6, 负数=蓝方1~6
 */

const {
  getAllLegalMoves,
  applyMove,
  checkWin,
  isRed,
  isBlue,
  pieceNum,
  RED_TARGET,
  BLUE_TARGET,
  BOARD_SIZE
} = require('./engine');

const MAX_DEPTH = 3;

function evaluate(board, player) {
  let score = 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      const piece = board[i][j];
      if (piece === 0) continue;

      const num = pieceNum(piece);
      if (isRed(piece)) {
        const dist = Math.max(Math.abs(i - 4), Math.abs(j - 4));
        const val = (6 - num + 1) * (5 - dist);
        score += player === 1 ? val : -val;
      }
      if (isBlue(piece)) {
        const dist = Math.max(i, j);
        const val = (6 - num + 1) * (5 - dist);
        score += player === 2 ? val : -val;
      }
    }
  }
  return score;
}

function simulateDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function minimax(board, depth, alpha, beta, isMaximizing, player, dice) {
  const winResult = checkWin(board);
  if (winResult.gameOver) {
    return winResult.winner === player ? 100000 + depth : -100000 - depth;
  }
  if (depth === 0) {
    return evaluate(board, player);
  }

  const currentPlayer = isMaximizing ? player : (player === 1 ? 2 : 1);
  const currentDice = isMaximizing ? dice : simulateDice();
  const moves = getAllLegalMoves(board, currentDice, currentPlayer);

  if (moves.length === 0) {
    return currentPlayer === player ? -100000 - depth : 100000 + depth;
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move.piece, move.direction);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, false, player, simulateDice());
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move.piece, move.direction);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, true, player, simulateDice());
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getAIMove(board, dice, player) {
  const moves = getAllLegalMoves(board, dice, player);
  if (moves.length === 0) {
    return { piece: 0, direction: '', message: 'AI 无棋可走' };
  }
  if (moves.length === 1) {
    return { piece: moves[0].piece, direction: moves[0].direction };
  }

  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const newBoard = applyMove(board, move.piece, move.direction);
    const score = minimax(newBoard, MAX_DEPTH, -Infinity, Infinity, false, player, simulateDice());
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return { piece: bestMove.piece, direction: bestMove.direction };
}

module.exports = { getAIMove, evaluate };
