import { useState } from 'react';
import { COUNTRIES, DIVS, FOREIGN, type Div } from '@/core';
import { sortClubs } from '../sortClubs';
import { useUi } from '@/store/uiStore';
import { StrengthStars, Seg } from '../components/Badges';
import { Crest } from '../components/Crest';
import { DivTabs } from '../components/DivTabs';
import type { PageProps } from './types';

export function Clubs({ W }: PageProps) {
  const { tab, clubSort, set, openModal } = useUi();
  const div: Div = tab && ([...DIVS, 'SUL'] as string[]).includes(tab) ? tab : W.clubs[W.user!].div;
  const [country, setCountry] = useState<string>('ARG');
  const clubs = W.clubs.filter((c) => c.div === div && (div !== 'SUL' || c.country === country));
  const str = sortClubs(W, clubs, clubSort);
  return (
    <>
      <div className="ph">
        <h2>Clubes</h2>
        <span className="sp" />
        <Seg
          options={[
            { value: 'str', label: 'Força do elenco' },
            { value: 'az', label: 'Ordem alfabética' },
          ]}
          value={clubSort}
          onChange={(v) => set({ clubSort: v })}
        />
      </div>
      <DivTabs value={div} withSul onChange={(d) => set({ tab: d, stage: null, rday: null })} />
      {div === 'SUL' && (
        <div className="seg" style={{ margin: '0 0 12px' }}>
          {FOREIGN.map((k) => (
            <button key={k} className={country === k ? 'on' : ''} onClick={() => setCountry(k)}>
              {COUNTRIES[k]}
            </button>
          ))}
        </div>
      )}
      <div className="clubgrid">
        {clubs.map((c) => (
          <button
            key={c.id}
            className={`clubcard ${c.id === W.user ? 'on' : ''}`}
            onClick={() => openModal({ kind: 'club', id: c.id })}
          >
            <Crest club={c} size={30} />
            <div style={{ minWidth: 0 }}>
              <b>{c.n}</b>
              <span>{c.div === 'SUL' ? COUNTRIES[c.country!] : c.uf}</span> <StrengthStars s={str[c.id]} />
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
