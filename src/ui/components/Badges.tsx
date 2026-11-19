import {
  injuryRisk,
  POS_GROUP,
  riskLevel,
  RULES,
  youthFac,
  type Club,
  type Player,
  type Pos,
  type World,
} from '@/core';
import { fitColor, ovrCls, strVal } from '../format';

export const Ovr = ({ v }: { v: number }) => <span className={`ovr ${ovrCls(v)}`}>{v}</span>;

export const PosTag = ({ p }: { p: Pos }) => <span className={`pos pg${POS_GROUP[p]}`}>{p}</span>;

export const FitBar = ({ f }: { f: number }) => (
  <div className="bar" title={`Condição ${Math.round(f)}%`}>
    <i style={{ width: `${Math.round(f)}%`, background: fitColor(f) }} />
  </div>
);

export const MoraleBar = ({ m }: { m: number }) => (
  <div className="bar" title={`Moral ${Math.round(m)}`}>
    <i
      style={{
        width: `${Math.round(m)}%`,
        background: m > 70 ? 'var(--ok)' : m > 45 ? 'var(--blue)' : 'var(--orange)',
      }}
    />
  </div>
);

export const FormStrip = ({ form }: { form: string[] }) => (
  <span className="form">
    {form.slice(-5).map((r, i) => (
      <span key={i} className={`f${r}`}>
        {r}
      </span>
    ))}
  </span>
);

const fiveStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export const FacilityStars = ({ club }: { club: Club }) => {
  const f = youthFac(club);
  const n = f >= 1.15 ? 5 : f >= 1.08 ? 4 : f >= 1.0 ? 3 : f >= 0.95 ? 2 : 1;
  return (
    <span className="stars" title="Estrutura da base">
      {fiveStars(n)}
    </span>
  );
};

/** Força do elenco em estrelas (meia estrela de precisão). */
export const StrengthStars = ({ s }: { s: number }) => {
  const v = Math.round(strVal(s) * 2) / 2;
  return (
    <span
      className="sstars"
      title={`Força ${v.toLocaleString('pt-BR')} de 5 (média dos 13 melhores: ${s.toFixed(1)})`}
      aria-label={`${v} de 5 estrelas`}
    >
      <span className="bg">★★★★★</span>
      <span className="fg" style={{ width: `${(v / 5) * 100}%` }}>
        ★★★★★
      </span>
    </span>
  );
};

export const StatusTags = ({ p }: { p: Player }) => (
  <>
    {p.inj > 0 && (
      <span className="tag inj" title="Lesionado">
        LES {p.inj}
      </span>
    )}
    {p.sus > 0 && (
      <span className="tag sus" title="Suspenso">
        SUSP
      </span>
    )}
    {p.ret != null && (
      <span className="tag ret" title="Avisou que vai encerrar a carreira no fim da temporada">
        aposenta
      </span>
    )}
  </>
);

/** Selo de risco de lesão (só médio e alto), com o motivo na dica. */
export const RiskTag = ({ W, p, short }: { W: World; p: Player; short?: boolean }) => {
  if (RULES.injuryModel !== 'risk' || p.inj > 0 || p.c < 0) return null;
  const r = injuryRisk(W, p);
  const lv = riskLevel(r.w);
  if (lv === 'baixo') return null;
  return (
    <span
      className={`tag risk ${lv === 'alto' ? 'hi' : 'md'}`}
      title={`Risco de lesão ${lv}: ${r.why.join(', ') || 'desgaste'}`}
    >
      {short ? '⚠' : `risco ${lv}`}
    </span>
  );
};

/** Botões segmentados (escolha única). */
export function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
