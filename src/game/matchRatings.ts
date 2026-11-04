import { clamp, hash } from './random';
import { overall } from './ratings';
import { familiarity } from './positions';
import { findPlayer } from './npc';
import { sideFormation, stateOf } from './matches';
import { formations, type Career, type Match, type World } from './types';

export type PlayerRating = {
  id: string;
  clubId: string;
  rating: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  saves: number;
  role: string;
};

const defenders = new Set(['CB', 'LB', 'RB']);

/**
 * Notas no estilo SofaScore (3,0 a 10,0), calculadas pelo que aconteceu na partida:
 * gols, passes para gol, finalizações, defesas, gols sofridos com o atleta em campo,
 * domínio do time, resultado, forma do dia e adaptação à função.
 */
export function matchRatings(career: Career, world: World, match: Match): PlayerRating[] {
  const fixture = career.fixtures.find((f) => f.id === match.fixtureId);
  if (!fixture) return [];
  const sides = [
    { clubId: fixture.homeId, ids: match.homeLineup, gf: match.homeGoals, ga: match.awayGoals },
    { clubId: fixture.awayId, ids: match.awayLineup, gf: match.awayGoals, ga: match.homeGoals },
  ];
  const sideOvr = sides.map(({ clubId, ids }) => {
    const roles = formations[sideFormation(career, match, clubId)];
    const values = ids.flatMap((id, i) => {
      const p = findPlayer(world, id);
      return p ? [overall(p, roles[i] || p.position, stateOf(career, id))] : [];
    });
    return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  });
  const out: PlayerRating[] = [];
  sides.forEach((side, k) => {
    const other = sides[1 - k];
    const stats = k === 0 ? match.home : match.away;
    const otherStats = k === 0 ? match.away : match.home;
    const roles = formations[sideFormation(career, match, side.clubId)];
    const ids = new Set([
      ...side.ids,
      ...match.replaced.filter((id) => career.players[id]?.clubId === side.clubId),
    ]);
    for (const id of ids) {
      const minutes = match.minutesPlayed[id] || 0;
      if (!minutes) continue;
      const p = findPlayer(world, id);
      if (!p) continue;
      const s = stateOf(career, id);
      const index = side.ids.indexOf(id);
      const role = index >= 0 ? roles[index] || p.position : p.position;
      const finalXi = index >= 0;
      // Janela em campo: quem saiu jogou do início; quem entrou jogou até o fim.
      const from = finalXi && minutes < match.minute ? match.minute - minutes : 0;
      const to = finalXi ? match.minute : minutes;
      const onPitch = (m: number) => m > from && m <= to;
      const conceded = match.events.filter(
        (e) => e.type === 'goal' && e.clubId === other.clubId && onPitch(e.minute),
      ).length;
      const saves = match.events.filter(
        (e) => e.type === 'save' && e.clubId === other.clubId && onPitch(e.minute),
      ).length;
      const mine = match.events.filter((e) => e.playerId === id);
      const goals = mine.filter((e) => e.type === 'goal').length;
      const assists = match.events.filter((e) => e.type === 'goal' && e.assistId === id).length;
      const onTarget = mine.filter((e) => e.type === 'save').length;
      const misses = mine.filter((e) => e.type === 'miss').length;
      const yellows = mine.filter((e) => e.type === 'yellow').length;
      const fam = familiarity(p, role, s);
      const noise = ((hash(`${match.seed}:${id}:form`) % 2001) - 1000) / 1000;
      let r = 6.4;
      r += clamp((overall(p, role, s) - sideOvr[1 - k]) / 12, -1, 1) * 0.35;
      r += (((s?.morale ?? 60) - 60) / 40) * 0.15;
      r += noise * 0.35;
      if (fam < 85) r -= ((85 - fam) / 75) * 1.3;
      r += goals * (defenders.has(role) ? 1.2 : 1) + assists * 0.65;
      r += onTarget * 0.15 - misses * 0.08 - yellows * 0.3;
      if (role === 'GK')
        r += saves * 0.3 - conceded * 0.35 + (conceded === 0 && minutes >= 60 ? 0.6 : 0);
      else if (defenders.has(role) || role === 'DM')
        r +=
          -conceded * 0.18 + (conceded === 0 && minutes >= 60 ? (role === 'DM' ? 0.25 : 0.45) : 0);
      if (['DM', 'CM', 'AM'].includes(role)) r += ((stats.possession - 50) / 100) * 0.8;
      r += clamp((stats.xg - otherStats.xg) * 0.12, -0.3, 0.3);
      if (match.minute >= 90) r += side.gf > side.ga ? 0.3 : side.gf < side.ga ? -0.25 : 0;
      if (match.injured?.includes(id)) r -= 0.2;
      r += match.bonus?.[id] || 0;
      if (minutes < 60) r = 6.5 + (r - 6.5) * Math.max(0.35, minutes / 60);
      out.push({
        id,
        clubId: side.clubId,
        rating: Math.round(clamp(r, 3, 10) * 10) / 10,
        minutes,
        goals,
        assists,
        shots: onTarget + misses + goals,
        saves: role === 'GK' ? saves : 0,
        role,
      });
    }
  });
  return out.sort((a, b) => b.rating - a.rating);
}

/** Craque do jogo: maior nota; no empate, quem venceu. */
export function manOfTheMatch(ratings: PlayerRating[], match: Match, homeId: string) {
  const winner =
    match.homeGoals === match.awayGoals
      ? null
      : match.homeGoals > match.awayGoals
        ? 'home'
        : 'away';
  return [...ratings].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    const side = (r: PlayerRating) => (r.clubId === homeId ? 'home' : 'away');
    return Number(side(b) === winner) - Number(side(a) === winner);
  })[0];
}

/** Cor da nota, como nos apps de estatística. */
export const ratingTone = (r: number) =>
  r >= 8 ? 'elite' : r >= 7 ? 'good' : r >= 6.5 ? 'ok' : r >= 6 ? 'meh' : 'bad';
