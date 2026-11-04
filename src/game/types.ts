import { z } from 'zod';

export const SNAPSHOT = 'WORLD_SNAPSHOT_2026_01_01';
export const positions = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'] as const;
export const positionSchema = z.enum(positions);
export type Position = z.infer<typeof positionSchema>;
export const attributeKeys = [
  'pace',
  'acceleration',
  'finishing',
  'shortPass',
  'longPass',
  'vision',
  'dribbling',
  'control',
  'strength',
  'stamina',
  'positioning',
  'marking',
  'tackling',
  'interception',
  'heading',
  'composure',
  'reflexes',
  'handling',
  'diving',
] as const;
const rating = z.number().int().min(1).max(99);
const percent = z.number().min(0).max(100);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    'Data inválida',
  );
export const attributesSchema = z.object({
  pace: rating,
  acceleration: rating,
  finishing: rating,
  shortPass: rating,
  longPass: rating,
  vision: rating,
  dribbling: rating,
  control: rating,
  strength: rating,
  stamina: rating,
  positioning: rating,
  marking: rating,
  tackling: rating,
  interception: rating,
  heading: rating,
  composure: rating,
  reflexes: rating,
  handling: rating,
  diving: rating,
});
export type Attributes = z.infer<typeof attributesSchema>;
export const clubSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  short: z.string().min(2).max(4),
  league: z.enum(['A', 'B']),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  state: z.string().length(2),
  stadium: z.string().min(1),
  reputation: rating,
  budget: z.number().nonnegative(),
  debt: z.number().nonnegative(),
});
export type Club = z.infer<typeof clubSchema>;
export const playerSchema = z.object({
  id: z.string().min(1),
  clubId: z.string().min(1),
  name: z.string().min(2),
  birthDate: isoDate,
  nationality: z.string().min(2),
  position: positionSchema,
  foot: z.enum(['D', 'E', 'A']),
  potential: rating,
  uncertainty: z.number().int().min(0).max(10),
  value: z.number().nonnegative(),
  wage: z.number().nonnegative(),
  contractEnd: isoDate,
  attributes: attributesSchema,
  /** Número da camisa quando conhecido na fonte; o restante é atribuído pela carreira. */
  number: z.number().int().min(1).max(99).optional(),
  /** Posições secundárias/terciárias, em ordem de domínio. */
  secondary: z.array(positionSchema).max(3).optional(),
});
export type Player = z.infer<typeof playerSchema>;
export const worldSchema = z
  .object({
    id: z.string().min(1),
    snapshot: z.literal(SNAPSHOT),
    date: z.literal('2026-01-01'),
    mode: z.enum(['demo', 'official']),
    source: z.string().trim().min(3),
    license: z.string().trim().min(3),
    clubs: z.array(clubSchema).length(40),
    players: z.array(playerSchema).min(440).max(3000),
  })
  .superRefine((w, ctx) => {
    const ids = new Set(w.clubs.map((c) => c.id));
    if (ids.size !== 40 || new Set(w.players.map((p) => p.id)).size !== w.players.length)
      ctx.addIssue({ code: 'custom', message: 'IDs duplicados no snapshot.' });
    if (w.clubs.filter((c) => c.league === 'A').length !== 20)
      ctx.addIssue({ code: 'custom', message: 'O mundo precisa de 20 clubes em cada divisão.' });
    for (const p of w.players) {
      if (!ids.has(p.clubId) || p.birthDate >= w.date || p.contractEnd <= w.date)
        ctx.addIssue({ code: 'custom', message: `Clube ou datas inválidos: ${p.name}` });
    }
    for (const club of w.clubs) {
      const squad = w.players.filter((p) => p.clubId === club.id);
      if (
        squad.length < 18 ||
        squad.length > 75 ||
        squad.filter((p) => p.position === 'GK').length < 2
      )
        ctx.addIssue({
          code: 'custom',
          message: `${club.name}: 18 a 75 atletas e pelo menos 2 goleiros.`,
        });
    }
  });
export type World = z.infer<typeof worldSchema>;
export const managerSchema = z.object({
  firstName: z.string().trim().min(2, 'Informe um nome com pelo menos duas letras.').max(35),
  lastName: z.string().trim().min(2, 'Informe um sobrenome com pelo menos duas letras.').max(45),
  nationality: z.string().min(2).max(40),
  age: z
    .number()
    .int()
    .min(18, 'O manager deve ter entre 18 e 85 anos.')
    .max(85, 'O manager deve ter entre 18 e 85 anos.'),
  style: z.enum(['Terno azul', 'Agasalho', 'Camisa social']),
  appearance: z.string().max(400),
  avatar: z.string().url().optional(),
});
export type Manager = z.infer<typeof managerSchema>;
export const challenges = [
  'Realista',
  'Do zero',
  'Crise financeira',
  'Só a base',
  'Venda necessária',
  'Pressão máxima',
  'Reconstrução',
] as const;
export const difficulties = ['Iniciante', 'Amador', 'Profissional'] as const;
export const formations = {
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LW', 'AM', 'RW', 'ST'],
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'LW', 'RW', 'ST'],
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RB', 'ST', 'ST'],
} as const;
export type Formation = keyof typeof formations;
export const roleNames = [
  'Capitão',
  'Vice-capitão',
  'Pênaltis',
  'Faltas curtas',
  'Faltas longas',
  'Escanteio esquerdo',
  'Escanteio direito',
  'Lateral esquerdo',
  'Lateral direito',
] as const;
export const playerStateSchema = z.object({
  clubId: z.string().nullable(),
  fitness: percent,
  morale: percent,
  injuryDays: z.number().int().nonnegative(),
  yellow: z.number().int().nonnegative(),
  suspension: z.number().int().nonnegative(),
  growth: z.number().min(-20).max(20),
  minutes: z.number().int().nonnegative(),
  goals: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  wage: z.number().nonnegative(),
  contractEnd: isoDate,
  relationship: percent,
  benchGames: z.number().int().nonnegative(),
  retired: z.boolean().optional(),
  /** Posição principal escolhida pelo treinador (sobrepõe o snapshot). */
  position: positionSchema.optional(),
  /** Posição em treinamento. */
  training: positionSchema.optional(),
  /** Familiaridade conquistada em treino por posição (0–100). */
  trained: z.record(z.string(), z.number().min(0).max(100)).optional(),
  ratingTotal: z.number().optional(),
  rated: z.number().int().optional(),
  monthlyRatingTotal: z.number().default(0),
  monthlyRated: z.number().int().nonnegative().default(0),
  personality: z
    .enum(['Profissional', 'Ambicioso', 'Temperamental', 'Leal', 'Disciplinado', 'Líder'])
    .default('Profissional'),
  sharpness: percent.default(50),
  potentialDelta: z.number().min(-8).max(8).default(0),
  development: z.enum(['Equilibrado', 'Ataque', 'Criação', 'Defesa', 'Físico']).default('Equilibrado'),
  role: z
    .enum(['Padrão', 'Finalizador', 'Armador', 'Pivô', 'Volante', 'Zagueiro construtor', 'Lateral ofensivo'])
    .default('Padrão'),
  clause: z.number().nonnegative().optional(),
  loanFrom: z.string().optional(),
  loanUntil: isoDate.optional(),
  promiseUntil: isoDate.optional(),
});
export type PlayerState = z.infer<typeof playerStateSchema>;
export const tacticSchema = z.object({
  formation: z.enum(['4-2-3-1', '4-3-3', '4-4-2', '3-5-2']),
  mentality: z.enum(['Defensiva', 'Equilibrada', 'Ofensiva']),
  pressure: z.number().int().min(1).max(5),
  width: z.number().int().min(1).max(5),
  tempo: z.number().int().min(1).max(5),
  line: z.number().int().min(1).max(5),
});
export type Tactic = z.infer<typeof tacticSchema>;
const eventSchema = z.object({
  minute: z.number().int().min(0).max(95),
  type: z.enum([
    'kickoff',
    'chance',
    'goal',
    'save',
    'miss',
    'yellow',
    'injury',
    'sub',
    'tactic',
    'half',
    'full',
    'moment',
  ]),
  clubId: z.string(),
  playerId: z.string().optional(),
  /** Quem deu o passe para o gol. */
  assistId: z.string().optional(),
  text: z.string(),
});
export type MatchEvent = z.infer<typeof eventSchema>;
export const momentKinds = ['tired', 'injury', 'position', 'subbed', 'bench', 'badday'] as const;
export const momentSchema = z.object({
  id: z.string(),
  minute: z.number().int().min(0).max(90),
  kind: z.enum(momentKinds),
  playerId: z.string(),
  text: z.string(),
  status: z.enum(['open', 'done']),
  outcome: z.string().optional(),
  action: z.string().optional(),
  /** Posição que o atleta pede (momentos de troca de posição). */
  role: z.string().optional(),
});
export type MatchMoment = z.infer<typeof momentSchema>;
const sideStatsSchema = z.object({
  shots: z.number().int().nonnegative(),
  xg: z.number().nonnegative(),
  possession: z.number().min(0).max(100),
  passes: z.number().int().nonnegative(),
});
export const matchSchema = z.object({
  fixtureId: z.string(),
  seed: z.number(),
  minute: z.number().int().min(0).max(90),
  homeGoals: z.number().int().nonnegative(),
  awayGoals: z.number().int().nonnegative(),
  home: sideStatsSchema,
  away: sideStatsSchema,
  events: z.array(eventSchema),
  homeLineup: z.array(z.string()),
  awayLineup: z.array(z.string()),
  usedSubs: z.number().int().min(0).max(5),
  replaced: z.array(z.string()),
  ratings: z.record(z.string(), z.number()),
  minutesPlayed: z.record(z.string(), z.number().int().min(0).max(90)).default({}),
  energySpent: z.record(z.string(), z.number().nonnegative()).default({}),
  /** Atletas que sentiram lesão e seguem em campo (rendimento reduzido). */
  injured: z.array(z.string()).default([]),
  /** Momentos humanos do jogo que pedem uma decisão do técnico. */
  moments: z.array(momentSchema).default([]),
  /** Plano de jogo dos clubes da engine nesta partida. */
  homeTactic: tacticSchema.optional(),
  awayTactic: tacticSchema.optional(),
  /** Ajustes de nota vindos das conversas em campo. */
  bonus: z.record(z.string(), z.number()).optional(),
  /** Craque do jogo, definido no apito final. */
  mvp: z.string().optional(),
});
export type Match = z.infer<typeof matchSchema>;
export const cupIds = ['EST', 'CDB', 'SUP', 'LIB', 'SUL'] as const;
export const fixtureSchema = z.object({
  id: z.string(),
  date: isoDate,
  /** Presente apenas em partidas do Brasileirão. */
  league: z.enum(['A', 'B']).optional(),
  /** Competição de copa: EST-SP, CDB, SUP, LIB ou SUL. */
  cup: z.string().optional(),
  stage: z.string().optional(),
  group: z.string().optional(),
  tie: z.string().optional(),
  leg: z.number().int().min(1).max(2).optional(),
  round: z.number().int(),
  homeId: z.string(),
  awayId: z.string(),
  playoff: z.boolean().default(false),
  penalties: z
    .object({ home: z.number().int().nonnegative(), away: z.number().int().nonnegative() })
    .optional(),
  result: matchSchema.optional(),
});
export type Fixture = z.infer<typeof fixtureSchema>;
export const messageSchema = z.object({
  id: z.string(),
  date: isoDate,
  from: z.string(),
  title: z.string(),
  body: z.string(),
  kind: z.enum(['board', 'player', 'staff', 'market', 'news', 'finance']),
  important: z.boolean(),
  read: z.boolean(),
  playerId: z.string().optional(),
  resolved: z.boolean(),
  aiText: z.string().optional(),
  /** Plano sugerido pelo auxiliar técnico para o próximo jogo. */
  tactic: tacticSchema.optional(),
  choice: z.enum(['support', 'firm']).optional(),
});
export type Message = z.infer<typeof messageSchema>;
const negotiationTermsSchema = z.object({
  fee: z.number().nonnegative().optional(),
  wage: z.number().nonnegative().optional(),
  years: z.number().int().min(1).max(5).optional(),
  bonus: z.number().nonnegative().optional(),
  exchangePlayerId: z.string().optional(),
});
export type NegotiationTerms = z.infer<typeof negotiationTermsSchema>;
export const negotiationMessageSchema = negotiationTermsSchema.extend({
  date: isoDate,
  from: z.enum(['me', 'club', 'agent', 'system']),
  kind: z.enum(['offer', 'counter', 'accept', 'reject', 'info']),
  text: z.string(),
});
export type NegotiationMessage = z.infer<typeof negotiationMessageSchema>;
export const offerSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  fromClubId: z.string(),
  toClubId: z.string(),
  fee: z.number().nonnegative(),
  wage: z.number().nonnegative(),
  exchangePlayerId: z.string().optional(),
  /** Duração do contrato oferecido ao atleta, em anos. */
  years: z.number().int().min(1).max(5).optional(),
  /** Luvas pagas ao atleta na assinatura. */
  bonus: z.number().nonnegative().optional(),
  date: isoDate,
  responseDate: isoDate,
  /** countered = o outro lado devolveu uma contraproposta e aguarda a sua decisão. */
  status: z.enum(['pending', 'countered', 'accepted', 'rejected', 'completed', 'declined']),
  incoming: z.boolean(),
  minimum: z.number().nonnegative(),
  /** Etapa da conversa: acordo entre clubes ou contrato com o agente do atleta. */
  stage: z.enum(['club', 'player']).optional(),
  /** Paciência restante do outro lado; zerada, a conversa é encerrada. */
  patience: z.number().optional(),
  /** Último valor total pedido pelo clube vendedor (taxa + troca). */
  ask: z.number().nonnegative().optional(),
  counter: negotiationTermsSchema.optional(),
  lockedUntil: isoDate.optional(),
  messages: z.array(negotiationMessageSchema).optional(),
});
export type Offer = z.infer<typeof offerSchema>;
export const careerSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  worldId: z.string(),
  mode: z.enum(['demo', 'official']),
  manager: managerSchema,
  clubId: z.string(),
  date: isoDate,
  seed: z.number().int(),
  difficulty: z.enum(difficulties),
  challenge: z.enum(challenges),
  players: z.record(z.string(), playerStateSchema),
  finances: z.record(
    z.string(),
    z.object({
      cash: z.number(),
      transferBudget: z.number().nonnegative(),
      debt: z.number().nonnegative(),
      history: z.array(
        z.object({ date: isoDate, income: z.number(), expenses: z.number(), balance: z.number() }),
      ),
    }),
  ),
  fixtures: z.array(fixtureSchema),
  lineup: z.array(z.string()).length(11),
  roles: z.record(z.string(), z.string()),
  tactic: tacticSchema,
  messages: z.array(messageSchema),
  offers: z.array(offerSchema),
  confidence: percent,
  sales: z.number().nonnegative(),
  activeMatch: matchSchema.optional(),
  memories: z.array(z.object({ playerId: z.string(), date: isoDate, text: z.string() })),
  seasonEnded: z.boolean(),
  promoted: z.array(z.string()),
  relegated: z.array(z.string()),
  season: z.number().int().min(2026).default(2026),
  /** Divisão atual de cada clube após acessos e rebaixamentos (o snapshot base nunca muda). */
  leagues: z.record(z.string(), z.enum(['A', 'B'])).default({}),
  /** Atletas criados pela carreira (categorias de base), fora do snapshot imutável. */
  youth: z.array(playerSchema).default([]),
  honours: z
    .array(z.object({ season: z.number().int(), competition: z.string(), clubId: z.string() }))
    .default([]),
  /** Números de camisa definidos na carreira (sobrepõem o snapshot). */
  numbers: z.record(z.string(), z.number().int().min(1).max(99)).default({}),
  /** Conquistas desbloqueadas (id → data). */
  achievements: z.record(z.string(), isoDate).default({}),
  /** Preferências da carreira. */
  prefs: z
    .object({ advance: z.enum(['day', 'event', 'auto']).default('day') })
    .default({ advance: 'day' }),
  /** Lista de observação do mercado. */
  shortlist: z.array(z.string()).default([]),
  scouts: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        region: z.string(),
        skill: z.number().int().min(1).max(5),
        progress: z.number().int().min(0).max(30).default(0),
      }),
    )
    .default([]),
  prospects: z.array(playerSchema).default([]),
  awards: z
    .array(
      z.object({
        season: z.number().int(),
        month: z.number().int().min(0).max(12),
        category: z.enum(['Jogador do mês', 'Time do mês', 'Melhor jogador', 'Artilheiro', 'Revelação', 'Goleiro']),
        playerId: z.string().optional(),
        clubId: z.string().optional(),
      }),
    )
    .default([]),
  jobOffers: z
    .array(
      z.object({
        id: z.string(),
        clubId: z.string(),
        expires: isoDate,
        salary: z.number().nonnegative(),
      }),
    )
    .default([]),
  preContracts: z
    .array(
      z.object({
        playerId: z.string(),
        clubId: z.string(),
        wage: z.number().nonnegative(),
        joined: z.boolean().default(false),
      }),
    )
    .default([]),
  sacked: z.boolean().default(false),
  history: z
    .array(
      z.object({
        season: z.number().int(),
        league: z.enum(['A', 'B']),
        position: z.number().int(),
        confidence: z.number(),
        trophies: z.array(z.string()),
      }),
    )
    .default([]),
});
export type Career = z.infer<typeof careerSchema>;
export type TableRow = {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
};
