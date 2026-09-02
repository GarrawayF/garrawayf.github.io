import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAILS, SITE_LINKS } from "../site-links";
import { SubpageFooter, SubpageHeader } from "../subpage-chrome";

export const metadata: Metadata = {
  title: "プライバシーポリシー｜Garraway F",
  description: "Garraway F公式ウェブサイトにおける個人情報の取扱いをご案内します。",
};

const externalTransmissions = [
  {
    service: "GitHub Pages",
    policy: "https://docs.github.com/ja/site-policy/privacy-policies/github-general-privacy-statement",
  },
  {
    service: "Google Fonts・Google マップ",
    policy: "https://policies.google.com/privacy?hl=ja",
  },
  {
    service: "Facebook",
    policy: "https://www.facebook.com/privacy/policy/",
  },
  {
    service: "Instagram",
    policy: "https://privacycenter.instagram.com/policy/",
  },
] as const;

export default function PrivacyPage() {
  return (
    <main id="top" className="subpage privacyPage">
      <SubpageHeader />

      <section className="subpageHero privacyPageHero">
        <div>
          <p><span /> PRIVACY &amp; DATA</p>
          <h1>大切な情報を、<br /><em>誠実に扱う。</em></h1>
        </div>
        <aside>
          <strong>POLICY</strong>
          <p>Garraway F公式ウェブサイトにおける個人情報の取扱いを定めます。</p>
          <a href="#policy">本文を確認する ↓</a>
        </aside>
      </section>

      <article className="privacyDocument" id="policy">
        <header className="privacyDocumentHead">
          <p>制定日：2026年9月2日</p>
          <h2>プライバシーポリシー</h2>
          <p>
            Garraway Fの運営主体はトヨタ自動車株式会社です。株式会社Serendipityは、
            運営委託契約に基づき、本サイトの運用と問い合わせ対応を行います。
          </p>
          <div className="privacyScopeNote">
            <strong>対象範囲</strong>
            <p>本ポリシーは本サイトに適用されます。会員登録、チェックイン、ポイント、注文・決済等を行うGarraway F Webアプリには、別途定める利用規約・プライバシーポリシーが適用されます。</p>
            <a href={SITE_LINKS.webAppTerms} target="_blank" rel="noreferrer">Webアプリ利用規約・プライバシーポリシー ↗</a>
          </div>
        </header>

        <section>
          <span className="privacySectionNo">01</span>
          <div>
            <h2>個人情報の取扱い</h2>
            <p>お問い合わせで取得する氏名、連絡先、内容等は、回答・連絡およびGarraway Fの運営に必要な範囲で利用し、必要に応じてトヨタ自動車株式会社へ報告します。株式会社Serendipityは、同社の指示と運営委託契約に従って取り扱います。</p>
            <p className="privacyCallout">入力内容は本サイトのサーバーには保存されません。送信時に利用者のメールアプリから公式窓口へ送信されます。</p>
            <p>受信したメールは対応に必要な期間のみ保管し、不要となった後に削除します。</p>
          </div>
        </section>

        <section>
          <span className="privacySectionNo">02</span>
          <div>
            <h2>Cookie・外部送信</h2>
            <p>本サイトは独自のアクセス解析や広告配信を行いません。サイト配信や外部コンテンツの表示に伴い、IPアドレス、端末・ブラウザ情報、Cookie等が各サービス提供者へ送信されることがあります。</p>
            <p>
              {externalTransmissions.map((item, index) => (
                <span key={item.service}>
                  {index > 0 && " / "}
                  <a href={item.policy} target="_blank" rel="noreferrer">{item.service}</a>
                </span>
              ))}
            </p>
          </div>
        </section>

        <section className="privacyContactSection">
          <span className="privacySectionNo">03</span>
          <div>
            <h2>お問い合わせ窓口</h2>
            <p>個人情報に関するお問い合わせは、株式会社Serendipityが下記窓口で受け付け、トヨタ自動車株式会社と連携して対応します。</p>
            <dl>
              <div><dt>運営主体</dt><dd>トヨタ自動車株式会社</dd></div>
              <div><dt>運営受託者</dt><dd>株式会社Serendipity</dd></div>
              <div>
                <dt>窓口</dt>
                <dd>
                  {CONTACT_EMAILS.map((email) => <a href={`mailto:${email}`} key={email}>{email}</a>)}
                </dd>
              </div>
            </dl>
            <p><a href={SITE_LINKS.toyotaPrivacy} target="_blank" rel="noreferrer">トヨタ自動車株式会社「個人情報に関する基本方針」 ↗</a></p>
            <p><a href={SITE_LINKS.toyotaCompany} target="_blank" rel="noreferrer">トヨタ自動車株式会社「会社概要」 ↗</a></p>
          </div>
        </section>

        <nav className="privacyEndLinks" aria-label="関連する方針と窓口">
          <Link href="/contact">お問い合わせへ進む →</Link>
          <a href={SITE_LINKS.webAppTerms} target="_blank" rel="noreferrer">Webアプリ規約を確認する ↗</a>
        </nav>
      </article>

      <SubpageFooter />
    </main>
  );
}
