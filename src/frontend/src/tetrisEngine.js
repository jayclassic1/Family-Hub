// Pure Tetris game logic — no React, no rendering. A classic 10x20 board
// with 7-bag randomization, basic wall-kick rotation, ghost-piece
// projection, and standard-ish scoring.

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

const PIECES = {
  I: { cells: [[1, 0], [1, 1], [1, 2], [1, 3]], color: "#4dd9ec" },
  O: { cells: [[1, 1], [1, 2], [2, 1], [2, 2]], color: "#f2d94e" },
  T: { cells: [[1, 1], [2, 0], [2, 1], [2, 2]], color: "#b15ce0" },
  S: { cells: [[1, 1], [1, 2], [2, 0], [2, 1]], color: "#6fd66f" },
  Z: { cells: [[1, 0], [1, 1], [2, 1], [2, 2]], color: "#e0605c" },
  J: { cells: [[1, 0], [2, 0], [2, 1], [2, 2]], color: "#5c7fe0" },
  L: { cells: [[1, 2], [2, 0], [2, 1], [2, 2]], color: "#f0a03c" },
};

const PIECE_TYPES = Object.keys(PIECES);

function rotateCells(cells, times) {
  let result = cells;
  for (let i = 0; i < times; i++) {
    result = result.map(([r, c]) => [c, 3 - r]);
  }
  return result;
}

function make7Bag() {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function createEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

export function refillQueue(queue) {
  const next = [...queue];
  if (next.length < 7) {
    next.push(...make7Bag());
  }
  return next;
}

export function spawnPiece(type) {
  return { type, rotation: 0, row: 0, col: 3 };
}

function getCells(piece) {
  return rotateCells(PIECES[piece.type].cells, piece.rotation % 4);
}

export function getPieceColor(type) {
  return PIECES[type].color;
}

function collides(board, piece, rowOffset = 0, colOffset = 0) {
  const cells = getCells(piece);
  for (const [r, c] of cells) {
    const boardRow = piece.row + r + rowOffset;
    const boardCol = piece.col + c + colOffset;
    if (boardCol < 0 || boardCol >= BOARD_WIDTH || boardRow >= BOARD_HEIGHT) return true;
    if (boardRow >= 0 && board[boardRow][boardCol]) return true;
  }
  return false;
}

export function isGameOver(board, piece) {
  return collides(board, piece, 0, 0);
}

export function tryMove(board, piece, dRow, dCol) {
  if (!collides(board, piece, dRow, dCol)) {
    return { ...piece, row: piece.row + dRow, col: piece.col + dCol };
  }
  return null;
}

export function tryRotate(board, piece) {
  if (piece.type === "O") return piece;
  const rotated = { ...piece, rotation: (piece.rotation + 1) % 4 };
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    if (!collides(board, rotated, 0, k)) {
      return { ...rotated, col: rotated.col + k };
    }
  }
  return null;
}

export function hardDropRow(board, piece) {
  let dropRow = piece.row;
  while (!collides(board, { ...piece, row: dropRow + 1 })) {
    dropRow++;
  }
  return dropRow;
}

export function getGhostPiece(board, piece) {
  return { ...piece, row: hardDropRow(board, piece) };
}

export function lockPiece(board, piece) {
  const newBoard = board.map((row) => [...row]);
  for (const [r, c] of getCells(piece)) {
    const boardRow = piece.row + r;
    const boardCol = piece.col + c;
    if (boardRow >= 0 && boardRow < BOARD_HEIGHT) {
      newBoard[boardRow][boardCol] = piece.type;
    }
  }
  return newBoard;
}

export function clearLines(board) {
  const remaining = board.filter((row) => row.some((cell) => cell === null));
  const clearedCount = BOARD_HEIGHT - remaining.length;
  const newRows = Array.from({ length: clearedCount }, () => Array(BOARD_WIDTH).fill(null));
  return { board: [...newRows, ...remaining], linesCleared: clearedCount };
}

export function scoreForLines(count, level) {
  const base = [0, 100, 300, 500, 800][count] || 0;
  return base * (level + 1);
}

export function levelForLines(totalLines) {
  return Math.floor(totalLines / 10);
}

export function speedForLevel(level) {
  return Math.max(100, 1000 - level * 75);
}

export function pieceCells(piece) {
  return getCells(piece).map(([r, c]) => [piece.row + r, piece.col + c]);
}
