import type { Metadata } from "next";
import PageBanner from "../components/PageBanner";
import AccountView from "./AccountView";

export const metadata: Metadata = {
  title: "Аккаунт",
};

export default function AccountPage() {
  return (
    <main className="page">
      <PageBanner title="Аккаунт" text="Твой профиль, списки и вкусы, которые учитывает подбор." image="/hero/rust.jpg" />
      <AccountView />
    </main>
  );
}
