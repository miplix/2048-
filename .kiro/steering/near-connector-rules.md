# NEAR Connector — критические правила

## connector.connect() — НИКОГДА не await

```js
// ПРАВИЛЬНО — connect() только открывает модал, результат через событие
connector.connect().catch(()=>{});

// НЕПРАВИЛЬНО — await блокирует и ломает flow
await connector.connect();
```

## connector.on() — регистрировать обработчик ОДИН РАЗ

```js
// ПРАВИЛЬНО — сохраняем ссылку, снимаем при необходимости
const onSignIn = (t) => { ... };
connector.on('wallet:signIn', onSignIn);
// при отмене: connector.off('wallet:signIn', onSignIn);

// НЕПРАВИЛЬНО — каждый вызов showWalletScreen добавляет новый обработчик
connector.on('wallet:signIn', (t) => { ... }); // накапливается!
```

## Коннектор — создавать ОДИН РАЗ глобально

```js
// ПРАВИЛЬНО — один экземпляр на всё время жизни страницы
let _connector = null;
function getConnector() {
  if (_connector) return _connector;
  _connector = new lib.NearConnector({...});
  return _connector;
}
const _earlyConnector = getConnector(); // инициализация при загрузке
```

## z-index нашего оверлея — НИЖЕ чем у модала HOT Connector

HOT Connector рендерит свой модал в body с высоким z-index.
Наш фоновый оверлей должен иметь z-index: 100 (не 9999).
