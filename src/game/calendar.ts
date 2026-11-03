import { addDays } from './random';
import { type Career, type Club, type Fixture } from './types';

export const milestones = [
  { date: '2026-01-05', end: '2026-03-03', title: 'Primeira janela de transferências' },
  { date: '2026-01-11', end: '2026-03-08', title: 'Estaduais · expansão futura' },
  { date: '2026-01-28', end: '2026-12-02', title: 'Brasileirão Série A' },
  { date: '2026-02-01', title: 'Supercopa · expansão futura' },
  { date: '2026-02-18', end: '2026-12-06', title: 'Copa do Brasil · expansão futura' },
  { date: '2026-03-21', end: '2026-11-14', title: 'Brasileirão Série B · fase regular' },
  { date: '2026-07-20', end: '2026-09-11', title: 'Segunda janela de transferências' },
  { date: '2026-11-21', end: '2026-11-28', title: 'Playoffs de acesso · Série B' },
] as const;

export function transferWindow(date: string) {
  return (
    (date >= '2026-01-05' && date <= '2026-03-03') || (date >= '2026-07-20' && date <= '2026-09-11')
  );
}

export function createSchedule(clubs: Club[]): Fixture[] {
  return (['A', 'B'] as const)
    .flatMap((league) => {
      const teams = clubs.filter((c) => c.league === league).map((c) => c.id);
      if (teams.length !== 20) throw new Error('Calendário exige 20 clubes por divisão.');
      const order = [...teams];
      const fixtures: Fixture[] = [];
      const start = league === 'A' ? '2026-01-28' : '2026-03-21';
      const end = league === 'A' ? '2026-12-02' : '2026-11-14';
      const span = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
      for (let round = 0; round < 19; round++) {
        for (let i = 0; i < 10; i++) {
          const [h, a] = round % 2 === 0 ? [order[i], order[19 - i]] : [order[19 - i], order[i]];
          for (let leg = 0; leg < 2; leg++) {
            const r = round + leg * 19;
            // A pausa internacional não contém rodadas da Série A.
            const raw = Math.round((r * (span - (league === 'A' ? 45 : 0))) / 37);
            const offset = league === 'A' && raw >= 133 ? raw + 45 : raw;
            fixtures.push({
              id: `${league}-${r + 1}-${i}`,
              date: addDays(start, offset),
              league,
              round: r + 1,
              homeId: leg ? a : h,
              awayId: leg ? h : a,
              playoff: false,
            });
          }
        }
        order.splice(1, 0, order.pop()!);
      }
      return fixtures;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function nextFixture(career: Career) {
  return career.fixtures.find(
    (f) => !f.result && (f.homeId === career.clubId || f.awayId === career.clubId),
  );
}
