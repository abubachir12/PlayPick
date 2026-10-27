"use client";

import { Suspense, useEffect, useState } from "react";
import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, Search, X } from "lucide-react";
import { useLibrary } from "@/lib/use-library";

const links = [
  { href: "/", label: "Главная" },
  { href: "/games", label: "Игры" },
  { href: "/pick", label: "Подбор" },
  { href: "/favorites", label: "Избранное" },
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

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
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
          <Form action="/games" className="search-wrapper" role="search">
            <Search size={16} className="search-icon" />

            <input
              className="search"
              type="search"
              name="search"
              maxLength={200}
              placeholder="Поиск игр..."
              aria-label="Поиск игр"
            />
          </Form>

          <Link
            href="/favorites"
            className="header-icon-link"
            aria-label={`Избранное: ${favoritesCount}`}
          >
            <Heart size={18} />
            {favoritesCount > 0 && <span className="header-badge">{favoritesCount}</span>}
          </Link>
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
          <Form action="/games" className="mobile-search" role="search" onSubmit={closeMenu}>
            <Search size={16} className="search-icon" />
            <input
              className="search"
              type="search"
              name="search"
              maxLength={200}
              placeholder="Поиск игр..."
              aria-label="Поиск игр"
            />
          </Form>
          {navLinks}
        </nav>
      )}
    </header>
  );
}
