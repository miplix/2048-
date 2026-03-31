// UI — рендеринг, вкладки, оверлеи, toast-уведомления
export class UI {
  constructor(board, currency, upgrades, achievements) {
    this.board = board;
    this.currency = currency;
    this.upgrades = upgrades;
    this.achievements = achievements;

    this.activeTab = 'game';
    this.deleteMode = false;       // режим удаления плитки (80 монет)
    this.deathDeleteMode = false;  // режим удаления при поражении
    this.deathDeleteCount = 0;     // сколько плиток ещё нужно удалить
    this.deathDeleteRefund = false;// нужно ли вернуть 120 монет при отмене
    this.adCooldown = 0;
    this._adTimer = null;

    this._buildDOM();
    this._bindEvents();
    this._render(board.getState());
    this._renderCoins(currency.coins);
    this._renderAchievements();
  }

  _buildDOM() {
    document.getElementById('app').innerHTML = `
      <div class="header">
        <div class="header-title">2048<span class="plus">+</span></div>
        <div class="coins-display"><span class="coin-icon">🪙</span><span id="coins-count">0</span></div>
      </div>
      <div class="metrics">
        <div class="metric"><div class="metric-label">Счёт</div><div class="metric-value" id="score">0</div></div>
        <div class="metric"><div class="metric-label">Рекорд</div><div class="metric-value" id="best">0</div></div>
        <div class="metric"><div class="metric-label">Цель</div><div class="metric-value" id="goal">2048</div></div>
        <div class="metric"><div class="metric-label">Поле</div><div class="metric-value" id="grid-size">4×4</div></div>
      </div>
      <div class="actions">
        <button class="btn-action" id="btn-undo">↩ Отмена<span class="cost">40🪙</span></button>
        <button class="btn-action" id="btn-delete">✕ Удалить<span class="cost">80🪙</span></button>
        <button class="btn-action hidden" id="btn-auto-delete">⚡ Авто-уд.<span class="badge hidden" id="auto-badge">1</span></button>
        <button class="btn-action btn-new" id="btn-new-game">Новая игра</button>
      </div>
      <div class="board-wrapper">
        <div id="board"></div>
        <div id="overlay-gameover" class="overlay hidden">
          <div class="overlay-content">
            <div class="overlay-title">Игра окончена</div>
            <div id="overlay-score"></div>
            <div id="overlay-coins"></div>
            <button class="btn-overlay" id="btn-continue">Удалить 2 плитки <span class="cost">120🪙</span></button>
            <button class="btn-overlay btn-heart hidden" id="btn-heart">💗 Второе сердце</button>
            <button class="btn-overlay btn-newgame" id="btn-overlay-new">Новая игра</button>
          </div>
        </div>
        <div id="overlay-delete" class="overlay-delete hidden">
          <div class="delete-banner">Выбери плитку для удаления</div>
        </div>
        <div id="overlay-death-delete" class="overlay-death hidden">
          <div class="death-banner">Выбери плитки для удаления</div>
          <div class="death-counter" id="death-counter">Осталось: 2</div>
          <button class="btn-cancel-death" id="btn-cancel-death">Отмена</button>
        </div>
      </div>
      <div class="tabs">
        <button class="tab active" data-tab="game">Игра</button>
        <button class="tab" data-tab="shop">Магазин</button>
        <button class="tab" data-tab="upgrades">Апгрейды</button>
        <button class="tab" data-tab="rewards">Награды</button>
      </div>
      <div id="tab-game" class="tab-content active"></div>
      <div id="tab-shop" class="tab-content hidden"></div>
      <div id="tab-upgrades" class="tab-content hidden"></div>
      <div id="tab-rewards" class="tab-content hidden"></div>
      <div id="toast-container"></div>
      <div id="achievement-popup" class="achievement-popup hidden"></div>
    `;
    this._renderShop();
  }

  _bindEvents() {
    // Вкладки
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    // Кнопки действий
    document.getElementById('btn-undo').addEventListener('click', () => {
      if (!this.board.undo(this.currency)) this.toast('Нет хода для отмены или недостаточно монет');
    });

    document.getElementById('btn-delete').addEventListener('click', () => {
      if (this.currency.coins < 80) { this.toast('Недостаточно монет'); return; }
      this._enterDeleteMode();
    });

    document.getElementById('btn-auto-delete').addEventListener('click', () => {
      if (!this.board.autoDeleteCharge) return;
      this._enterAutoDeleteMode();
    });

    document.getElementById('btn-new-game').addEventListener('click', () => this._newGame());

    // Оверлей поражения
    document.getElementById('btn-continue').addEventListener('click', () => this._startDeathDelete());
    document.getElementById('btn-heart').addEventListener('click', () => this._useSecondHeart());
    document.getElementById('btn-overlay-new').addEventListener('click', () => this._newGame());
    document.getElementById('btn-cancel-death').addEventListener('click', () => this._cancelDeathDelete());

    // Клавиатура
    document.addEventListener('keydown', e => {
      if (this.deleteMode || this.deathDeleteMode) return;
      if (this.activeTab !== 'game') return;
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
                    a: 'left', d: 'right', w: 'up', s: 'down',
                    A: 'left', D: 'right', W: 'up', S: 'down' };
      if (map[e.key]) { e.preventDefault(); this._handleMove(map[e.key]); }
    });

    // Свайп
    let touchStart = null;
    const boardEl = document.getElementById('board');
    boardEl.addEventListener('touchstart', e => {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    boardEl.addEventListener('touchend', e => {
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 25 && Math.abs(dy) < 25) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this._handleMove(dx > 0 ? 'right' : 'left');
      } else {
        this._handleMove(dy > 0 ? 'down' : 'up');
      }
    }, { passive: true });

    // Подписки
    this.board.on('move', state => this._render(state));
    this.board.on('gameOver', state => { this._render(state); this._showGameOver(state); });
    this.board.on('win', goal => this.toast(`🎉 Достигнута плитка ${goal / 2}! Новая цель: ${goal}`));
    this.board.on('autoCharge', charged => this._updateAutoDeleteBtn(charged));
    this.currency.onChange(coins => this._renderCoins(coins));
    this.achievements.onChange(() => { this._renderAchievements(); this._checkAchievementPopup(); });
  }

  _handleMove(dir) {
    if (document.getElementById('overlay-gameover').classList.contains('hidden') === false) return;
    this.board.move(dir);
  }

  _render(state) {
    const boardEl = document.getElementById('board');
    const wasDeleteActive = boardEl.classList.contains('delete-active');
    boardEl.className = `board board-${state.size}`;
    if (wasDeleteActive) boardEl.classList.add('delete-active');
    boardEl.innerHTML = '';
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const val = state.grid[r][c];
        const cell = document.createElement('div');
        cell.className = `tile tile-${val || 'empty'}`;
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (val) cell.textContent = val;

        // Клик в режиме удаления
        cell.addEventListener('click', () => {
          if (this.deleteMode && val) {
            this._confirmDelete(r, c);
          } else if (this.deleteMode && !val) {
            // пустая — игнорируем
          } else if (this.deathDeleteMode && val) {
            this._deathDeleteTile(r, c);
          }
        });
        boardEl.appendChild(cell);
      }
    }

    document.getElementById('score').textContent = state.score;
    document.getElementById('best').textContent = state.bestScore;
    document.getElementById('goal').textContent = state.goal;
    document.getElementById('grid-size').textContent = `${state.size}×${state.size}`;
    this._updateAutoDeleteBtn(state.autoDeleteCharge);

    // Подсветка в режиме удаления
    if (this.deleteMode) this._highlightTiles();
    if (this.deathDeleteMode) this._highlightTiles();
  }

  _renderCoins(coins) {
    document.getElementById('coins-count').textContent = coins;
    // Обновляем кнопку продолжения
    const btnContinue = document.getElementById('btn-continue');
    if (btnContinue) btnContinue.disabled = coins < 120;
  }

  _updateAutoDeleteBtn(charged) {
    const btn = document.getElementById('btn-auto-delete');
    const badge = document.getElementById('auto-badge');
    const lvl = this.upgrades.getAutoDeleteLevel();
    if (lvl > 0) {
      btn.classList.remove('hidden');
      if (charged) {
        badge.classList.remove('hidden');
        btn.classList.add('charged');
      } else {
        badge.classList.add('hidden');
        btn.classList.remove('charged');
      }
    } else {
      btn.classList.add('hidden');
    }
  }

  _switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    if (tab === 'upgrades') this._renderUpgrades();
    if (tab === 'rewards') this._renderAchievements();
  }

  // ---- Режим удаления плитки (80 монет) ----
  _enterDeleteMode() {
    this.deleteMode = true;
    document.getElementById('board').classList.add('delete-active');
    document.getElementById('overlay-delete').classList.remove('hidden');
    this._highlightTiles();

    // Кнопка отмены в баннере
    const banner = document.getElementById('overlay-delete');
    banner.innerHTML = `<div class="delete-banner">Выбери плитку для удаления <button id="btn-cancel-delete" class="btn-cancel">Отмена</button></div>`;
    document.getElementById('btn-cancel-delete').addEventListener('click', () => this._exitDeleteMode(false));
  }

  _exitDeleteMode(spent) {
    this.deleteMode = false;
    document.getElementById('board').classList.remove('delete-active');
    document.getElementById('overlay-delete').classList.add('hidden');
    this._render(this.board.getState());
  }

  _confirmDelete(r, c) {
    if (!this.currency.spend(80)) { this.toast('Недостаточно монет'); this._exitDeleteMode(false); return; }
    this.board.deleteTile(r, c);
    this._exitDeleteMode(true);
    this.toast('Плитка удалена');
  }

  _highlightTiles() {
    document.querySelectorAll('.tile:not(.tile-empty)').forEach(el => el.classList.add('deletable'));
  }

  // ---- Авто-удаление ----
  _enterAutoDeleteMode() {
    this.deleteMode = true;
    this._autoDeleteFree = true;
    document.getElementById('board').classList.add('delete-active');
    document.getElementById('overlay-delete').classList.remove('hidden');
    const banner = document.getElementById('overlay-delete');
    banner.innerHTML = `<div class="delete-banner">⚡ Авто-удаление: выбери плитку <button id="btn-cancel-delete" class="btn-cancel">Отмена</button></div>`;
    document.getElementById('btn-cancel-delete').addEventListener('click', () => {
      this._autoDeleteFree = false;
      this._exitDeleteMode(false);
    });
    this._highlightTiles();

    // Переопределяем клики плиток для авто-удаления
    document.querySelectorAll('.tile:not(.tile-empty)').forEach(el => {
      el.onclick = () => {
        const r = parseInt(el.dataset.r);
        const c = parseInt(el.dataset.c);
        this.board.useAutoDelete(r, c);
        this._autoDeleteFree = false;
        this._exitDeleteMode(true);
        this.toast('Авто-удаление использовано');
      };
    });
  }

  // ---- Оверлей поражения ----
  _showGameOver(state) {
    const overlay = document.getElementById('overlay-gameover');
    overlay.classList.remove('hidden');
    document.getElementById('overlay-score').textContent = `Счёт: ${state.score}`;
    document.getElementById('overlay-coins').textContent = `Монеты: ${this.currency.coins}`;

    const btnContinue = document.getElementById('btn-continue');
    btnContinue.disabled = this.currency.coins < 120;

    const btnHeart = document.getElementById('btn-heart');
    if (this.upgrades.hasSecondHeart() && !this.board.secondHeartUsed) {
      btnHeart.classList.remove('hidden');
    } else {
      btnHeart.classList.add('hidden');
    }
  }

  _hideGameOver() {
    document.getElementById('overlay-gameover').classList.add('hidden');
  }

  _startDeathDelete() {
    if (this.currency.coins < 120) return;
    this.currency.spend(120);
    this.deathDeleteMode = true;
    this.deathDeleteCount = 2;
    this.deathDeleteRefund = true;

    // Оверлей поражения становится полупрозрачным
    const overlay = document.getElementById('overlay-gameover');
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0.3';

    document.getElementById('overlay-death-delete').classList.remove('hidden');
    document.getElementById('death-counter').textContent = `Осталось: ${this.deathDeleteCount}`;
    this._highlightTiles();
  }

  _deathDeleteTile(r, c) {
    this.board.deleteTile(r, c);
    this.deathDeleteCount--;
    document.getElementById('death-counter').textContent = `Осталось: ${this.deathDeleteCount}`;
    if (this.deathDeleteCount <= 0) {
      this._finishDeathDelete();
    }
  }

  _finishDeathDelete() {
    this.deathDeleteMode = false;
    this.deathDeleteRefund = false;
    document.getElementById('overlay-death-delete').classList.add('hidden');
    this._hideGameOver();
    const overlay = document.getElementById('overlay-gameover');
    overlay.style.pointerEvents = '';
    overlay.style.opacity = '';
    this._render(this.board.getState());
    this.toast('Игра продолжается!');
  }

  _cancelDeathDelete() {
    this.deathDeleteMode = false;
    if (this.deathDeleteRefund) {
      this.currency.add(120);
      this.deathDeleteRefund = false;
    }
    document.getElementById('overlay-death-delete').classList.add('hidden');
    const overlay = document.getElementById('overlay-gameover');
    overlay.style.pointerEvents = '';
    overlay.style.opacity = '';
    this._render(this.board.getState());
  }

  _useSecondHeart() {
    if (!this.board.useSecondHeart()) return;
    this._hideGameOver();
    // Режим выбора 1 плитки бесплатно
    this.deathDeleteMode = true;
    this.deathDeleteCount = 1;
    this.deathDeleteRefund = false;
    document.getElementById('overlay-death-delete').classList.remove('hidden');
    document.getElementById('death-counter').textContent = 'Осталось: 1';
    const banner = document.querySelector('.death-banner');
    if (banner) banner.textContent = '💗 Второе сердце: выбери плитку';
    this._highlightTiles();
  }

  _newGame() {
    this._hideGameOver();
    this.deleteMode = false;
    this.deathDeleteMode = false;
    document.getElementById('overlay-delete').classList.add('hidden');
    document.getElementById('overlay-death-delete').classList.add('hidden');
    const overlay = document.getElementById('overlay-gameover');
    overlay.style.pointerEvents = '';
    overlay.style.opacity = '';
    this.board.reset();
  }

  // ---- Магазин ----
  _renderShop() {
    const el = document.getElementById('tab-shop');
    el.innerHTML = `
      <div class="shop">
        <h3 class="section-title">Пакеты монет</h3>
        <div class="shop-grid">
          <div class="shop-item"><div class="shop-coins">200🪙</div><div class="shop-label">Стартер</div><button class="btn-buy" onclick="alert('Демо: +200 монет')">$0.99</button></div>
          <div class="shop-item"><div class="shop-coins">800🪙</div><div class="shop-label">Базовый</div><button class="btn-buy" onclick="alert('Демо: +800 монет')">$4.99</button></div>
          <div class="shop-item"><div class="shop-coins">2400🪙</div><div class="shop-label">Премиум</div><button class="btn-buy" onclick="alert('Демо: +2400 монет')">$9.99</button></div>
          <div class="shop-item"><div class="shop-coins">7000🪙</div><div class="shop-label">Мега</div><button class="btn-buy" onclick="alert('Демо: +7000 монет')">$19.99</button></div>
        </div>
        <h3 class="section-title">Реклама</h3>
        <div class="ad-section">
          <button class="btn-ad" id="btn-watch-ad">▶ Смотреть рекламу (+35🪙)</button>
          <div class="ad-cooldown hidden" id="ad-cooldown"></div>
        </div>
      </div>
    `;
    document.getElementById('btn-watch-ad').addEventListener('click', () => this._watchAd());
  }

  _watchAd() {
    if (this.adCooldown > 0) return;
    // Демо: симулируем просмотр рекламы
    this.currency.add(35);
    this.toast('+35 монет за рекламу!');
    this.adCooldown = 120;
    this._startAdTimer();
  }

  _startAdTimer() {
    const btn = document.getElementById('btn-watch-ad');
    const cd = document.getElementById('ad-cooldown');
    if (!btn || !cd) return;
    btn.disabled = true;
    cd.classList.remove('hidden');
    clearInterval(this._adTimer);
    this._adTimer = setInterval(() => {
      this.adCooldown--;
      cd.textContent = `Следующая реклама через: ${this.adCooldown}с`;
      if (this.adCooldown <= 0) {
        clearInterval(this._adTimer);
        btn.disabled = false;
        cd.classList.add('hidden');
      }
    }, 1000);
  }

  // ---- Апгрейды ----
  _renderUpgrades() {
    const el = document.getElementById('tab-upgrades');
    const u = this.upgrades;
    const coins = this.currency.coins;

    const spawnCost = u.spawnUpgradeCost();
    const spawnLvl = u.getSpawnLevel();
    const spawnUnlocked = u.isSpawnUnlocked();

    const coinBonusCost = u.coinBonusUpgradeCost();
    const coinBonusLvl = u.getCoinBonusLevel();

    const comboCost = u.comboUpgradeCost();
    const comboLvl = u.getComboLevel();

    const autoDelCost = u.autoDeleteUpgradeCost();
    const autoDelLvl = u.getAutoDeleteLevel();

    el.innerHTML = `
      <div class="upgrades">
        <h3 class="section-title">Расширение поля</h3>
        <div class="upgrade-item">
          <div class="upg-info"><b>Поле 5×5</b><br>25 клеток вместо 16</div>
          ${u.hasGrid5()
            ? '<span class="upg-done">✓ Куплено</span>'
            : `<button class="btn-upg ${coins < 10000 ? 'disabled' : ''}" id="btn-grid5">10 000🪙</button>`}
        </div>
        <div class="upgrade-item">
          <div class="upg-info"><b>Поле 6×6</b><br>36 клеток. Требует 5×5</div>
          ${u.hasGrid6()
            ? '<span class="upg-done">✓ Куплено</span>'
            : `<button class="btn-upg ${(!u.hasGrid5() || coins < 20000) ? 'disabled' : ''}" id="btn-grid6">20 000🪙</button>`}
        </div>

        <h3 class="section-title">Шансы плиток ${!spawnUnlocked ? '🔒 (достигни 2048)' : `(ур. ${spawnLvl}/8)`}</h3>
        <div class="upgrade-item">
          <div class="upg-info">Улучшить шансы появления плиток</div>
          ${spawnLvl >= 8
            ? '<span class="upg-done">✓ Максимум</span>'
            : `<button class="btn-upg ${(!spawnUnlocked || coins < spawnCost) ? 'disabled' : ''}" id="btn-spawn">
                ${spawnUnlocked ? `${spawnCost}🪙` : 'Заблокировано'}
               </button>`}
        </div>

        <h3 class="section-title">Монеты и прогрессия</h3>
        <div class="upgrade-item">
          <div class="upg-info"><b>Бонус к монетам</b> (ур. ${coinBonusLvl}/3)<br>+5/10/15% к монетам за слияния ≥16</div>
          ${coinBonusLvl >= 3
            ? '<span class="upg-done">✓ Максимум</span>'
            : `<button class="btn-upg ${coins < coinBonusCost ? 'disabled' : ''}" id="btn-coin-bonus">${coinBonusCost}🪙</button>`}
        </div>
        <div class="upgrade-item">
          <div class="upg-info"><b>Комбо-монеты</b> (ур. ${comboLvl}/10)<br>×${(1 + comboLvl * 0.105).toFixed(2)} к монетам за слияния ≥128</div>
          ${comboLvl >= 10
            ? '<span class="upg-done">✓ Максимум</span>'
            : `<button class="btn-upg ${coins < comboCost ? 'disabled' : ''}" id="btn-combo">${comboCost}🪙</button>`}
        </div>
        <div class="upgrade-item">
          <div class="upg-info"><b>Авто-удаление</b> (ур. ${autoDelLvl}/3)<br>Заряд каждые ${[20,15,10][autoDelLvl] || 10} слияний</div>
          ${autoDelLvl >= 3
            ? '<span class="upg-done">✓ Максимум</span>'
            : `<button class="btn-upg ${coins < autoDelCost ? 'disabled' : ''}" id="btn-auto-del">${autoDelCost}🪙</button>`}
        </div>
        <div class="upgrade-item">
          <div class="upg-info"><b>Второе сердце</b><br>1 бесплатное удаление при поражении за сессию</div>
          ${u.hasSecondHeart()
            ? '<span class="upg-done">✓ Куплено</span>'
            : `<button class="btn-upg ${coins < 1800 ? 'disabled' : ''}" id="btn-heart-upg">1 800🪙</button>`}
        </div>
      </div>
    `;

    // Привязываем кнопки
    this._bindUpgradeBtn('btn-grid5', () => {
      if (this.upgrades.buyGrid5(this.currency)) { this.toast('Поле 5×5 куплено! Начни новую игру.'); this._renderUpgrades(); }
      else this.toast('Недостаточно монет');
    });
    this._bindUpgradeBtn('btn-grid6', () => {
      if (this.upgrades.buyGrid6(this.currency)) { this.toast('Поле 6×6 куплено! Начни новую игру.'); this._renderUpgrades(); }
      else this.toast('Недостаточно монет');
    });
    this._bindUpgradeBtn('btn-spawn', () => {
      if (this.upgrades.buySpawn(this.currency)) { this.toast('Шансы плиток улучшены!'); this._renderUpgrades(); }
      else this.toast('Недостаточно монет');
    });
    this._bindUpgradeBtn('btn-coin-bonus', () => {
      if (this.upgrades.buyCoinBonus(this.currency)) { this.toast('Бонус к монетам улучшен!'); this._renderUpgrades(); }
      else this.toast('Недостаточно монет');
    });
    this._bindUpgradeBtn('btn-combo', () => {
      if (this.upgrades.buyCombo(this.currency)) { this.toast('Комбо-монеты улучшены!'); this._renderUpgrades(); }
      else this.toast('Недостаточно монет');
    });
    this._bindUpgradeBtn('btn-auto-del', () => {
      if (this.upgrades.buyAutoDelete(this.currency)) { this.toast('Авто-удаление улучшено!'); this._renderUpgrades(); this._updateAutoDeleteBtn(this.board.autoDeleteCharge); }
      else this.toast('Недостаточно монет');
    });
    this._bindUpgradeBtn('btn-heart-upg', () => {
      if (this.upgrades.buySecondHeart(this.currency)) { this.toast('Второе сердце куплено!'); this._renderUpgrades(); }
      else this.toast('Недостаточно монет');
    });
  }

  _bindUpgradeBtn(id, fn) {
    const btn = document.getElementById(id);
    if (btn && !btn.classList.contains('disabled')) btn.addEventListener('click', fn);
  }

  // ---- Достижения ----
  _renderAchievements() {
    const el = document.getElementById('tab-rewards');
    const collected = this.achievements.getCollected();
    const goal = this.achievements.getCurrentGoal();
    const pending = this.achievements.hasPendingClaim();
    const maxReached = this.achievements.getMaxReached();

    let html = '<div class="achievements">';

    // Собранные
    if (collected.length > 0) {
      html += '<h3 class="section-title">Собранные</h3>';
      collected.forEach(tile => {
        html += `<div class="ach-item collected"><span class="ach-tile tile-${tile}">${tile}</span><span class="ach-label">Плитка ${tile}</span><span class="ach-status">✓ Получено</span></div>`;
      });
    }

    // Активная цель
    html += '<h3 class="section-title">Активная цель</h3>';
    html += `<div class="ach-item active-goal">
      <span class="ach-tile tile-${goal}">${goal}</span>
      <span class="ach-label">Плитка ${goal} → +${this.achievements.getReward(goal)}🪙</span>
      ${pending
        ? `<button class="btn-claim pulse" id="btn-claim">Забрать</button>`
        : `<span class="ach-status pending">Ещё не достигнута</span>`}
    </div>`;

    // Следующая цель (если текущая ещё не собрана)
    const nextGoal = goal * 2;
    if (maxReached < nextGoal) {
      html += '<h3 class="section-title">Следующая</h3>';
      html += `<div class="ach-item next-goal">
        <span class="ach-tile tile-${nextGoal}">${nextGoal}</span>
        <span class="ach-label">Плитка ${nextGoal} → +${this.achievements.getReward(nextGoal)}🪙</span>
        <span class="ach-status">Следующая</span>
      </div>`;
    }

    html += '</div>';
    el.innerHTML = html;

    const claimBtn = document.getElementById('btn-claim');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => {
        const reward = this.achievements.claim(this.currency);
        this.toast(`+${reward}🪙 за достижение!`);
        this._renderAchievements();
      });
    }
  }

  _checkAchievementPopup() {
    if (!this.achievements.hasPendingClaim()) return;
    const goal = this.achievements.getCurrentGoal();
    const popup = document.getElementById('achievement-popup');
    popup.textContent = `🏆 Достигнута плитка ${goal}! Забери награду во вкладке Награды`;
    popup.classList.remove('hidden');
    setTimeout(() => popup.classList.add('hidden'), 3000);
  }

  // ---- Toast ----
  toast(msg) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
  }
}
