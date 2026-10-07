export default function Home() {
  return (
    <main>
      <header>
        <div>
          <div>
            <span>✦</span>
            <span>PlayPick</span>
          </div>

          <nav>
            <a href="#">Главная</a>
            <a href="#">Игры</a>
            <a href="#">Подбор</a>
            <a href="#">Сообщество</a>
          </nav>

          <div>
            <input
              type="text"
              placeholder="Поиск игр..."
            />

            <button>♧</button>
            <button>👤</button>
          </div>
        </div>
      </header>


      <h1>Во что поиграть сейчас?</h1>
      <p>
        Подберём игры под твоё настроение, время и предпочтения.
      </p>

      <button>Подобрать игру</button>
      <button>Как это работает?</button>

      <div>
        <div>
          <strong>12 500+</strong>
          <span>оценок от игроков</span>
        </div>

        <div>
          <strong>8 900+</strong>
          <span>игр в базе</span>
        </div>

        <div>
          <strong>Уникальные</strong>
          <span>характеристики</span>
        </div>

        <div>
          <strong>Рекомендации</strong>
          <span>под твоё настроение</span>
        </div>
      </div>
    </main >
  );
}
