"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Heart, LogOut, Pencil, Sparkles, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api-client";
import { formatReleaseDate, pluralize } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useLibrary } from "@/lib/use-library";
import { deleteAccount, logout, renameAccount, useSession } from "@/lib/use-session";
import { EmptyState } from "../components/States";

function topGenres(games: { genres: string[] }[]) {
  const counts = new Map<string, number>();
  for (const game of games) for (const genre of game.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

export default function AccountView() {
  const router = useRouter();
  const session = useSession();
  const { library } = useLibrary();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const genres = useMemo(() => topGenres(library.favorites), [library.favorites]);

  if (session.status === "loading") return <div className="account-card skeleton" style={{ minHeight: 260 }} />;

  if (!session.user) {
    return (
      <EmptyState title="Ты ещё не вошёл">
        <p>Без аккаунта списки живут только в этом браузере. Войди — и они будут на всех устройствах.</p>
        <div className="center-row">
          <Link href="/login?next=/account" className="secondary-button small">Войти</Link>
          <Link href="/register?next=/account" className="primary-button small">Создать аккаунт</Link>
        </div>
      </EmptyState>
    );
  }

  const user = session.user;
  const joined = formatReleaseDate(user.createdAt.slice(0, 10));

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    try {
      await renameAccount(name);
      setEditing(false);
      toast("Имя сохранено");
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  return (
    <div className="account-grid">
      <section className="account-card">
        <div className="account-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
        {editing ? (
          <form className="account-rename" onSubmit={(event) => void saveName(event)}>
            <label className="field">
              <span className="visually-hidden">Имя</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoFocus />
            </label>
            <button type="submit" className="primary-button small" disabled={!name.trim()}>Сохранить</button>
            <button type="button" className="secondary-button small" onClick={() => setEditing(false)}>Отмена</button>
          </form>
        ) : (
          <h2 className="account-name">
            {user.name}
            <button type="button" className="icon-button" aria-label="Изменить имя" onClick={() => { setName(user.name); setEditing(true); }}>
              <Pencil size={15} />
            </button>
          </h2>
        )}
        <p className="account-email">{user.email}</p>
        {joined && <p className="hint">С нами с {joined}</p>}

        <div className="account-actions">
          <button type="button" className="secondary-button small" onClick={() => void logout().then(() => { toast("Вы вышли из аккаунта"); router.push("/"); })}>
            <LogOut size={16} /> Выйти
          </button>
          <button
            type="button"
            className="text-link danger-link"
            onClick={() => {
              if (!window.confirm("Удалить аккаунт вместе с избранным и пройденным? Это нельзя отменить.")) return;
              void deleteAccount().then(() => { toast("Аккаунт удалён"); router.push("/"); }).catch((error) => toast(errorMessage(error)));
            }}
          >
            <Trash2 size={15} /> Удалить аккаунт
          </button>
        </div>
      </section>

      <section className="account-card">
        <div className="account-stats">
          <Link href="/favorites" className="account-stat">
            <Heart size={18} />
            <strong>{library.favorites.length}</strong>
            <span>{pluralize(library.favorites.length, "игра", "игры", "игр")} в избранном</span>
          </Link>
          <Link href="/favorites" className="account-stat">
            <Check size={18} />
            <strong>{library.played.length}</strong>
            <span>{pluralize(library.played.length, "игра пройдена", "игры пройдены", "игр пройдено")}</span>
          </Link>
        </div>

        <h3 className="account-subtitle"><Sparkles size={16} /> Твои вкусы</h3>
        {genres.length ? (
          <>
            <ul className="chip-list">
              {genres.map(([genre, count]) => (
                <li key={genre}><Link className="chip chip-link" href={`/games?genre=${encodeURIComponent(genre)}`}>{genre} · {count}</Link></li>
              ))}
            </ul>
            <p className="hint account-note">Подбор поднимает игры, похожие на избранное, и подписывает «Похоже на твоё избранное».</p>
          </>
        ) : (
          <p className="hint">Добавь пару игр в избранное — и подбор начнёт учитывать твои вкусы.</p>
        )}
        <Link href="/pick" className="primary-button small account-pick">Подобрать с учётом вкусов</Link>
      </section>
    </div>
  );
}
