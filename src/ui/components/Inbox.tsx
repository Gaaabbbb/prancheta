import { useState } from 'react';
import { readNews, unreadNews, type NewsItem, type World } from '@/core';
import { useGame } from '@/store/gameStore';
import { useUi } from '@/store/uiStore';
import { newsKind } from '../inbox/newsActions';

type Filter = 'all' | 'unread' | 'open';
const FILTERS: [Filter, string][] = [
  ['all', 'Todas'],
  ['unread', 'Não lidas'],
  ['open', 'Sem ação'],
];
const PAGE = 10;

/** Caixa de entrada: novas em negrito, clique para ler e agir. */
export function Inbox({ W }: { W: World }) {
  const mutate = useGame((s) => s.mutate);
  const openModal = useUi((s) => s.openModal);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);
  const unread = unreadNews(W);
  const list = W.news.filter((n) => (filter === 'unread' ? !n.rd : filter === 'open' ? !n.ac : true));

  const open = (n: NewsItem) => {
    if (!n.rd) mutate(() => readNews(n));
    openModal({ kind: 'news', item: n });
  };

  return (
    <div className="panel">
      <h3>
        <span>
          Caixa de entrada <small>{unread ? `${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'tudo lido'}</small>
        </span>
        {unread > 0 && (
          <button
            className="btn ghost sm"
            onClick={() => {
              mutate((W) => W.news.forEach(readNews));
              void useGame.getState().save();
            }}
          >
            Marcar todas como lidas
          </button>
        )}
      </h3>
      <div className="seg" style={{ marginBottom: 8 }}>
        {FILTERS.map(([k, l]) => (
          <button
            key={k}
            className={filter === k ? 'on' : ''}
            onClick={() => {
              setFilter(k);
              setShown(PAGE);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="news">
        {list.length === 0 && <p className="muted">{filter === 'all' ? 'Sem notícias.' : 'Nada por aqui.'}</p>}
        {list.slice(0, shown).map((n, i) => {
          const kind = newsKind(n.k);
          return (
            <button key={`${n.y}-${n.d}-${i}-${n.t}`} className={`it ${n.rd ? '' : 'new'}`} onClick={() => open(n)}>
              <span className="when">
                {n.y} d{n.d}
              </span>
              <span className="nk" style={{ color: kind.color }}>
                {kind.label}
              </span>
              <b>{n.t}</b>
              <span className="bd">{n.b}</span>
              {n.ac && <span className="ac">✓ {n.ac}</span>}
            </button>
          );
        })}
      </div>
      {list.length > shown && (
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setShown((s) => s + PAGE)}>
          Mostrar mais ({list.length - shown})
        </button>
      )}
    </div>
  );
}
