"use client";

import { useEffect, useState } from "react";
const heroImages = [
  "/hero/ark.jpg",
  "/hero/battlefield.jpg",
  "/hero/rust.jpg",
  "/hero/witcher.jpg",
];

export default function Home() {
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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

          <div className="profile-bar">
            <input
              className="search"
              type="text"
              placeholder="Поиск игр..."
            />

            <button>♧</button>
            <button>👤</button>
          </div>
        </div>
      </header>

      <section className="hero">
        <img
          key={currentImage}
          src={heroImages[currentImage]}
          alt=""
          className="hero-image"
        />

        <div className="hero-overlay"></div>

        <div className="hero-content">
          <div className="hero-label">
            ✦ Персональные рекомендации
          </div>

          <h1 className="hero-title">
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

          <div className="hero-stats">
            <div className="hero-stat">
              <strong>12 500+</strong>
              <span>оценок от игроков</span>
            </div>

            <div className="hero-stat">
              <strong>8 900+</strong>
              <span>игр в базе</span>
            </div>

            <div className="hero-stat">
              <strong>100+</strong>
              <span>уникальных характеристик</span>
            </div>

            <div className="hero-stat">
              <strong>∞</strong>
              <span>персональных рекомендаций</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}