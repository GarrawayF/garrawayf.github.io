import type { Metadata } from "next";
import Link from "next/link";
import OfficialListings from "../official-listings";
import { SubpageFooter, SubpageHeader } from "../subpage-chrome";
import { SITE_LINKS } from "../site-links";
import { listingBuildTime, siteUpdates } from "../site-updates";
import Phrase from "../phrase";
import styles from "../official-updates.module.css";

export const metadata: Metadata = {
  title: "イベント情報｜Garraway F",
  description: "Garraway Fで開催されるイベントの日程・会場と、開催アーカイブをご案内します。",
};

export default function EventsPage() {
  return (
    <main id="top" className="subpage">
      <SubpageHeader />
      <section className="subpageHero eventPageHero">
        <div>
          <p><span /> EVENTS / NEWS</p>
          <h1><Phrase parts={["ここから、"]} /><br /><em><Phrase parts={["次の挑戦が", "始まる。"]} /></em></h1>
          <a className="eventHeroJump" href="#upcoming-events">開催予定 <b>↓</b></a>
          {" "}
          <a className="eventHeroJump" href="#past-events">開催アーカイブ <b>↓</b></a>
        </div>
        <aside>
          <strong>EVENTS</strong>
          <p>開催予定とアーカイブを、ひと目で。気になる企画から詳細へ進めます。</p>
        </aside>
      </section>
      <section className="eventIndexSection" aria-labelledby="event-index-title">
        <header className="eventIndexHead">
          <p className="sectionTag">EVENT INFORMATION</p>
          <h2 id="event-index-title"><Phrase parts={["開催情報"]} /></h2>
        </header>
        <div className="eventIndexLayout">
          <OfficialListings {...siteUpdates} initialNow={listingBuildTime} />
          <aside className={styles.aside} aria-labelledby="event-social-links">
            <h3 className={styles.listTitle} id="event-social-links">公式SNS</h3>
            <ul>
              <li><a className={styles.detailLink} href={SITE_LINKS.facebookEvents} target="_blank" rel="noreferrer">Facebookイベント ↗</a></li>
              <li><a className={styles.detailLink} href={SITE_LINKS.instagram} target="_blank" rel="noreferrer">Instagram ↗</a></li>
              <li><Link className={styles.detailLink} href="/#social-links">公式SNS一覧 →</Link></li>
            </ul>
          </aside>
        </div>
      </section>
      <section className="subpageClosing">
        <span>HOST OR CO-CREATE</span>
        <h2><Phrase parts={["次は、", "あなたの", "問いを。"]} /></h2>
        <p>共創・イベント開催・取材のご相談はこちらから。</p>
        <Link href="/contact">相談窓口へ進む <b>→</b></Link>
      </section>
      <SubpageFooter />
    </main>
  );
}
