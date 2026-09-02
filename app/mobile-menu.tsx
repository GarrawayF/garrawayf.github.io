"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MobileMenuProps = {
  subpage?: boolean;
};

export default function MobileMenu({ subpage = false }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const home = subpage ? "/" : "";

  useEffect(() => {
    const previous = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <details
      className="mobileMenu"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label={open ? "メニューを閉じる" : "メニューを開く"}>
        <span /><span /><span />
      </summary>
      <nav aria-label="モバイルナビゲーション">
        <Link href={`${home}#about`} onClick={close}>ABOUT</Link>
        <Link href={`${home}#how`} onClick={close}>HOW IT WORKS</Link>
        <Link href={`${home}#people`} onClick={close}>PEOPLE</Link>
        <Link href={`${home}#news`} onClick={close}>SOCIAL LIVE</Link>
        <Link href="/events" onClick={close}>EVENTS</Link>
        <Link href={`${home}#floor`} onClick={close}>FLOOR</Link>
        <Link href={`${home}#join`} onClick={close}>JOIN</Link>
        <Link href={`${home}#access`} onClick={close}>ACCESS</Link>
        <Link href="/contact" onClick={close}>CONTACT</Link>
      </nav>
    </details>
  );
}
