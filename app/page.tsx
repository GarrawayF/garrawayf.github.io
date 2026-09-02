import SocialLive from "./social-live";
import Link from "next/link";
import { withBasePath } from "./base-path";
import { SITE_LINKS } from "./site-links";
import MobileMenu from "./mobile-menu";

const stats = [
  { value: "24,000", label: "COMMUNITY MEMBERS", ja: "コミュニティ会員" },
  { value: "88,888", label: "TOTAL VISITS", ja: "累計来館" },
  { value: "100+", label: "CO-CREATIONS", ja: "共創プロジェクト" },
];

const participantTypes = [
  {
    no: "01",
    en: "CHALLENGER",
    title: "挑戦する人",
    body: "まだ形になっていない想いを、行動に変えたい人。",
    examples: ["起業家", "社内起案者", "学生チーム", "地域プレイヤー"],
    tone: "blue",
  },
  {
    no: "02",
    en: "ISSUE OWNER",
    title: "課題の当事者",
    body: "現場にある痛みや願いを、自分の言葉で語れる人。",
    examples: ["地域住民", "商店主", "医療・福祉の現場職員", "地域事業者"],
    tone: "pink",
  },
  {
    no: "03",
    en: "ASSET HOLDER",
    title: "技術アセットの保有者",
    body: "技術、知見、場所、ネットワークを、解決の力としてひらく人。",
    examples: ["AI・センサー企業", "大学・研究機関", "データ保有者", "施設運営者"],
    tone: "yellow",
  },
];

const impactFlow = [
  { no: "01", icon: "＋", en: "ENCOUNTER", title: "出会い", body: "立場を越えて、人・問い・可能性をつなぐ。", output: "共創の入口" },
  { no: "02", icon: "◎", en: "EMPATHY", title: "共感", body: "当事者の声に触れ、課題を自分ごとにする。", output: "共通の目的" },
  { no: "03", icon: "↗", en: "CHALLENGE", title: "挑戦", body: "できることから小さく試し、現場で学ぶ。", output: "実証・学び" },
  { no: "04", icon: "◉", en: "SHARE", title: "発信", body: "想いとプロセスをひらき、次の仲間を呼ぶ。", output: "次の出会い" },
];

const people = [
  {
    role: "BUSINESS PRODUCER",
    title: "ビジネスプロデューサー",
    body: "想いをプロジェクトへ変え、挑戦が動き出す仕組みをつくります。",
    image: withBasePath("/images/people/img_engineer_01-pc.webp"),
  },
  {
    role: "OKAMI",
    title: "女将",
    body: "初めて来た日からつながりが生まれる、心地よい場と共創の循環を育てます。",
    image: withBasePath("/images/people/img_engineer_02-pc.webp"),
  },
  {
    role: "CONCIERGE",
    title: "コンシェルジュ",
    body: "一人ひとりの想いに寄り添い、人・課題・機会をつなぎます。",
    image: withBasePath("/images/people/img_engineer_03-pc.webp"),
  },
];

const futuristBase = withBasePath("/images/people");
const futurists = [
  { image: "img_futurist01.webp", name: "両角 将太", org: "F Ventures", role: "代表" },
  { image: "img_futurist02.webp", name: "池田 美奈子", org: "Edit-and-Design", role: "編集者・デザイン研究者" },
  { image: "img_futurist05.webp", name: "石丸 修平", org: "福岡地域戦略推進協議会", role: "事務局長" },
  { image: "img_futurist06.webp", name: "東 博暢", org: "日本総合研究所", role: "主席研究員" },
  { image: "img_futurist07.webp", name: "岸原 稔泰", org: "GxPartners", role: "代表パートナー & CEO" },
  { image: "img_futurist09.webp", name: "村岡 浩司", org: "一平ホールディングス", role: "代表取締役社長" },
  { image: "img_futurist10.webp", name: "中村 俊介", org: "しくみデザイン", role: "代表取締役" },
  { image: "img_futurist11.webp", name: "今津 研太郎", org: "TRIART", role: "代表取締役社長" },
  { image: "img_futurist12.webp", name: "岩永 真一", org: "福岡テンジン大学", role: "学長" },
  { image: "img_futurist13.webp", name: "松岡 恭子", org: "スピングラス・アーキテクツ", role: "建築家・代表取締役" },
  { image: "img_futurist14.webp", name: "最首 英裕", org: "グルーヴノーツ", role: "代表取締役社長" },
  { image: "img_futurist15.webp", name: "森田 泰暢", org: "福岡大学 商学部", role: "准教授" },
  { image: "img_futurist16.webp", name: "木村 忠昭", org: "アドライト", role: "代表取締役CEO" },
  { image: "img_futurist17.webp", name: "中島 賢一", org: "福岡eスポーツ協会", role: "会長" },
  { image: "img_futurist18.webp", name: "宮代 陽之", org: "国際経済研究所", role: "非常勤フェロー" },
  { image: "img_futurist20.webp", name: "森戸 裕一", org: "日本DX推進協会", role: "代表理事" },
  { image: "img_futurist27.webp", name: "成田 智哉", org: "マドラー", role: "代表取締役" },
  { image: "img_futurist31.webp", name: "神田 佑亮", org: "呉工業高等専門学校", role: "教授" },
  { image: "img_futurist32.webp", name: "日高 洋祐", org: "MaaS Tech Japan", role: "代表取締役" },
  { image: "img_futurist34.webp", name: "辻 悠佑", org: "東京大学協創プラットフォーム開発", role: "マネージングパートナー" },
  { image: "img_futurist35.webp", name: "髙田 理世", org: "シェアリングエコノミー協会", role: "九州支部副支部長" },
  { image: "img_futurist37.webp", name: "黒瀬 武史", org: "九州大学大学院", role: "教授・都市デザイン" },
  { image: "img_futurist38.webp", name: "三木 浩江", org: "NEO福岡", role: "会長" },
];

const spaces = [
  {
    no: "01",
    title: "LIVING LAB",
    mode: "対話・プロジェクト",
    body: "問いを立て、対話し、プロジェクトを動かす中心空間。",
    image: withBasePath("/images/floor-living-lab.webp"),
    position: "center 35%",
    wide: true,
  },
  {
    no: "02",
    title: "KITCHEN & DINING",
    mode: "食事・交流",
    body: "食事や休憩をきっかけに、自然な交流が生まれる。",
    image: withBasePath("/images/floor-monozukuri-lab.webp"),
    position: "center",
  },
  {
    no: "03",
    title: "SERENDIPITY STREET",
    mode: "偶然の出会い",
    body: "移動の途中にも、偶然の会話と新しいつながりが生まれる。",
    image: withBasePath("/images/serendipity-street.jpg"),
  },
  {
    no: "04",
    title: "モノづくりラボ",
    mode: "試作・共創",
    body: "アイデアを可視化し、試しながら形にしていく共創空間。",
    image: withBasePath("/images/floor-monozukuri-lab-community.webp"),
    position: "center",
  },
  {
    no: "05",
    title: "STUDIO & FOCUS",
    mode: "発信・集中",
    body: "発信に集中するスタジオと、個人で深く取り組める静かな空間。",
    image: withBasePath("/images/floor-studio-focus.webp"),
    position: "center 42%",
  },
];

const joinSteps = [
  { no: "01", title: "公式LINEから\n会員登録", body: "案内に沿って、お名前・メールアドレス・ご所属などを入力します。", mark: "LINE" },
  { no: "02", title: "来館したら\nチェックイン", body: "QRコードでチェックインし、今月の参加チケットを記入します。", mark: "CHECK" },
  { no: "03", title: "対話から\nスタート", body: "チケットをコンシェルジュへ。最初のつながりが始まります。", mark: "HELLO!" },
];

const consultationPaths = [
  { no: "01", en: "CO-CREATION", title: "共創・プロジェクト", body: "社会課題／新規事業／実証実験／技術連携", href: "/contact?type=co-creation#contact-form" },
  { no: "02", en: "HOST AN EVENT", title: "イベント開催", body: "トーク／ワークショップ／共創イベント", href: "/contact?type=event#contact-form" },
  { no: "03", en: "MEDIA / VISIT", title: "取材・視察", body: "メディア取材／企業・自治体等の視察", href: "/contact?type=media#contact-form" },
  { no: "04", en: "OTHER", title: "その他", body: "登壇／協業／相談先が分からない内容", href: "/contact?type=other#contact-form" },
];

export default function Home() {
  return (
    <main id="top">
      <a className="skipLink" href="#about">本文へスキップ</a>
      <header className="siteHeader">
        <a className="brand" href="#top" aria-label="Garraway F トップへ">
          Garraway<span>F</span>
        </a>
        <nav className="desktopNav" aria-label="メインナビゲーション">
          <a href="#about">ABOUT</a>
          <a href="#people">PEOPLE</a>
          <Link href="/events">EVENTS</Link>
          <a href="#floor">FLOOR</a>
          <a href="#access">ACCESS</a>
          <Link href="/contact">CONTACT</Link>
        </nav>
        <a className="headerCta" href={SITE_LINKS.line} target="_blank" rel="noreferrer">
          LINE<span className="headerCtaSuffix">で参加</span><b aria-hidden="true">↗</b>
        </a>
        <MobileMenu />
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="heroNoise" aria-hidden="true" />
        <div className="heroCopy">
          <p className="eyebrow"><span /> SOCIAL IMPLEMENTATION LIVING LAB</p>
          <h1 id="hero-title">
            問いが、<br />
            仲間と出会い、<br />
            <em>挑戦になる。</em>
          </h1>
          <p className="heroLead">
            挑戦する人、課題の当事者、技術やアセットを持つ仲間が出会い、
            できることから小さく始める、福岡・天神のリビングラボ。
          </p>
          <div className="heroActions">
            <a className="primaryButton" href="#about">Garraway Fを知る <span>↓</span></a>
            <a className="textButton" href="#join">はじめての方へ <span>→</span></a>
          </div>
        </div>

        <div className="heroVisual">
          <div className="heroPhotoFrame">
            <img
              src={withBasePath("/images/hero-community.jpg")}
              alt="Garraway Fで対話する人々"
              fetchPriority="high"
            />
          </div>
          <div className="heroSticker heroStickerOne">OPEN TO<br /><b>EVERYONE!</b></div>
          <div className="heroSticker heroStickerTwo">FUKUOKA<br /><b>TENJIN</b></div>
          <div className="heroF" aria-hidden="true">F</div>
        </div>

        <div className="heroStatus">
          <span className="statusDot" />
          <div><b>OPEN WEEKDAYS</b><small>MON–FRI / 10:00–20:00</small></div>
        </div>
      </section>

      <div className="ticker" aria-label="Garraway Fの合言葉">
        <div>
          <span>SERENDIPITY</span><i>✦</i><span>CO-CREATION</span><i>✦</i>
          <span>やりましょうよ！</span><i>✦</i><span>SERENDIPITY</span><i>✦</i>
          <span>CO-CREATION</span><i>✦</i><span>やりましょうよ！</span><i>✦</i>
        </div>
      </div>

      <section className="stats" aria-label="Garraway Fの実績">
        <p className="statsIntro">SINCE 2019 / AS OF AUG 2026<br /><b>つながりが、動き出している。</b></p>
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}<small>{stat.ja}</small></span>
          </div>
        ))}
      </section>

      <section className="about" id="about">
        <div className="sectionKicker">01 <span /> WHAT IS GARRAWAY F?</div>
        <div className="aboutGrid">
          <div className="aboutTitle">
            <p>対話で終わらず、<br />実践へ進む。</p>
            <h2>社会課題に挑戦する<br /><em>仲間づくりの場。</em></h2>
          </div>
          <div className="aboutBody">
            <p className="aboutLead">
              Garraway Fは、社会課題を<br />
              小さな実践へ変える<br />
              <b>“まちのリビングラボ”</b>です。
            </p>
            <p>
              立場の違う人が集まり、福岡・天神のまちを舞台に、
              できることから試し、結果から学び、次の挑戦へつなげます。
            </p>
          </div>
        </div>
      </section>

      <section className="participantSection" id="how" aria-labelledby="participant-title">
        <header className="participantHead">
          <div className="sectionKicker">02 <span /> CO-CREATION PLAYERS</div>
          <h2 id="participant-title">
            <small>WHO MEETS HERE</small>
            <span><b>3</b>つの属性</span>
          </h2>
          <p><strong>違う立場が、ひとつの問いでつながる。</strong>視点と力が重なることで、一人では届かない可能性が動き出します。</p>
        </header>
        <p className="mobileRailHint" aria-hidden="true">3 PROFILES / SWIPE →</p>
        <div className="labSteps" role="region" aria-label="3つの属性。横にスワイプして確認できます" tabIndex={0}>
          {participantTypes.map((step) => (
            <article className={`labStep ${step.tone}`} key={step.no}>
              <div className="stepTop"><span>{step.no} / 03</span><b>{step.en}</b></div>
              <div className="stepMark" aria-hidden="true">{step.en.slice(0, 1)}</div>
              <div className="stepContent">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
              <div className="stepExamples">
                <small>EXAMPLES</small>
                <ul>
                  {step.examples.map((example) => <li key={example}>{example}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="impactFlow" id="engine" aria-labelledby="impact-title">
        <header className="impactHead">
          <div className="sectionKicker">03 <span /> CO-CREATION ENGINE</div>
          <h2 id="impact-title">
            <small>FOUR FUNCTIONS</small>
            <span><b>4</b>つの機能</span>
          </h2>
          <p><strong>出会いを、次の挑戦へ。</strong>人と問いを「出会い・共感・挑戦・発信」で前へ動かし、発信から次の出会いを生み出します。</p>
        </header>
        <div className="engineMap" aria-label="3つの属性が4つの機能を通じて次の挑戦へつながる構造">
          <div className="engineMapInput">
            <small>INPUT / 3 ATTRIBUTES</small>
            <strong>3つの属性</strong>
            <p>挑戦する人・課題の当事者・技術アセットの保有者</p>
          </div>
          <i aria-hidden="true">→</i>
          <div className="engineMapProcess">
            <small>ENGINE / 4 FUNCTIONS</small>
            <strong>4つの機能</strong>
            <p>出会い → 共感 → 挑戦 → 発信</p>
          </div>
          <i aria-hidden="true">→</i>
          <div className="engineMapOutcome">
            <small>OUTCOME / NEXT</small>
            <strong>次の挑戦</strong>
            <p>NEXT CHALLENGE</p>
          </div>
        </div>
        <ol className="flowGrid" aria-label="4つの機能：出会い、共感、挑戦、発信">
          {impactFlow.map((stage) => (
            <li className="flowCard" key={stage.no}>
              <div className="flowTop"><span>{stage.no} / 04</span><b>{stage.en}</b></div>
              <div className="flowCore">
                <div className="flowIcon" aria-hidden="true">{stage.icon}</div>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </div>
              <small className="flowOutput"><span>OUTPUT</span><b>{stage.output}</b></small>
            </li>
          ))}
        </ol>
        <div className="flowReturn" aria-label="発信が次の出会いにつながり循環する">
          <span>04 / SHARE</span>
          <b>発信が、次の出会いを生む。</b>
          <i aria-hidden="true">↺ 01</i>
        </div>
        <div className="flowEngine" aria-label="3つの属性と4つの機能から次の挑戦を生み出す共創エンジン">
          <span>GARRAWAY F / CO-CREATION ENGINE</span>
          <div className="flowEquation">
            <div><small>INPUT</small><b>3つの属性</b></div>
            <i aria-hidden="true">×</i>
            <div><small>ENGINE</small><b>4つの機能</b></div>
            <i aria-hidden="true">=</i>
            <strong><small>OUTCOME</small><b>次の挑戦</b></strong>
          </div>
        </div>
      </section>

      <section className="peopleSection" id="people">
        <header className="sectionIntro light">
          <div className="sectionKicker">04 <span /> CULTURAL ENGINEERS</div>
          <h2>人が、人をつなぐ。</h2>
          <p>仕組みだけでは場は動かない。想いを聴き、関係をつなぎ、一歩目を一緒につくる人がいます。</p>
        </header>
        <div className="peopleGrid">
          {people.map((person, index) => (
            <article className="personCard" key={person.role}>
              <div className="personImage">
                <img src={person.image} alt={person.title} loading="lazy" />
                <span>0{index + 1}</span>
              </div>
              <div className="personCopy">
                <small>{person.role}</small>
                <h3>{person.title}</h3>
                <p>{person.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="futuristsSection" aria-labelledby="futurists-title">
        <header className="futuristsHead">
          <div>
            <div className="sectionKicker">05 <span /> FUTURISTS</div>
            <h2 id="futurists-title">23 FUTURISTS</h2>
          </div>
          <p>多様な専門性と実践知を持ち、Garraway Fとともに少し先の未来を考える仲間たち。</p>
          <span className="scrollHint">SWIPE →</span>
        </header>
        <div className="futuristRail" role="region" aria-label="23人のFUTURISTS。横にスワイプして確認できます" tabIndex={0}>
          {futurists.map((person, index) => (
            <article className="futuristCard" key={person.name}>
              <div className="futuristImage">
                <img src={`${futuristBase}/${person.image}`} alt={person.name} loading="lazy" />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3>{person.name}</h3>
              <p>{person.org}</p>
              <small>{person.role}</small>
            </article>
          ))}
        </div>
      </section>

      <SocialLive />

      <section className="floorSection" id="floor">
        <header className="floorHead">
          <div className="sectionKicker">07 <span /> FLOOR / TENJIN CLASS 3F</div>
          <h2>偶然が生まれる、<br /><em>150席の実験室。</em></h2>
          <p>集中する、話す、つくる、食べる。目的の違う空間がひとつの街のようにつながっています。</p>
        </header>
        <div className="floorIndexLabel" aria-hidden="true">
          <span>FLOOR INDEX</span>
          <b>05 SPACES</b>
        </div>
        <div className="spaceGrid" role="list" aria-label="5つの空間一覧">
          {spaces.map((space) => (
            <figure className={`spaceCard ${space.wide ? "spaceWide" : ""}`} key={space.no} role="listitem">
              <div className="spaceThumb">
                <img src={space.image} alt={space.title} loading="lazy" style={{ objectPosition: space.position || "center" }} />
                <span className="spacePhotoNo" aria-hidden="true">{space.no}</span>
              </div>
              <figcaption>
                <span>{space.no}</span>
                <h3>{space.title}</h3>
                <small className="spaceMode">{space.mode}</small>
                <p>{space.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="floorMap">
          <div>
            <span>GARRAWAY F / FLOOR SYSTEM</span>
            <h3>歩けば、誰かと出会う。</h3>
            <p>空間を横断するSerendipity Streetが、すべての場所と人をつなぎます。</p>
          </div>
          <img
            src={withBasePath("/assets/floor-map.svg")}
            alt="Garraway F 天神CLASS 3階 フロアマップ"
            loading="lazy"
          />
        </div>
      </section>

      <section className="joinSection" id="join">
        <header className="joinHead">
          <div className="sectionKicker">08 <span /> JOIN THE COMMUNITY</div>
          <h2>参加は、<br /><em>かんたん3ステップ。</em></h2>
          <p>つながりを求める方なら、どなたでも無料です。</p>
        </header>
        <p className="joinRoute" aria-label="LINE登録からチェックイン、対話へ">
          <span>LINE登録</span><i aria-hidden="true">→</i>
          <span>CHECK-IN</span><i aria-hidden="true">→</i>
          <span>対話</span>
        </p>
        <div className="joinGrid" aria-label="参加までの3ステップ">
          {joinSteps.map((step, index) => (
            <article className={`joinCard joinTone${index + 1}`} key={step.no}>
              <div className="joinStepRail" aria-hidden="true"><span>{step.no}</span><b>{step.mark}</b></div>
              <div className="joinStepBody">
                <span className="joinStepIcon" aria-hidden="true">{index === 0 ? "＋" : index === 1 ? "✓" : "●"}</span>
                <small>STEP {step.no}</small>
                <h3>{step.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h3>
                <p>{step.body}</p>
                {index === 0 && (
                  <a href={SITE_LINKS.line} target="_blank" rel="noreferrer">
                    <span>LINEで無料登録</span><b aria-hidden="true">↗</b>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="joinNote">作業だけを目的とした場所ではなく、対話と参加から新しいつながりを育てる場です。</p>
      </section>

      <section className="accessSection" id="access">
        <div className="accessCopy">
          <div className="sectionKicker">09 <span /> ACCESS</div>
          <h2>天神の、<br /><em>まちのリビングへ。</em></h2>
          <div className="accessDetails">
            <div><span>OPEN</span><b>10:00–20:00</b><small>MON–FRI</small></div>
            <div><span>ADDRESS</span><p>〒810-0021<br />福岡市中央区今泉1丁目19番22号<br /><b>天神CLASS 3階</b></p></div>
          </div>
          <a href="https://www.google.com/maps/search/?api=1&query=%E7%A6%8F%E5%B2%A1%E5%B8%82%E4%B8%AD%E5%A4%AE%E5%8C%BA%E4%BB%8A%E6%B3%891%E4%B8%81%E7%9B%AE19%E7%95%AA22%E5%8F%B7" target="_blank" rel="noreferrer">
            GOOGLE MAPSで開く <span>↗</span>
          </a>
        </div>
        <div className="mapWrap">
          <iframe
            title="Garraway F Google Map"
            src="https://www.google.com/maps?q=%E7%A6%8F%E5%B2%A1%E5%B8%82%E4%B8%AD%E5%A4%AE%E5%8C%BA%E4%BB%8A%E6%B3%891%E4%B8%81%E7%9B%AE19%E7%95%AA22%E5%8F%B7&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <span>FUKUOKA / 33.587°N</span>
        </div>
        <div className="accessPhoto">
          <a
            href={withBasePath("/images/access-tenjin-class-3f.webp")}
            target="_blank"
            rel="noreferrer"
            aria-label="アクセス案内画像を大きく表示"
          >
            <img
              src={withBasePath("/images/access-tenjin-class-3f.webp")}
              alt="天神CLASSの外観と、Garraway Fが3階にあることを示すアクセス案内"
              width="1448"
              height="1086"
              loading="lazy"
              decoding="async"
            />
          </a>
        </div>
      </section>

      <section className="consultationSection" id="contact" aria-labelledby="consultation-title">
        <header className="consultationHead">
          <div className="sectionKicker">10 <span /> START A CONVERSATION</div>
          <div className="consultationTitle">
            <span>CONTACT FORM / STEP 01</span>
            <h2 id="consultation-title">まず、<br /><em>相談を選ぶ。</em></h2>
          </div>
          <div className="consultationIntro">
            <strong>4つの入口から、<br />一番近いものを。</strong>
            <p>選んだ相談種別は、次のフォームへ自動で引き継がれます。迷った場合は「その他」を選んでください。</p>
          </div>
        </header>

        <div className="consultationBoard">
          <aside className="consultationProcess" aria-label="お問い合わせの流れ">
            <div className="consultationProcessHead">
              <span>HOW IT WORKS</span>
              <strong>3<small>STEPS</small></strong>
            </div>
            <ol>
              <li><b>01</b><span>相談を選ぶ</span></li>
              <li><b>02</b><span>内容を入力</span></li>
              <li><b>03</b><span>メールで送信</span></li>
            </ol>
            <p><b>約3分</b>で入力できます。問いがまだ言葉になっていなくても、まずは近い入口を選んでください。</p>
          </aside>

          <nav className="consultationChooser" aria-label="相談内容を選択">
            <div className="consultationChooserHead">
              <span>STEP 01 / CHOOSE ONE</span>
              <strong>相談内容を選択 <b>必須</b></strong>
            </div>
            <ol className="consultationGrid">
              {consultationPaths.map((item) => (
                <li key={item.no}>
                  <Link className="consultationCard" href={item.href}>
                    <span className="consultationCardNo" aria-hidden="true">{item.no}<small>/ 04</small></span>
                    <span className="consultationCardCopy">
                      <b aria-hidden="true">{item.en}</b>
                      <strong>{item.title}</strong>
                      <small>{item.body}</small>
                    </span>
                    <span className="consultationCardCta">
                      <span>入力フォームへ<small>相談種別を自動反映</small></span>
                      <b aria-hidden="true">→</b>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="consultationPrivacy"><b>MAIL APP</b> 入力後にメールアプリが開きます。入力内容はサイトに保存されません。<Link href="/privacy">個人情報の取扱いはこちら</Link></p>
          </nav>
        </div>
      </section>

      <section className="closing">
        <span>LET&apos;S MAKE IT HAPPEN.</span>
        <h2>やりましょうよ！</h2>
        <p>偶然の出会いを、次の挑戦へ。</p>
        <a href={SITE_LINKS.line} target="_blank" rel="noreferrer">
          <span>公式LINEから参加する</span><b>↗</b>
        </a>
      </section>

      <footer className="siteFooter">
        <div>
          <a className="brand footerBrand" href="#top">Garraway<span>F</span></a>
          <p>社会課題に挑戦する、まちのリビングラボ。</p>
        </div>
        <nav aria-label="関連リンク">
          <Link href="/events">Events →</Link>
          <Link href="/contact">Contact →</Link>
          <Link href="/privacy">Privacy →</Link>
          <a href={SITE_LINKS.webAppTerms} target="_blank" rel="noreferrer">App Terms ↗</a>
          <a href={SITE_LINKS.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>
          <a href={SITE_LINKS.facebook} target="_blank" rel="noreferrer">Facebook ↗</a>
          <a href={SITE_LINKS.x} target="_blank" rel="noreferrer">X ↗</a>
          <a href={SITE_LINKS.note} target="_blank" rel="noreferrer">note ↗</a>
        </nav>
        <small>FUKUOKA / TENJIN CLASS 3F<br />運営主体：トヨタ自動車株式会社<br />運営受託者：株式会社Serendipity<br />© GARRAWAY F</small>
      </footer>
    </main>
  );
}
