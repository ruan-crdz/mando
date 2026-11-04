import { addDays, ageAt, clamp, hash, random } from './random';
import { overall } from './ratings';
import { squad } from './matches';
import { competitionName, transferWindow } from './calendar';
import { table } from './competitions';
import { clubById, foreignClubs, isForeign } from './npc';
import { askingPrice, expireLoanOptions, marketValue } from './transfers';
import { agentCount, agentInfluence, agentName, agentOf, settleFee } from './market';
import { notify, recordMove, remember } from './chronicle';
import { rivalry } from './context';
import { positionNames } from './positions';
import { directorEffect, staffLevel, staffName } from './staff';
import { lockerMonthly } from './dressing';
import {
  clubPhilosophies,
  coachStyles,
  type Career,
  type Fixture,
  type Living,
  type Match,
  type Player,
  type Position,
  type World,
} from './types';

const coachFirst = [
  'Antônio',
  'Paulo',
  'Marcelo',
  'Roberto',
  'Cláudio',
  'Fernando',
  'Ricardo',
  'Sérgio',
  'Jorge',
  'Luís',
  'Abel',
  'Renato',
  'Tite',
  'Mano',
  'Dorival',
  'Vagner',
  'Hélio',
  'Juan',
  'Gustavo',
  'Eduardo',
];
const coachLast = [
  'Carvalho',
  'Moreira',
  'Fonseca',
  'Rezende',
  'Ventura',
  'Cardoso',
  'Antunes',
  'Silveira',
  'Bastos',
  'Pacheco',
  'Rangel',
  'Sampaio',
  'Assunção',
  'Lacerda',
  'Prado',
];
const politicians = [
  'Carlos Menezes',
  'Augusto Brandão',
  'Wilson Tavares',
  'Mário Leitão',
  'Sílvio Rocha',
  'Heitor Galvão',
];

const money = (n: number) =>
  n >= 1e6 ? `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} mi` : `R$ ${Math.round(n / 1000)} mil`;

export const philosophy = (clubId: string) =>
  clubPhilosophies[hash(`${clubId}:philosophy`) % clubPhilosophies.length];

type Coach = Living['coaches'][string];

function newCoach(c: Career, world: World, clubId: string, salt: string): Coach {
  const rep = clubById(world, clubId).reputation;
  const rng = random(hash(`${c.seed}:${clubId}:coach:${salt}`));
  // Ídolos aposentados viram técnicos.
  const legends = world.players.filter(
    (p) => c.players[p.id]?.retired && c.players[p.id].personality === 'Líder',
  );
  const legend = legends.length && rng() < 0.3 ? legends[Math.floor(rng() * legends.length)] : null;
  return {
    name: legend
      ? legend.name
      : `${coachFirst[Math.floor(rng() * coachFirst.length)]} ${coachLast[Math.floor(rng() * coachLast.length)]}`,
    style: coachStyles[Math.floor(rng() * coachStyles.length)],
    skill: clamp(Math.round((rep - 58) / 7 + rng() * 1.6), 1, 5),
    since: c.date,
    winless: 0,
  };
}

export function ensureCoaches(c: Career, world: World) {
  delete c.living.coaches[c.clubId];
  for (const club of world.clubs)
    if (club.id !== c.clubId && !c.living.coaches[club.id])
      c.living.coaches[club.id] = newCoach(c, world, club.id, 'inicio');
}

/** Pressão no cargo dos técnicos da IA: sequência ruim derruba e muda o clube. */
function coachAfterMatch(c: Career, world: World, fixture: Fixture, result: Match) {
  for (const clubId of [fixture.homeId, fixture.awayId]) {
    const coach = c.living.coaches[clubId];
    if (!coach) continue;
    const home = clubId === fixture.homeId;
    const won = home ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals;
    coach.winless = won ? 0 : coach.winless + 1;
    if (!fixture.league || coach.winless < 5) continue;
    const ids = world.clubs.filter((x) => x.league === fixture.league).map((x) => x.id);
    const rows = table(
      c.fixtures.filter((f) => f.league === fixture.league && !f.playoff),
      ids,
    );
    const rank = rows.findIndex((r) => r.clubId === clubId) + 1;
    if ((rows[0]?.played ?? 0) < 5) continue;
    if (coach.winless < 8 && rank <= ids.length / 2) continue;
    const club = clubById(world, clubId);
    const next = newCoach(c, world, clubId, c.date);
    c.living.coaches[clubId] = next;
    notify(c, {
      kind: 'news',
      from: 'Mando Esportes',
      title: `${club.name} demite ${coach.name}`,
      body: `Após ${coach.winless} jogos sem vencer, a diretoria do ${club.name} trocou o comando. ${next.name} chega com estilo ${next.style.toLowerCase()} e deve mudar a forma de jogar.`,
    });
    // Dança das cadeiras: um trabalho sólido abre portas em clubes maiores.
    const ours = clubById(world, c.clubId);
    const rng = random(hash(`${c.seed}:${c.date}:${clubId}:sondagem`));
    if (
      !c.sacked &&
      c.confidence >= 70 &&
      club.reputation > ours.reputation &&
      !c.jobOffers.some((o) => o.clubId === clubId) &&
      rng() < 0.6
    ) {
      c.jobOffers.push({
        id: `job-${hash(`${c.id}:${c.date}:${clubId}:sondagem`)}`,
        clubId,
        expires: addDays(c.date, 10),
        salary: Math.round(club.reputation * 13000),
      });
      notify(c, {
        kind: 'board',
        from: club.name,
        title: `Sondagem do ${club.name}`,
        body: `O ${club.name} demitiu o técnico e quer conversar com você. A proposta está na Diretoria por 10 dias.`,
      });
    }
  }
}

const ideal: Partial<Record<Position, number>> = {
  GK: 2,
  CB: 4,
  LB: 2,
  RB: 2,
  DM: 2,
  CM: 3,
  AM: 2,
  LW: 2,
  RW: 2,
  ST: 3,
};
const southAmerica = [
  'Argentina',
  'Uruguai',
  'Paraguai',
  'Colômbia',
  'Chile',
  'Equador',
  'Peru',
  'Venezuela',
  'Bolívia',
];

function canLose(c: Career, world: World, clubId: string, p: Player) {
  const roster = squad(c, world, clubId);
  return (
    roster.length > 20 &&
    (p.position !== 'GK' || roster.filter((x) => x.position === 'GK').length > 2)
  );
}

function move(
  c: Career,
  world: World,
  p: Player,
  to: string,
  fee: number,
  kind: Living['transfers'][number]['kind'],
  years = 3,
) {
  const s = c.players[p.id];
  const from = s.clubId || 'livre';
  const buyer = c.finances[to];
  if (buyer) {
    buyer.cash -= fee;
    buyer.transferBudget = Math.max(0, buyer.transferBudget - fee);
    buyer.history.push({ date: c.date, income: 0, expenses: fee, balance: buyer.cash });
  }
  // Vendedor recebe só a sua fatia; solidariedade, parceiros e sell-ons são repassados.
  if (s.clubId) settleFee(c, world, { playerId: p.id, from: s.clubId, to, fee, budgetShare: 0.6 });
  else {
    s.rights = 100;
    delete s.partner;
    delete s.rightsPartners;
  }
  s.clubId = to;
  s.wage = Math.round(s.wage * (isForeign(to) ? 2.5 : 1.2));
  s.contractEnd = `${Number(c.date.slice(0, 4)) + years}-12-31`;
  s.morale = clamp(s.morale + 6);
  delete s.listed;
  recordMove(c, world, p.id, from, to, fee, kind);
}

/** Mercado entre clubes da IA: compras por carência, vendas ao exterior e retornos. */
function aiMarket(c: Career, world: World) {
  const rng = random(hash(`${c.seed}:${c.date}:ai-market`));
  if (rng() > 0.4) return;
  const clubs = world.clubs.filter((x) => x.id !== c.clubId);
  const state = (p: Player) => c.players[p.id];
  const ovr = (p: Player) => overall(p, p.position, state(p));
  const pool = world.players.filter((p) => {
    const s = state(p);
    return (
      s &&
      !s.retired &&
      s.clubId &&
      !s.loanFrom &&
      s.clubId !== c.clubId &&
      !isForeign(s.clubId) &&
      !s.clubId.startsWith('npc-')
    );
  });
  // 1) Compra doméstica pela maior carência do elenco.
  const buyer = clubs[Math.floor(rng() * clubs.length)];
  const roster = squad(c, world, buyer.id);
  if (roster.length < 30) {
    const need = (Object.keys(ideal) as Position[])
      .map((pos) => ({ pos, gap: ideal[pos]! - roster.filter((p) => p.position === pos).length }))
      .sort((a, b) => b.gap - a.gap)[0];
    const level =
      roster
        .map(ovr)
        .sort((a, b) => b - a)
        .slice(0, 11)
        .reduce((n, v) => n + v, 0) / 11 || 60;
    const style = philosophy(buyer.id);
    const target = pool
      .filter((p) => {
        const age = ageAt(p.birthDate, c.date);
        const seller = clubById(world, state(p).clubId!);
        return (
          state(p).clubId !== buyer.id &&
          p.position === need.pos &&
          seller.reputation <= buyer.reputation + 2 &&
          ovr(p) >= level - 3 &&
          (style !== 'Revela e vende' || age <= 24) &&
          (style !== 'Veteranos' || age >= 27) &&
          (style !== 'Sul-americanos' || southAmerica.includes(p.nationality) || rng() < 0.3)
        );
      })
      .sort((a, b) => ovr(b) - ovr(a))[0];
    if (target && canLose(c, world, state(target).clubId!, target)) {
      const fee = Math.round((marketValue(c, target) * (1 + rng() * 0.4)) / 50000) * 50000;
      if (c.finances[buyer.id].transferBudget >= fee && c.finances[buyer.id].cash >= fee) {
        const from = clubById(world, state(target).clubId!).name;
        move(c, world, target, buyer.id, fee, 'compra');
        notify(c, {
          kind: 'news',
          from: 'Mercado da Bola',
          title: `${buyer.name} fecha com ${target.name}`,
          body: `O ${buyer.name} acertou a contratação de ${target.name} (${target.position}), ex-${from}, por ${money(fee)}.${style !== 'Equilibrado' ? ` A filosofia do clube: ${style.toLowerCase()}.` : ''}`,
          playerId: target.id,
        });
      }
    }
  }
  // 2) Europa e Arábia levam os destaques (mais forte na janela do meio do ano).
  if (rng() < (c.date.slice(5, 7) >= '07' ? 0.5 : 0.25)) {
    const star = pool
      .filter((p) => {
        const age = ageAt(p.birthDate, c.date);
        return (age <= 24 && ovr(p) >= 72) || (age <= 30 && ovr(p) >= 79);
      })
      .sort((a, b) => ovr(b) - ovr(a) + (rng() - 0.5) * 8)[0];
    const buyers = star ? foreignClubs.filter((x) => x.reputation >= ovr(star) + 2) : [];
    if (star && buyers.length && canLose(c, world, state(star).clubId!, star)) {
      const club = buyers[Math.floor(rng() * buyers.length)];
      const fee = Math.round((marketValue(c, star) * (1.3 + rng() * 0.8)) / 100000) * 100000;
      const from = clubById(world, state(star).clubId!).name;
      move(c, world, star, club.id, fee, 'exterior', 4);
      notify(c, {
        kind: 'news',
        from: 'Mercado da Bola',
        title: `${star.name} vai para o ${club.name}`,
        body: `O ${from} vendeu ${star.name} ao ${club.name} (${(club as { country?: string }).country || 'exterior'}) por ${money(fee)}. Mais um destaque do Brasileirão atravessa o oceano.`,
        playerId: star.id,
      });
    }
  }
  // 3) Veteranos voltam do exterior para fechar a carreira em casa.
  const veterans = world.players.filter((p) => {
    const s = state(p);
    return s && isForeign(s.clubId) && ageAt(p.birthDate, c.date) >= 31;
  });
  if (veterans.length && rng() < 0.15) {
    const vet = veterans[Math.floor(rng() * veterans.length)];
    const home = clubs
      .filter((x) => squad(c, world, x.id).length < 30 && c.finances[x.id].cash > 0)
      .sort((a, b) => b.reputation - a.reputation)[Math.floor(rng() * 6)];
    if (home) {
      move(c, world, vet, home.id, 0, 'retorno', 2);
      notify(c, {
        kind: 'news',
        from: 'Mercado da Bola',
        title: `${vet.name} está de volta ao Brasil`,
        body: `Depois de anos fora, ${vet.name} acertou com o ${home.name} para voltar ao futebol brasileiro.`,
        playerId: vet.id,
      });
    }
  }
  // 4) Clubes com elenco curto contratam livres.
  const short = clubs.find((x) => squad(c, world, x.id).length < 22);
  if (short) {
    const free = world.players
      .filter(
        (p) =>
          state(p) &&
          !state(p).retired &&
          state(p).clubId === null &&
          ageAt(p.birthDate, c.date) < 35,
      )
      .sort((a, b) => ovr(b) - ovr(a))[0];
    if (free) move(c, world, free, short.id, 0, 'livre', 2);
  }
}

/** Relações do vestiário: amizades por idioma e geração, rixas por temperamento. */
function refreshRelations(c: Career, world: World) {
  const ids = new Set(squad(c, world).map((p) => p.id));
  c.living.relations = c.living.relations.filter((r) => ids.has(r.a) && ids.has(r.b));
  if (c.living.relations.length >= 10) return;
  const players = squad(c, world);
  const rng = random(hash(`${c.seed}:${c.date}:relations`));
  for (let tries = 0; tries < 12 && c.living.relations.length < 10; tries++) {
    const a = players[Math.floor(rng() * players.length)];
    const b = players[Math.floor(rng() * players.length)];
    if (!a || !b || a.id === b.id) continue;
    if (
      c.living.relations.some(
        (r) => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id),
      )
    )
      continue;
    const sa = c.players[a.id];
    const sb = c.players[b.id];
    const sameLanguage = a.nationality === b.nationality && a.nationality !== 'Brasil';
    const generation = Math.abs(ageAt(a.birthDate, c.date) - ageAt(b.birthDate, c.date)) <= 2;
    const hot = [sa.personality, sb.personality].filter(
      (x) => x === 'Temperamental' || x === 'Ambicioso',
    ).length;
    if (hot === 2 && a.position === b.position)
      c.living.relations.push({ a: a.id, b: b.id, kind: 'rixa' });
    else if (sameLanguage || (generation && rng() < 0.4))
      c.living.relations.push({ a: a.id, b: b.id, kind: 'amizade' });
  }
}

function wagesOf(c: Career, world: World) {
  return squad(c, world).reduce((n, p) => n + c.players[p.id].wage, 0);
}

function youthMinutes(c: Career, world: World) {
  return squad(c, world)
    .filter((p) => ageAt(p.birthDate, c.date) <= 21)
    .reduce((n, p) => n + c.players[p.id].minutes, 0);
}

/** Diretoria cobra coisas concretas, com prazo e consequência. */
function createDemand(c: Career, world: World) {
  if (c.living.demands.some((d) => !d.done)) return;
  const rng = random(hash(`${c.seed}:${c.date}:demand`));
  if (rng() > 0.4) return;
  const finance = c.finances[c.clubId];
  const club = clubById(world, c.clubId);
  const window = transferWindow(addDays(c.date, 10));
  const derby = c.fixtures.find(
    (f) =>
      !f.result &&
      f.date > c.date &&
      f.date <= addDays(c.date, 60) &&
      (f.homeId === c.clubId || f.awayId === c.clubId) &&
      rivalry(f.homeId, f.awayId),
  );
  const options: Living['demands'][number][] = [];
  const id = `demand-${hash(`${c.id}:${c.date}`)}`;
  if (window && finance.cash < club.budget)
    options.push({
      id,
      kind: 'venda',
      text: `Arrecade ${money(club.budget * 0.25)} em vendas até o prazo ou o orçamento será cortado.`,
      deadline: addDays(c.date, 40),
      baseline: c.sales + club.budget * 0.25,
      done: false,
    });
  options.push({
    id,
    kind: 'base',
    text: 'Dê 270 minutos a atletas da base (até 21 anos) nos próximos 45 dias.',
    deadline: addDays(c.date, 45),
    baseline: youthMinutes(c, world) + 270,
    done: false,
  });
  if (derby)
    options.push({
      id,
      kind: 'classico',
      text: `Vença o ${rivalry(derby.homeId, derby.awayId)} em ${derby.date.split('-').reverse().join('/')}.`,
      deadline: derby.date,
      baseline: 0,
      done: false,
    });
  if (finance.cash < 0)
    options.push({
      id,
      kind: 'folha',
      text: 'Reduza a folha salarial em 10% em até 60 dias.',
      deadline: addDays(c.date, 60),
      baseline: wagesOf(c, world) * 0.9,
      done: false,
    });
  const demand = options[Math.floor(rng() * options.length)];
  c.living.demands.push(demand);
  notify(c, {
    kind: 'board',
    from: 'Presidência',
    title: 'Exigência da diretoria',
    body: `${demand.text} Acompanhe em Escritório → Diretoria.`,
  });
}

function checkDemands(c: Career, world: World) {
  for (const d of c.living.demands) {
    if (d.done) continue;
    const met =
      (d.kind === 'venda' && c.sales >= d.baseline) ||
      (d.kind === 'base' && youthMinutes(c, world) >= d.baseline) ||
      (d.kind === 'folha' && wagesOf(c, world) <= d.baseline);
    if (met) {
      d.done = true;
      c.confidence = clamp(c.confidence + 6);
      notify(c, {
        kind: 'board',
        from: 'Presidência',
        title: 'Exigência cumprida',
        body: `Missão cumprida: ${d.text} A diretoria reconhece o trabalho.`,
      });
    } else if (d.deadline < c.date) {
      d.done = true;
      failDemand(c, d.text);
    }
  }
  c.living.demands = c.living.demands.slice(-12);
}

function failDemand(c: Career, text: string) {
  const f = c.finances[c.clubId];
  f.transferBudget = Math.round(f.transferBudget * 0.7);
  c.confidence = clamp(c.confidence - 6);
  notify(c, {
    kind: 'board',
    from: 'Presidência',
    title: 'Exigência descumprida',
    body: `Não cumprimos: ${text} Como avisado, o orçamento de transferências foi cortado em 30%.`,
  });
}

const moveTo = (value: number, target: number, rate: number) =>
  clamp(Math.round(value + (target - value) * rate));

/** Fechamento do mês: eixos da diretoria, torcida, salários, punições, eleição e SAF. */
function monthly(c: Career, world: World) {
  const L = c.living;
  const f = c.finances[c.clubId];
  const club = clubById(world, c.clubId);
  const own = c.fixtures.filter(
    (x) =>
      x.result &&
      x.date.startsWith(String(c.season)) &&
      (x.homeId === c.clubId || x.awayId === c.clubId),
  );
  const scored = own.reduce(
    (n, x) => n + (x.homeId === c.clubId ? x.result!.homeGoals : x.result!.awayGoals),
    0,
  );
  L.board.finances = moveTo(
    L.board.finances,
    f.cash >= 0 ? 60 + Math.min(35, f.cash / 4e6) : 50 - Math.min(45, -f.cash / 2e6),
    0.4,
  );
  L.board.youth = moveTo(L.board.youth, 40 + Math.min(55, youthMinutes(c, world) / 120), 0.4);
  L.board.style = moveTo(
    L.board.style,
    own.length ? 30 + Math.min(65, (scored / own.length) * 28) : 60,
    0.4,
  );
  const axes = Object.values(L.board);
  const avg = axes.reduce((n, v) => n + v, 0) / axes.length;
  c.confidence = clamp(Math.round(c.confidence + (avg - 60) * 0.08));
  L.fans = moveTo(L.fans, 60, 0.1);
  if (L.fans < 25) {
    for (const p of squad(c, world)) c.players[p.id].morale = clamp(c.players[p.id].morale - 3);
    notify(c, {
      kind: 'news',
      from: 'Mando Esportes',
      title: `Protesto no CT do ${club.name}`,
      body: 'Torcedores organizados cobraram elenco e comissão no portão do CT. O clima pesou e a moral do grupo caiu.',
    });
  } else if (L.fans >= 80) {
    const bonus = club.reputation * 25000;
    f.cash += bonus;
    f.history.push({ date: c.date, income: bonus, expenses: 0, balance: f.cash });
  }
  // Caixa negativo atrasa salário; muito negativo gera punição da FIFA.
  if (f.cash < 0) {
    if (!L.wagesLate)
      notify(c, {
        kind: 'finance',
        from: 'Departamento financeiro',
        title: 'Salários atrasados',
        body: 'O caixa ficou negativo e os salários do mês atrasaram. O elenco ficou insatisfeito.',
        important: true,
      });
    L.wagesLate = true;
    for (const p of squad(c, world)) c.players[p.id].morale = clamp(c.players[p.id].morale - 6);
    if (f.cash < -club.budget * 1.5 && !(L.transferBan && L.transferBan >= c.date)) {
      L.transferBan = addDays(c.date, 120);
      remember(c, 'marco', 'Clube punido com transfer ban da FIFA por dívidas');
      notify(c, {
        kind: 'board',
        from: 'FIFA',
        title: 'Transfer ban aplicado',
        body: `Dívidas com outros clubes geraram um transfer ban de 120 dias. Não é possível contratar até ${L.transferBan.split('-').reverse().join('/')}.`,
        important: true,
      });
    }
  } else L.wagesLate = false;
  // Proposta de SAF quando a dívida aperta.
  const rng = random(hash(`${c.seed}:${c.date}:saf`));
  if (L.owner === 'Associação' && f.debt > club.budget * 3 && rng() < 0.25) {
    L.owner = 'SAF';
    f.debt = Math.round(f.debt * 0.4);
    f.cash += club.budget;
    f.transferBudget += club.budget;
    L.board.results = clamp(L.board.results - 10);
    remember(c, 'marco', `O ${club.name} virou SAF: investidor assumiu o futebol`);
    notify(c, {
      kind: 'board',
      from: 'Conselho deliberativo',
      title: `${club.name} aprova a SAF`,
      body: `Um fundo de investimento comprou 90% do futebol. A dívida caiu e chegaram ${money(club.budget)} para reforços, mas o investidor quer resultado imediato.`,
    });
  }
  // Eleição presidencial no fim do ano.
  if (c.date.endsWith('-10-01') && L.owner === 'Associação' && !L.election) {
    L.election = {
      date: `${c.season}-11-20`,
      rival: politicians[hash(`${c.id}:${c.season}:politico`) % politicians.length],
      threat: clamp(Math.round(85 - c.confidence * 0.6 - L.fans * 0.2)),
    };
    notify(c, {
      kind: 'news',
      from: 'Mando Esportes',
      title: `Eleição no ${club.name}`,
      body: `${L.election.rival} lançou candidatura de oposição e promete trocar o técnico se vencer em ${L.election.date.split('-').reverse().join('/')}. Resultados e torcida decidem o pleito.`,
    });
  }
  refreshRelations(c, world);
  lockerMonthly(c, world);
  directorReport(c, world);
  agentPitch(c, world);
  createDemand(c, world);
}

/** Empresário influente oferece atletas da carteira (mensagem informativa, não trava o avanço). */
function agentPitch(c: Career, world: World) {
  const rng = random(hash(`${c.seed}:${c.date}:empresario`));
  if (rng() > 0.6) return;
  const influential = Array.from({ length: agentCount }, (_, i) => i).filter(
    (i) => agentInfluence(i) >= 4,
  );
  const index = influential[Math.floor(rng() * influential.length)];
  const budget = c.finances[c.clubId]?.transferBudget ?? 0;
  const ovr = (p: Player) => overall(p, p.position, c.players[p.id]);
  const clients = world.players
    .filter((p) => {
      const s = c.players[p.id];
      return (
        s &&
        !s.retired &&
        s.clubId &&
        s.clubId !== c.clubId &&
        !s.loanFrom &&
        !isForeign(s.clubId) &&
        !s.clubId.startsWith('npc-') &&
        agentOf(p.id).index === index
      );
    })
    .map((p) => ({ p, price: askingPrice(c, world, p) }))
    .filter((x) => x.price <= Math.max(budget * 1.3, 2e6))
    .sort((a, b) => ovr(b.p) - ovr(a.p) || a.price - b.price)
    .slice(0, 3);
  if (!clients.length) return;
  notify(c, {
    kind: 'market',
    from: `${agentName(index)} · Empresário (influência ${agentInfluence(index)})`,
    title: 'Atletas da minha carteira',
    body: `Professor, tenho nomes que encaixam no seu projeto: ${clients
      .map(
        (x) =>
          `${x.p.name} (${x.p.position}, ${clubById(world, c.players[x.p.id].clubId!).name}, geral ${ovr(x.p)}, pedida ~${money(x.price)})`,
      )
      .join('; ')}. Minha comissão é de 5 a 10% e facilito a conversa com os clubes.`,
    playerId: clients[0].p.id,
    resolved: true,
  });
}

/** Relatório mensal do diretor de futebol: alvos para a posição mais carente que cabem no orçamento. */
function directorReport(c: Career, world: World) {
  const fx = directorEffect(staffLevel(c, 'director'));
  const roster = squad(c, world);
  if (!roster.length) return;
  const need = (Object.keys(ideal) as Position[])
    .map((pos) => {
      const at = roster.filter((p) => p.position === pos);
      const best = Math.max(0, ...at.map((p) => overall(p, pos, c.players[p.id])));
      return { pos, gap: ideal[pos]! - at.length, best };
    })
    .sort((a, b) => b.gap - a.gap || a.best - b.best || a.pos.localeCompare(b.pos))[0];
  const budget = c.finances[c.clubId]?.transferBudget ?? 0;
  const ovr = (p: Player) => overall(p, p.position, c.players[p.id]);
  const targets = world.players
    .filter((p) => {
      const s = c.players[p.id];
      return (
        s &&
        !s.retired &&
        s.clubId &&
        s.clubId !== c.clubId &&
        !s.loanFrom &&
        !isForeign(s.clubId) &&
        !s.clubId.startsWith('npc-') &&
        p.position === need.pos &&
        ovr(p) >= need.best - 2
      );
    })
    .map((p) => ({ p, price: askingPrice(c, world, p) }))
    .filter((x) => x.price <= budget)
    .sort((a, b) => ovr(b.p) - ovr(a.p) || a.price - b.price)
    .slice(0, fx.targets);
  const pos = positionNames[need.pos].toLowerCase();
  notify(c, {
    kind: 'market',
    from: `${staffName(c, 'director')} · Diretor de futebol`,
    title: 'Alvos do mês',
    body: targets.length
      ? `A carência maior é de ${pos}. Dentro do orçamento (${money(budget)}): ${targets
          .map(
            (x) =>
              `${x.p.name} (${clubById(world, c.players[x.p.id].clubId!).name}, geral ${ovr(x.p)}, pedida ~${money(x.price)})`,
          )
          .join('; ')}.${transferWindow(c.date) ? '' : ' Prepare as propostas para a próxima janela.'}`
      : `A carência maior é de ${pos}, mas nenhum nome que melhore o elenco cabe no orçamento atual (${money(budget)}).`,
    ...(targets[0] ? { playerId: targets[0].p.id } : {}),
  });
}

function electionDay(c: Career) {
  const e = c.living.election;
  if (!e || e.date !== c.date) return;
  const threat = clamp(Math.round(85 - c.confidence * 0.6 - c.living.fans * 0.2));
  const roll = hash(`${c.id}:${c.date}:votos`) % 100;
  if (roll < threat) {
    c.confidence = Math.min(c.confidence, 32);
    remember(c, 'cargo', `${e.rival} venceu a eleição; o cargo ficou ameaçado`);
    notify(c, {
      kind: 'board',
      from: 'Presidência',
      title: `${e.rival} é o novo presidente`,
      body: 'A oposição venceu e não esconde que quer outro técnico. Qualquer tropeço pode custar o cargo.',
      important: true,
    });
  } else {
    c.confidence = clamp(c.confidence + 6);
    notify(c, {
      kind: 'board',
      from: 'Presidência',
      title: 'Situação reeleita',
      body: `${e.rival} perdeu a eleição. A diretoria atual segue e mantém o apoio ao seu trabalho.`,
    });
  }
  delete c.living.election;
}

/** Chamado a cada dia avançado (antes dos jogos da IA). */
export function livingDay(c: Career, world: World) {
  ensureCoaches(c, world);
  expireLoanOptions(c, world);
  if (transferWindow(c.date)) aiMarket(c, world);
  if (c.date.endsWith('-01')) monthly(c, world);
  checkDemands(c, world);
  electionDay(c);
  if (c.living.headline && c.living.headline.until < c.date) delete c.living.headline;
  // Treino da semana: carga física acelera o ritmo; recuperação poupa o físico.
  const focus = c.living.training;
  if (focus !== 'Equilibrado')
    for (const p of squad(c, world)) {
      const s = c.players[p.id];
      if (focus === 'Físico') {
        s.fitness = clamp(s.fitness - 1);
        s.sharpness = clamp(s.sharpness + 0.3);
      } else if (focus === 'Recuperação') s.fitness = clamp(s.fitness + 2);
      else if (focus === 'Tático') s.sharpness = clamp(s.sharpness + 0.15);
    }
  // Rixas explodem de vez em quando.
  const rng = random(hash(`${c.seed}:${c.date}:rixa`));
  const feud = c.living.relations.find((r) => r.kind === 'rixa');
  if (feud && rng() < 0.012) {
    const a = world.players.find((p) => p.id === feud.a);
    const b = world.players.find((p) => p.id === feud.b);
    if (a && b) {
      c.players[a.id].morale = clamp(c.players[a.id].morale - 5);
      c.players[b.id].morale = clamp(c.players[b.id].morale - 5);
      notify(c, {
        kind: 'staff',
        from: 'Auxiliar técnico',
        title: 'Discussão no treino',
        body: `${a.name} e ${b.name} bateram boca no treino. Escalar os dois juntos derruba o entrosamento.`,
      });
    }
  }
}

/** Depois de cada partida: técnicos da IA, torcida, diretoria, memória e legado. */
export function livingAfterMatch(c: Career, world: World, fixture: Fixture, result: Match) {
  coachAfterMatch(c, world, fixture, result);
  const home = fixture.homeId === c.clubId;
  if (!home && fixture.awayId !== c.clubId) return;
  const L = c.living;
  const diff = home ? result.homeGoals - result.awayGoals : result.awayGoals - result.homeGoals;
  const derby = rivalry(fixture.homeId, fixture.awayId);
  const weight = derby ? 2 : 1;
  const rival = clubById(world, home ? fixture.awayId : fixture.homeId).name;
  L.fans = clamp(
    L.fans + (diff > 0 ? 3 : diff < 0 ? -4 : -1) * weight + (diff >= 3 ? 3 : diff <= -3 ? -5 : 0),
  );
  L.board.results = clamp(L.board.results + (diff > 0 ? 3 : diff < 0 ? -4 : 0));
  if (derby) {
    L.board.derbies = clamp(L.board.derbies + (diff > 0 ? 10 : diff < 0 ? -12 : -2));
    c.confidence = clamp(c.confidence + (diff > 0 ? 2 : diff < 0 ? -3 : 0));
    if (diff > 0)
      remember(
        c,
        'vitoria',
        `Venceu o ${derby} contra o ${rival} (${result.homeGoals} × ${result.awayGoals})`,
      );
    // Deixar ídolos no banco do clássico pesa mais.
    for (const p of squad(c, world)) {
      const s = c.players[p.id];
      if (
        !result.minutesPlayed[p.id] &&
        (s.personality === 'Líder' || s.personality === 'Ambicioso') &&
        overall(p) >= 72
      )
        s.morale = clamp(s.morale - 4);
    }
    const demand = L.demands.find(
      (d) => d.kind === 'classico' && !d.done && d.deadline === fixture.date,
    );
    if (demand) {
      demand.done = true;
      if (diff > 0) {
        c.confidence = clamp(c.confidence + 6);
        notify(c, {
          kind: 'board',
          from: 'Presidência',
          title: 'Exigência cumprida',
          body: `Vencemos o ${derby}, como pedimos. Parabéns.`,
        });
      } else failDemand(c, demand.text);
    }
  }
  if (diff >= 4)
    remember(
      c,
      'vitoria',
      `Goleada de ${Math.max(result.homeGoals, result.awayGoals)} × ${Math.min(result.homeGoals, result.awayGoals)} sobre o ${rival}`,
    );
  if (diff <= -4)
    remember(
      c,
      'derrota',
      `Goleada sofrida para o ${rival} (${result.homeGoals} × ${result.awayGoals})`,
    );
  L.recentTactics = [...L.recentTactics, { ...c.tactic }].slice(-10);
  for (const id of Object.keys(result.minutesPlayed)) {
    if (c.players[id]?.clubId !== c.clubId) continue;
    const row = (L.clubStats[id] ??= { games: 0, goals: 0, assists: 0 });
    row.games++;
  }
  for (const e of result.events) {
    if (e.type !== 'goal' || e.clubId !== c.clubId) continue;
    if (e.playerId && L.clubStats[e.playerId]) L.clubStats[e.playerId].goals++;
    if (e.assistId && L.clubStats[e.assistId]) L.clubStats[e.assistId].assists++;
  }
  const debut = `Estreia no comando do ${clubById(world, c.clubId).name}`;
  if (!L.timeline.some((t) => t.text === debut)) remember(c, 'marco', debut);
}

/** Fecha a temporada: títulos na linha do tempo e convite da Seleção. */
export function livingSeasonEnd(c: Career, season: number) {
  const titles = c.honours.filter((h) => h.season === season && h.clubId === c.clubId);
  for (const h of titles)
    remember(c, 'titulo', `Campeão: ${competitionName(h.competition)} ${season}`);
  const big = titles.filter((h) => ['A', 'LIB', 'CDB'].includes(h.competition)).length;
  const career = c.honours.filter((h) => h.clubId === c.clubId).length;
  if (!c.living.nationalInvite && (big >= 1 || career >= 4) && c.confidence >= 60) {
    c.living.nationalInvite = true;
    remember(c, 'marco', 'Convidado pela CBF para comandar a Seleção (em paralelo ao clube)');
    notify(c, {
      kind: 'board',
      from: 'CBF',
      title: 'Convite da Seleção Brasileira',
      body: 'Seu trabalho chamou a atenção da CBF. Você foi convidado para comandar a Seleção em paralelo ao clube. Sua reputação no mercado subiu.',
    });
  }
  c.living.recentTactics = c.living.recentTactics.slice(-5);
}

export const analystCost = (level: number) => 400000 * level;

export function setTraining(career: Career, focus: Living['training']): Career {
  return { ...career, living: { ...career.living, training: focus } };
}

export function toggleMarking(career: Career): Career {
  return { ...career, living: { ...career.living, marking: !career.living.marking } };
}

/** Contrata um analista de desempenho melhor (relatórios mais precisos e previsão de resultado). */
export function upgradeAnalyst(career: Career): Career {
  const level = career.living.analyst;
  if (level >= 5) throw new Error('O analista já é o melhor disponível.');
  const cost = analystCost(level + 1);
  const c = structuredClone(career);
  const f = c.finances[c.clubId];
  if (f.cash < cost) throw new Error('Caixa insuficiente para contratar o analista.');
  f.cash -= cost;
  f.history.push({ date: c.date, income: 0, expenses: cost, balance: f.cash });
  c.living.analyst = level + 1;
  return c;
}
