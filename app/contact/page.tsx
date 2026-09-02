import type { Metadata } from "next";
import Link from "next/link";
import { SubpageFooter, SubpageHeader } from "../subpage-chrome";
import { SITE_LINKS } from "../site-links";
import ContactForm from "./contact-form";

export const metadata: Metadata = {
  title: "相談・お問い合わせ｜Garraway F",
  description: "共創・プロジェクト、イベント開催、取材・視察など、Garraway Fへのご相談窓口です。",
};

const contactTypes = [
  {
    id: "co-creation",
    no: "01",
    en: "CO-CREATION",
    title: "共創・プロジェクト相談",
    body: "社会課題、現場の困りごと、技術やアセットを持ち寄り、小さな実践を始めたい方へ。",
    guide: "課題・保有アセット・最初に試したいことをご記入ください。",
    tone: "contactBlue",
  },
  {
    id: "event",
    no: "02",
    en: "HOST AN EVENT",
    title: "イベント開催相談",
    body: "Garraway Fの目的に共感し、参加者の次の挑戦につながるイベントを開催したい方へ。",
    guide: "目的・テーマ・対象者・開催希望日をご記入ください。",
    tone: "contactPink",
  },
  {
    id: "media",
    no: "03",
    en: "MEDIA / VISIT",
    title: "取材・視察",
    body: "リビングラボの運営、共創事例、コミュニティづくりについて取材・視察したい方へ。",
    guide: "媒体・目的・希望日時・掲載予定をご記入ください。",
    tone: "contactYellow",
  },
  {
    id: "other",
    no: "04",
    en: "OTHER",
    title: "その他",
    body: "上記に当てはまらないご質問や、相談先が分からない内容はこちらから。",
    guide: "ご相談の背景と確認したいことをご記入ください。",
    tone: "contactWhite",
  },
];

export default function ContactPage() {
  return (
    <main id="top" className="subpage">
      <SubpageHeader />
      <section className="subpageHero contactPageHero">
        <div>
          <p><span /> START A CONVERSATION</p>
          <h1>相談から、<br /><em>共創は始まる。</em></h1>
        </div>
        <aside>
          <strong>4 WAYS</strong>
          <p>目的に近い入口を選んでください。相談内容を確認し、担当者からご連絡します。</p>
          <a href="#contact-form">相談内容を入力する ↓</a>
        </aside>
      </section>

      <section className="contactChoiceSection" aria-labelledby="contact-choice-title">
        <header>
          <p className="sectionTag">CHOOSE YOUR PURPOSE</p>
          <h2 id="contact-choice-title">何を、<br />一緒に始めますか。</h2>
          <p>目的に近い入口を選ぶと、下のフォームに相談種別が自動で反映されます。</p>
        </header>
        <div className="contactChoiceGrid" role="region" aria-label="4つの相談窓口。横にスワイプして選択できます" tabIndex={0}>
          {contactTypes.map((item) => (
            <article className={`contactChoiceCard ${item.tone}`} id={item.id} key={item.no}>
              <div><span>{item.no} / 04</span><b>{item.en}</b></div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <small>{item.guide}</small>
              <Link href={`/contact?type=${item.id}#contact-form`}>
                この内容で相談する <b>↓</b>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <ContactForm initialType="co-creation" />

      <section className="contactPrinciples">
        <div>
          <p className="sectionTag">FOR EVENT HOSTS</p>
          <h2>場所を借りるだけでなく、<br />次の挑戦につなげる。</h2>
        </div>
        <ol>
          <li><span>01</span>Garraway Fの目的と運営方針を理解する</li>
          <li><span>02</span>主催者から参加者へGarraway Fを紹介する</li>
          <li><span>03</span>無料利用であること、テーマへの共感により開催できることを伝える</li>
          <li><span>04</span>参加者や地域の次の挑戦につながる場にする</li>
        </ol>
      </section>

      <section className="contactVisitCta">
        <div><span>JUST VISITING?</span><h2>初めて訪れる方へ。</h2><p>個人での初回来館は、公式LINEから会員登録をお願いします。</p></div>
        <a href={SITE_LINKS.line} target="_blank" rel="noreferrer">LINEで参加する <b>↗</b></a>
      </section>
      <SubpageFooter />
    </main>
  );
}
