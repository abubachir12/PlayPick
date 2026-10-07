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


      <section className="hero">
        <div className="hero-content">

          <div className="hero-label">
            ✦ Персональные рекомендации
          </div>

          <h1>
            Во что поиграть
            <span>сейчас?</span>
          </h1>

          <p className="hero-description">
            Подберём игры под твоё настроение, время
            и то, что тебе нравится.
          </p>

          <div className="hero-buttons">
            <button className="primary-button">
              Подобрать игру →
            </button>

            <button className="secondary-button">
              Как это работает?
            </button>
          </div>

          <div className="statistics">
            <div className="stat">
              <strong>12 500+</strong>
              <span>оценок от игроков</span>
            </div>

            <div className="stat">
              <strong>8 900+</strong>
              <span>игр в базе</span>
            </div>

            <div className="stat">
              <strong>100+</strong>
              <span>уникальных характеристик</span>
            </div>

            <div className="stat">
              <strong>∞</strong>
              <span>персональных рекомендаций</span>
            </div>
          </div>

        </div>

        {/* Декоративная часть справа */}
        <div className="hero-decoration">
          <div className="hero-glow"></div>
        </div>
      </section>
    </main >
  );
}
