// CurrencyManager — монеты: начисление, списание, события
export class CurrencyManager {
  constructor(upgradeSystem) {
    this.upgradeSystem = upgradeSystem;
    this._coins = parseInt(localStorage.getItem('coins') || '0', 10);
    this._listeners = [];
  }

  get coins() { return this._coins; }

  onChange(fn) { this._listeners.push(fn); }

  _notify() {
    localStorage.setItem('coins', this._coins);
    this._listeners.forEach(fn => fn(this._coins));
  }

  // Формула: min(8, max(0, floor(log2(value) - 3)))
  calcMergeCoins(value) {
    if (value < 16) return 0;
    return Math.min(8, Math.max(0, Math.floor(Math.log2(value) - 3)));
  }

  // Начислить монеты за слияние с учётом апгрейдов
  awardMerge(value) {
    let base = this.calcMergeCoins(value);
    if (base === 0) return 0;

    // Бонус к монетам (+5/10/15% для слияний >= 16)
    if (value >= 16) {
      const bonusLvl = this.upgradeSystem.getCoinBonusLevel();
      const bonusPct = [0, 0.05, 0.10, 0.15][bonusLvl] || 0;
      base = base * (1 + bonusPct);
    }

    // Комбо-монеты (множитель для слияний >= 128)
    if (value >= 128) {
      const comboLvl = this.upgradeSystem.getComboLevel();
      const mult = 1 + comboLvl * 0.105;
      base = base * mult;
    }

    const earned = Math.floor(base);
    this._coins += earned;
    this._notify();
    return earned;
  }

  add(amount) {
    this._coins += amount;
    this._notify();
  }

  spend(amount) {
    if (this._coins < amount) return false;
    this._coins -= amount;
    this._notify();
    return true;
  }

  // Ежедневный бонус +50 монет
  checkDailyBonus() {
    const today = new Date().toDateString();
    const last = localStorage.getItem('dailyBonusDate');
    if (last !== today) {
      localStorage.setItem('dailyBonusDate', today);
      this.add(50);
      return true;
    }
    return false;
  }
}
