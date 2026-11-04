import { LEARNED } from './positions';
import { type Career, type Fixture } from './types';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold';
  check: (c: Career) => boolean;
};

/** Resultados oficiais do clube do manager, do mais antigo para o mais recente. */
function results(c: Career) {
  return c.fixtures
    .filter((f): f is Fixture & { result: NonNullable<Fixture['result']> } =>
      Boolean(f.result && (f.homeId === c.clubId || f.awayId === c.clubId)),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => {
      const home = f.homeId === c.clubId;
      const gf = home ? f.result.homeGoals : f.result.awayGoals;
      const ga = home ? f.result.awayGoals : f.result.homeGoals;
      return { gf, ga, cup: f.cup };
    });
}

const streak = (c: Career, ok: (r: { gf: number; ga: number }) => boolean) => {
  let best = 0;
  let run = 0;
  for (const r of results(c)) {
    run = ok(r) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
};
const titles = (c: Career) => c.honours.filter((h) => h.clubId === c.clubId);
const signings = (c: Career) =>
  c.offers.filter((o) => o.fromClubId === c.clubId && o.status === 'completed');

export const achievements: Achievement[] = [
  {
    id: 'contrato',
    title: 'Caneta na mão',
    description: 'Assine seu primeiro contrato como manager.',
    tier: 'bronze',
    check: () => true,
  },
  {
    id: 'primeira-vitoria',
    title: 'Primeira vitória',
    description: 'Vença sua primeira partida oficial.',
    tier: 'bronze',
    check: (c) => results(c).some((r) => r.gf > r.ga),
  },
  {
    id: 'goleada',
    title: 'Goleada',
    description: 'Vença por quatro ou mais gols de diferença.',
    tier: 'silver',
    check: (c) => results(c).some((r) => r.gf - r.ga >= 4),
  },
  {
    id: 'muralha',
    title: 'Muralha',
    description: 'Termine cinco jogos sem sofrer gols.',
    tier: 'silver',
    check: (c) => results(c).filter((r) => r.ga === 0).length >= 5,
  },
  {
    id: 'embalado',
    title: 'Embalado',
    description: 'Vença cinco partidas seguidas.',
    tier: 'silver',
    check: (c) => streak(c, (r) => r.gf > r.ga) >= 5,
  },
  {
    id: 'invicto',
    title: 'Invencível',
    description: 'Fique dez jogos sem perder.',
    tier: 'gold',
    check: (c) => streak(c, (r) => r.gf >= r.ga) >= 10,
  },
  {
    id: 'artilharia',
    title: 'Máquina de gols',
    description: 'Marque 50 gols com seu clube.',
    tier: 'silver',
    check: (c) => results(c).reduce((n, r) => n + r.gf, 0) >= 50,
  },
  {
    id: 'primeira-contratacao',
    title: 'Reforço confirmado',
    description: 'Conclua sua primeira contratação.',
    tier: 'bronze',
    check: (c) => signings(c).length >= 1,
  },
  {
    id: 'bomba',
    title: 'Contratação bombástica',
    description: 'Contrate um atleta por R$ 30 milhões ou mais.',
    tier: 'gold',
    check: (c) => signings(c).some((o) => o.fee >= 30_000_000),
  },
  {
    id: 'venda',
    title: 'Negociador',
    description: 'Arrecade R$ 20 milhões em vendas.',
    tier: 'silver',
    check: (c) => c.sales >= 20_000_000,
  },
  {
    id: 'cofre',
    title: 'Cofre cheio',
    description: 'Tenha R$ 150 milhões em caixa.',
    tier: 'gold',
    check: (c) => (c.finances[c.clubId]?.cash ?? 0) >= 150_000_000,
  },
  {
    id: 'titulo',
    title: 'Primeira taça',
    description: 'Conquiste seu primeiro título.',
    tier: 'silver',
    check: (c) => titles(c).length >= 1,
  },
  {
    id: 'brasileirao',
    title: 'Campeão brasileiro',
    description: 'Vença a Série A.',
    tier: 'gold',
    check: (c) => titles(c).some((h) => h.competition === 'A'),
  },
  {
    id: 'libertadores',
    title: 'Glória eterna',
    description: 'Conquiste a Libertadores.',
    tier: 'gold',
    check: (c) => titles(c).some((h) => h.competition === 'LIB'),
  },
  {
    id: 'copa-do-brasil',
    title: 'Rei de copas',
    description: 'Conquiste a Copa do Brasil.',
    tier: 'gold',
    check: (c) => titles(c).some((h) => h.competition === 'CDB'),
  },
  {
    id: 'dobradinha',
    title: 'Dobradinha',
    description: 'Ganhe dois títulos na mesma temporada.',
    tier: 'gold',
    check: (c) => {
      const bySeason = new Map<number, number>();
      for (const h of titles(c)) bySeason.set(h.season, (bySeason.get(h.season) ?? 0) + 1);
      return [...bySeason.values()].some((n) => n >= 2);
    },
  },
  {
    id: 'acesso',
    title: 'Subiu!',
    description: 'Conquiste o acesso à Série A.',
    tier: 'gold',
    check: (c) => c.promoted.includes(c.clubId),
  },
  {
    id: 'diretoria',
    title: 'Homem de confiança',
    description: 'Alcance 90% de confiança da diretoria.',
    tier: 'silver',
    check: (c) => c.confidence >= 90,
  },
  {
    id: 'professor',
    title: 'Professor',
    description: 'Ensine uma nova posição a um atleta no treino.',
    tier: 'silver',
    check: (c) =>
      Object.values(c.players).some(
        (s) =>
          s.clubId === c.clubId &&
          Object.values(s.trained || {}).some((v) => v >= LEARNED && v < 100),
      ),
  },
  {
    id: 'numeracao',
    title: 'Dono da numeração',
    description: 'Mude o número da camisa de um atleta.',
    tier: 'bronze',
    check: (c) => Object.keys(c.numbers).length > 0,
  },
  {
    id: 'cem-dias',
    title: 'Cem dias de trabalho',
    description: 'Complete 100 dias no cargo.',
    tier: 'bronze',
    check: (c) => c.history.length > 0 || c.date >= `${c.season}-04-11`,
  },
  {
    id: 'temporada',
    title: 'Missão cumprida',
    description: 'Complete uma temporada inteira.',
    tier: 'silver',
    check: (c) => c.seasonEnded || c.history.length > 0,
  },
];

/** Conquistas recém-desbloqueadas (ainda não registradas na carreira). */
export function newAchievements(c: Career): Achievement[] {
  const have = c.achievements || {};
  return achievements.filter((a) => !have[a.id] && a.check(c));
}

/** Registra as conquistas novas na carreira; devolve a mesma carreira se nada mudou. */
export function unlockAchievements(c: Career): { career: Career; unlocked: Achievement[] } {
  const unlocked = newAchievements(c);
  if (!unlocked.length) return { career: c, unlocked };
  return {
    career: {
      ...c,
      achievements: {
        ...c.achievements,
        ...Object.fromEntries(unlocked.map((a) => [a.id, c.date])),
      },
    },
    unlocked,
  };
}
