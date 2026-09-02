import Link from "next/link";
import { SITE_LINKS } from "./site-links";
import MobileMenu from "./mobile-menu";

export function SubpageHeader() {
  return (
    <header className="siteHeader subpageSiteHeader">
      <Link className="brand" href="/#top" aria-label="Garraway F トップへ">
        Garraway<span>F</span>
      </Link>
      <nav className="desktopNav" aria-label="メインナビゲーション">
        <Link href="/#about">ABOUT</Link>
        <Link href="/#people">PEOPLE</Link>
        <Link href="/events">EVENTS</Link>
        <Link href="/#floor">FLOOR</Link>
        <Link href="/contact">CONTACT</Link>
      </nav>
      <a className="headerCta" href={SITE_LINKS.line} target="_blank" rel="noreferrer">
        LINE<span className="headerCtaSuffix">で参加</span><b aria-hidden="true">↗</b>
      </a>
      <MobileMenu subpage />
    </header>
  );
}

export function SubpageFooter() {
  return (
    <footer className="siteFooter subpageFooter">
      <div>
        <Link className="brand footerBrand" href="/#top">Garraway<span>F</span></Link>
        <p>社会課題に挑戦する、まちのリビングラボ。</p>
      </div>
      <nav aria-label="関連リンク">
        <Link href="/events">Events →</Link>
        <Link href="/contact">Contact →</Link>
        <Link href="/privacy">Privacy →</Link>
        <a href={SITE_LINKS.webAppTerms} target="_blank" rel="noreferrer">App Terms ↗</a>
        <a href={SITE_LINKS.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>
        <a href={SITE_LINKS.facebook} target="_blank" rel="noreferrer">Facebook ↗</a>
        <a href={SITE_LINKS.x} target="_blank" rel="noreferrer">X ↗</a>
        <a href={SITE_LINKS.note} target="_blank" rel="noreferrer">note ↗</a>
      </nav>
      <small>FUKUOKA / TENJIN CLASS 3F<br />運営主体：トヨタ自動車株式会社<br />運営受託者：株式会社Serendipity<br />© GARRAWAY F</small>
    </footer>
  );
}
