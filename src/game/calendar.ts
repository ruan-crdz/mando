import { addDays } from './random';
import { type Career, type Club, type Fixture } from './types';

export const competitionNames: Record<string, string> = {
  A: 'Brasileirão Série A',
  B: 'Brasileirão Série B',
  CDB: 'Copa do Brasil',
  SUP: 'Supercopa do Brasil',
  LIB: 'Copa Libertadores',
  SUL: 'Copa Sul-Americana',
  SEL: 'Amistoso de Seleções',
};
export const stateCupNames: Record<string, string> = {
  SP: 'Paulistão',
  RJ: 'Carioca',
  MG: 'Mineiro',
  RS: 'Gaúcho',
  PR: 'Paranaense',
  SC: 'Catarinense',
  BA: 'Baiano',
  PE: 'Pernambucano',
  CE: 'Cearense',
  GO: 'Goiano',
  MT: 'Mato-Grossense',
  AL: 'Alagoano',
  PA: 'Paraense',
};

export function competitionName(id: string) {
  if (id.startsWith('EST-')) return stateCupNames[id.slice(4)] || `Estadual ${id.slice(4)}`;
  return competitionNames[id] || id;
}
export const fixtureCompetition = (f: Fixture) => f.cup || f.league || 'A';
export function fixtureLabel(f: Fixture) {
  const name = competitionName(fixtureCompetition(f));
  if (f.league) return { name, stage: f.playoff ? 'Playoff de acesso' : `Rodada ${f.round}` };
  return {
    name,
    stage: [f.group ? `Grupo ${f.group}` : f.stage, f.leg ? `${f.leg}º jogo` : '']
      .filter(Boolean)
      .join(' · '),
  };
}

export function milestones(season: number) {
  return [
    { date: `${season}-01-05`, end: `${season}-03-03`, title: 'Primeira janela de transferências' },
    { date: `${season}-01-11`, end: `${season}-03-08`, title: 'Estaduais' },
    { date: `${season}-01-28`, end: `${season}-12-02`, title: 'Brasileirão Série A' },
    { date: `${season}-02-01`, title: 'Supercopa do Brasil' },
    { date: `${season}-02-18`, end: `${season}-12-06`, title: 'Copa do Brasil' },
    {
      date: `${season}-03-21`,
      end: `${season}-11-14`,
      title: 'Brasileirão Série B · fase regular',
    },
    { date: `${season}-04-01`, end: `${season}-11-21`, title: 'Copa Sul-Americana' },
    { date: `${season}-04-08`, end: `${season}-11-28`, title: 'Copa Libertadores' },
    { date: `${season}-07-20`, end: `${season}-09-11`, title: 'Segunda janela de transferências' },
    { date: `${season}-11-21`, end: `${season}-11-28`, title: 'Playoffs de acesso · Série B' },
  ];
}

export function transferWindow(date: string) {
  const md = date.slice(5);
  return (md >= '01-05' && md <= '03-03') || (md >= '07-20' && md <= '09-11');
}

/** 'open' no primeiro dia de cada janela, 'close' no último. */
export function windowMark(date: string): 'open' | 'close' | undefined {
  const md = date.slice(5);
  if (md === '01-05' || md === '07-20') return 'open';
  if (md === '03-03' || md === '09-11') return 'close';
  return undefined;
}

/** Próxima data de abertura de janela a partir de `date` (inclusive). */
export function nextWindowOpen(date: string) {
  const y = Number(date.slice(0, 4));
  const md = date.slice(5);
  if (md <= '01-05') return `${y}-01-05`;
  if (md <= '07-20') return `${y}-07-20`;
  return `${y + 1}-01-05`;
}

export function createSchedule(clubs: Club[], season = 2026): Fixture[] {
  return (['A', 'B'] as const)
    .flatMap((league) => {
      const teams = clubs.filter((c) => c.league === league).map((c) => c.id);
      if (teams.length !== 20) throw new Error('Calendário exige 20 clubes por divisão.');
      const order = [...teams];
      const fixtures: Fixture[] = [];
      const start = league === 'A' ? `${season}-01-28` : `${season}-03-21`;
      const end = league === 'A' ? `${season}-12-02` : `${season}-11-14`;
      const span = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
      // Em 2026 a Série A para durante a Copa do Mundo.
      const pause = league === 'A' && season === 2026 ? 45 : 0;
      for (let round = 0; round < 19; round++) {
        for (let i = 0; i < 10; i++) {
          const [h, a] = round % 2 === 0 ? [order[i], order[19 - i]] : [order[19 - i], order[i]];
          for (let leg = 0; leg < 2; leg++) {
            const r = round + leg * 19;
            const raw = Math.round((r * (span - pause)) / 37);
            const offset = pause && raw >= 133 ? raw + pause : raw;
            fixtures.push({
              id: `${season}-${league}-${r + 1}-${i}`,
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
