"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CONTACT_EMAILS } from "../site-links";

const CONTACT_FORM_CC_EMAIL = "2019garrawayf@gmail.com";

const contactOptions = [
  ["co-creation", "共創・プロジェクト相談"],
  ["event", "イベント開催相談"],
  ["media", "取材・視察"],
  ["other", "その他"],
] as const;

type ContactType = (typeof contactOptions)[number][0];

const isContactType = (value: string): value is ContactType =>
  contactOptions.some(([key]) => key === value);

export default function ContactForm({ initialType = "co-creation" }: { initialType?: string }) {
  const [contactType, setContactType] = useState<ContactType>(() =>
    isContactType(initialType) ? initialType : "co-creation",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requestedType = new URLSearchParams(window.location.search).get("type") || "";
    const timer = window.setTimeout(() => {
      if (isContactType(requestedType)) setContactType(requestedType);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const body = [
      `相談種別: ${contactOptions.find(([key]) => key === contactType)?.[1] || "その他"}`,
      `お名前: ${String(data.get("name") || "")}`,
      `会社・団体名: ${String(data.get("organization") || "")}`,
      `メールアドレス: ${String(data.get("email") || "")}`,
      `電話番号: ${String(data.get("phone") || "")}`,
      "",
      "ご相談内容:",
      String(data.get("inquiry") || ""),
    ].join("\n");
    const mailto = `mailto:${CONTACT_EMAILS[0]}?cc=${encodeURIComponent(CONTACT_FORM_CC_EMAIL)}&subject=${encodeURIComponent("Garraway Fへのお問い合わせ")}&body=${encodeURIComponent(body)}`;

    setMessage("メールアプリを開きました。内容を確認して送信してください。");
    window.location.href = mailto;
  };

  return (
    <section className="contactFormSection" id="contact-form" tabIndex={-1} aria-labelledby="contact-form-title">
      <header className="contactFormHead">
        <p className="sectionTag">SEND YOUR QUESTION</p>
        <h2 id="contact-form-title">問いを、<br />聞かせてください。</h2>
        <p>入力後にメールアプリが開きます。内容を確認して送信してください。</p>
      </header>

      <div className="contactFormBoard">
        <aside>
          <span>DELIVERED TO</span>
          <strong>01</strong>
          <div>
            {CONTACT_EMAILS.map((email) => <a href={`mailto:${email}`} key={email}>{email}</a>)}
          </div>
          <p>入力内容はサイトに保存されません。メールアプリで送信すると、公式窓口へ届きます。</p>
        </aside>

        <form className="contactForm" onSubmit={handleSubmit}>
          <label className="contactFormField contactFormWide">
            <span>01 / 相談内容 <b>必須</b></span>
            <select value={contactType} onChange={(event) => setContactType(event.target.value as ContactType)} required>
              {contactOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>

          <label className="contactFormField">
            <span>02 / お名前 <b>必須</b></span>
            <input name="name" type="text" autoComplete="name" maxLength={100} required />
          </label>

          <label className="contactFormField">
            <span>03 / 会社・団体名</span>
            <input name="organization" type="text" autoComplete="organization" maxLength={120} />
          </label>

          <label className="contactFormField">
            <span>04 / メールアドレス <b>必須</b></span>
            <input name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required />
          </label>

          <label className="contactFormField">
            <span>05 / 電話番号</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} />
          </label>

          <label className="contactFormField contactFormWide">
            <span>06 / ご相談内容 <b>必須</b></span>
            <textarea
              name="inquiry"
              rows={8}
              minLength={20}
              maxLength={4000}
              placeholder="背景、実現したいこと、最初に試したいことなどをご記入ください。"
              required
            />
          </label>

          <label className="contactFormConsent contactFormWide">
            <input name="consent" type="checkbox" value="yes" required />
            <span>
              <Link href="/privacy">プライバシーポリシー</Link>を確認し、問い合わせ情報の取扱いに同意します。
            </span>
          </label>

          <div className="contactFormSubmit contactFormWide">
            <button type="submit">
              <span>メールアプリで送信する</span><b>→</b>
            </button>
            <p className="contactFormStatus" role="status" aria-live="polite">
              {message || "宛先：info@garrawayf.com"}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
