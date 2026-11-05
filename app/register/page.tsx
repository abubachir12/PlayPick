import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "../components/AuthForm";
import PageBanner from "../components/PageBanner";

export const metadata: Metadata = {
  title: "Регистрация",
};

export default function RegisterPage() {
  return (
    <main className="page auth-page">
      <PageBanner
        title="Регистрация"
        text="Аккаунт хранит избранное и пройденное, а подбор учитывает твои вкусы."
        image="/hero/ark.jpg"
      />
      <Suspense fallback={<div className="auth-form skeleton" style={{ minHeight: 380 }} />}>
        <AuthForm mode="register" />
      </Suspense>
    </main>
  );
}
