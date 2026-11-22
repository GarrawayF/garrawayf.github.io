/** Presentation labels describe the word, never the team that used it. */
export const keywordCategories = [
  { id: "people", label: "人・対象", short: "人・対象" },
  { id: "place", label: "場所", short: "場所" },
  { id: "situation", label: "課題・状況", short: "課題・状況" },
  { id: "means", label: "手段・アイデア", short: "手段・案" },
  { id: "value", label: "効果・価値", short: "効果・価値" },
  { id: "other", label: "その他・文脈次第", short: "その他" },
] as const;

type Category = typeof keywordCategories[number]["id"];
const words: Record<Exclude<Category,"other">, string> = {
  people: "人 子ども 子供 こども 親子 親子連れ 保護者 高齢者 住民 利用者 来訪者 旅行者 観光客 店主 店員 スタッフ 施設担当 駅員 配送担当者 当事者 参加者 地域住民",
  place: "場所 駅 駅前 品川 品川駅 改札 出口 広場 商店街 店 店舗 カフェ 喫茶店 通路 道路 歩道 休憩所 休憩場所 避難所 駅前広場 交差点 屋内 店先 待合室",
  situation: "時間 待ち合わせ 休憩 乗り換え 荷物 雨 雨の日 雨宿り 段差 混雑 人混み 渋滞 迷う すれ違い 移動中 寄り道 災害 停電 避難 荷下ろし 寒さ 暑さ 風 騒音 雑踏 待ち時間",
  means: "写真 カード 屋根 案内 地図 ベンチ 看板 アプリ 通知 合図 短文 メッセージ ピクトグラム 案内札 目印 矢印 道案内 多言語 スロープ 手すり 椅子 声かけ 掲示 提案 試す 掲示板 サイン 電話 携帯 スマホ 案内図 乗車券",
  value: "安心 安全 快適 便利 楽しさ 信頼 交流 共感 満足 効率 時間短縮 負担軽減 わかりやすさ 分かりやすさ 使いやすさ 行きやすさ 歩きやすさ 通りやすさ 休みやすさ 一体感",
};
const byWord = new Map<string, Category>();
for (const [category, entries] of Object.entries(words)) {
  for (const word of entries.split(" ")) byWord.set(word, category as Category);
}
export function classifyKeyword(label: string) {
  const key = label.normalize("NFKC").trim().replace(/^[「『【"]+|[」』】"]+$/g, "");
  const id = byWord.get(key) ?? "other";
  return keywordCategories.find(category => category.id === id)!;
}
