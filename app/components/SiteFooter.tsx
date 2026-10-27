import Link from "next/link";

const moods = [
  { id: "relax", label: "Расслабиться" },
  { id: "challenge", label: "Испытать себя" },
  { id: "story", label: "Погрузиться в сюжет" },
  { id: "explore", label: "Исследовать мир" },
  { id: "social", label: "Поиграть вместе" },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-about">
          <Link href="/" className="header-logo">
            <span>✦</span>
            <span>PlayPick</span>
          </Link>
          <p>Подбор игр под настроение, свободное время и любимые жанры.</p>
        </div>

        <nav className="site-footer-column" aria-label="Разделы">
          <h2>Разделы</h2>
          <Link href="/games">Каталог</Link>
          <Link href="/pick">Подбор</Link>
          <Link href="/favorites">Избранное</Link>
        </nav>

        <nav className="site-footer-column" aria-label="Настроения">
          <h2>Настроения</h2>
          {moods.map((mood) => <Link key={mood.id} href={`/pick?mood=${mood.id}`}>{mood.label}</Link>)}
        </nav>

        <div className="site-footer-column">
          <h2>Источники</h2>
          {/* RAWG requires a visible active link on pages that show its data. */}
          <a href="https://rawg.io/" target="_blank" rel="noopener noreferrer">Данные об играх: RAWG</a>
          <a href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer">RAWG API</a>
          <a href="https://github.com/abubachir12/PlayPick" target="_blank" rel="noopener noreferrer">Код на GitHub</a>
        </div>
      </div>
      <div className="site-footer-bottom">PlayPick — учебный проект. Названия и изображения игр принадлежат их правообладателям.</div>
    </footer>
  );
}
