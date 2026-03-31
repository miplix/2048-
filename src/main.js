import { UpgradeSystem } from './UpgradeSystem.js';
import { CurrencyManager } from './CurrencyManager.js';
import { SpawnSystem } from './SpawnSystem.js';
import { AchievementSystem } from './AchievementSystem.js';
import { GameBoard } from './GameBoard.js';
import { UI } from './UI.js';

// Инициализация всех модулей
const upgrades = new UpgradeSystem();
const currency = new CurrencyManager(upgrades);
const spawn = new SpawnSystem(upgrades);
const achievements = new AchievementSystem();
const board = new GameBoard(upgrades.getGridSize(), spawn, currency, upgrades, achievements);
const ui = new UI(board, currency, upgrades, achievements);

// Ежедневный бонус
if (currency.checkDailyBonus()) {
  ui.toast('🎁 Ежедневный бонус: +50 монет!');
}
