"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, UserRound, X } from "lucide-react";
import { useLibrary } from "@/lib/use-library";
import { useSession } from "@/lib/use-session";
import { RegionSelect } from "./PriceTag";
import SearchBox from "./SearchBox";

const links = [
  { href: "/", label: "Главная" },
  { href: "/games", label: "Игры" },
  { href: "/pick", label: "Подбор" },
  { href: "/consultant", label: "Консультант" },
  // Favorites keep their own heart button in the header, so the fifth link goes to collections.
  { href: "/collections", label: "Подборки" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinkList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return links.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      aria-current={pathname && isActive(pathname, link.href) ? "page" : undefined}
      onClick={onNavigate}
    >
      {link.label}
    </Link>
  ));
}

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinkList pathname={usePathname()} onNavigate={onNavigate} />;
}

export default function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { library } = useLibrary();
  const session = useSession();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setIsMobileMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobileMenuOpen]);
  const favoritesCount = library.favorites.length;
  const closeMenu = () => setIsMobileMenuOpen(false);

  // usePathname suspends on /games/[slug] during prerender; links render without highlight meanwhile.
  const navLinks = (
    <Suspense fallback={<NavLinkList pathname={null} />}>
      <ActiveNavLinks onNavigate={closeMenu} />
    </Suspense>
  );

  return (
    <header className={isScrolled ? "is-scrolled" : undefined}>
      <div className="header-inner">
        <Link href="/" className="header-logo">
          <span>✦</span>
          <span>PlayPick</span>
        </Link>

        <nav className="desktop-nav">{navLinks}</nav>

        <div className="profile-bar">
          <SearchBox autoFocusShortcut />

          <RegionSelect compact />

          <Link
            href="/favorites"
            className="header-icon-link"
            aria-label={`Избранное: ${favoritesCount}`}
          >
            <Heart size={18} />
            {favoritesCount > 0 && <span className="header-badge">{favoritesCount}</span>}
          </Link>

          {session.user ? (
            <Link href="/account" className="header-avatar-link" aria-label={`Аккаунт: ${session.user.name}`} title={session.user.name}>
              {session.user.name.slice(0, 1).toUpperCase()}
            </Link>
          ) : (
            <Link href="/login" className={`header-login ${session.status === "loading" ? "is-loading" : ""}`}>
              <UserRound size={16} /> <span>Войти</span>
            </Link>
          )}
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
          <SearchBox className="mobile-search" onNavigate={closeMenu} />
          {navLinks}
          <Link href={session.user ? "/account" : "/login"} onClick={closeMenu}>
            {session.user ? `Аккаунт · ${session.user.name}` : "Войти"}
          </Link>
          <RegionSelect align="left" />
        </nav>
      )}
    </header>
  );
}
