"use client";

import { useEffect, useState } from "react";
import {
  Star,
  LibraryBig,
  Heart,
  Sparkles,
  Search,
  Bell,
  UserRound,
  Menu,
  X,
} from "lucide-react";

const heroImages = [
  "/hero/ark.jpg",
  "/hero/battlefield.jpg",
  "/hero/rust.jpg",
  "/hero/witcher.jpg",
];

export default function Home() {
  const [currentImage, setCurrentImage] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main>
      <header>
        <div className="header-inner">
          <div className="header-logo">
            <span>✦</span>
            <span>PlayPick</span>
          </div>

          <nav className="desktop-nav">
            <a href="#">Главная</a>
            <a href="#">Игры</a>
            <a href="#">Подбор</a>
            <a href="#">Сообщество</a>
          </nav>

          <div className="profile-bar">
            <div className="search-wrapper">
              <Search size={16} className="search-icon" />

              <input
                className="search"
                type="text"
                placeholder="Поиск игр..."
                aria-label="Поиск игр"
              />
            </div>

            <button type="button" aria-label="Уведомления">
              <Bell size={18} />
            </button>

            <button
              type="button"
              className="header-avatar"
              aria-label="Профиль пользователя"
            >
              <UserRound size={18} />
            </button>
          </div>

          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label={isMobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <nav className="mobile-nav" id="mobile-navigation">
            <a href="#" onClick={() => setIsMobileMenuOpen(false)}>
              Главная
            </a>

            <a href="#" onClick={() => setIsMobileMenuOpen(false)}>
              Игры
            </a>

            <a href="#" onClick={() => setIsMobileMenuOpen(false)}>
              Подбор
            </a>

            <a href="#" onClick={() => setIsMobileMenuOpen(false)}>
              Сообщество
            </a>
          </nav>
        )}
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
          {/* <div className="hero-label">
            ✦ Персональные рекомендации
          </div> */}

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
              <div className="hero-stat-icon">
                <Star size={18} />
              </div>

              <div className="hero-stat-content">
                <strong>12 500+</strong>
                <span>оценок от игроков</span>
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-icon">
                <LibraryBig size={18} />
              </div>

              <div className="hero-stat-content">
                <strong>8 900+</strong>
                <span>игр в базе</span>
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-icon">
                <Heart size={18} />
              </div>

              <div className="hero-stat-content">
                <strong>100+</strong>
                <span>уникальных характеристик</span>
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-icon">
                <Sparkles size={18} />
              </div>

              <div className="hero-stat-content">
                <strong>∞</strong>
                <span>персональных рекомендаций</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}