import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "../components/AuthForm";
import PageBanner from "../components/PageBanner";

export const metadata: Metadata = {
  title: "Вход",
};

export default function LoginPage() {
  return (
    <main className="page auth-page">
      <PageBanner
        title="Вход"
        text="Избранное и пройденное будут с тобой на любом устройстве."
        image="/hero/witcher.jpg"
      />
      <Suspense fallback={<div className="auth-form skeleton" style={{ minHeight: 320 }} />}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
