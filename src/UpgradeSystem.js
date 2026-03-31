// UpgradeSystem — хранение и применение апгрейдов
export class UpgradeSystem {
  static SPAWN_COSTS = [800, 1500, 2800, 4500, 7000, 10500, 15000, 22000];
  static COIN_BONUS_COSTS = [600, 1400, 2800];
  static COMBO_COSTS = [500, 1000, 2000, 3500, 5000, 7000, 9000, 11000, 12500, 14000];
  static AUTO_DELETE_COSTS = [2000, 4500, 9000];
  static SECOND_HEART_COST = 1800;
  static GRID_5_COST = 10000;
  static GRID_6_COST = 20000;

  constructor() {
    this._load();
  }

  _load() {
    const raw = localStorage.getItem('upgrades');
    const defaults = {
      spawnLevel: 0,
      spawnUnlocked: false,
      coinBonusLevel: 0,
      comboLevel: 0,
      autoDeleteLevel: 0,
      secondHeart: false,
      grid5: false,
      grid6: false,
    };
    this._data = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  }

  _save() {
    localStorage.setItem('upgrades', JSON.stringify(this._data));
  }

  getSpawnLevel() { return this._data.spawnLevel; }
  isSpawnUnlocked() { return this._data.spawnUnlocked; }
  unlockSpawn() { this._data.spawnUnlocked = true; this._save(); }

  getCoinBonusLevel() { return this._data.coinBonusLevel; }
  getComboLevel() { return this._data.comboLevel; }
  getAutoDeleteLevel() { return this._data.autoDeleteLevel; }
  hasSecondHeart() { return this._data.secondHeart; }
  hasGrid5() { return this._data.grid5; }
  hasGrid6() { return this._data.grid6; }

  getGridSize() {
    if (this._data.grid6) return 6;
    if (this._data.grid5) return 5;
    return 4;
  }

  // Стоимость следующего уровня спауна
  spawnUpgradeCost() {
    const lvl = this._data.spawnLevel;
    return lvl < 8 ? UpgradeSystem.SPAWN_COSTS[lvl] : null;
  }

  coinBonusUpgradeCost() {
    const lvl = this._data.coinBonusLevel;
    return lvl < 3 ? UpgradeSystem.COIN_BONUS_COSTS[lvl] : null;
  }

  comboUpgradeCost() {
    const lvl = this._data.comboLevel;
    return lvl < 10 ? UpgradeSystem.COMBO_COSTS[lvl] : null;
  }

  autoDeleteUpgradeCost() {
    const lvl = this._data.autoDeleteLevel;
    return lvl < 3 ? UpgradeSystem.AUTO_DELETE_COSTS[lvl] : null;
  }

  // Покупки — возвращают стоимость или null если недоступно
  buySpawn(currency) {
    if (!this._data.spawnUnlocked) return false;
    const cost = this.spawnUpgradeCost();
    if (cost === null) return false;
    if (!currency.spend(cost)) return false;
    this._data.spawnLevel++;
    this._save();
    return true;
  }

  buyCoinBonus(currency) {
    const cost = this.coinBonusUpgradeCost();
    if (cost === null) return false;
    if (!currency.spend(cost)) return false;
    this._data.coinBonusLevel++;
    this._save();
    return true;
  }

  buyCombo(currency) {
    const cost = this.comboUpgradeCost();
    if (cost === null) return false;
    if (!currency.spend(cost)) return false;
    this._data.comboLevel++;
    this._save();
    return true;
  }

  buyAutoDelete(currency) {
    const cost = this.autoDeleteUpgradeCost();
    if (cost === null) return false;
    if (!currency.spend(cost)) return false;
    this._data.autoDeleteLevel++;
    this._save();
    return true;
  }

  buySecondHeart(currency) {
    if (this._data.secondHeart) return false;
    if (!currency.spend(UpgradeSystem.SECOND_HEART_COST)) return false;
    this._data.secondHeart = true;
    this._save();
    return true;
  }

  buyGrid5(currency) {
    if (this._data.grid5) return false;
    if (!currency.spend(UpgradeSystem.GRID_5_COST)) return false;
    this._data.grid5 = true;
    this._save();
    return true;
  }

  buyGrid6(currency) {
    if (!this._data.grid5) return false;
    if (this._data.grid6) return false;
    if (!currency.spend(UpgradeSystem.GRID_6_COST)) return false;
    this._data.grid6 = true;
    this._save();
    return true;
  }
}
