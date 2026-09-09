import styles from "./ramen-tech-special.module.css";

export default function RamenTechSpecial() {
  return (
    <aside className={styles.wrap} aria-label="RAMEN TECH 2026 特設サイト">
      <a className={styles.card} href="/ramen-tech-2026/">
        <span className={styles.kicker}>SPECIAL SITE / 2026</span>
        <strong>RAMEN<br />TECH</strong>
        <span className={styles.copy}>全イベント検索・移動込み<br />マイスケジュールをつくる</span>
        <span className={styles.cta}>OPEN ↗</span>
      </a>
    </aside>
  );
}
