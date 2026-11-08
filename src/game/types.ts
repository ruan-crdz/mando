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
  gender: z.enum(['Homem', 'Mulher', 'Não informar']).optional(),
  formOfAddress: z.enum(['Sr.', 'Sra.', 'Mx.']).optional(),
  countryRegion: z.string().min(2).max(60).optional(),
  birthRegion: z.string().trim().min(2).max(80).optional(),
  birthDate: isoDate.optional(),
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
  'Reconstrução',
] as const;
export const difficulties = ['Iniciante', 'Amador', 'Profissional'] as const;
export const formations = {
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LW', 'AM', 'RW', 'ST'],
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'LW', 'RW', 'ST'],
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RB', 'ST', 'ST'],
  '4-1-4-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'LM', 'CM', 'CM', 'RM', 'ST'],
  '4-3-2-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'AM', 'AM', 'ST'],
  '4-4-2 losango': ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'AM', 'ST', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  '3-4-2-1': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'AM', 'AM', 'ST'],
  '5-3-2': ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'ST', 'ST'],
  '5-4-1': ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST'],
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
export const assistantAreas = ['ataque', 'meio', 'defesa', 'goleiro'] as const;
export type AssistantArea = (typeof assistantAreas)[number];
const assistantCoachSchema = z.object({
  id: z.string().optional(),
  area: z.enum(assistantAreas).optional(),
  name: z.string().min(2),
  tacticalVision: z.enum(['Ofensivo', 'Retranqueiro', 'Pressão', 'Posse', 'Contra-ataque']),
  skill: z.number().int().min(1).max(5),
  stars: z.record(positionSchema, z.number().int().min(1).max(5)),
  wageWeekly: z.number().nonnegative().max(5000),
});
export type AssistantCoach = z.infer<typeof assistantCoachSchema>;
const savedLineupSchema = z.object({
  name: z.string().min(1).max(32),
  formation: z.enum(Object.keys(formations) as [Formation, ...Formation[]]),
  playerIds: z.array(z.string()).length(11),
});
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
  development: z
    .enum(['Equilibrado', 'Ataque', 'Criação', 'Defesa', 'Físico'])
    .default('Equilibrado'),
  role: z
    .enum([
      'Padrão',
      'Finalizador',
      'Armador',
      'Pivô',
      'Volante',
      'Zagueiro construtor',
      'Lateral ofensivo',
    ])
    .default('Padrão'),
  clause: z.number().nonnegative().optional(),
  /** Preço pedido quando o treinador colocou o atleta à venda. */
  listed: z.number().nonnegative().optional(),
  loanFrom: z.string().optional(),
  loanUntil: isoDate.optional(),
  /** Termos do empréstimo em vigor (taxa, salário, opção/obrigação e números no clube). */
  loan: z
    .object({
      months: z.number().int().min(1).max(12),
      fee: z.number().nonnegative(),
      wagePct: z.number().min(0).max(100),
      option: z.number().nonnegative().optional(),
      obligation: z
        .object({ fee: z.number().nonnegative(), games: z.number().int().min(1) })
        .optional(),
      games: z.number().int().nonnegative().default(0),
      ratingSum: z.number().nonnegative().default(0),
    })
    .optional(),
  /** % dos direitos econômicos do clube atual (ausente = padrão determinístico). */
  rights: z.number().min(0).max(100).optional(),
  /** Dono do restante dos direitos: id de clube, 'investidor' ou 'empresario'. */
  partner: z.string().optional(),
  /** Demais titulares dos direitos, quando há mais de um. */
  rightsPartners: z.record(z.string(), z.number().min(0).max(100)).optional(),
  promiseUntil: isoDate.optional(),
});
export type PlayerState = z.infer<typeof playerStateSchema>;
export const tacticSchema = z.object({
  formation: z.enum(Object.keys(formations) as [Formation, ...Formation[]]),
  mentality: z.enum(['Defensiva', 'Equilibrada', 'Ofensiva']),
  pressure: z.number().int().min(1).max(5),
  width: z.number().int().min(1).max(5),
  tempo: z.number().int().min(1).max(5),
  line: z.number().int().min(1).max(5),
});
export type Tactic = z.infer<typeof tacticSchema>;
const matchEventTypes = [
  'kickoff',
  'chance',
  'goal',
  'save',
  'miss',
  'yellow',
  'red',
  'injury',
  'sub',
  'tactic',
  'half',
  'full',
] as const;
const knownMatchEventTypes = new Set<string>(matchEventTypes);
const matchEventTypeSchema = z.preprocess(
  (value) => (typeof value === 'string' && !knownMatchEventTypes.has(value) ? 'chance' : value),
  z.enum(matchEventTypes),
);
const eventSchema = z.object({
  minute: z.number().int().min(0).max(95),
  type: matchEventTypeSchema,
  clubId: z.string(),
  playerId: z.string().optional(),
  /** Quem deu o passe para o gol. */
  assistId: z.string().optional(),
  /** Qualidade da chance (gols esperados). */
  xg: z.number().optional(),
  origin: z.enum(['open', 'penalty', 'freeKick', 'corner']).optional(),
  text: z.string(),
});
export type MatchEvent = z.infer<typeof eventSchema>;
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
  /** Atletas expulsos, mantidos na escalação para preservar as posições dos demais. */
  dismissed: z.array(z.string()).default([]),
  /** Plano de jogo dos clubes da engine nesta partida. */
  homeTactic: tacticSchema.optional(),
  awayTactic: tacticSchema.optional(),
  /** Ajustes de nota vindos das conversas em campo. */
  bonus: z.record(z.string(), z.number()).optional(),
  /** Craque do jogo, definido no apito final. */
  mvp: z.string().optional(),
  /** Trocas feitas pelo técnico da IA. */
  aiSubs: z.number().int().optional(),
  /** Instrução temporária da beira do campo e minuto do último comando. */
  shout: z
    .object({
      kind: z.enum(['incentivar', 'pressionar', 'acalmar']),
      until: z.number().int().min(0).max(90),
    })
    .optional(),
  lastShout: z.number().int().min(0).max(90).optional(),
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
export const loanTermsSchema = z.object({
  months: z.number().int().min(1).max(12),
  /** % do salário pago pelo clube que recebe o atleta. */
  wagePct: z.number().min(0).max(100),
  /** Opção de compra (valor fixo) ao fim do empréstimo. */
  option: z.number().nonnegative().optional(),
  /** Obrigação de compra se o atleta fizer ao menos `games` jogos. */
  obligation: z
    .object({ fee: z.number().nonnegative(), games: z.number().int().min(1) })
    .optional(),
});
export type LoanTerms = z.infer<typeof loanTermsSchema>;
const negotiationTermsSchema = z.object({
  fee: z.number().nonnegative().optional(),
  wage: z.number().nonnegative().optional(),
  years: z.number().int().min(1).max(5).optional(),
  bonus: z.number().nonnegative().optional(),
  exchangePlayerId: z.string().optional(),
  /** % dos direitos econômicos comprados. */
  rights: z.number().min(0).max(100).optional(),
  /** % sobre futura venda devida ao vendedor. */
  sellOn: z.number().min(0).max(30).optional(),
  loan: loanTermsSchema.optional(),
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
  /** % dos direitos econômicos negociados (padrão 100). */
  rights: z.number().min(0).max(100).optional(),
  /** % sobre futura venda concedida ao vendedor. */
  sellOn: z.number().min(0).max(30).optional(),
  /** Presente quando a conversa é um pedido de empréstimo. */
  loan: loanTermsSchema.optional(),
  /** Acordo fechado fora da janela: a operação se concretiza quando ela abrir. */
  awaitingWindow: z.boolean().optional(),
  /** Empréstimo de atleta do usuário para um clube da IA, agendado para a janela. */
  outLoan: z.boolean().optional(),
});
export type Offer = z.infer<typeof offerSchema>;
export const coachStyles = [
  'Ofensivo',
  'Retranqueiro',
  'Pressão',
  'Posse',
  'Contra-ataque',
] as const;
const staffLevelSchema = z.number().int().min(1).max(5).default(2);
export const livingSchema = z.object({
  /** Técnicos dos clubes da IA. */
  coaches: z
    .record(
      z.string(),
      z.object({
        name: z.string(),
        style: z.enum(coachStyles),
        skill: z.number().int().min(1).max(5),
        since: isoDate,
        /** Sequência sem vencer (pressão no cargo). */
        winless: z.number().int().nonnegative().default(0),
      }),
    )
    .default({}),
  /** Movimentações do mercado da carreira. */
  transfers: z
    .array(
      z.object({
        date: isoDate,
        playerId: z.string(),
        from: z.string(),
        to: z.string(),
        fee: z.number().nonnegative(),
        kind: z.enum(['compra', 'exterior']),
      }),
    )
    .default([]),
  /** Linha do tempo da carreira. */
  timeline: z
    .array(
      z.object({
        date: isoDate,
        kind: z.enum([
          'titulo',
          'venda',
          'contratacao',
          'derrota',
          'vitoria',
          'marco',
          'base',
          'cargo',
        ]),
        text: z.string(),
      }),
    )
    .default([]),
  /** Números de cada atleta pelo clube sob o seu comando (hall da fama). */
  clubStats: z
    .record(
      z.string(),
      z.object({
        games: z.number().int().nonnegative(),
        goals: z.number().int().nonnegative(),
        assists: z.number().int().nonnegative(),
      }),
    )
    .default({}),
  clubStatsByClub: z
    .record(
      z.string(),
      z.record(
        z.string(),
        z.object({
          games: z.number().int().nonnegative(),
          goals: z.number().int().nonnegative(),
          assists: z.number().int().nonnegative(),
        }),
      ),
    )
    .default({}),
  academy: z
    .object({
      clubId: z.string(),
      season: z.number().int().min(2026),
      candidates: z.array(playerSchema),
    })
    .optional(),
  academyRoster: z.array(playerSchema).default([]),
  academyInitializedClubs: z.array(z.string()).default([]),
  academyFixtures: z
    .array(
      z.object({
        id: z.string(),
        date: isoDate,
        homeId: z.string(),
        awayId: z.string(),
        homeGoals: z.number().int().nonnegative().optional(),
        awayGoals: z.number().int().nonnegative().optional(),
      }),
    )
    .default([]),
  managerRecord: z
    .object({
      since: isoDate,
      won: z.number().int().nonnegative().default(0),
      drawn: z.number().int().nonnegative().default(0),
      lost: z.number().int().nonnegative().default(0),
    })
    .optional(),
  managerTitles: z
    .object({
      since: isoDate,
      entries: z
        .array(
          z.object({
            season: z.number().int(),
            competition: z.string(),
            clubId: z.string(),
            date: isoDate,
          }),
        )
        .default([]),
    })
    .optional(),
  /** Comissão técnica contratada (nível 1–5 de cada cargo). */
  staff: z
    .object({
      fitness: staffLevelSchema,
      medical: staffLevelSchema,
      goalkeeping: staffLevelSchema,
      director: staffLevelSchema,
      youth: staffLevelSchema,
    })
    .prefault({}),
  /** % sobre a próxima venda do atleta devida ao clube credor. */
  sellOns: z
    .array(
      z.object({
        playerId: z.string(),
        clubId: z.string(),
        pct: z.number().min(0).max(100),
        since: isoDate,
      }),
    )
    .default([]),
  /** Opções de compra de empréstimos encerrados que o usuário ainda pode exercer. */
  loanOptions: z
    .array(
      z.object({
        playerId: z.string(),
        clubId: z.string(),
        fee: z.number().nonnegative(),
        expires: isoDate,
      }),
    )
    .default([]),
  /** Contas pagas e recebidas pelo clube do usuário em transações de terceiros. */
  ledger: z
    .array(
      z.object({
        date: isoDate,
        playerId: z.string(),
        kind: z.enum(['sellon', 'solidariedade', 'direitos', 'comissao', 'emprestimo', 'opcao']),
        from: z.string(),
        to: z.string(),
        amount: z.number().nonnegative(),
      }),
    )
    .default([]),
});
export type Living = z.infer<typeof livingSchema>;
const careerStateSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  worldId: z.string(),
  mode: z.enum(['demo', 'official']),
  manager: managerSchema,
  /** Optional for existing saves; absent legacy data is treated as already onboarded. */
  onboarding: z
    .object({
      contractSigned: z.boolean(),
      tutorialComplete: z.boolean(),
    })
    .optional(),
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
      playerWageBudget: z.number().nonnegative().optional(),
      assistantWageBudget: z.number().nonnegative().optional(),
      debt: z.number().nonnegative(),
      history: z.array(
        z.object({
          date: isoDate,
          income: z.number(),
          expenses: z.number(),
          balance: z.number(),
        }),
      ),
    }),
  ),
  fixtures: z.array(fixtureSchema),
  lineup: z.array(z.string()).length(11),
  /** Reservas escolhidos para as substituições; vazio em saves antigos mantém a disponibilidade anterior. */
  bench: z.array(z.string()).max(9).default([]),
  /** Distingue um banco explicitamente vazio do comportamento automático de saves antigos. */
  benchConfigured: z.boolean().default(false),
  /** Esquemas criados pelo treinador para reutilização e exportação. */
  savedLineups: z.array(savedLineupSchema).default([]),
  /** Auxiliares identificados individualmente; chaves de área são aceitas em saves antigos. */
  assistantCoaches: z.record(z.string(), assistantCoachSchema).default({}),
  roles: z.record(z.string(), z.string()),
  tactic: tacticSchema,
  messages: z.array(messageSchema),
  offers: z.array(offerSchema),
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
  history: z
    .array(
      z.object({
        season: z.number().int(),
        clubId: z.string().optional(),
        league: z.enum(['A', 'B']),
        position: z.number().int(),
        trophies: z.array(z.string()),
      }),
    )
    .default([]),
  /** Mundo vivo: técnicos da IA, mercado, vestiário, diretoria, torcida e legado. */
  living: livingSchema.prefault({}),
});
export const careerSchema = careerStateSchema.transform((career, ctx) => {
  const names = new Set<string>();
  const ids = new Set<string>();
  const removed: string[] = [];
  for (const [key, coach] of Object.entries(career.assistantCoaches)) {
    const legacy = coach.area === undefined;
    const area = coach.area ?? assistantAreas.find((item) => item === key);
    if (!area) {
      ctx.addIssue({ code: 'custom', message: 'Auxiliar sem setor válido.' });
      continue;
    }
    if (names.has(coach.name) || (coach.id && ids.has(coach.id))) {
      if (!legacy)
        ctx.addIssue({
          code: 'custom',
          message: 'Um auxiliar não pode ocupar mais de um cargo.',
        });
      else {
        delete career.assistantCoaches[key];
        removed.push(coach.name);
      }
      continue;
    }
    names.add(coach.name);
    if (coach.id) ids.add(coach.id);
    coach.area = area;
  }
  if (removed.length)
    career.messages.unshift({
      id: `assistant-migration-${career.id}`,
      date: career.date,
      from: 'Comissão técnica',
      title: 'Cargos dos auxiliares regularizados',
      body: `As atribuições duplicadas de ${[...new Set(removed)].join(', ')} foram removidas. Cada profissional permanece em um único setor, e os salários duplicados deixam de ser cobrados.`,
      kind: 'staff',
      important: false,
      read: false,
      resolved: true,
    });
  return career;
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
