"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { errorMessage } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { login, register, useSession } from "@/lib/use-session";

// Only same-site paths are allowed as a return address after signing in.
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";
  const session = useSession();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isRegister) await register({ name, email, password });
      else await login({ email, password });
      toast(isRegister ? "Аккаунт создан — списки теперь сохраняются в нём" : "Вы вошли в аккаунт");
      router.push(next);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  const otherHref = `${isRegister ? "/login" : "/register"}${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`;

  if (session.user && !busy) {
    return (
      <div className="auth-form">
        <p className="state-title">Ты уже вошёл как {session.user.name}</p>
        <p className="hint">{session.user.email}</p>
        <Link href={next} className="primary-button">Продолжить</Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
      {isRegister && (
        <label className="field labeled">
          <span>Как к тебе обращаться</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="nickname" placeholder="Например, Артём" />
        </label>
      )}

      <label className="field labeled">
        <span>Почта</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254}
          autoComplete="email" required placeholder="you@example.com" />
      </label>

      <label className="field labeled">
        <span>Пароль{isRegister && <span className="hint"> — не короче 8 символов</span>}</span>
        <span className="password-field">
          <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)}
            minLength={isRegister ? 8 : undefined} maxLength={128} required
            autoComplete={isRegister ? "new-password" : "current-password"} />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button type="submit" className="primary-button" disabled={busy || !email || !password}>
        {busy ? "Секунду…" : isRegister ? "Создать аккаунт" : "Войти"}
      </button>

      <p className="auth-switch">
        {isRegister ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
        <Link href={otherHref} className="text-link">{isRegister ? "Войти" : "Зарегистрироваться"}</Link>
      </p>
    </form>
  );
}
