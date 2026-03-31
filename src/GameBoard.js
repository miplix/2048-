// GameBoard — логика сетки, слияния, проверка конца игры
export class GameBoard {
  constructor(size, spawnSystem, currencyManager, upgradeSystem, achievementSystem) {
    this.size = size;
    this.spawnSystem = spawnSystem;
    this.currency = currencyManager;
    this.upgrades = upgradeSystem;
    this.achievements = achievementSystem;

    this.grid = [];
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('bestScore') || '0', 10);
    this.goal = 2048;
    this.mergeCount = 0;       // счётчик слияний для авто-удаления
    this.autoDeleteCharge = false;
    this.secondHeartUsed = false; // сброс за сессию

    this._prevGrid = null;
    this._prevScore = 0;

    this._listeners = { move: [], gameOver: [], win: [], autoCharge: [] };
    this._init();
  }

  on(event, fn) {
    if (this._listeners[event]) this._listeners[event].push(fn);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }

  _init() {
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.score = 0;
    this.goal = 2048;
    this.mergeCount = 0;
    this.autoDeleteCharge = false;
    this._prevGrid = null;
    this._prevScore = 0;
    this._spawnTile();
    this._spawnTile();
  }

  reset() {
    this._init();
    this._emit('move', this._state());
  }

  _state() {
    return {
      grid: this.grid.map(r => [...r]),
      score: this.score,
      bestScore: this.bestScore,
      goal: this.goal,
      size: this.size,
      autoDeleteCharge: this.autoDeleteCharge,
    };
  }

  _emptyCell() {
    const cells = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++)
        if (this.grid[r][c] === 0) cells.push([r, c]);
    return cells;
  }

  _spawnTile() {
    const empty = this._emptyCell();
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    this.grid[r][c] = this.spawnSystem.getSpawnValue();
  }

  // Сохранить состояние для undo
  _saveState() {
    this._prevGrid = this.grid.map(r => [...r]);
    this._prevScore = this.score;
  }

  undo(currency) {
    if (!this._prevGrid) return false;
    if (!currency.spend(40)) return false;
    this.grid = this._prevGrid.map(r => [...r]);
    this.score = this._prevScore;
    this._prevGrid = null;
    this._emit('move', this._state());
    return true;
  }

  // Основной ход: direction = 'left'|'right'|'up'|'down'
  move(direction) {
    this._saveState();
    const rotated = this._rotateToLeft(direction);
    let moved = false;
    let mergedThisMove = [];

    for (let r = 0; r < this.size; r++) {
      const { row, didMove, merges } = this._slideLeft(rotated[r]);
      if (didMove) moved = true;
      rotated[r] = row;
      mergedThisMove.push(...merges);
    }

    if (!moved) {
      this._prevGrid = null; // нет хода — не сохраняем
      return false;
    }

    this.grid = this._rotateFromLeft(direction, rotated);

    // Начисляем монеты и обновляем счёт
    for (const value of mergedThisMove) {
      this.score += value;
      this.currency.awardMerge(value);
      this.mergeCount++;

      // Авто-удаление
      const autoLvl = this.upgrades.getAutoDeleteLevel();
      if (autoLvl > 0) {
        const threshold = [20, 15, 10][autoLvl - 1];
        if (this.mergeCount % threshold === 0) {
          this.autoDeleteCharge = true;
          this._emit('autoCharge', true);
        }
      }

      // Достижения
      this.achievements.notifyTileReached(value);
    }

    // Обновляем рекорд
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('bestScore', this.bestScore);
    }

    // Проверяем цель
    const maxTile = Math.max(...this.grid.flat());
    if (maxTile >= this.goal) {
      // Разблокируем апгрейд шансов при первом достижении 2048
      if (this.goal === 2048 && !this.upgrades.isSpawnUnlocked()) {
        this.upgrades.unlockSpawn();
      }
      this.goal *= 2;
      this._emit('win', this.goal / 2);
    }

    this._spawnTile();
    this._emit('move', this._state());

    // Проверяем конец игры
    if (this._isGameOver()) {
      this._emit('gameOver', this._state());
    }

    return true;
  }

  _slideLeft(row) {
    const filtered = row.filter(v => v !== 0);
    const merged = [];
    const merges = [];
    let i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const val = filtered[i] * 2;
        merged.push(val);
        merges.push(val);
        i += 2;
      } else {
        merged.push(filtered[i]);
        i++;
      }
    }
    while (merged.length < row.length) merged.push(0);
    const didMove = merged.some((v, idx) => v !== row[idx]);
    return { row: merged, didMove, merges };
  }

  // Поворачиваем сетку так, чтобы всегда применять slideLeft
  _rotateToLeft(direction) {
    const g = this.grid;
    const n = this.size;
    if (direction === 'left') return g.map(r => [...r]);
    if (direction === 'right') return g.map(r => [...r].reverse());
    if (direction === 'up') {
      return Array.from({ length: n }, (_, c) => Array.from({ length: n }, (__, r) => g[r][c]));
    }
    // down
    return Array.from({ length: n }, (_, c) => Array.from({ length: n }, (__, r) => g[n - 1 - r][c]));
  }

  _rotateFromLeft(direction, rotated) {
    const n = this.size;
    if (direction === 'left') return rotated.map(r => [...r]);
    if (direction === 'right') return rotated.map(r => [...r].reverse());
    if (direction === 'up') {
      return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (__, c) => rotated[c][r]));
    }
    // down
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (__, c) => rotated[c][n - 1 - r]));
  }

  _isGameOver() {
    if (this._emptyCell().length > 0) return false;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const v = this.grid[r][c];
        if (c + 1 < this.size && this.grid[r][c + 1] === v) return false;
        if (r + 1 < this.size && this.grid[r + 1][c] === v) return false;
      }
    }
    return true;
  }

  // Удалить плитку по координатам
  deleteTile(r, c) {
    if (this.grid[r][c] === 0) return false;
    this.grid[r][c] = 0;
    this._emit('move', this._state());
    return true;
  }

  // Использовать заряд авто-удаления
  useAutoDelete(r, c) {
    if (!this.autoDeleteCharge) return false;
    if (this.grid[r][c] === 0) return false;
    this.grid[r][c] = 0;
    this.autoDeleteCharge = false;
    this._emit('autoCharge', false);
    this._emit('move', this._state());
    return true;
  }

  // Продолжение после поражения: удалить 2 плитки
  continueAfterDeath(currency) {
    if (!currency.spend(120)) return false;
    return true; // UI переходит в режим выбора 2 плиток
  }

  useSecondHeart() {
    if (!this.upgrades.hasSecondHeart()) return false;
    if (this.secondHeartUsed) return false;
    this.secondHeartUsed = true;
    return true; // UI переходит в режим выбора 1 плитки
  }

  getState() { return this._state(); }
}
