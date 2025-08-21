/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- DOM Elements ---
const boardElement = document.getElementById('sudoku-board');
const newGameBtn = document.getElementById('new-game-btn');
const solveBtn = document.getElementById('solve-btn');
const hintBtn = document.getElementById('hint-btn');
const memoBtn = document.getElementById('memo-btn');
const statusElement = document.getElementById('status');
const difficultyContainer = document.getElementById('difficulty-selector');
const mistakesElement = document.getElementById('mistakes-count');
const hintsElement = document.getElementById('hints-count');
const loaderOverlay = document.getElementById('loader-overlay');

// --- Game State ---
let currentPuzzle = [];
let currentSolution = [];
let selectedDifficulty = '中級'; // Default difficulty
let mistakes = 0;
let maxMistakesForLevel = 3;
let hintsUsed = 0;
let maxHintsForLevel = 5; // Default max hints
let isGameOver = false;
let isMemoMode = false;
let memoGrid = [];

// --- Sudoku Generation Logic ---

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function isValid(grid, row, col, num) {
    for (let x = 0; x < 9; x++) {
        if (grid[row][x] === num || grid[x][col] === num) {
            return false;
        }
    }
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (grid[i + startRow][j + startCol] === num) {
                return false;
            }
        }
    }
    return true;
}

function fillGrid(grid) {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (grid[i][j] === 0) {
                const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                for (const num of numbers) {
                    if (isValid(grid, i, j, num)) {
                        grid[i][j] = num;
                        if (fillGrid(grid)) {
                            return true;
                        }
                        grid[i][j] = 0; // Backtrack
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function createSudokuPuzzle(difficulty) {
    const solution = Array(9).fill(0).map(() => Array(9).fill(0));
    fillGrid(solution);

    const puzzleGrid = solution.map(row => [...row]);
    
    const cluesMap = { '初級': 40, '中級': 30, '上級': 25, '達人': 20 };
    const clues = cluesMap[difficulty] || 30;
    let cellsToRemove = 81 - clues;

    const cells = Array.from({ length: 81 }, (_, i) => i);
    shuffle(cells);

    for (let i = 0; i < cellsToRemove; i++) {
        const cellIndex = cells[i];
        const row = Math.floor(cellIndex / 9);
        const col = cellIndex % 9;
        puzzleGrid[row][col] = 0;
    }
    
    const puzzleWithNulls = puzzleGrid.map(row => 
        row.map(cell => cell === 0 ? null : cell)
    );

    return { puzzle: puzzleWithNulls, solution };
}

// --- Main Game Functions ---

function updateMemoDisplay(row, col) {
    const memoContainer = boardElement.querySelector(`.memo-grid[data-row='${row}'][data-col='${col}']`);
    if (!memoContainer) return;

    memoContainer.innerHTML = ''; // Clear existing
    const memos = memoGrid[row]?.[col];
    if (!memos) return;

    for (let i = 1; i <= 9; i++) {
        const memoNumDiv = document.createElement('div');
        memoNumDiv.classList.add('memo-number');
        if (memos.has(i)) {
            memoNumDiv.textContent = i.toString();
        }
        memoContainer.appendChild(memoNumDiv);
    }
}

function generateSudoku() {
  setButtonsDisabled(true);
  showLoader(true);
  
  setTimeout(() => {
    mistakes = 0;
    hintsUsed = 0;
    isGameOver = false;
    isMemoMode = false;
    memoBtn.classList.remove('active');
    memoGrid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  
    updateStatus(`「${selectedDifficulty}」レベルのパズルを生成中です...`);
    
    maxHintsForLevel = selectedDifficulty === '達人' ? 3 : 5;
    
    switch (selectedDifficulty) {
        case '初級': maxMistakesForLevel = 5; break;
        case '中級': maxMistakesForLevel = 3; break;
        case '上級': maxMistakesForLevel = 2; break;
        case '達人': maxMistakesForLevel = 0; break;
        default: maxMistakesForLevel = 3;
    }
    
    updateMistakesDisplay();
    updateHintsDisplay();
    
    const { puzzle, solution } = createSudokuPuzzle(selectedDifficulty);
    currentPuzzle = puzzle;
    currentSolution = solution;
    renderBoard();
    updateStatus("新しいパズルができました！");

    setButtonsDisabled(false);
    showLoader(false);
  }, 50);
}

function renderBoard() {
  boardElement.innerHTML = '';
  clearValidation();
  if (!isGameOver) {
      updateStatus("数字を入力してください。");
  }

  currentPuzzle.forEach((row, rowIndex) => {
    row.forEach((cellValue, colIndex) => {
      const cell = document.createElement('div');
      cell.classList.add('cell');

      if (cellValue !== null) {
        cell.textContent = cellValue.toString();
        cell.classList.add('fixed-cell');
        cell.setAttribute('aria-readonly', 'true');
      } else {
        const memoContainer = document.createElement('div');
        memoContainer.classList.add('memo-grid');
        memoContainer.dataset.row = rowIndex.toString();
        memoContainer.dataset.col = colIndex.toString();
        cell.appendChild(memoContainer);

        const input = document.createElement('input');
        input.type = 'number';
        input.classList.add('input-cell');
        input.min = '1';
        input.max = '9';
        input.dataset.row = rowIndex.toString();
        input.dataset.col = colIndex.toString();
        input.setAttribute('aria-label', `セル ${rowIndex + 1}行目 ${colIndex + 1}列目`);
        input.addEventListener('input', handleInput);
        cell.appendChild(input);
      }
      boardElement.appendChild(cell);
    });
  });
}

function handleInput(e) {
    if (isGameOver) return;
    
    const target = e.target;
    const row = parseInt(target.dataset.row);
    const col = parseInt(target.dataset.col);

    if (target.value.length > 1) {
        target.value = target.value.slice(-1);
    }
    const userValue = target.value;

    if (isMemoMode) {
        target.value = ''; // Clear input for next memo
        if (userValue && /^[1-9]$/.test(userValue)) {
            const num = parseInt(userValue);
            const cellMemos = memoGrid[row][col];
            if (cellMemos.has(num)) {
                cellMemos.delete(num);
            } else {
                cellMemos.add(num);
            }
            updateMemoDisplay(row, col);
        }
        return; // End of memo handling
    }

    target.classList.remove('correct', 'incorrect');

    if (userValue === '') {
        updateStatus("数字を入力してください。");
        return;
    }
    
    const num = parseInt(userValue);
    if (num === currentSolution[row][col]) {
        target.classList.add('correct');
        updateStatus("正解です！");
        target.disabled = true;

        if (memoGrid[row][col].size > 0) {
            memoGrid[row][col].clear();
            updateMemoDisplay(row, col);
        }

        checkWinCondition();
    } else {
        target.classList.add('incorrect');
        mistakes++;
        updateMistakesDisplay();
        if (maxMistakesForLevel === 0) {
             handleGameOver();
        } else if (mistakes >= maxMistakesForLevel) {
            handleGameOver();
        } else {
            updateStatus(`不正解です。残り${maxMistakesForLevel - mistakes}回`);
        }
    }
}

function checkWinCondition() {
    const allInputs = Array.from(boardElement.querySelectorAll('.input-cell'));
    const allFilled = allInputs.every(input => input.disabled || input.value !== '');
    const allCorrect = allInputs.every(input => {
        if (input.disabled) return true;
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);
        return parseInt(input.value) === currentSolution[row][col];
    });

    if (allFilled && allCorrect) {
        updateStatus("おめでとうございます！パズルが完成しました！");
        isGameOver = true;
        solveBtn.disabled = true;
        hintBtn.disabled = true;
        memoBtn.disabled = true;
    }
}

function solvePuzzle() {
    clearValidation();
    const inputs = boardElement.querySelectorAll('.input-cell');
    inputs.forEach(input => {
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);
        
        if (memoGrid[row]?.[col]?.size > 0) {
            memoGrid[row][col].clear();
            updateMemoDisplay(row, col);
        }

        input.value = currentSolution[row][col].toString();
        input.disabled = true;
        input.classList.remove('incorrect');
    });
    updateStatus("解答を表示しました。");
    isGameOver = true;
    solveBtn.disabled = true;
    hintBtn.disabled = true;
    memoBtn.disabled = true;
}

function giveHint() {
    if (isGameOver) return;
    if (hintsUsed >= maxHintsForLevel) {
        updateStatus("ヒントをすべて使い切りました。");
        return;
    }

    const emptyInputs = [];
    boardElement.querySelectorAll('.input-cell:not([disabled])').forEach(input => {
        if (!input.value) {
            emptyInputs.push(input);
        }
    });

    if (emptyInputs.length === 0) {
        updateStatus("ヒントを使うための空きマスがありません。");
        return;
    }

    const randomInput = emptyInputs[Math.floor(Math.random() * emptyInputs.length)];
    const row = parseInt(randomInput.dataset.row);
    const col = parseInt(randomInput.dataset.col);
    const solutionValue = currentSolution[row][col];

    randomInput.value = solutionValue.toString();
    randomInput.classList.add('correct');
    randomInput.disabled = true;

    if (memoGrid[row][col].size > 0) {
        memoGrid[row][col].clear();
        updateMemoDisplay(row, col);
    }

    hintsUsed++;
    updateHintsDisplay();
    updateStatus("ヒントを使いました。");

    if (hintsUsed >= maxHintsForLevel) {
        hintBtn.disabled = true;
    }
    checkWinCondition();
}

function clearValidation() {
    const inputs = boardElement.querySelectorAll('.input-cell');
    inputs.forEach(input => {
        input.classList.remove('correct', 'incorrect');
    });
}

function updateStatus(message) {
    statusElement.textContent = message;
}

function setButtonsDisabled(disabled) {
    newGameBtn.disabled = disabled;
    solveBtn.disabled = disabled;
    memoBtn.disabled = disabled;
    hintBtn.disabled = disabled || hintsUsed >= maxHintsForLevel;
    
    const difficultyButtons = difficultyContainer?.querySelectorAll('.difficulty-btn');
    difficultyButtons?.forEach(btn => {
        btn.disabled = disabled;
    });
}

function showLoader(show) {
    loaderOverlay.classList.toggle('hidden', !show);
}

function setupDifficultyControls() {
    if (!difficultyContainer) return;
    
    const buttons = difficultyContainer.querySelectorAll('.difficulty-btn');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            if (newGameBtn.disabled) return;

            const newDifficulty = button.dataset.difficulty;
            if (!newDifficulty || newDifficulty === selectedDifficulty) {
                return;
            }

            selectedDifficulty = newDifficulty;

            buttons.forEach(btn => {
                const isSelected = btn === button;
                btn.classList.toggle('active', isSelected);
                btn.setAttribute('aria-checked', String(isSelected));
            });
            
            generateSudoku();
        });
    });
}

function updateMistakesDisplay() {
    if (mistakesElement) {
        if (maxMistakesForLevel === 0) {
            mistakesElement.textContent = `${mistakes} / 1`;
        } else {
            mistakesElement.textContent = `${mistakes} / ${maxMistakesForLevel}`;
        }
    }
}

function updateHintsDisplay() {
    if (hintsElement) {
        hintsElement.textContent = `${hintsUsed} / ${maxHintsForLevel}`;
    }
}

function handleGameOver() {
    isGameOver = true;
    const message = maxMistakesForLevel > 0 ? `ゲームオーバー！${maxMistakesForLevel}回間違えました。` : `ゲームオーバー！`;
    updateStatus(message);
    hintBtn.disabled = true;
    memoBtn.disabled = true;
    boardElement.querySelectorAll('.input-cell:not(:disabled)').forEach(input => {
        input.disabled = true;
    });
}

function toggleMemoMode() {
    if (isGameOver || newGameBtn.disabled) return;
    isMemoMode = !isMemoMode;
    memoBtn.classList.toggle('active', isMemoMode);
    updateStatus(isMemoMode ? "メモモードがオンです。" : "メモモードがオフです。");
}

function main() {
    setupDifficultyControls();
    newGameBtn.addEventListener('click', generateSudoku);
    solveBtn.addEventListener('click', solvePuzzle);
    hintBtn.addEventListener('click', giveHint);
    memoBtn.addEventListener('click', toggleMemoMode);
    generateSudoku();
}

document.addEventListener('DOMContentLoaded', main);
export {};
