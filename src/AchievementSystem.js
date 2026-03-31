// AchievementSystem — отслеживание рекордов, начисление наград
export class AchievementSystem {
  // Базовые награды для первых плиток
  static BASE_REWARDS = {
    128: 20, 256: 26, 512: 33, 1024: 41, 2048: 50,
    4096: 55, 8192: 61, 16384: 67, 32768: 73,
  };

  constructor() {
    this._load();
    this._listeners = [];
  }

  _load() {
    const raw = localStorage.getItem('achievements');
    const defaults = {
      currentGoal: 128,       // текущая активная цель
      pendingClaim: false,    // есть ли награда для сбора
      collected: [],          // список собранных плиток
      maxReached: 0,          // максимальная достигнутая плитка
    };
    this._data = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  }

  _save() {
    localStorage.setItem('achievements', JSON.stringify(this._data));
  }

  onChange(fn) { this._listeners.push(fn); }
  _notify() { this._listeners.forEach(fn => fn(this._data)); }

  // Вычислить награду для плитки (с прогрессией +10%)
  getReward(tile) {
    if (AchievementSystem.BASE_REWARDS[tile]) {
      return AchievementSystem.BASE_REWARDS[tile];
    }
    // Для плиток выше 32768 — вычисляем прогрессию
    let prev = 32768;
    let reward = 73;
    while (prev < tile) {
      prev *= 2;
      reward = Math.round(reward * 1.1);
    }
    return reward;
  }

  // Вызывается при достижении новой максимальной плитки
  notifyTileReached(value) {
    if (value <= this._data.maxReached) return false;
    this._data.maxReached = value;

    // Проверяем, достигнута ли текущая цель
    if (!this._data.pendingClaim && value >= this._data.currentGoal) {
      this._data.pendingClaim = true;
      this._save();
      this._notify();
      return true; // новое достижение
    }
    this._save();
    return false;
  }

  hasPendingClaim() { return this._data.pendingClaim; }
  getCurrentGoal() { return this._data.currentGoal; }
  getMaxReached() { return this._data.maxReached; }
  getCollected() { return [...this._data.collected]; }

  // Забрать награду
  claim(currency) {
    if (!this._data.pendingClaim) return 0;
    const reward = this.getReward(this._data.currentGoal);
    currency.add(reward);
    this._data.collected.push(this._data.currentGoal);
    this._data.pendingClaim = false;

    // Сдвигаем цель к следующей плитке
    this._data.currentGoal *= 2;

    // Если следующая цель уже достигнута — сразу активируем
    if (this._data.maxReached >= this._data.currentGoal) {
      this._data.pendingClaim = true;
    }

    this._save();
    this._notify();
    return reward;
  }

  getNextGoal() {
    return this._data.currentGoal * 2;
  }
}
