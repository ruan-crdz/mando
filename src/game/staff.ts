import { hash } from './random';
import type { Career } from './types';

/** Comissão técnica contratável (o analista e os olheiros já existem à parte). */
export const staffRoles = ['fitness', 'medical', 'goalkeeping', 'director', 'youth'] as const;
export type StaffRole = (typeof staffRoles)[number];

export const staffTitles: Record<StaffRole, string> = {
  fitness: 'Preparador físico',
  medical: 'Departamento médico',
  goalkeeping: 'Treinador de goleiros',
  director: 'Diretor de futebol',
  youth: 'Coordenador da base',
};

/** Nível atual (saves antigos começam no 2). */
export const staffLevel = (c: Career, role: StaffRole) => c.living?.staff?.[role] ?? 2;

/** Pagamento único para trazer um profissional do nível indicado. */
export const staffHireCost = (level: number) => 250000 * level;
/** Salário mensal, debitado no fechamento do mês. */
export const staffWage = (level: number) => 15000 * level;

export const assistantPayroll = (c: Career) =>
  Object.values(c.assistantCoaches).reduce(
    (total, assistant) => total + assistant.wageWeekly * (52 / 12),
    0,
  );

export function playerSalaryCommitment(c: Career) {
  const academy = new Set(c.living.academyRoster.map((player) => player.id));
  let total = 0;
  for (const [id, state] of Object.entries(c.players)) {
    if (academy.has(id)) continue;
    if (state.clubId === c.clubId)
      total += state.loanFrom && state.loan ? (state.wage * state.loan.wagePct) / 100 : state.wage;
    else if (state.loanFrom === c.clubId && state.loan) total += state.wage;
  }
  for (const contract of c.preContracts)
    if (
      contract.clubId === c.clubId &&
      !contract.joined &&
      c.players[contract.playerId]?.clubId !== c.clubId
    )
      total += contract.wage;
  return Math.ceil(total);
}

export function salaryBudgets(c: Career) {
  const finance = c.finances[c.clubId];
  const committed = playerSalaryCommitment(c);
  const assistants = finance.assistantWageBudget ?? Math.ceil(assistantPayroll(c));
  const players =
    finance.playerWageBudget ?? Math.max(committed, Math.ceil(committed * 1.25) - assistants);
  return { players, assistants, committed, available: Math.max(0, players - committed) };
}

export function setAssistantSalaryBudget(career: Career, monthly: number): Career {
  if (!Number.isInteger(monthly) || monthly < 0)
    throw new Error('Informe um orçamento mensal válido para os auxiliares.');
  const budget = salaryBudgets(career);
  if (monthly < Math.ceil(assistantPayroll(career)))
    throw new Error('O orçamento não pode ficar abaixo dos salários dos auxiliares contratados.');
  const players = budget.players + budget.assistants - monthly;
  if (players < budget.committed)
    throw new Error(
      'Essa redistribuição não deixa orçamento suficiente para os salários dos jogadores.',
    );
  return {
    ...career,
    finances: {
      ...career.finances,
      [career.clubId]: {
        ...career.finances[career.clubId],
        playerWageBudget: players,
        assistantWageBudget: monthly,
      },
    },
  };
}

export function checkPlayerSalaryBudget(c: Career, increase: number, arrivingPlayerId?: string) {
  if (c.finances[c.clubId].playerWageBudget === undefined) return;
  const budget = salaryBudgets(c);
  const reserved = arrivingPlayerId
    ? (c.preContracts.find(
        (contract) =>
          contract.playerId === arrivingPlayerId &&
          contract.clubId === c.clubId &&
          !contract.joined,
      )?.wage ?? 0)
    : 0;
  if (increase <= reserved) return;
  if (budget.committed + increase - reserved > budget.players)
    throw new Error(
      'Orçamento salarial dos jogadores insuficiente. Redistribua o orçamento da comissão ou reduza a folha.',
    );
}

export const staffPayroll = (c: Career) =>
  staffRoles.reduce((n, role) => n + staffWage(staffLevel(c, role)), 0) + assistantPayroll(c);

export const fitnessEffect = (level: number) => ({
  /** Desgaste a menos em campo. */
  energy: 0.04 * (level - 1),
  /** Chance a menos de lesão por esforço em jogo. */
  injury: 0.05 * (level - 1),
  /** Condição extra recuperada por dia. */
  recovery: 0.25 * (level - 1),
});

export const medicalEffect = (level: number) => ({
  /** Dias a menos em cada lesão. */
  days: 0.06 * (level - 1),
  /** Chance de recaída ao voltar de lesão. */
  relapse: 0.12 - 0.025 * (level - 1),
});

export const goalkeepingEffect = (level: number) => ({
  /** Evolução extra dos goleiros. */
  growth: 0.12 * (level - 1),
  /** Gols a menos sofridos nas finalizações (defesas do goleiro). */
  save: 0.015 * (level - 1),
});

export const directorEffect = (level: number) => ({
  /** Rodadas a mais de paciência do clube vendedor e do agente. */
  patience: level >= 5 ? 2 : level >= 4 ? 1 : 0,
  /** Quanto o vendedor cede na contraproposta (0,35 = padrão). */
  concession: 0.3 + 0.025 * level,
  /** Alvos sugeridos no relatório mensal. */
  targets: level >= 4 ? 3 : level >= 2 ? 2 : 1,
});

export const youthCoachEffect = (level: number) => ({
  /** Potencial extra de cada jovem revelado. */
  potential: level - 1,
  /** Jovens a mais revelados por temporada. */
  extra: level >= 5 ? 2 : level >= 3 ? 1 : 0,
});

const pct = (v: number) => `${Math.round(v * 1000) / 10}`.replace('.', ',') + '%';

/** Efeito do nível em números, para a tela. */
export function staffEffectText(role: StaffRole, level: number): string[] {
  if (role === 'fitness') {
    const e = fitnessEffect(level);
    return [
      `−${pct(e.energy)} de desgaste em jogo`,
      `−${pct(e.injury)} de chance de lesão por esforço`,
      `+${e.recovery.toFixed(2).replace('.', ',')} de condição por dia`,
    ];
  }
  if (role === 'medical') {
    const e = medicalEffect(level);
    return [`−${pct(e.days)} no tempo de cada lesão`, `${pct(e.relapse)} de risco de recaída`];
  }
  if (role === 'goalkeeping') {
    const e = goalkeepingEffect(level);
    return [
      `+${pct(e.growth)} de evolução dos goleiros`,
      `−${pct(e.save)} de gols sofridos por finalização`,
    ];
  }
  if (role === 'director') {
    const e = directorEffect(level);
    return [
      `+${e.patience} de paciência nas negociações`,
      `Vendedor cede ${pct(e.concession)} da diferença na contraproposta`,
      `${e.targets} alvo${e.targets > 1 ? 's' : ''} sugerido${e.targets > 1 ? 's' : ''} por mês`,
    ];
  }
  const e = youthCoachEffect(level);
  return [
    `+${e.potential} de potencial por jovem revelado`,
    `+${e.extra} ${e.extra === 1 ? 'jovem revelado' : 'jovens revelados'} por temporada`,
  ];
}

const first = [
  'Álvaro',
  'Rogério',
  'Wagner',
  'Márcio',
  'Leandro',
  'Fábio',
  'Celso',
  'Otávio',
  'Valdir',
  'Rubens',
  'Nélson',
  'Ademir',
  'Gilmar',
  'Ivan',
  'Denise',
  'Patrícia',
  'Luciana',
  'Simone',
];
const last = [
  'Albuquerque',
  'Barreto',
  'Coutinho',
  'Damasceno',
  'Esteves',
  'Falcão',
  'Guimarães',
  'Holanda',
  'Ibiapina',
  'Junqueira',
  'Leme',
  'Macedo',
  'Nogueira',
  'Queiroz',
  'Tavares',
];

/** Nome fictício e estável do profissional contratado em cada nível. */
export function staffName(c: Career, role: StaffRole, level = staffLevel(c, role)) {
  const h = hash(`${c.id}:${c.clubId}:${role}:${level}`);
  return `${first[h % first.length]} ${last[Math.floor(h / first.length) % last.length]}`;
}

/** Troca o profissional por outro do nível escolhido. Subir custa o pagamento único; descer é grátis. */
export function hireStaff(career: Career, role: StaffRole, level: number): Career {
  if (!staffRoles.includes(role)) throw new Error('Cargo desconhecido.');
  if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error('Nível inválido.');
  const current = staffLevel(career, role);
  if (level === current) throw new Error('Esse profissional já está no cargo.');
  const c = structuredClone(career);
  if (level > current) {
    const cost = staffHireCost(level);
    const f = c.finances[c.clubId];
    if (f.cash < cost)
      throw new Error(`Caixa insuficiente para contratar o ${staffTitles[role].toLowerCase()}.`);
    f.cash -= cost;
    f.history.push({ date: c.date, income: 0, expenses: cost, balance: f.cash });
  }
  c.living.staff = { ...c.living.staff, [role]: level };
  return c;
}
