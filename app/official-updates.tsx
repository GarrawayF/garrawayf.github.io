import Link from "next/link";
import OfficialListings from "./official-listings";
import Phrase from "./phrase";
import SocialLinks from "./social-links";
import { listingBuildTime, siteUpdates } from "./site-updates";
import styles from "./official-updates.module.css";

export default function OfficialUpdates() {
  return (
    <section className="socialLiveSection" id="news" aria-labelledby="news-heading">
      <header className="socialLiveHead">
        <p className="sectionTag">06 / NEWS &amp; EVENTS</p>
        <h2 id="news-heading"><Phrase parts={["お知らせ・", "イベント"]} /></h2>
      </header>

      <div className={styles.homeBoard}>
        <OfficialListings {...siteUpdates} initialNow={listingBuildTime} compact />
      </div>
      <Link className="socialEventsButton" href="/events">
        <span>イベント情報を一覧で見る</span><b aria-hidden="true">→</b>
      </Link>

      <h3 className={styles.channelTitle}>公式SNS</h3>
      <SocialLinks />
    </section>
  );
}
