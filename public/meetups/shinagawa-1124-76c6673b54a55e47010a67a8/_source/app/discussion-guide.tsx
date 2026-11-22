"use client";

import { NotebookPen, Pencil, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import "./discussion-guide.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenMemo?: () => void;
  onWrite?: () => void;
};

export default function DiscussionGuide({ open, onClose, onOpenMemo, onWrite }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open || !dialog.current) return;
    const modal = dialog.current;
    modal.showModal();
    return () => { if (modal.open) modal.close(); };
  }, [open]);

  function leave(next?: () => void) {
    dialog.current?.close();
    onClose();
    next?.();
  }

  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      className="discussion-guide"
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); leave(); }}
      onClick={event => {
        if (event.target === event.currentTarget) leave();
      }}
    >
      <div className="discussion-guide-surface">
        <header className="discussion-guide-header">
          <h2 id={titleId}>今日の進め方</h2>
          <button type="button" className="discussion-guide-close" onClick={() => leave()} aria-label="今日の進め方を閉じる" autoFocus>
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        <div className="discussion-guide-content" tabIndex={0} role="region" aria-label="午後の流れ">
          <p className="discussion-guide-intro">品川で「誰と、何を試してみたいか」を持ち寄ります。</p>
          <p className="discussion-guide-speakers">牧村和彦さん、宮代陽之さん、南奈津子さんの順に、講演と対話を3回繰り返します。</p>
          <section>
            <h3><span>講演 30分</span>聞きながら個人メモ</h3>
            <p>品川で過ごす誰か一人を思い浮かべ、困っている場面や、できたらうれしい体験をメモします。</p>
          </section>
          <section>
            <h3><span>対話 30分</span>班で一人ひと言</h3>
            <p>時間があれば隣の人と一人1分ずつ。班で自分の案か、共感した理由を話し、一件ずつ投稿します。講師名は振り返るための目印。複数の講演をまたぐ案も同じ欄へ。紙・口頭の案は記録役が入力します。</p>
            <p>各回の最後の5分は「班でまとめる」を開きます。自分の班を選び、投稿・キーワード・マインドマップを見ながら、品川で試したいことを書きます。16:30からの10分で3回分を見渡し、発表したいテーマを選びます。「発表を見る」では全員の案を読めます。質問や共感した理由は、それぞれの案の「コメント」に書けます。</p>
          </section>
          <section>
            <h3><span>16:40から</span>5班の発表と会場の対話</h3>
            <p>講師3人・田中大裕さん・植野直亮が前に並び、植野が会場の声を拾います。「班でまとめる」の「全体対話」を選び、会場で生まれた挑戦テーマを追加します。元になった個人の案は2件までつなげられます。</p>
            <p>続きを話したい人と、ネットワーキングで次の一歩へ。</p>
          </section>
          <div className="discussion-guide-answer">
            <h3>発表は、何を使えばいい？</h3>
            <p>各班2分。紙・口頭・スライドのどれでも、伝えやすい方法でどうぞ。</p>
          </div>
        </div>
        {(onOpenMemo || onWrite) && (
          <footer className="discussion-guide-actions">
            {onOpenMemo && <button type="button" onClick={() => leave(onOpenMemo)}><NotebookPen size={17} aria-hidden="true" />個人メモを開く</button>}
            {onWrite && <button type="button" className="discussion-guide-write" onClick={() => leave(onWrite)}><Pencil size={17} aria-hidden="true" />案を書く</button>}
          </footer>
        )}
      </div>
    </dialog>
  );
}
