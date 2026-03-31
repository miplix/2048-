// SpawnSystem — логика появления плиток с учётом уровня прокачки
export class SpawnSystem {
  // Таблица шансов по уровням апгрейда
  static SPAWN_TABLES = [
    [{ value: 2, weight: 90 }, { value: 4, weight: 10 }],
    [{ value: 2, weight: 80 }, { value: 4, weight: 20 }],
    [{ value: 2, weight: 60 }, { value: 4, weight: 30 }, { value: 8, weight: 10 }],
    [{ value: 2, weight: 40 }, { value: 4, weight: 40 }, { value: 8, weight: 20 }],
    [{ value: 2, weight: 10 }, { value: 4, weight: 50 }, { value: 8, weight: 30 }, { value: 16, weight: 10 }],
    [{ value: 4, weight: 40 }, { value: 8, weight: 40 }, { value: 16, weight: 20 }],
    [{ value: 4, weight: 20 }, { value: 8, weight: 50 }, { value: 16, weight: 30 }],
    [{ value: 8, weight: 60 }, { value: 16, weight: 40 }],
    [{ value: 8, weight: 50 }, { value: 16, weight: 50 }],
  ];

  constructor(upgradeSystem) {
    this.upgradeSystem = upgradeSystem;
  }

  // Получить значение новой плитки согласно текущему уровню прокачки
  getSpawnValue() {
    const level = this.upgradeSystem.getSpawnLevel();
    const table = SpawnSystem.SPAWN_TABLES[level] || SpawnSystem.SPAWN_TABLES[0];
    const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const entry of table) {
      rand -= entry.weight;
      if (rand <= 0) return entry.value;
    }
    return table[table.length - 1].value;
  }
}
