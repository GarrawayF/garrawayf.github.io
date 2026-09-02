import type { Metadata } from "next";
import Link from "next/link";
import EventsLive from "./events-live";
import { SubpageFooter, SubpageHeader } from "../subpage-chrome";
import { SITE_LINKS } from "../site-links";

export const metadata: Metadata = {
  title: "イベント情報｜Garraway F",
  description: "Garraway Fで開催されるイベントと、Instagram・Facebookから届く最新情報をご案内します。",
};

export default function EventsPage() {
  return (
    <main id="top" className="subpage">
      <SubpageHeader />
      <section className="subpageHero eventPageHero">
        <div>
          <p><span /> EVENTS / NEWS</p>
          <h1>ここから、<br /><em>次の挑戦が始まる。</em></h1>
          <a className="eventHeroJump" href="#event-index-title">開催情報を見る <b>↓</b></a>
        </div>
        <aside>
          <strong>EVENTS</strong>
          <p>開催予定とアーカイブを、ひと目で。気になる企画から詳細へ進めます。</p>
          <a href={SITE_LINKS.facebookEvents} target="_blank" rel="noreferrer">FACEBOOK EVENTS ↗</a>
        </aside>
      </section>
      <EventsLive />
      <section className="subpageClosing">
        <span>HOST OR CO-CREATE</span>
        <h2>次は、あなたの問いを。</h2>
        <p>共創・イベント開催・取材のご相談はこちらから。</p>
        <Link href="/contact">相談窓口へ進む <b>→</b></Link>
      </section>
      <SubpageFooter />
    </main>
  );
}
