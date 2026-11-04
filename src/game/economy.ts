import { addDays, addMonths, clamp, hash } from './random';
import { clubById } from './npc';
import { notify, remember } from './chronicle';
import {
  facilityKinds,
  type Career,
  type Economy,
  type FacilityKind,
  type Fixture,
  type SponsorDeal,
  type World,
} from './types';

/** Economia do clube do usuário. Os clubes da IA seguem com as fórmulas simples da engine. */

const round = (n: number, step: number) => Math.round(n / step) * step;
const money = (n: number) =>
  n >= 1e6 ? `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} mi` : `R$ ${Math.round(n / 1000)} mil`;
const day = (d: string) => d.split('-').reverse().join('/');

function clubInfo(c: Career, world: World) {
  const club = world.clubs.find((x) => x.id === c.clubId);
  return {
    reputation: club?.reputation ?? 70,
    league: club?.league ?? 'A',
    budget: club?.budget ?? 20e6,
  };
}

/** 0 para reputação 60, 1 para reputação 87. */
const span = (rep: number) => clamp((rep - 60) / 27, 0, 1.15);

export const facilityPlans: Record<
  FacilityKind,
  { label: string; cost: number[]; days: number[]; upkeep: number }
> = {
  stadium: {
    label: 'Estádio',
    cost: [0, 0, 12e6, 25e6, 45e6, 80e6],
    days: [0, 0, 120, 180, 240, 300],
    upkeep: 40000,
  },
  training: {
    label: 'Centro de Treinamento',
    cost: [0, 0, 6e6, 12e6, 22e6, 38e6],
    days: [0, 0, 60, 90, 120, 180],
    upkeep: 30000,
  },
  youth: {
    label: 'Categorias de Base',
    cost: [0, 0, 4e6, 8e6, 15e6, 26e6],
    days: [0, 0, 60, 90, 120, 150],
    upkeep: 20000,
  },
};

export function startLevel(kind: FacilityKind, rep: number, clubId: string) {
  const raw =
    kind === 'stadium'
      ? 1 + Math.floor((rep - 58) / 8)
      : kind === 'training'
        ? 1 + Math.floor((rep - 60) / 8)
        : 1 + Math.floor((rep - 62 + (hash(`${clubId}:base:nivel`) % 9)) / 8);
  return clamp(raw, 1, 4);
}

export const baseCapacity = (rep: number, clubId: string) =>
  Math.max(12000, round(15000 + span(rep) * 55000 + (hash(`${clubId}:capacidade`) % 5001) - 2500, 100));

/** Cada nível de estádio acima do original amplia a capacidade em 8%. */
export const capacityAt = (level: number, rep: number, clubId: string) =>
  round(baseCapacity(rep, clubId) * (1 + 0.08 * (level - startLevel('stadium', rep, clubId))), 100);

export const refTicket = (rep: number) => round(30 + span(rep) * 32, 5);
export const refFee = (rep: number) => round(20 + span(rep) * 27, 5);
export const baseMembers = (rep: number) => round(2000 + span(rep) ** 2 * 50000, 100);
/** Cota de TV do clube do usuário (o patrocínio master é pago à parte). */
export const tvIncome = (rep: number) => Math.round(rep * 75000 + 3e6);
export const sponsorBase = (rep: number, league: 'A' | 'B', fans: number) =>
  round(rep * 28000 * (league === 'A' ? 1 : 0.75) * (0.85 + fans / 400), 10000);

export const trainingEffect = (level: number) => ({
  /** Bônus no ganho de evolução dos atletas. */
  growth: 0.05 * (level - 1),
  /** Perda diária de ritmo de jogo. */
  decay: 0.15 - 0.02 * (level - 1),
  /** Redução na chance e no tempo de lesão em jogo. */
  injury: 0.04 * (level - 1),
});
/** Pontos de potencial a mais para cada jovem revelado pela base. */
export const youthBonus = (level: number) => Math.round((level - 1) * 1.5);

const storedLevel = (c: Career, kind: FacilityKind) =>
  c.living?.economy?.clubId === c.clubId ? c.living.economy.facilities[kind] : 1;
export const trainingLevel = (c: Career) => storedLevel(c, 'training');
export const youthLevel = (c: Career) => storedLevel(c, 'youth');

export const upkeep = (e: Economy) =>
  facilityKinds.reduce((n, kind) => n + e.facilities[kind] * facilityPlans[kind].upkeep, 0);

const sponsorNames = [
  'Banco Cerrado',
  'Ipê Seguros',
  'Farol Telecom',
  'Construtora Aroeira',
  'Mercantil Jequitibá',
  'Vila Rica Alimentos',
  'Energia Pampa',
  'Atlântica Saúde',
  'Rota Sul Logística',
  'Cacau Norte',
  'Mar Azul Turismo',
  'Tropeiro Motors',
  'Serra Verde Cosméticos',
  'Rede Sabiá Farmácias',
];

function freshEconomy(c: Career, world: World): Economy {
  const { reputation: rep, league } = clubInfo(c, world);
  const monthly = sponsorBase(rep, league, c.living?.fans ?? 60);
  const months = 5 + (hash(`${c.seed}:${c.clubId}:patrocinio`) % 8);
  return {
    clubId: c.clubId,
    ticket: refTicket(rep),
    fee: refFee(rep),
    members: baseMembers(rep),
    facilities: {
      stadium: startLevel('stadium', rep, c.clubId),
      training: startLevel('training', rep, c.clubId),
      youth: startLevel('youth', rep, c.clubId),
    },
    works: [],
    sponsor: {
      name: sponsorNames[hash(`${c.seed}:${c.clubId}:master`) % sponsorNames.length],
      style: 'Equilibrado',
      monthly,
      months,
      title: monthly * 4,
      access: monthly * 3,
      g4: monthly * 2,
      since: c.date,
      until: addMonths(`${c.date.slice(0, 7)}-01`, months),
    },
    offers: [],
    games: [],
  };
}

/** Leitura sem efeitos colaterais (telas). */
export const economyOf = (c: Career, world: World): Economy =>
  c.living.economy?.clubId === c.clubId ? c.living.economy : freshEconomy(c, world);

/** Garante a economia do clube atual; troca de clube recomeça do zero. */
export function ensureEconomy(c: Career, world: World): Economy {
  const current = c.living.economy;
  if (current?.clubId === c.clubId) return current;
  const stale = current?.offersMessage && c.messages.find((m) => m.id === current.offersMessage);
  if (stale) stale.resolved = stale.read = true;
  return (c.living.economy = freshEconomy(c, world));
}

/** Aproveitamento (0–1) nos últimos cinco jogos antes da data. */
export function recentForm(c: Career, before: string) {
  const games = c.fixtures
    .filter(
      (f) => f.result && f.date < before && (f.homeId === c.clubId || f.awayId === c.clubId),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5);
  if (!games.length) return 0.5;
  const points = games.reduce((n, f) => {
    const r = f.result!;
    const diff = f.homeId === c.clubId ? r.homeGoals - r.awayGoals : r.awayGoals - r.homeGoals;
    return n + (diff > 0 ? 3 : diff === 0 ? 1 : 0);
  }, 0);
  return points / (games.length * 3);
}

export type Crowd = {
  capacity: number;
  crowd: number;
  members: number;
  occupancy: number;
  income: number;
  cost: number;
};

/**
 * Público de um jogo em casa: sócios garantem parte das cadeiras (check-in incluso na
 * mensalidade); o restante depende de torcida, fase, clássico, adversário e preço.
 */
export function crowdFor(c: Career, world: World, fixture: Fixture, derby: boolean): Crowd {
  const e = economyOf(c, world);
  const { reputation: rep } = clubInfo(c, world);
  const capacity = capacityAt(e.facilities.stadium, rep, c.clubId);
  const members = Math.min(Math.round(e.members * (derby ? 0.7 : 0.55)), Math.round(capacity * 0.6));
  let rival = 65;
  try {
    rival = clubById(world, fixture.homeId === c.clubId ? fixture.awayId : fixture.homeId).reputation;
  } catch {
    // Adversário fora do mundo carregado: usa a média.
  }
  const cup = Boolean(fixture.cup && !fixture.cup.startsWith('EST'));
  const noise = ((hash(`${c.seed}:${fixture.id}:publico`) % 61) - 30) / 1000;
  const demand = clamp(
    (0.3 +
      c.living.fans * 0.006 +
      (recentForm(c, fixture.date) - 0.5) * 0.2 +
      (derby ? 0.15 : 0) +
      (cup ? 0.06 : 0) +
      (rival - 70) * 0.004 +
      noise) *
      Math.pow(e.ticket / refTicket(rep), -0.8),
    0.05,
    1,
  );
  const crowd = Math.min(capacity, members + Math.round((capacity - members) * demand));
  return {
    capacity,
    crowd,
    members,
    occupancy: crowd / capacity,
    income: Math.round((crowd - members) * e.ticket),
    cost: Math.round(crowd * 3 + 40000),
  };
}

/** Bilheteria do jogo em casa do usuário (registrada antes da reação da torcida ao resultado). */
export function recordGate(c: Career, world: World, fixture: Fixture, derby: boolean) {
  const e = ensureEconomy(c, world);
  const gate = crowdFor(c, world, fixture, derby);
  e.games = [
    ...e.games,
    {
      date: fixture.date,
      crowd: gate.crowd,
      capacity: gate.capacity,
      members: gate.members,
      income: gate.income,
    },
  ].slice(-12);
  return gate;
}

/** Número de sócios para o qual o quadro caminha (12% da distância por mês). */
export function memberTarget(c: Career, world: World, fee?: number) {
  const e = economyOf(c, world);
  const { reputation: rep } = clubInfo(c, world);
  const L = c.living;
  return Math.round(
    baseMembers(rep) *
      (0.55 + L.fans * 0.009) *
      Math.pow(refFee(rep) / (fee ?? e.fee), 0.7) *
      (L.wagesLate ? 0.9 : 1),
  );
}

/** Fechamento mensal do clube do usuário: sócios, reação ao preço, patrocínio e manutenção. */
export function economyMonth(c: Career, world: World) {
  const e = ensureEconomy(c, world);
  const { reputation: rep } = clubInfo(c, world);
  const L = c.living;
  const target = memberTarget(c, world);
  let members = e.members + (target - e.members) * 0.12;
  if (L.fans < 25 || L.wagesLate) members *= 0.97;
  e.members = Math.max(200, Math.round(members));
  const ratio = e.ticket / refTicket(rep);
  if (ratio >= 1.35) L.fans = clamp(L.fans - 2);
  else if (ratio <= 0.8) L.fans = clamp(L.fans + 1);
  const sponsor = e.sponsor && e.sponsor.until > c.date ? e.sponsor.monthly : 0;
  return {
    tv: tvIncome(rep),
    sponsor,
    membership: e.members * e.fee,
    upkeep: upkeep(e),
  };
}

function signSponsor(c: Career, e: Economy, index: number, auto: boolean) {
  const deal = e.offers[index] ?? e.offers[0];
  if (!deal) return;
  const until = addMonths(`${c.date.slice(0, 7)}-01`, deal.months);
  e.sponsor = { ...deal, since: c.date, until };
  e.offers = [];
  delete e.offersMessage;
  delete e.offersExpire;
  const board = c.living.board;
  board.finances = clamp(
    board.finances + (deal.style === 'Fixo' ? 3 : deal.style === 'Desempenho' ? -1 : 1),
  );
  remember(c, 'marco', `Novo patrocínio master: ${deal.name}`);
  notify(c, {
    kind: 'finance',
    from: 'Departamento comercial',
    title: `${deal.name} é o novo patrocinador master`,
    body: `${auto ? 'Sem resposta no prazo, a diretoria assinou a primeira proposta. ' : ''}Contrato de ${deal.months} meses (até ${day(until)}): ${money(deal.monthly)} por mês. Bônus na virada da temporada: ${money(deal.title)} por título, ${money(deal.access)} pelo acesso e ${money(deal.g4)} pelo G4 da Série A.`,
  });
}

function offerSponsors(c: Career, world: World, e: Economy) {
  const { reputation: rep, league } = clubInfo(c, world);
  const base = sponsorBase(rep, league, c.living.fans);
  const start = hash(`${c.seed}:${c.date}:patrocinadores`) % sponsorNames.length;
  const plans: [SponsorDeal['style'], number, number, number][] = [
    ['Fixo', 1.15, 0.4, 36],
    ['Equilibrado', 1, 1, 24],
    ['Desempenho', 0.8, 2.5, 12],
  ];
  e.offers = plans.map(([style, fixed, bonus, months], i) => {
    const monthly = round(base * fixed, 10000);
    return {
      name: sponsorNames[(start + i * 5) % sponsorNames.length],
      style,
      monthly,
      months,
      title: round(base * 4 * bonus, 50000),
      access: round(base * 3 * bonus, 50000),
      g4: round(base * 2 * bonus, 50000),
    };
  });
  e.offersExpire = addDays(c.date, 10);
  const old = e.sponsor;
  notify(c, {
    kind: 'finance',
    from: 'Departamento comercial',
    title: 'Patrocínio master: escolha a nova proposta',
    body: `${old ? `O contrato com ${old.name} ${old.until <= c.date ? 'terminou' : `vence em ${day(old.until)}`}.` : 'A camisa está sem patrocinador master.'} ${e.offers
      .map(
        (o) =>
          `${o.name} (${o.style.toLowerCase()}): ${money(o.monthly)}/mês por ${o.months} meses; bônus de ${money(o.title)} por título, ${money(o.access)} pelo acesso e ${money(o.g4)} pelo G4.`,
      )
      .join(' ')} Escolha aqui ou em Finanças → Patrocínio. Confirmar sem escolher assina a primeira.`,
    important: true,
  });
  e.offersMessage = c.messages[0].id;
}

/** Rotina diária: obras concluídas e renovação do patrocínio master. */
export function economyDay(c: Career, world: World) {
  const e = ensureEconomy(c, world);
  for (const w of e.works.filter((work) => work.done <= c.date)) {
    e.facilities[w.kind] = Math.max(e.facilities[w.kind], w.level);
    const label = facilityPlans[w.kind].label;
    if (w.kind === 'stadium') c.living.fans = clamp(c.living.fans + 4);
    remember(c, 'marco', `${label} chegou ao nível ${w.level}`);
    notify(c, {
      kind: 'board',
      from: 'Presidência',
      title: `Obra concluída: ${label} nível ${w.level}`,
      body:
        w.kind === 'stadium'
          ? `A reforma terminou e o estádio agora recebe ${capacityAt(w.level, clubInfo(c, world).reputation, c.clubId).toLocaleString('pt-BR')} torcedores. A torcida comemorou (+4 de humor).`
          : w.kind === 'training'
            ? `O novo CT está em uso: ${Math.round(trainingEffect(w.level).growth * 100)}% a mais de evolução, ritmo cai mais devagar e lesões em jogo ${Math.round(trainingEffect(w.level).injury * 100)}% menos frequentes e mais curtas.`
            : `A base ganhou estrutura: cada jovem revelado na virada da temporada terá +${youthBonus(w.level)} de potencial.`,
    });
  }
  e.works = e.works.filter((work) => work.done > c.date);
  if (e.offers.length) {
    const msg = c.messages.find((m) => m.id === e.offersMessage);
    if (!msg || msg.resolved || (e.offersExpire && e.offersExpire < c.date)) {
      if (msg) msg.resolved = msg.read = true;
      signSponsor(c, e, 0, true);
    }
    return;
  }
  if (!e.sponsor || e.sponsor.until <= addDays(c.date, 10)) offerSponsors(c, world, e);
}

/** Resposta genérica à mensagem do patrocínio (ou modo automático): assina a primeira proposta. */
export function settleSponsorMessage(c: Career, messageId: string) {
  const e = c.living.economy;
  if (e?.clubId === c.clubId && e.offersMessage === messageId && e.offers.length)
    signSponsor(c, e, 0, false);
}

export function chooseSponsor(career: Career, world: World, index: number): Career {
  const c = structuredClone(career);
  const e = ensureEconomy(c, world);
  if (!e.offers[index]) throw new Error('Proposta de patrocínio indisponível.');
  const msg = c.messages.find((m) => m.id === e.offersMessage);
  if (msg) {
    msg.resolved = msg.read = true;
    msg.choice = 'support';
  }
  signSponsor(c, e, index, false);
  return c;
}

const ticketBounds = (rep: number) => [
  Math.max(5, round(refTicket(rep) * 0.4, 5)),
  round(refTicket(rep) * 3, 5),
];
const feeBounds = (rep: number) => [
  Math.max(5, round(refFee(rep) * 0.4, 5)),
  round(refFee(rep) * 3, 5),
];
export const priceBounds = (c: Career, world: World) => {
  const rep = clubInfo(c, world).reputation;
  return { ticket: ticketBounds(rep), fee: feeBounds(rep) };
};

export function setPrices(
  career: Career,
  world: World,
  patch: { ticket?: number; fee?: number },
): Career {
  const c = structuredClone(career);
  const e = ensureEconomy(c, world);
  const rep = clubInfo(c, world).reputation;
  if (patch.ticket !== undefined) {
    const [min, max] = ticketBounds(rep);
    e.ticket = Math.round(clamp(patch.ticket, min, max));
  }
  if (patch.fee !== undefined) {
    const [min, max] = feeBounds(rep);
    e.fee = Math.round(clamp(patch.fee, min, max));
  }
  return c;
}

/** Inicia a obra do próximo nível: pagamento à vista e prazo de conclusão. */
export function startWork(career: Career, world: World, kind: FacilityKind): Career {
  const c = structuredClone(career);
  const e = ensureEconomy(c, world);
  const level = e.facilities[kind];
  if (level >= 5) throw new Error('Esta instalação já está no nível máximo.');
  if (e.works.some((w) => w.kind === kind))
    throw new Error('Já existe uma obra em andamento nesta área.');
  const plan = facilityPlans[kind];
  const cost = plan.cost[level + 1];
  const f = c.finances[c.clubId];
  if (f.cash < cost) throw new Error('Caixa insuficiente para iniciar a obra.');
  f.cash -= cost;
  f.history.push({ date: c.date, income: 0, expenses: cost, balance: f.cash });
  f.transferBudget = Math.max(0, Math.min(f.transferBudget, f.cash));
  const done = addDays(c.date, plan.days[level + 1]);
  e.works.push({ kind, level: level + 1, start: c.date, done, cost });
  const { budget } = clubInfo(c, world);
  const hit = Math.round((cost / Math.max(1, f.cash + cost)) * 20) + (f.cash < budget * 0.5 ? 6 : 0);
  const board = c.living.board;
  board.finances = clamp(board.finances + 2 - hit);
  if (kind === 'youth') board.youth = clamp(board.youth + 4);
  notify(c, {
    kind: 'board',
    from: 'Presidência',
    title: `Obra iniciada: ${plan.label} nível ${level + 1}`,
    body: `${hit >= 8 ? 'A diretoria aprovou, mas reclamou do tamanho do gasto' : 'A diretoria aprovou o investimento'} (${money(cost)}, finanças ${2 - hit >= 0 ? '+' : ''}${2 - hit}). Conclusão prevista para ${day(done)}.`,
  });
  return c;
}

/** Virada da temporada: bônus do patrocinador e reação dos sócios à campanha. */
export function economySeasonEnd(
  c: Career,
  world: World,
  season: number,
  outcome: { promoted: boolean; relegated: boolean; g4: boolean },
) {
  const e = ensureEconomy(c, world);
  const titles = c.honours.filter((h) => h.season === season && h.clubId === c.clubId);
  const big = titles.some((h) => !h.competition.startsWith('EST'));
  const s = e.sponsor;
  if (s) {
    const parts: [string, number][] = [];
    if (big && s.title) parts.push(['título', s.title]);
    if (outcome.promoted && s.access) parts.push(['acesso', s.access]);
    if (outcome.g4 && s.g4) parts.push(['G4', s.g4]);
    const total = parts.reduce((n, [, v]) => n + v, 0);
    if (total > 0) {
      const f = c.finances[c.clubId];
      f.cash += total;
      f.history.push({ date: c.date, income: total, expenses: 0, balance: f.cash });
      notify(c, {
        kind: 'finance',
        from: s.name,
        title: 'Bônus de desempenho do patrocinador',
        body: `Metas batidas em ${season}: ${parts.map(([k, v]) => `${k} (${money(v)})`).join(', ')}. Total de ${money(total)} no caixa.`,
      });
    }
  }
  const growth = 1 + titles.length * 0.06 + (outcome.promoted ? 0.05 : 0) - (outcome.relegated ? 0.08 : 0);
  e.members = Math.max(200, Math.round(e.members * growth));
}
