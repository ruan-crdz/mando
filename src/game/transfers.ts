import { addDays, addMonths, ageAt, clamp, hash, random } from './random';
import { overall } from './ratings';
import { reconcileSquad, squad } from './matches';
import { transferWindow } from './calendar';
import { type Career, type Offer, type Player, type World } from './types';

export function marketValue(career: Career, player: Player) {
  const state = career.players[player.id];
  const age = ageAt(player.birthDate, career.date);
  return Math.round(
    player.value * (1 + state.growth * 0.04) * (age < 23 ? 1.1 : age > 32 ? 0.8 : 1),
  );
}

export function askingPrice(career: Career, world: World, player: Player, buyerId = career.clubId) {
  const state = career.players[player.id];
  const seller = world.clubs.find((c) => c.id === state.clubId);
  const buyer = world.clubs.find((c) => c.id === buyerId)!;
  const years = Math.max(
    0,
    (Date.parse(state.contractEnd) - Date.parse(career.date)) / (365 * 86400000),
  );
  const factor =
    1.08 +
    Math.min(4, years) * 0.1 +
    ((seller?.reputation || 50) - buyer.reputation) * 0.003 +
    (state.morale - 50) * 0.001;
  return Math.round(marketValue(career, player) * clamp(factor, 0.8, 1.9));
}

function checkOutgoing(c: Career, world: World, playerId: string, clubId: string) {
  const players = squad(c, world, clubId);
  const p = world.players.find((p) => p.id === playerId)!;
  if (
    players.length <= 18 ||
    (p.position === 'GK' && players.filter((p) => p.position === 'GK').length <= 2)
  )
    throw new Error('A transferência deixaria o clube com menos de 18 atletas ou dois goleiros.');
}

const difficultyFactor = (c: Career) =>
  c.difficulty === 'Iniciante' ? 0.9 : c.difficulty === 'Profissional' ? 1.08 : 1;

export function requiredWage(c: Career, player: Player) {
  return c.players[player.id].wage * (c.difficulty === 'Profissional' ? 1.15 : 1.05);
}

/** Salário mensal equivalente, diluindo as luvas pelos meses de contrato. */
export const effectiveWage = (wage: number, bonus = 0, years = 3) => wage + bonus / (12 * years);

/**
 * Leitura do diretor sobre a chance de cada lado aceitar (0–100). No modo Profissional
 * o mínimo do clube é estimado com erro, como uma informação de bastidor.
 */
export function negotiationOutlook(
  c: Career,
  world: World,
  player: Player,
  fee: number,
  wage: number,
  exchangePlayerId?: string,
  years = 3,
  bonus = 0,
) {
  const exact = askingPrice(c, world, player) * difficultyFactor(c);
  const noise = c.difficulty === 'Profissional' ? ((hash(`${player.id}:${c.season}`) % 15) - 7) / 100 : 0;
  const minimum = exact * (1 + noise);
  const exchange = exchangePlayerId && world.players.find((p) => p.id === exchangePlayerId);
  const amount = fee + (exchange ? marketValue(c, exchange) * 0.8 : 0);
  const club = Math.round(clamp(((amount / Math.max(1, minimum) - 0.7) / 0.3) * 100));
  const ratio = effectiveWage(wage, bonus, years) / Math.max(1, requiredWage(c, player));
  const athlete = Math.round(clamp(((ratio - 0.8) / 0.2) * 100));
  return { club, player: athlete, minimum: Math.round(minimum), amount };
}

export function createOffer(
  career: Career,
  world: World,
  playerId: string,
  fee: number,
  wage: number,
  exchangePlayerId?: string,
  terms: { years?: number; bonus?: number } = {},
): Career {
  const c = structuredClone(career);
  if (!transferWindow(c.date)) throw new Error('A janela de transferências está fechada.');
  if (!Number.isFinite(fee) || fee < 0 || !Number.isFinite(wage) || wage <= 0)
    throw new Error('Informe valores válidos.');
  const player = world.players.find((p) => p.id === playerId);
  const sellerId = c.players[playerId]?.clubId;
  if (!player || !sellerId || sellerId === c.clubId)
    throw new Error('Jogador indisponível para esta proposta.');
  if (c.challenge === 'Venda necessária' && c.sales < 10000000)
    throw new Error('Venda R$ 10 milhões em atletas antes de contratar.');
  if (c.challenge === 'Só a base' && ageAt(player.birthDate, c.date) > 23)
    throw new Error('Este desafio permite contratar apenas jogadores de até 23 anos.');
  const bonus = Math.max(0, Math.round(terms.bonus || 0));
  const years = clamp(Math.round(terms.years || 3), 1, 5);
  if (fee > c.finances[c.clubId].transferBudget || fee + bonus > c.finances[c.clubId].cash)
    throw new Error('Proposta acima do orçamento disponível.');
  if (c.offers.some((o) => o.playerId === playerId && o.status === 'pending'))
    throw new Error('Já existe uma negociação pendente por este atleta.');
  checkOutgoing(c, world, playerId, sellerId);
  if (exchangePlayerId) {
    if (c.players[exchangePlayerId]?.clubId !== c.clubId)
      throw new Error('O atleta de troca não pertence ao seu clube.');
    checkOutgoing(c, world, exchangePlayerId, c.clubId);
  }
  const minimum = askingPrice(c, world, player) * difficultyFactor(c);
  c.offers.push({
    id: `offer-${hash(`${c.seed}-${c.date}-${playerId}-${c.offers.length}`)}`,
    playerId,
    fromClubId: c.clubId,
    toClubId: sellerId,
    fee,
    wage,
    exchangePlayerId,
    years,
    ...(bonus ? { bonus } : {}),
    date: c.date,
    responseDate: addDays(c.date, 2),
    status: 'pending',
    incoming: false,
    minimum,
  });
  return c;
}

export function completeTransfer(c: Career, world: World, offer: Offer) {
  if (!transferWindow(c.date)) throw new Error('Transferência fora da janela.');
  const buyer = c.finances[offer.fromClubId];
  const seller = c.finances[offer.toClubId];
  if (c.players[offer.playerId].clubId !== offer.toClubId)
    throw new Error('O atleta já mudou de clube.');
  const bonus = offer.bonus || 0;
  if (buyer.cash < offer.fee + bonus || buyer.transferBudget < offer.fee)
    throw new Error('O comprador não tem mais orçamento suficiente.');
  checkOutgoing(c, world, offer.playerId, offer.toClubId);
  if (offer.exchangePlayerId) {
    if (c.players[offer.exchangePlayerId].clubId !== offer.fromClubId)
      throw new Error('Atleta de troca indisponível.');
    checkOutgoing(c, world, offer.exchangePlayerId, offer.fromClubId);
  }
  const outgoingIds = new Set(
    [offer.playerId, offer.exchangePlayerId].filter((id): id is string => Boolean(id)),
  );
  if (c.lineup.some((id) => outgoingIds.has(id))) {
    const remaining = squad(c, world).filter(
      (p) =>
        !outgoingIds.has(p.id) &&
        c.players[p.id].injuryDays === 0 &&
        c.players[p.id].suspension === 0 &&
        c.players[p.id].fitness >= 30,
    );
    if (remaining.length < 11)
      throw new Error('A operação deixaria o clube sem onze atletas disponíveis.');
  }
  if (offer.exchangePlayerId) c.players[offer.exchangePlayerId].clubId = offer.toClubId;
  buyer.cash -= offer.fee + bonus;
  buyer.transferBudget -= offer.fee;
  seller.cash += offer.fee;
  seller.transferBudget += Math.round(offer.fee * 0.75);
  buyer.history.push({
    date: c.date,
    income: 0,
    expenses: offer.fee + bonus,
    balance: buyer.cash,
  });
  seller.history.push({ date: c.date, income: offer.fee, expenses: 0, balance: seller.cash });
  const p = c.players[offer.playerId];
  p.clubId = offer.fromClubId;
  p.wage = offer.wage;
  p.contractEnd = `${Number(c.date.slice(0, 4)) + (offer.years || 3)}-12-31`;
  p.morale = clamp(p.morale + 8);
  offer.status = 'completed';
  if (offer.toClubId === c.clubId) c.sales += offer.fee;
  reconcileSquad(c, world);
}

export function answerIncoming(
  career: Career,
  world: World,
  offerId: string,
  accept: boolean,
): Career {
  const c = structuredClone(career);
  const offer = c.offers.find((o) => o.id === offerId);
  if (!offer || !offer.incoming || offer.status !== 'pending')
    throw new Error('Proposta não está disponível.');
  if (accept) completeTransfer(c, world, offer);
  else offer.status = 'declined';
  return c;
}

export function processOffers(c: Career, world: World) {
  for (const offer of c.offers.filter(
    (o) => !o.incoming && o.status === 'pending' && o.responseDate <= c.date,
  )) {
    const player = world.players.find((p) => p.id === offer.playerId)!;
    const exchange =
      offer.exchangePlayerId && world.players.find((p) => p.id === offer.exchangePlayerId);
    const amount = offer.fee + (exchange ? marketValue(c, exchange) * 0.8 : 0);
    const clubOk = amount >= offer.minimum;
    const playerOk =
      effectiveWage(offer.wage, offer.bonus, offer.years) >= requiredWage(c, player);
    const accepted = clubOk && playerOk && transferWindow(c.date);
    offer.status = accepted ? 'accepted' : 'rejected';
    let body = accepted
      ? 'A proposta atende às exigências. Transferência concluída.'
      : !clubOk
        ? 'O clube considerou o valor baixo. Melhore a oferta ou inclua um atleta na troca.'
        : 'Os clubes chegaram a um acordo, mas o atleta recusou o contrato. Aumente salário ou luvas.';
    if (accepted) {
      // Revalida recursos porque outras propostas podem ter sido concluídas no mesmo dia.
      try {
        completeTransfer(c, world, offer);
      } catch (error) {
        offer.status = 'rejected';
        body = `A transferência não pôde ser concluída: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    c.messages.unshift({
      id: `${offer.id}-reply`,
      date: c.date,
      from: world.clubs.find((club) => club.id === offer.toClubId)!.name,
      kind: 'market',
      title: `Resposta por ${player.name}`,
      body,
      important: true,
      read: false,
      resolved: false,
    });
  }
  if (!transferWindow(c.date)) {
    for (const offer of c.offers.filter((o) => o.status === 'pending')) offer.status = 'declined';
    return;
  }
  const rng = random(hash(`${c.seed}:${c.date}:market`));
  if (rng() > 0.045) return;
  const own = squad(c, world).filter(
    (p) => !c.offers.some((o) => o.playerId === p.id && o.status === 'pending'),
  );
  const player = own[Math.floor(rng() * own.length)];
  const buyers = world.clubs.filter((club) => club.id !== c.clubId);
  const buyer = buyers[Math.floor(rng() * buyers.length)];
  if (!player || !buyer) return;
  const fee = Math.round(marketValue(c, player) * (1 + rng() * 0.6));
  if (fee > c.finances[buyer.id].transferBudget) return;
  const id = `incoming-${hash(`${c.date}:${player.id}`)}`;
  c.offers.push({
    id,
    playerId: player.id,
    fromClubId: buyer.id,
    toClubId: c.clubId,
    fee,
    wage: Math.round(c.players[player.id].wage * 1.15),
    date: c.date,
    responseDate: addDays(c.date, 7),
    incoming: true,
    status: 'pending',
    minimum: askingPrice(c, world, player, buyer.id),
  });
  c.messages.unshift({
    id,
    date: c.date,
    kind: 'market',
    from: buyer.name,
    title: `Proposta por ${player.name}`,
    body: `${buyer.name} enviou uma proposta. Consulte o mensageiro de transferências para decidir.`,
    important: true,
    resolved: false,
    read: false,
    playerId: player.id,
  });
}

export const renewalOptions = [6, 12, 24, 36, 48, 60] as const;

/** Novo salário, luvas e término para estender o contrato por `months` meses. */
export function renewalTerms(c: Career, playerId: string, months = 36) {
  const p = c.players[playerId];
  const increase = (c.difficulty === 'Profissional' ? 1.18 : 1.1) - (months < 12 ? 0.05 : 0);
  const wage = Math.round(p.wage * increase);
  const bonus = Math.round(wage * Math.max(0.5, (2 * months) / 36));
  const start = p.contractEnd > c.date ? p.contractEnd : c.date;
  return { wage, bonus, contractEnd: addMonths(start, months) };
}

export function renewContract(
  career: Career,
  world: World,
  playerId: string,
  months = 36,
): Career {
  const c = structuredClone(career);
  const p = c.players[playerId];
  if (!p || p.clubId !== c.clubId) throw new Error('Contrato indisponível.');
  if (!Number.isInteger(months) || months < 6 || months > 60)
    throw new Error('Escolha uma renovação entre 6 meses e 5 anos.');
  const player = world.players.find((p) => p.id === playerId)!;
  const { wage, bonus, contractEnd } = renewalTerms(c, playerId, months);
  if (c.finances[c.clubId].cash < bonus)
    throw new Error('Saldo insuficiente para as luvas de renovação.');
  c.finances[c.clubId].cash -= bonus;
  c.finances[c.clubId].history.push({
    date: c.date,
    income: 0,
    expenses: bonus,
    balance: c.finances[c.clubId].cash,
  });
  p.wage = wage;
  p.contractEnd = contractEnd;
  p.morale = clamp(p.morale + 5);
  c.memories.push({
    playerId,
    date: c.date,
    text: `Contrato de ${player.name} renovado pelo manager.`,
  });
  return c;
}

export function scoutReport(c: Career, player: Player) {
  const s = c.players[player.id];
  const ovr = overall(player, player.position, s);
  return c.difficulty === 'Profissional'
    ? `OVR estimado ${Math.max(1, ovr - 4)}–${Math.min(99, ovr + 4)} · potencial ${player.potential - player.uncertainty}–${Math.min(99, player.potential + player.uncertainty)}`
    : `OVR ${ovr} · potencial ${player.potential - player.uncertainty}–${Math.min(99, player.potential + player.uncertainty)}`;
}
