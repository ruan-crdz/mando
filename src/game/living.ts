import { addDays, clamp, hash, random } from './random';
import { overall } from './ratings';
import { squad } from './matches';
import { competitionName, transferWindow } from './calendar';
import { table } from './competitions';
import { clubById, isForeign } from './npc';
import { askingPrice, expireLoanOptions } from './transfers';
import { agentCount, agentInfluence, agentName, agentOf } from './market';
import { notify, remember } from './chronicle';
import { positionNames } from './positions';
import { directorEffect, staffLevel, staffName } from './staff';
import {
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
const money = (n: number) =>
  n >= 1e6 ? `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} mi` : `R$ ${Math.round(n / 1000)} mil`;

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

/** Relatórios mensais de elenco e mercado. */
function monthly(c: Career, world: World) {
  directorReport(c, world);
  agentPitch(c, world);
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

/** Chamado a cada dia avançado (antes dos jogos da IA). */
export function livingDay(c: Career, world: World) {
  ensureCoaches(c, world);
  expireLoanOptions(c, world);
  if (c.date.endsWith('-01')) monthly(c, world);
}

/** Depois de cada partida: estatísticas e histórico da carreira. */
export function livingAfterMatch(c: Career, world: World, fixture: Fixture, result: Match) {
  coachAfterMatch(c, world, fixture, result);
  const home = fixture.homeId === c.clubId;
  if (!home && fixture.awayId !== c.clubId) return;
  const L = c.living;
  const diff = home ? result.homeGoals - result.awayGoals : result.awayGoals - result.homeGoals;
  const record = (L.managerRecord ??= { since: c.date, won: 0, drawn: 0, lost: 0 });
  if (diff > 0) record.won++;
  else if (diff < 0) record.lost++;
  else record.drawn++;
  const rival = clubById(world, home ? fixture.awayId : fixture.homeId).name;
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
  for (const id of Object.keys(result.minutesPlayed)) {
    if (c.players[id]?.clubId !== c.clubId) continue;
    const row = (L.clubStats[id] ??= { games: 0, goals: 0, assists: 0 });
    row.games++;
    const clubRows = (L.clubStatsByClub[c.clubId] ??= {});
    const clubRow = (clubRows[id] ??= { games: 0, goals: 0, assists: 0 });
    clubRow.games++;
    if (clubRow.games === 100) {
      const youth = c.youth.find((player) => player.id === id && player.clubId === c.clubId);
      if (youth) {
        remember(c, 'base', `${youth.name}, formado no clube, chegou a 100 jogos no seu comando`);
        notify(c, {
          kind: 'news',
          from: 'Mando Esportes',
          title: `Cria da base: 100 jogos de ${youth.name}`,
          body: 'O jovem formado no clube alcançou a marca sob seu comando e entrou para a história da sua carreira.',
        });
      }
    }
  }
  for (const e of result.events) {
    if (e.type !== 'goal' || e.clubId !== c.clubId) continue;
    if (e.playerId && L.clubStats[e.playerId]) L.clubStats[e.playerId].goals++;
    if (e.assistId && L.clubStats[e.assistId]) L.clubStats[e.assistId].assists++;
    if (e.playerId && L.clubStatsByClub[c.clubId]?.[e.playerId])
      L.clubStatsByClub[c.clubId][e.playerId].goals++;
    if (e.assistId && L.clubStatsByClub[c.clubId]?.[e.assistId])
      L.clubStatsByClub[c.clubId][e.assistId].assists++;
  }
  const debut = `Estreia no comando do ${clubById(world, c.clubId).name}`;
  if (!L.timeline.some((t) => t.text === debut)) remember(c, 'marco', debut);
}

/** Registra os títulos da temporada na linha do tempo da carreira. */
export function livingSeasonEnd(c: Career, season: number) {
  const titles = c.living.managerTitles
    ? c.living.managerTitles.entries.filter((h) => h.season === season)
    : c.honours.filter((h) => h.season === season && h.clubId === c.clubId);
  for (const h of titles) {
    const text = `Campeão: ${competitionName(h.competition)} ${season}`;
    if (!c.living.timeline.some((event) => event.text === text)) remember(c, 'titulo', text);
  }
}
