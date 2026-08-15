// Deterministic Sudoku generator. Given the same cycleId + difficulty,
// every player gets the exact same puzzle — no server-side puzzle storage
// needed.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isSafe(grid, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === num) return false;
    if (grid[i][col] === num) return false;
  }
  const br = row - (row % 3);
  const bc = col - (col % 3);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[br + r][bc + c] === num) return false;
    }
  }
  return true;
}

function findEmpty(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
}

function fillGrid(grid, rng) {
  const spot = findEmpty(grid);
  if (!spot) return true;
  const [r, c] = spot;
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  for (const n of nums) {
    if (isSafe(grid, r, c, n)) {
      grid[r][c] = n;
      if (fillGrid(grid, rng)) return true;
      grid[r][c] = 0;
    }
  }
  return false;
}

function countSolutions(grid, limit) {
  const spot = findEmpty(grid);
  if (!spot) return 1;
  const [r, c] = spot;
  let count = 0;
  for (let n = 1; n <= 9; n++) {
    if (isSafe(grid, r, c, n)) {
      grid[r][c] = n;
      count += countSolutions(grid, limit - count);
      grid[r][c] = 0;
      if (count >= limit) return count;
    }
  }
  return count;
}

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

const DIFFICULTY_GIVENS = { easy: 40, medium: 32, hard: 26 };

// Turns a cycleId (string, from a BigInt) plus a difficulty label into a
// stable 32-bit seed.
function seedFrom(cycleIdText, salt) {
  const s = cycleIdText + ":" + salt;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generatePuzzle(cycleIdText, difficulty) {
  const solvedRng = mulberry32(seedFrom(cycleIdText, "solve"));
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillGrid(solution, solvedRng);

  const removalRng = mulberry32(seedFrom(cycleIdText, "remove:" + difficulty));
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9]),
    removalRng
  );

  const puzzle = cloneGrid(solution);
  const targetGivens = DIFFICULTY_GIVENS[difficulty] || 32;
  let givens = 81;

  for (const [r, c] of positions) {
    if (givens <= targetGivens) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    const check = cloneGrid(puzzle);
    const solutions = countSolutions(check, 2);
    if (solutions === 1) {
      givens -= 1;
    } else {
      puzzle[r][c] = backup;
    }
  }

  return { puzzle, solution };
}

export function isGridComplete(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return false;
    }
  }
  return true;
}

export function gridMatches(grid, solution) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}
