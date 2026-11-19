/**
 * Parâmetros de regra que a versão nova mudou em relação ao Prancheta.html original.
 * Os testes de paridade usam `applyLegacyRules()` para continuar comparando com o original;
 * o jogo usa os valores de `CURRENT_RULES`.
 */
export interface Rules {
  /** multiplicador da evolução anual dos jovens até 21 anos */
  youthGrowth: number;
  /** multiplicador do desgaste físico em campo */
  fatigue: number;
  /**
   * recuperação por rodada:
   * - 'flat': soma `recovery * (0.75 + res/40)` (original)
   * - 'pct': recupera a fração `recovery + res/100` do que falta para 100
   * - 'rest': recupera a fração `1 - e^(-dias / (recovery * (1.25 - res/40)))` do que falta para 100,
   *   ou seja, depende dos dias de descanso até a rodada seguinte (uma semana devolve ~65%, três dias ~36%)
   */
  recoveryMode: 'flat' | 'pct' | 'rest';
  recovery: number;
  /** rendimento = fitBase + fitImpact * condição/100 (original: 0.72 + 0.28) */
  fitBase: number;
  fitImpact: number;
  /** peso da condição na escalação automática: base + peso * condição/100 (titulares e banco) */
  aiFitBase: number;
  aiFit: number;
  benchFitBase: number;
  benchFit: number;
  /** quanto o cansaço aumenta a chance de lesão (0 = não aumenta) */
  tiredInjury: number;
  /** multiplicador da chance de lesão em campo */
  injuryRate: number;
  /** chance de uma lesão ser longa (6 a 16 jogos) em vez de curta (1 a 4) */
  longInjury: number;
  /** multiplicador da chance de cartão numa falta */
  cardRate: number;
  /** peso da nota média da temporada no rendimento, por ponto acima/abaixo de 6,5 (0 = não pesa) */
  formImpact: number;
  /** mercado e contratos: contratos vencem, transferências, empréstimos, jogadores livres */
  market: boolean;
  /**
   * público dos jogos:
   * - 'fill': ocupação do estádio pela reputação (original; estádio grande sempre enche mais)
   * - 'demand': torcida pela reputação, limitada pela capacidade (estádio pequeno pode lotar, grande nem sempre)
   */
  gateModel: 'fill' | 'demand';
  /**
   * patrocínio anual = folha anual * fator:
   * - 'rep': 0,8 + reputação/250 (original)
   * - 'div': fator da divisão (A 0,54 · B 0,68 · C 0,58 · D 0,85 · sul-americanos 0,68) + (reputação − típica)/300
   */
  sponsorModel: 'rep' | 'div';
  /** 'rounds': o jogo anda de rodada em rodada (original); 'days': anda dia a dia, com copas */
  calendar: 'rounds' | 'days';
  /**
   * evolução dos jogadores:
   * - 'legacy': jovens até 21 evoluem na temporada; os outros mudam só na virada, por faixa de idade (original)
   * - 'curve': curva de carreira com teto escondido, evolução semanal pela minutagem, queda depois dos 30 e
   *   aposentadoria anunciada seis meses antes
   */
  career: 'legacy' | 'curve';
  /** fração do cansaço do jogo que passa logo depois da partida (0 = nada, como no original) */
  postMatchRecovery: number;
  /**
   * lesões:
   * - 'legacy': chance por lance com peso fraco do cansaço e duração curta ou longa (original)
   * - 'risk': risco por jogador (cansaço, idade, carga de jogos, recaída), tipos de lesão com duração própria
   */
  injuryModel: 'legacy' | 'risk';
}

export const LEGACY_RULES: Readonly<Rules> = {
  youthGrowth: 1,
  fatigue: 1,
  recoveryMode: 'flat',
  recovery: 20,
  fitBase: 0.72,
  fitImpact: 0.28,
  aiFitBase: 0.75,
  aiFit: 0.25,
  benchFitBase: 0.8,
  benchFit: 0.2,
  tiredInjury: 0,
  injuryRate: 1,
  longInjury: 0.15,
  cardRate: 1,
  formImpact: 0,
  market: false,
  gateModel: 'fill',
  sponsorModel: 'rep',
  calendar: 'rounds',
  career: 'legacy',
  postMatchRecovery: 0,
  injuryModel: 'legacy',
};

export const CURRENT_RULES: Readonly<Rules> = {
  youthGrowth: 0.5,
  fatigue: 2.2,
  recoveryMode: 'rest',
  recovery: 10,
  fitBase: 0.67,
  fitImpact: 0.33,
  aiFitBase: 0.65,
  aiFit: 0.35,
  benchFitBase: 0.72,
  benchFit: 0.28,
  tiredInjury: 1,
  injuryRate: 0.6,
  longInjury: 0.1,
  cardRate: 0.5,
  formImpact: 0.02,
  market: true,
  gateModel: 'demand',
  sponsorModel: 'div',
  calendar: 'days',
  career: 'curve',
  postMatchRecovery: 0,
  injuryModel: 'risk',
};

/** Regras em vigor (mutável de propósito, para os testes trocarem). */
export const RULES: Rules = { ...CURRENT_RULES };

export const applyLegacyRules = (): void => void Object.assign(RULES, LEGACY_RULES);
export const applyCurrentRules = (): void => void Object.assign(RULES, CURRENT_RULES);

/** Fração do cansaço que some com `rest` dias de descanso (modo 'rest'). */
export const restRecovery = (rest: number, res: number): number =>
  1 - Math.exp(-rest / (RULES.recovery * (1.25 - res / 40)));

/** Condição depois da recuperação entre uma rodada e a seguinte (`rest` = dias de descanso). */
export const recoverFitness = (f: number, res: number, rest = 7): number => {
  if (RULES.recoveryMode === 'flat') return Math.min(100, f + RULES.recovery * (0.75 + res / 40));
  const frac = RULES.recoveryMode === 'pct' ? Math.min(1, RULES.recovery + res / 100) : restRecovery(rest, res);
  return Math.min(100, f + (100 - f) * frac);
};
