import Image from "next/image";
import { withBasePath } from "./base-path";
import { SITE_LINKS } from "./site-links";
import styles from "./social-links.module.css";

const socials = [
  { name: "LINE", detail: "公式アカウント", href: SITE_LINKS.line, brand: "line", icon: "line.png" },
  { name: "Facebook", detail: "Garraway F", href: SITE_LINKS.facebook, brand: "facebook", icon: "facebook.png" },
  { name: "Instagram", detail: "GarrawayF公式", href: SITE_LINKS.instagram, brand: "instagram", icon: "instagram.svg" },
  { name: "Instagram", detail: "GarrawayF図書館", href: SITE_LINKS.libraryInstagram, brand: "instagram", icon: "instagram.svg" },
  { name: "X", detail: "旧Twitter", href: SITE_LINKS.x, brand: "x", icon: "x.svg" },
  { name: "note", detail: "Garraway F", href: SITE_LINKS.note, brand: "note", icon: "note.png" },
] as const;

export default function SocialLinks() {
  return (
    <nav id="social-links" className={styles.links} aria-label="Garraway F公式SNS">
      {socials.map(({ name, detail, href, brand, icon }) => (
        <a
          className={`${styles.card} ${styles[brand]}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name}（${detail}）を開く（新しいタブ）`}
          key={href}
        >
          <span className={styles.icon} aria-hidden="true">
            <Image src={withBasePath(`/assets/social/${icon}`)} alt="" width={56} height={56} />
          </span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
          <span className={styles.copy}>
            <span className={styles.name}>{name}</span>
            <span className={styles.detail}>{detail}</span>
          </span>
        </a>
      ))}
    </nav>
  );
}
