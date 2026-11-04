import { ageAt, hash } from './random';
import { notify } from './chronicle';
import { squad } from './matches';
import { clubById, findPlayer, knownClub } from './npc';
import { type Career, type Living, type World } from './types';

/** Empresários fictícios: os primeiros da lista são os mais influentes. */
const agents = [
  'Valdir Montenegro',
  'Cássio Albuquerque',
  'Rogério Tavolaro',
  'Denise Furtado',
  'Edson Lacerda',
  'Márcia Quintela',
  'Ivan Borba',
  'Raul Peixoto',
  'Otávio Simas',
  'Leandro Cunha',
  'Célio Barreto',
  'Fábio Arantes',
  'Juliana Prates',
  'Nestor Viana',
  'Humberto Salles',
  'Gilmar Toledo',
  'Patrícia Aires',
  'Sandro Mattos',
  'Wellington Brito',
  'Lauro Fontes',
] as const;

export type Agent = { index: number; name: string; influence: number; commission: number };

export const agentInfluence = (index: number) => 5 - Math.floor(index / 4);

/** Empresário do atleta (determinístico), com influência 1–5 e comissão de 5–10%. */
export function agentOf(playerId: string): Agent {
  const index = hash(`${playerId}:empresario`) % agents.length;
  return {
    index,
    name: agents[index],
    influence: agentInfluence(index),
    commission: 5 + (hash(`${playerId}:comissao`) % 6),
  };
}

export const agentName = (index: number) => agents[index];
export const agentCount = agents.length;

const isYouth = (c: Career, id: string) =>
  c.youth.some((p) => p.id === id) || c.prospects.some((p) => p.id === id);

/** Clube formador: base do clube que revelou o atleta. */
export function formingClub(c: Career, world: World, playerId: string): string | undefined {
  const player = findPlayer(world, playerId);
  if (!player || playerId.startsWith('npc-')) return undefined;
  if (isYouth(c, playerId)) return knownClub(world, player.clubId) ? player.clubId : undefined;
  if (ageAt(player.birthDate, '2026-01-01') <= 21 || hash(`${playerId}:formador`) % 100 < 35)
    return player.clubId;
  const clubs = world.clubs;
  return clubs[hash(`${playerId}:formador:clube`) % clubs.length].id;
}

/** % dos direitos econômicos pertencentes ao clube atual. */
export function clubRights(c: Career, playerId: string): number {
  const s = c.players[playerId];
  if (s?.rights !== undefined) return s.rights;
  if (isYouth(c, playerId) || playerId.startsWith('npc-')) return 100;
  if (hash(`${playerId}:direitos`) % 100 < 70) return 100;
  return 50 + (hash(`${playerId}:fatia`) % 9) * 5;
}

/** Dono do restante dos direitos (clube, investidor ou empresário). */
export function rightsPartner(c: Career, world: World, playerId: string): string | undefined {
  if (clubRights(c, playerId) >= 100) return undefined;
  const s = c.players[playerId];
  if (s?.rightsPartners && Object.keys(s.rightsPartners).length)
    return Object.keys(s.rightsPartners)[0];
  if (s?.partner) return s.partner;
  const roll = hash(`${playerId}:parceiro`) % 3;
  const former = formingClub(c, world, playerId);
  if (roll === 2 && former && former !== s?.clubId) return former;
  return roll === 1 ? 'empresario' : 'investidor';
}

export function rightsPartners(c: Career, world: World, playerId: string) {
  const state = c.players[playerId];
  if (clubRights(c, playerId) >= 100) return [];
  if (state?.rightsPartners && Object.keys(state.rightsPartners).length)
    return Object.entries(state.rightsPartners).map(([id, pct]) => ({ id, pct }));
  const partner = rightsPartner(c, world, playerId);
  return partner ? [{ id: partner, pct: 100 - clubRights(c, playerId) }] : [];
}

/** Nome de uma parte da transação (clube, fundo ou empresário). */
export function partyName(world: World, id: string, playerId?: string) {
  if (id === 'investidor') return 'Fundo investidor';
  if (id === 'empresario') return playerId ? `${agentOf(playerId).name} (empresário)` : 'Empresário';
  return knownClub(world, id) ? clubById(world, id).name : id;
}

const money = (n: number) =>
  n >= 1e6 ? `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} mi` : `R$ ${Math.round(n / 1000)} mil`;

export function addLedger(c: Career, entry: Omit<Living['ledger'][number], 'date'>) {
  if (entry.amount <= 0) return;
  c.living.ledger.push({ date: c.date, ...entry });
  if (c.living.ledger.length > 80) c.living.ledger.splice(0, c.living.ledger.length - 80);
}

function credit(c: Career, clubId: string, amount: number, budgetShare = 0) {
  const f = c.finances[clubId];
  if (!f || amount <= 0) return;
  f.cash += amount;
  if (budgetShare) f.transferBudget += Math.round(amount * budgetShare);
  f.history.push({ date: c.date, income: amount, expenses: 0, balance: f.cash });
}

/**
 * Distribui o valor de uma venda: 5% de solidariedade ao formador, a fatia do parceiro
 * dos direitos, os sell-ons pendentes e o líquido do vendedor. Atualiza os direitos do
 * comprador (o vendedor mantém o restante) e registra o novo sell-on.
 */
export function settleFee(
  c: Career,
  world: World,
  deal: {
    playerId: string;
    from: string;
    to: string;
    fee: number;
    rights?: number;
    sellOn?: number;
    budgetShare?: number;
  },
) {
  const { playerId, from, to, fee } = deal;
  const s = c.players[playerId];
  const bought = Math.max(0, Math.min(100, deal.rights ?? 100));
  if (!s) return { net: fee, solidarity: 0, partner: 0, sellOn: 0 };
  const player = findPlayer(world, playerId);
  const userSells = from === c.clubId;
  let solidarity = 0;
  let partnerAmount = 0;
  let sellOnTotal = 0;
  let net = 0;
  const holders = [
    { id: from, pct: clubRights(c, playerId) },
    ...rightsPartners(c, world, playerId),
  ];
  if (fee > 0) {
    const former = formingClub(c, world, playerId);
    if (former && former !== from && former !== to) {
      solidarity = Math.round(fee * 0.05);
      credit(c, former, solidarity);
      if (former === c.clubId) {
        addLedger(c, { playerId, kind: 'solidariedade', from, to: former, amount: solidarity });
        notify(c, {
          kind: 'finance',
          from: 'FIFA · Clearing House',
          title: `Solidariedade: ${player?.name ?? 'ex-atleta da base'}`,
          body: `${player?.name} foi negociado pelo ${partyName(world, from)} ao ${partyName(world, to)} por ${money(fee)}. Como clube formador, recebemos ${money(solidarity)} (5% do mecanismo de solidariedade).`,
          playerId,
          resolved: true,
        });
      } else if (userSells)
        addLedger(c, { playerId, kind: 'solidariedade', from, to: former, amount: solidarity });
    }
    const pool = fee - solidarity;
    const gross = Math.round(pool * (holders[0].pct / 100));
    let remainingPartnerAmount = pool - gross;
    for (const [index, partner] of holders.slice(1).entries()) {
      const amount =
        index === holders.length - 2
          ? remainingPartnerAmount
          : Math.min(remainingPartnerAmount, Math.round(pool * (partner.pct / 100)));
      remainingPartnerAmount -= amount;
      partnerAmount += amount;
      credit(c, partner.id, amount);
      if (partner.id === c.clubId) {
        addLedger(c, { playerId, kind: 'direitos', from, to: partner.id, amount });
        notify(c, {
          kind: 'finance',
          from: 'Departamento financeiro',
          title: `Direitos de ${player?.name ?? 'ex-atleta'}`,
          body: `Ainda tínhamos ${partner.pct}% dos direitos econômicos de ${player?.name}, vendido pelo ${partyName(world, from)} por ${money(fee)}. Recebemos ${money(amount)}.`,
          playerId,
          resolved: true,
        });
      } else if (userSells)
        addLedger(c, { playerId, kind: 'direitos', from, to: partner.id, amount });
    }
    for (const claim of c.living.sellOns.filter((x) => x.playerId === playerId)) {
      if (claim.clubId === from || claim.clubId === to) continue;
      const amount = Math.round((gross * claim.pct) / 100);
      sellOnTotal += amount;
      credit(c, claim.clubId, amount);
      if (claim.clubId === c.clubId || userSells) {
        addLedger(c, { playerId, kind: 'sellon', from, to: claim.clubId, amount });
        if (claim.clubId === c.clubId)
          notify(c, {
            kind: 'finance',
            from: 'Departamento financeiro',
            title: `Sell-on de ${player?.name ?? 'ex-atleta'}`,
            body: `${player?.name} foi revendido pelo ${partyName(world, from)} ao ${partyName(world, to)} por ${money(fee)}. Nossa cláusula de ${claim.pct}% sobre futura venda rendeu ${money(amount)}.`,
            playerId,
            resolved: true,
          });
      }
    }
    c.living.sellOns = c.living.sellOns.filter((x) => x.playerId !== playerId);
    net = Math.max(0, gross - sellOnTotal);
    credit(c, from, net, deal.budgetShare ?? 0);
    if (userSells && (solidarity || partnerAmount || sellOnTotal))
      notify(c, {
        kind: 'finance',
        from: 'Departamento financeiro',
        title: `Repasses da venda de ${player?.name ?? 'atleta'}`,
        body: `Venda por ${money(fee)}.${solidarity ? ` Solidariedade ao formador (${partyName(world, formingClub(c, world, playerId)!)}): ${money(solidarity)}.` : ''}${partnerAmount ? ` Demais titulares dos direitos: ${money(partnerAmount)}.` : ''}${sellOnTotal ? ` Sell-on a clubes credores: ${money(sellOnTotal)}.` : ''} Líquido do clube: ${money(net)}.`,
        playerId,
        resolved: true,
      });
  } else c.living.sellOns = c.living.sellOns.filter((x) => x.playerId !== playerId || x.clubId !== to);
  const retained = new Map<string, number>();
  const remainderPoints = Math.round((100 - bought) * 100);
  let assigned = 0;
  holders.forEach((holder, index) => {
    const points =
      index === holders.length - 1
        ? remainderPoints - assigned
        : Math.min(remainderPoints - assigned, Math.round(holder.pct * (100 - bought)));
    assigned += points;
    retained.set(holder.id, (retained.get(holder.id) ?? 0) + points);
  });
  s.rights = (Math.round(bought * 100) + (retained.get(to) ?? 0)) / 100;
  retained.delete(to);
  const partners = Object.fromEntries(
    [...retained.entries()].filter(([, points]) => points > 0).map(([id, points]) => [id, points / 100]),
  );
  if (Object.keys(partners).length) s.rightsPartners = partners;
  else delete s.rightsPartners;
  delete s.partner;
  if (deal.sellOn && deal.sellOn > 0 && fee > 0)
    c.living.sellOns.push({ playerId, clubId: from, pct: deal.sellOn, since: c.date });
  return { net, solidarity, partner: partnerAmount, sellOn: sellOnTotal };
}

/** Folha mensal do clube, considerando a divisão salarial dos empréstimos. */
export function payroll(c: Career, world: World, clubId: string) {
  let total = 0;
  for (const p of squad(c, world, clubId)) {
    const s = c.players[p.id];
    total += s.loanFrom && s.loan ? (s.wage * s.loan.wagePct) / 100 : s.wage;
  }
  for (const s of Object.values(c.players))
    if (s.loanFrom === clubId && s.clubId !== clubId && s.loan)
      total += (s.wage * (100 - s.loan.wagePct)) / 100;
  return Math.round(total);
}
