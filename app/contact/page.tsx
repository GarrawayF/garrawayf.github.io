import type { Metadata } from "next";
import { SubpageFooter, SubpageHeader } from "../subpage-chrome";
import { SITE_LINKS } from "../site-links";
import ContactForm from "./contact-form";
import Phrase from "../phrase";

export const metadata: Metadata = {
  title: "相談・お問い合わせ｜Garraway F",
  description: "共創・プロジェクト、イベント開催、取材・視察など、Garraway Fへのご相談窓口です。",
};

export default function ContactPage() {
  return (
    <main id="top" className="subpage contactPage">
      <SubpageHeader />
      <section className="subpageHero contactPageHero">
        <div>
          <p><span /> CONTACT</p>
          <h1><span className="wordUnit">相談から、</span><wbr /><em className="wordUnit">共創は始まる。</em></h1>
        </div>
      </section>

      <ContactForm initialType="co-creation" />

      <section className="contactPrinciples">
        <div>
          <p className="sectionTag">FOR EVENT HOSTS</p>
          <h2><span className="wordUnit">場所を借りる</span><wbr /><span className="wordUnit">だけでなく、</span><br /><span className="wordUnit">次の挑戦に</span><wbr /><span className="wordUnit">つなげる。</span></h2>
        </div>
        <ol>
          <li><span>01</span>Garraway Fの目的と運営方針を理解する</li>
          <li><span>02</span>主催者から参加者へGarraway Fを紹介する</li>
          <li><span>03</span>無料利用であること、テーマへの共感により開催できることを伝える</li>
          <li><span>04</span>参加者や地域の次の挑戦につながる場にする</li>
        </ol>
      </section>

      <section className="contactVisitCta">
        <div><span>JUST VISITING?</span><h2><Phrase parts={["初めて", "訪れる方へ。"]} /></h2><p>個人での初回来館は、公式LINEから会員登録をお願いします。</p></div>
        <a href={SITE_LINKS.line} target="_blank" rel="noreferrer">LINEで参加する <b>↗</b></a>
      </section>
      <SubpageFooter />
    </main>
  );
}
