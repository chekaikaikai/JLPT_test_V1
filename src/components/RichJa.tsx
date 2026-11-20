import type { ReactNode } from 'react';

const TOKEN = /(\[\[.+?\]\]|＿＿＿|★|（[１-９]）)/g;

/**
 * 渲染題幹／文章：
 *  [[文字]] → 底線；＿＿＿ → 空格；★ → 紅框；（１）→ 編號空格
 */
export function RichJa({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(TOKEN).filter((s) => s !== '');
  const nodes: ReactNode[] = parts.map((s, i) => {
    if (s.startsWith('[[') && s.endsWith(']]')) return <u key={i} className="underline decoration-2 underline-offset-[6px]">{s.slice(2, -2)}</u>;
    if (s === '＿＿＿') return <span key={i} className="blank" aria-label="空格">&nbsp;</span>;
    if (s === '★') return <span key={i} className="blank-star" aria-label="星號空格">★</span>;
    if (/^（[１-９]）$/.test(s)) return <span key={i} className="num-blank">{s}</span>;
    return <span key={i}>{s}</span>;
  });
  return <span className={`ja whitespace-pre-line ${className}`}>{nodes}</span>;
}
