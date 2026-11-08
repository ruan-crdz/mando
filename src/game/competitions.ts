import { addDays, clamp, hash, random } from './random';
import { competitionName } from './calendar';
import {
  brazilianNpcClubs,
  clubById,
  continentalNpcClubs,
  findPlayer,
  isNpc,
  stateNpcClubs,
} from './npc';
import { type Career, type Fixture, type Match, type TableRow, type World } from './types';

export type PenaltyKick = {
  side: 'home' | 'away';
  takerId: string;
  keeperId: string;
  scored: boolean;
  /** Canto da cobrança e do goleiro: -1 esquerda, 0 meio, 1 direita. */
  aim: -1 | 0 | 1;
  dive: -1 | 0 | 1;
  /** Erro sem defesa: bola na trave ou por cima. */
  miss?: 'post' | 'over';
  home: number;
  away: number;
};

export type PenaltyShootout = {
  kicks: PenaltyKick[];
  home: number;
  away: number;
  winner: string;
  loser: string;
};

/**
 * Disputa de pênaltis da partida jogada pelo usuário: cobradores reais em campo, ordem por
 * qualidade de finalização e frieza, goleiro titular e encerramento antecipado como no futebol.
 * Retorna null quando o confronto não termina empatado no último jogo.
 */
export function penaltyShootout(
  c: Career,
  world: World,
  fixture: Fixture,
  match: Pick<Match, 'homeGoals' | 'awayGoals' | 'homeLineup' | 'awayLineup' | 'dismissed'>,
): PenaltyShootout | null {
  if (!fixture.tie) return null;
  const legs = c.fixtures.filter((f) => f.tie === fixture.tie).sort((a, b) => a.id.localeCompare(b.id));
  if (legs[legs.length - 1]?.id !== fixture.id) return null;
  if (legs.some((f) => f.id !== fixture.id && !f.result)) return null;
  const goals = new Map<string, number>([
    [fixture.homeId, match.homeGoals],
    [fixture.awayId, match.awayGoals],
  ]);
  for (const f of legs) {
    if (f.id === fixture.id) continue;
    goals.set(f.homeId, (goals.get(f.homeId) || 0) + f.result!.homeGoals);
    goals.set(f.awayId, (goals.get(f.awayId) || 0) + f.result!.awayGoals);
  }
  if (goals.get(fixture.homeId) !== goals.get(fixture.awayId)) return null;
  const rng = random(hash(`${c.seed}:${fixture.id}:shootout`));
  const skill = (id: string) => {
    const p = findPlayer(world, id);
    return p ? p.attributes.finishing * 0.6 + p.attributes.composure * 0.4 : 60;
  };
  const keeping = (id: string) => {
    const p = findPlayer(world, id);
    return p ? (p.attributes.reflexes + p.attributes.handling) / 2 : 60;
  };
  const side = (lineup: string[]) => {
    const onField = lineup.filter((id) => !match.dismissed.includes(id));
    const keeper = onField[0] ?? lineup[0] ?? '';
    const takers = onField
      .slice(1)
      .sort((a, b) => skill(b) - skill(a))
      .concat(keeper ? [keeper] : []);
    return { keeper, takers: takers.length ? takers : [keeper] };
  };
  const teams = { home: side(match.homeLineup), away: side(match.awayLineup) };
  const score = { home: 0, away: 0 };
  const taken = { home: 0, away: 0 };
  const kicks: PenaltyKick[] = [];
  const corner = () => (Math.floor(rng() * 3) - 1) as -1 | 0 | 1;
  const kick = (who: 'home' | 'away') => {
    const team = teams[who];
    const rival = teams[who === 'home' ? 'away' : 'home'];
    const takerId = team.takers[taken[who] % team.takers.length];
    const pressure = taken[who] >= 5 ? 0.03 : 0;
    const chance = clamp(0.75 + (skill(takerId) - keeping(rival.keeper)) * 0.004 - pressure, 0.55, 0.9);
    const scored = rng() < chance;
    const aim = corner();
    let dive = corner();
    let miss: PenaltyKick['miss'];
    if (scored && dive === aim) dive = (aim === 0 ? 1 : -aim) as -1 | 1;
    if (!scored) {
      if (rng() < 0.7) dive = aim;
      else miss = rng() < 0.5 ? 'post' : 'over';
    }
    taken[who]++;
    if (scored) score[who]++;
    kicks.push({
      side: who,
      takerId,
      keeperId: rival.keeper,
      scored,
      aim,
      dive,
      miss,
      home: score.home,
      away: score.away,
    });
  };
  const decided = () => {
    const left = { home: Math.max(0, 5 - taken.home), away: Math.max(0, 5 - taken.away) };
    return score.home + left.home < score.away || score.away + left.away < score.home;
  };
  for (let round = 0; round < 5 && !decided(); round++) {
    kick('home');
    if (decided()) break;
    kick('away');
  }
  while (score.home === score.away) {
    kick('home');
    kick('away');
  }
  const homeWins = score.home > score.away;
  return {
    kicks,
    home: score.home,
    away: score.away,
    winner: homeWins ? fixture.homeId : fixture.awayId,
    loser: homeWins ? fixture.awayId : fixture.homeId,
  };
}

type Stage = { key: string; name: string; dates: string[]; neutral?: boolean };

const knockout: Record<'CDB' | 'LIB' | 'SUL' | 'EST', Stage[]> = {
  CDB: [
    { key: 'R64', name: 'Primeira fase', dates: ['02-18'] },
    { key: 'R32', name: 'Segunda fase', dates: ['03-11'] },
    { key: 'R16', name: 'Oitavas de final', dates: ['04-29', '05-20'] },
    { key: 'QF', name: 'Quartas de final', dates: ['08-05', '08-26'] },
    { key: 'SF', name: 'Semifinal', dates: ['09-16', '10-14'] },
    { key: 'F', name: 'Final', dates: ['11-29', '12-06'] },
  ],
  LIB: [
    { key: 'R16', name: 'Oitavas de final', dates: ['08-12', '08-19'] },
    { key: 'QF', name: 'Quartas de final', dates: ['09-09', '09-16'] },
    { key: 'SF', name: 'Semifinal', dates: ['10-21', '10-28'] },
    { key: 'F', name: 'Final · campo neutro', dates: ['11-28'], neutral: true },
  ],
  SUL: [
    { key: 'R16', name: 'Oitavas de final', dates: ['08-13', '08-20'] },
    { key: 'QF', name: 'Quartas de final', dates: ['09-10', '09-17'] },
    { key: 'SF', name: 'Semifinal', dates: ['10-22', '10-29'] },
    { key: 'F', name: 'Final · campo neutro', dates: ['11-21'], neutral: true },
  ],
  EST: [
    { key: 'SF', name: 'Semifinal', dates: ['03-01'] },
    { key: 'F', name: 'Final', dates: ['03-08'] },
  ],
};
const groupDates = {
  LIB: ['04-08', '04-22', '05-06', '05-13', '05-20', '05-27'],
  SUL: ['04-01', '04-15', '04-29', '05-07', '05-19', '05-26'],
};
/** Premiações simplificadas em reais, pagas ao vencedor de cada fase. */
const prizes: Record<string, Record<string, number>> = {
  CDB: { R64: 1.5e6, R32: 2.2e6, R16: 3.8e6, QF: 6e6, SF: 12e6, F: 75e6 },
  LIB: { GROUP: 18e6, R16: 7e6, QF: 9e6, SF: 13e6, F: 120e6 },
  SUL: { GROUP: 6e6, R16: 3e6, QF: 4e6, SF: 6e6, F: 35e6 },
  EST: { SF: 1e6, F: 5e6 },
  SUP: { F: 10e6 },
};

const day = (d: string) => Math.round(Date.parse(`${d}T12:00:00Z`) / 86400000);

class Calendar {
  private busy = new Map<string, Set<number>>();
  constructor(fixtures: Fixture[]) {
    for (const f of fixtures) this.mark(f);
  }
  mark(f: Fixture) {
    for (const id of [f.homeId, f.awayId]) {
      if (!this.busy.has(id)) this.busy.set(id, new Set());
      this.busy.get(id)!.add(day(f.date));
    }
  }
  private free(id: string, d: number, gap: number) {
    const set = this.busy.get(id);
    if (!set) return true;
    for (let x = d - gap + 1; x < d + gap; x++) if (set.has(x)) return false;
    return true;
  }
  /** Primeira data a partir de `planned` em que os dois clubes têm descanso mínimo. */
  place(home: string, away: string, planned: string) {
    for (const gap of [3, 2, 1])
      for (let i = 0; i < 21; i++) {
        const date = addDays(planned, i);
        if (this.free(home, day(date), gap) && this.free(away, day(date), gap)) return date;
      }
    return addDays(planned, 21);
  }
}

export function table(fixtures: Fixture[], clubIds: string[]): TableRow[] {
  const rows = new Map(
    clubIds.map((id) => [
      id,
      { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 },
    ]),
  );
  for (const f of fixtures) {
    const h = rows.get(f.homeId);
    const a = rows.get(f.awayId);
    if (!f.result || !h || !a) continue;
    const r = f.result;
    h.played++;
    a.played++;
    h.gf += r.homeGoals;
    h.ga += r.awayGoals;
    a.gf += r.awayGoals;
    a.ga += r.homeGoals;
    if (r.homeGoals === r.awayGoals) {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    } else {
      const [w, l] = r.homeGoals > r.awayGoals ? [h, a] : [a, h];
      w.won++;
      w.points += 3;
      l.lost++;
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.clubId.localeCompare(b.clubId),
  );
}

function shuffle<T>(items: T[], seed: number) {
  const rng = random(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function roundRobin(ids: string[]) {
  const order = ids.length % 2 ? [...ids, ''] : [...ids];
  const n = order.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const [h, a] = r % 2 ? [order[n - 1 - i], order[i]] : [order[i], order[n - 1 - i]];
      if (h && a) pairs.push([h, a]);
    }
    rounds.push(pairs);
    order.splice(1, 0, order.pop()!);
  }
  return rounds;
}

export type Qualification = { LIB: string[]; SUL: string[]; SUP: [string, string] };

/** Vagas da primeira temporada: a ordem do snapshot na Série A representa a classificação de 2025. */
export function initialQualification(world: World): Qualification {
  const a = world.clubs.filter((c) => c.league === 'A').map((c) => c.id);
  const cupHolder = a.includes('corinthians') ? 'corinthians' : a[1];
  const lib = [...new Set([...a.slice(0, 6), cupHolder])];
  for (const id of a) if (lib.length < 7 && !lib.includes(id)) lib.push(id);
  const sul = a.filter((id) => !lib.includes(id)).slice(0, 6);
  return { LIB: lib, SUL: sul, SUP: [a[0], cupHolder === a[0] ? a[1] : cupHolder] };
}

function stageDates(season: number, stage: Stage) {
  return stage.dates.map((d) => `${season}-${d}`);
}

function addTie(
  c: Career,
  cal: Calendar,
  cup: string,
  stage: Stage,
  index: number,
  high: string,
  low: string,
  minDate: string,
  season: number,
) {
  const tie = `${season}-${cup}-${stage.key}-${index}`;
  const dates = stageDates(season, stage);
  let previous = minDate;
  dates.forEach((planned, i) => {
    const leg = dates.length === 2 ? i + 1 : undefined;
    // Ida na casa do clube de menor campanha; volta (ou jogo único) na casa do mais forte.
    const [homeId, awayId] = dates.length === 2 && i === 0 ? [low, high] : [high, low];
    const start = planned > previous ? planned : previous;
    const date = cal.place(homeId, awayId, start);
    const f: Fixture = {
      id: `${tie}-${i + 1}`,
      date,
      cup,
      stage: stage.name,
      tie,
      leg,
      round: index,
      homeId,
      awayId,
      playoff: false,
    };
    c.fixtures.push(f);
    cal.mark(f);
    previous = addDays(date, 3);
  });
}

const reputation = (world: World, id: string) => clubById(world, id).reputation;

export function createCups(c: Career, world: World, season: number, q: Qualification) {
  const cal = new Calendar(c.fixtures);
  const rng = (key: string) => hash(`${c.seed}:${season}:${key}`);
  // Estaduais: clubes principais do estado + clubes NPC até completar o grupo.
  const states = [...new Set(world.clubs.map((club) => club.state))].sort();
  for (const uf of states) {
    const members = world.clubs.filter((club) => club.state === uf).map((club) => club.id);
    let size = Math.max(8, members.length + 2);
    if (size % 2) size++;
    const ids = shuffle(
      [...members, ...stateNpcClubs(uf, size - members.length).map((n) => n.id)],
      rng(`EST-${uf}`),
    );
    const rounds = roundRobin(ids);
    const start = day(`${season}-01-11`);
    const span = day(`${season}-02-22`) - start;
    rounds.forEach((pairs, r) => {
      const planned = addDays(
        `${season}-01-11`,
        Math.round((r * span) / Math.max(1, rounds.length - 1)),
      );
      pairs.forEach(([homeId, awayId], i) => {
        const f: Fixture = {
          id: `${season}-EST-${uf}-${r + 1}-${i}`,
          date: cal.place(homeId, awayId, planned),
          cup: `EST-${uf}`,
          stage: 'Fase de classificação',
          group: 'Único',
          round: r + 1,
          homeId,
          awayId,
          playoff: false,
        };
        c.fixtures.push(f);
        cal.mark(f);
      });
    });
  }
  // Supercopa: jogo único.
  const [sa, sb] = q.SUP;
  addTie(
    c,
    cal,
    'SUP',
    { key: 'F', name: 'Final · jogo único', dates: ['02-01'], neutral: true },
    0,
    sa,
    sb,
    `${season}-02-01`,
    season,
  );
  // Copa do Brasil: 40 clubes principais + 24 clubes nacionais NPC.
  const npc = brazilianNpcClubs
    .map((n) => ({ id: n.id, score: n.reputation + (rng(`CDB-${n.id}`) % 6) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 24)
    .map((n) => n.id);
  const entrants = [...world.clubs.map((club) => club.id), ...npc].sort(
    (a, b) => reputation(world, b) - reputation(world, a) || a.localeCompare(b),
  );
  const pot1 = shuffle(entrants.slice(0, 32), rng('CDB-pot1'));
  const pot2 = shuffle(entrants.slice(32), rng('CDB-pot2'));
  pot1.forEach((high, i) => {
    // Na primeira fase o clube de menor ranking manda o jogo.
    addTie(c, cal, 'CDB', knockout.CDB[0], i, pot2[i], high, `${season}-02-18`, season);
  });
  // Torneios continentais: 32 clubes em 8 grupos de 4.
  const taken = new Set<string>();
  for (const cup of ['LIB', 'SUL'] as const) {
    const pool = continentalNpcClubs
      .filter((n) => !taken.has(n.id))
      .map((n) => ({ id: n.id, score: n.reputation + (rng(`${cup}-${n.id}`) % 7) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 32 - q[cup].length)
      .map((n) => n.id);
    pool.forEach((id) => taken.add(id));
    const ids = [...q[cup], ...pool].sort(
      (a, b) => reputation(world, b) - reputation(world, a) || a.localeCompare(b),
    );
    const groups: string[][] = Array.from({ length: 8 }, () => []);
    for (let pot = 0; pot < 4; pot++)
      shuffle(ids.slice(pot * 8, pot * 8 + 8), rng(`${cup}-pot${pot}`)).forEach((id, g) =>
        groups[g].push(id),
      );
    groups.forEach((members, g) => {
      const letter = String.fromCharCode(65 + g);
      const single = roundRobin(members);
      const all = [
        ...single,
        ...single.map((pairs) => pairs.map(([h, a]) => [a, h] as [string, string])),
      ];
      all.forEach((pairs, r) =>
        pairs.forEach(([homeId, awayId], i) => {
          const f: Fixture = {
            id: `${season}-${cup}-G${letter}-${r + 1}-${i}`,
            date: cal.place(homeId, awayId, `${season}-${groupDates[cup][r]}`),
            cup,
            stage: 'Fase de grupos',
            group: letter,
            round: r + 1,
            homeId,
            awayId,
            playoff: false,
          };
          c.fixtures.push(f);
          cal.mark(f);
        }),
      );
      for (const id of members) pay(c, id, prizes[cup].GROUP);
    });
  }
  c.fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function pay(c: Career, clubId: string, amount: number) {
  const f = c.finances[clubId];
  if (!f || !amount) return;
  f.cash += amount;
  f.history.push({ date: c.date, income: amount, expenses: 0, balance: f.cash });
}

export function cupGroups(c: Career, cup: string) {
  const groups = new Map<string, Set<string>>();
  for (const f of c.fixtures)
    if (f.cup === cup && f.group) {
      if (!groups.has(f.group)) groups.set(f.group, new Set());
      groups.get(f.group)!.add(f.homeId).add(f.awayId);
    }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, ids]) => ({
      group,
      rows: table(
        c.fixtures.filter((f) => f.cup === cup && f.group === group),
        [...ids],
      ),
    }));
}

export function tieWinner(c: Career, tie: string): { winner: string; loser: string } | null {
  const legs = c.fixtures.filter((f) => f.tie === tie).sort((a, b) => a.id.localeCompare(b.id));
  if (!legs.length || legs.some((f) => !f.result)) return null;
  const goals = new Map<string, number>();
  for (const f of legs) {
    goals.set(f.homeId, (goals.get(f.homeId) || 0) + f.result!.homeGoals);
    goals.set(f.awayId, (goals.get(f.awayId) || 0) + f.result!.awayGoals);
  }
  const last = legs[legs.length - 1];
  const [a, b] = [last.homeId, last.awayId];
  let diff = goals.get(a)! - goals.get(b)!;
  if (diff === 0) {
    if (!last.penalties) return null;
    diff = last.penalties.home - last.penalties.away;
  }
  return diff > 0 ? { winner: a, loser: b } : { winner: b, loser: a };
}

function shootout(seed: number) {
  const rng = random(seed);
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (rng() < 0.76) home++;
    if (rng() < 0.76) away++;
  }
  while (home === away) {
    if (rng() < 0.74) home++;
    if (rng() < 0.74) away++;
  }
  return { home, away };
}

export type CupNotice = {
  cup: string;
  title: string;
  body: string;
  clubs: string[];
  champion?: boolean;
};

/** Decide pênaltis, paga premiações, gera a próxima fase e registra campeões. */
export function progressCups(c: Career, world: World): CupNotice[] {
  const notices: CupNotice[] = [];
  const cal = new Calendar(c.fixtures);
  const season = c.season;
  const cups = [...new Set(c.fixtures.filter((f) => f.cup).map((f) => f.cup!))];
  for (const cup of cups) {
    if (c.honours.some((h) => h.season === season && h.competition === cup)) continue;
    const fixtures = c.fixtures.filter((f) => f.cup === cup);
    // Pênaltis assim que o último jogo de um confronto empatado termina.
    for (const tie of new Set(fixtures.filter((f) => f.tie).map((f) => f.tie!))) {
      const legs = fixtures.filter((f) => f.tie === tie).sort((a, b) => a.id.localeCompare(b.id));
      const last = legs[legs.length - 1];
      if (legs.every((f) => f.result) && !last.penalties && !tieWinner(c, tie)) {
        last.penalties = shootout(hash(`${c.seed}:${tie}:penalties`));
        const result = tieWinner(c, tie)!;
        notices.push({
          cup,
          title: `${competitionName(cup)}: decisão nos pênaltis`,
          body: `${clubById(world, result.winner).name} venceu ${clubById(world, result.loser).name} por ${Math.max(last.penalties.home, last.penalties.away)} a ${Math.min(last.penalties.home, last.penalties.away)} nas cobranças.`,
          clubs: [result.winner, result.loser],
        });
      }
    }
    const family = (cup.startsWith('EST-') ? 'EST' : cup) as keyof typeof knockout | 'SUP';
    const stages = family === 'SUP' ? [] : knockout[family];
    const ko = fixtures.filter((f) => f.tie);
    const groupFixtures = fixtures.filter((f) => f.group);
    let currentKey: string | null = null;
    let current: string[] = [];
    if (family === 'SUP') currentKey = 'F';
    else {
      for (const s of stages)
        if (ko.some((f) => f.tie!.startsWith(`${season}-${cup}-${s.key}-`))) currentKey = s.key;
    }
    if (currentKey)
      current = [
        ...new Set(
          ko.filter((f) => f.tie!.startsWith(`${season}-${cup}-${currentKey}-`)).map((f) => f.tie!),
        ),
      ].sort((a, b) => Number(a.split('-').pop()) - Number(b.split('-').pop()));
    const lastDate = (list: Fixture[]) =>
      list.reduce((max, f) => (f.date > max ? f.date : max), c.date);
    // Fim da fase de grupos/classificação → mata-mata.
    if (!currentKey && groupFixtures.length && groupFixtures.every((f) => f.result)) {
      const tables = cupGroups(c, cup);
      const minDate = addDays(lastDate(groupFixtures), 3);
      if (family === 'EST') {
        const [t] = tables;
        const r = t.rows;
        addTie(c, cal, cup, knockout.EST[0], 0, r[0].clubId, r[3].clubId, minDate, season);
        addTie(c, cal, cup, knockout.EST[0], 1, r[1].clubId, r[2].clubId, minDate, season);
      } else if (family === 'LIB' || family === 'SUL') {
        for (let g = 0; g < 8; g += 2) {
          const [x, y] = [tables[g].rows, tables[g + 1].rows];
          addTie(c, cal, cup, knockout[family][0], g, x[0].clubId, y[1].clubId, minDate, season);
          addTie(
            c,
            cal,
            cup,
            knockout[family][0],
            g + 1,
            y[0].clubId,
            x[1].clubId,
            minDate,
            season,
          );
        }
        for (const t of tables) for (const r of t.rows.slice(0, 2)) pay(c, r.clubId, 1e6);
      }
      continue;
    }
    if (!currentKey || !current.length) continue;
    const results = current.map((tie) => tieWinner(c, tie));
    if (results.some((r) => !r)) continue;
    const stageIndex = stages.findIndex((s) => s.key === currentKey);
    for (const r of results) pay(c, r!.winner, prizes[family][currentKey] || 0);
    if (currentKey === 'F' && results.length === 1) {
      const winner = results[0]!.winner;
      c.honours.push({ season, competition: cup, clubId: winner });
      notices.push({
        cup,
        champion: true,
        title: `${clubById(world, winner).name} é campeão: ${competitionName(cup)} ${season}`,
        body: `Taça entregue após vitória sobre ${clubById(world, results[0]!.loser).name}.`,
        clubs: [winner, results[0]!.loser],
      });
      continue;
    }
    const next = stages[stageIndex + 1];
    if (!next) continue;
    const minDate = addDays(lastDate(ko.filter((f) => current.includes(f.tie!))), 3);
    for (let i = 0; i < results.length; i += 2) {
      const a = results[i]!.winner;
      const b = results[i + 1]!.winner;
      const [high, low] = reputation(world, a) >= reputation(world, b) ? [a, b] : [b, a];
      // Na segunda fase da Copa do Brasil o jogo único é na casa do menor ranking.
      const single = next.dates.length === 1 && !next.neutral && family === 'CDB';
      addTie(c, cal, cup, next, i / 2, single ? low : high, single ? high : low, minDate, season);
    }
  }
  c.fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return notices;
}

export function cupsFinished(c: Career) {
  const cups = new Set(c.fixtures.filter((f) => f.cup).map((f) => f.cup!));
  return [...cups].every((cup) =>
    c.honours.some((h) => h.season === c.season && h.competition === cup),
  );
}

export function cupTies(c: Career, cup: string) {
  const ties = new Map<string, Fixture[]>();
  for (const f of c.fixtures)
    if (f.cup === cup && f.tie) {
      if (!ties.has(f.tie)) ties.set(f.tie, []);
      ties.get(f.tie)!.push(f);
    }
  return [...ties.entries()].map(([tie, legs]) => ({
    tie,
    stage: legs[0].stage || '',
    legs: legs.sort((a, b) => a.id.localeCompare(b.id)),
    winner: tieWinner(c, tie)?.winner,
  }));
}

export const isMainClub = (id: string) => !isNpc(id);
