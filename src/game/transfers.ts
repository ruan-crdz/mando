import { addDays, addMonths, ageAt, clamp, hash, random } from './random';
import { overall } from './ratings';
import { reconcileSquad, squad } from './matches';
import { transferWindow } from './calendar';
import { type Career, type NegotiationMessage, type Offer, type Player, type World } from './types';

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
  ask?: number,
) {
  const exact = Math.min(askingPrice(c, world, player) * difficultyFactor(c), ask ?? Infinity);
  const noise =
    c.difficulty === 'Profissional' ? ((hash(`${player.id}:${c.season}`) % 15) - 7) / 100 : 0;
  const minimum = exact * (1 + noise);
  const exchange = exchangePlayerId && world.players.find((p) => p.id === exchangePlayerId);
  const amount = fee + (exchange ? marketValue(c, exchange) * 0.8 : 0);
  const club = Math.round(clamp(((amount / Math.max(1, minimum) - 0.7) / 0.3) * 100));
  const ratio = effectiveWage(wage, bonus, years) / Math.max(1, requiredWage(c, player));
  const athlete = Math.round(clamp(((ratio - 0.8) / 0.2) * 100));
  return { club, player: athlete, minimum: Math.round(minimum), amount };
}

const roundUp = (value: number, step: number) => Math.ceil(value / step) * step;
const startPatience = (c: Career) =>
  c.difficulty === 'Iniciante' ? 5 : c.difficulty === 'Profissional' ? 3 : 4;
const exchangeValue = (c: Career, world: World, id?: string) => {
  const p = id && world.players.find((p) => p.id === id);
  return p ? marketValue(c, p) * 0.8 : 0;
};
const pick = (seed: string, lines: string[]) => lines[hash(seed) % lines.length];
const clubName = (world: World, id: string) => world.clubs.find((c) => c.id === id)?.name || id;

/** Histórico da conversa; saves antigos sem mensagens recebem a proposta original. */
export function threadOf(offer: Offer): NegotiationMessage[] {
  if (offer.messages) return offer.messages;
  return [
    {
      date: offer.date,
      from: offer.incoming ? 'club' : 'me',
      kind: 'offer',
      fee: offer.fee,
      wage: offer.wage,
      years: offer.years,
      bonus: offer.bonus,
      exchangePlayerId: offer.exchangePlayerId,
      text: offer.incoming
        ? 'Temos interesse no atleta. Segue nossa proposta oficial.'
        : 'Segue nossa proposta oficial.',
    },
  ];
}

function say(offer: Offer, message: NegotiationMessage) {
  offer.messages = [...threadOf(offer), message];
}

/** Conversa mais recente com o clube dono do atleta (uma única thread por alvo). */
export function activeThread(c: Career, playerId: string) {
  const sellerId = c.players[playerId]?.clubId;
  return [...c.offers]
    .reverse()
    .find(
      (o) =>
        !o.incoming &&
        o.playerId === playerId &&
        o.toClubId === sellerId &&
        o.status !== 'completed',
    );
}

function notify(c: Career, world: World, offer: Offer) {
  const thread = threadOf(offer);
  const last = thread[thread.length - 1];
  const player = world.players.find((p) => p.id === offer.playerId)!;
  c.messages.unshift({
    id: `${offer.id}-${threadOf(offer).length}`,
    date: c.date,
    from:
      last.from === 'agent'
        ? `Agente de ${player.name}`
        : clubName(world, offer.incoming ? offer.fromClubId : offer.toClubId),
    kind: 'market',
    title: `Negociação por ${player.name}`,
    body: last.text,
    important: false,
    read: false,
    resolved: false,
    playerId: player.id,
  });
}

function checkBudget(c: Career, fee: number, bonus: number) {
  const f = c.finances[c.clubId];
  if (fee > f.transferBudget || fee + bonus > f.cash)
    throw new Error('Proposta acima do orçamento disponível.');
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
  const existing = activeThread(c, playerId);
  if (existing?.status === 'pending')
    throw new Error('Esta proposta já está com o outro lado. Aguarde a resposta.');
  if (existing?.lockedUntil && existing.lockedUntil > c.date)
    throw new Error(
      `${clubName(world, sellerId)} encerrou as conversas por ${player.name} até ${existing.lockedUntil.split('-').reverse().slice(0, 2).join('/')}.`,
    );
  const contractStage =
    existing?.stage === 'player' &&
    (existing.status === 'countered' || existing.status === 'rejected');
  // Com o acordo entre clubes fechado, só o contrato do atleta continua em discussão.
  if (contractStage) {
    fee = existing.fee;
    exchangePlayerId = existing.exchangePlayerId;
  }
  const bonus = Math.max(0, Math.round(terms.bonus || 0));
  const years = clamp(Math.round(terms.years || 3), 1, 5);
  checkBudget(c, fee, bonus);
  checkOutgoing(c, world, playerId, sellerId);
  if (exchangePlayerId) {
    if (c.players[exchangePlayerId]?.clubId !== c.clubId)
      throw new Error('O atleta de troca não pertence ao seu clube.');
    checkOutgoing(c, world, exchangePlayerId, c.clubId);
  }
  const minimum = askingPrice(c, world, player) * difficultyFactor(c);
  const first = !existing;
  const offer: Offer = existing || {
    id: `offer-${hash(`${c.seed}-${c.date}-${playerId}-${c.offers.length}`)}`,
    playerId,
    fromClubId: c.clubId,
    toClubId: sellerId,
    fee,
    wage,
    date: c.date,
    responseDate: c.date,
    status: 'pending',
    incoming: false,
    minimum,
    stage: 'club',
    patience: startPatience(c),
    messages: [],
  };
  if (existing) {
    offer.messages = threadOf(existing);
    if (existing.status === 'declined') {
      offer.stage = 'club';
      offer.patience = startPatience(c);
      offer.ask = undefined;
      offer.minimum = minimum;
      say(offer, { date: c.date, from: 'system', kind: 'info', text: 'Negociação reaberta.' });
    }
  } else c.offers.push(offer);
  Object.assign(offer, {
    fee,
    wage,
    exchangePlayerId,
    years,
    bonus: bonus || undefined,
    status: 'pending',
    counter: undefined,
    responseDate: addDays(c.date, 1),
  });
  const seed = `${offer.id}:${threadOf(offer).length}`;
  say(offer, {
    date: c.date,
    from: 'me',
    kind: 'offer',
    ...(contractStage ? {} : { fee, exchangePlayerId }),
    wage,
    years,
    bonus: bonus || undefined,
    text: contractStage
      ? pick(seed, [
          `Proposta de contrato para ${player.name}. Acreditamos que é justa.`,
          `Revisamos o contrato de ${player.name}. Esses são os novos termos.`,
        ])
      : first
        ? pick(seed, [
            `Bom dia! Temos interesse em ${player.name}. Segue nossa proposta oficial.`,
            `Olá! ${player.name} está nos planos do clube. Esta é a nossa oferta.`,
            `Queremos ${player.name}. Segue a proposta formal do clube.`,
          ])
        : pick(seed, [
            'Revisamos os números. Segue nossa nova proposta.',
            'Fizemos um esforço. Esta é a nossa contraproposta.',
            'Ouvimos vocês. Melhoramos a oferta.',
          ]),
  });
  return c;
}

function finish(c: Career, world: World, offer: Offer) {
  try {
    completeTransfer(c, world, offer);
    const player = world.players.find((p) => p.id === offer.playerId)!;
    say(offer, {
      date: c.date,
      from: 'system',
      kind: 'info',
      text: offer.incoming
        ? `Venda concluída. ${player.name} deixou o clube.`
        : `Transferência concluída. ${player.name} é o novo reforço do clube!`,
    });
  } catch (error) {
    offer.status = 'rejected';
    say(offer, {
      date: c.date,
      from: 'system',
      kind: 'info',
      text: `A transferência não pôde ser concluída: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function lock(c: Career, offer: Offer) {
  offer.status = 'declined';
  offer.lockedUntil = addDays(c.date, 30);
}

/** Resposta do agente do atleta aos termos de contrato. */
function agentDecision(c: Career, world: World, offer: Offer) {
  const player = world.players.find((p) => p.id === offer.playerId)!;
  const years = offer.years || 3;
  const required = requiredWage(c, player);
  const effective = effectiveWage(offer.wage, offer.bonus, years);
  const seed = `${offer.id}:${threadOf(offer).length}:agent`;
  const patience = offer.patience ?? startPatience(c);
  if (effective >= required * 0.995) {
    say(offer, {
      date: c.date,
      from: 'agent',
      kind: 'accept',
      wage: offer.wage,
      years,
      bonus: offer.bonus,
      text: pick(seed, [
        `Temos acordo! ${player.name} assina por ${years} ${years === 1 ? 'ano' : 'anos'}.`,
        `Meu cliente está feliz. Pode preparar a apresentação de ${player.name}.`,
      ]),
    });
    offer.status = 'accepted';
    finish(c, world, offer);
    return;
  }
  if (patience <= 0) {
    lock(c, offer);
    say(offer, {
      date: c.date,
      from: 'agent',
      kind: 'reject',
      text: `Não houve evolução. ${player.name} decidiu seguir outro caminho.`,
    });
    return;
  }
  if (effective < required * 0.65) {
    offer.patience = patience - 2;
    offer.status = 'rejected';
    say(offer, {
      date: c.date,
      from: 'agent',
      kind: 'reject',
      text: 'Com todo respeito, isso está muito abaixo do que meu cliente ganha hoje. Precisamos de uma proposta séria.',
    });
    return;
  }
  const counterWage = roundUp(
    Math.max(offer.wage * 1.03, required - (offer.bonus || 0) / (12 * years)) * 1.01,
    1000,
  );
  offer.patience = patience - 1;
  offer.status = 'countered';
  offer.counter = { wage: counterWage, years, bonus: offer.bonus };
  say(offer, {
    date: c.date,
    from: 'agent',
    kind: 'counter',
    wage: counterWage,
    years,
    bonus: offer.bonus,
    text:
      offer.patience <= 1
        ? 'Esta é a última posição do meu cliente. Pegar ou largar.'
        : pick(seed, [
            `${player.name} gostou do projeto, mas o salário precisa melhorar.`,
            'Estamos perto. Ajuste o salário e fechamos.',
            'Meu cliente quer se sentir valorizado. Esta é a nossa contraproposta.',
          ]),
  });
}

/**
 * O clube vendedor tem uma avaliação oculta (preço pedido) e um piso de paciência.
 * Nunca pede menos do que já foi oferecido e só reduz a pedida ao longo da conversa.
 */
function clubDecision(c: Career, world: World, offer: Offer) {
  const player = world.players.find((p) => p.id === offer.playerId)!;
  const exVal = exchangeValue(c, world, offer.exchangePlayerId);
  const amount = offer.fee + exVal;
  const target = Math.min(offer.minimum, offer.ask ?? Infinity);
  const patience = offer.patience ?? startPatience(c);
  const seed = `${offer.id}:${threadOf(offer).length}:club`;
  if (amount >= target * 0.98) {
    say(offer, {
      date: c.date,
      from: 'club',
      kind: 'accept',
      fee: offer.fee,
      exchangePlayerId: offer.exchangePlayerId,
      text: pick(seed, [
        `Proposta aceita. Vocês estão liberados para conversar com ${player.name}.`,
        `Negócio fechado entre os clubes. Agora é com o agente de ${player.name}.`,
      ]),
    });
    offer.stage = 'player';
    offer.patience = startPatience(c);
    agentDecision(c, world, offer);
    return;
  }
  if (patience <= 0) {
    lock(c, offer);
    say(offer, {
      date: c.date,
      from: 'club',
      kind: 'reject',
      text: `Chega. Não vamos mais negociar ${player.name} nesta janela.`,
    });
    return;
  }
  if (amount < offer.minimum * 0.6) {
    offer.patience = patience - 2;
    offer.status = 'rejected';
    say(offer, {
      date: c.date,
      from: 'club',
      kind: 'reject',
      text:
        offer.patience <= 0
          ? `Isso é um desrespeito. ${player.name} vale muito mais — tente de novo e encerramos.`
          : pick(seed, [
              `Essa proposta nem merece resposta séria. ${player.name} vale muito mais.`,
              `Valor fora da realidade. ${player.name} é titular aqui.`,
            ]),
    });
    return;
  }
  const midpoint = offer.minimum - (offer.minimum - amount) * 0.35;
  const ask = Math.min(offer.ask ?? Infinity, roundUp(Math.max(amount * 1.04, midpoint), 100000));
  const fee = Math.max(offer.fee + 50000, roundUp(ask - exVal, 50000));
  offer.ask = ask;
  offer.patience = patience - 1;
  offer.status = 'countered';
  offer.counter = { fee, exchangePlayerId: offer.exchangePlayerId };
  say(offer, {
    date: c.date,
    from: 'club',
    kind: 'counter',
    fee,
    exchangePlayerId: offer.exchangePlayerId,
    text:
      offer.patience <= 1
        ? `Esta é a nossa última proposta por ${player.name}.`
        : pick(seed, [
            `Gostamos do interesse, mas ${player.name} vale mais. Fechamos neste valor.`,
            `Estamos perto. Com este valor liberamos ${player.name}.`,
            `A diretoria analisou e devolve com este número.`,
          ]),
  });
}

/** Aceita ou recusa a contraproposta do clube vendedor ou do agente. */
export function respondCounter(
  career: Career,
  world: World,
  offerId: string,
  accept: boolean,
): Career {
  const c = structuredClone(career);
  const offer = c.offers.find((o) => o.id === offerId);
  const answerable = accept
    ? offer?.status === 'countered' && Boolean(offer.counter)
    : offer?.status === 'countered' || offer?.status === 'rejected';
  if (!offer || offer.incoming || !answerable)
    throw new Error('Não há contraproposta para responder.');
  offer.messages = threadOf(offer);
  if (!accept) {
    offer.status = 'declined';
    say(offer, {
      date: c.date,
      from: 'me',
      kind: 'reject',
      text: 'Agradecemos, mas vamos encerrar a negociação por aqui.',
    });
    return c;
  }
  if (!transferWindow(c.date)) throw new Error('A janela de transferências está fechada.');
  const t = offer.counter!;
  const fee = offer.stage === 'player' ? offer.fee : (t.fee ?? offer.fee);
  const bonus = t.bonus ?? offer.bonus ?? 0;
  checkBudget(c, fee, bonus);
  Object.assign(offer, {
    fee,
    wage: t.wage ?? offer.wage,
    years: t.years ?? offer.years,
    bonus: bonus || undefined,
    counter: undefined,
  });
  say(offer, {
    date: c.date,
    from: 'me',
    kind: 'accept',
    ...(offer.stage === 'player'
      ? { wage: offer.wage, years: offer.years, bonus: offer.bonus }
      : { fee, exchangePlayerId: offer.exchangePlayerId }),
    text:
      offer.stage === 'player' ? 'Aceitamos os termos do contrato.' : 'Aceitamos o valor pedido.',
  });
  if (offer.stage === 'player') agentDecision(c, world, offer);
  else clubDecision(c, world, offer);
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
  offer.messages = threadOf(offer);
  if (accept) {
    say(offer, {
      date: c.date,
      from: 'me',
      kind: 'accept',
      fee: offer.fee,
      text: 'Proposta aceita. Negócio fechado.',
    });
    completeTransfer(c, world, offer);
    const player = world.players.find((p) => p.id === offer.playerId)!;
    say(offer, {
      date: c.date,
      from: 'system',
      kind: 'info',
      text: `Venda concluída. ${player.name} deixou o clube.`,
    });
  } else {
    offer.status = 'declined';
    say(offer, {
      date: c.date,
      from: 'me',
      kind: 'reject',
      text: 'O atleta não está à venda por esse valor.',
    });
  }
  return c;
}

/** Pede um valor maior ao clube interessado; ele aceita, devolve uma contraproposta ou desiste. */
export function counterIncoming(
  career: Career,
  world: World,
  offerId: string,
  fee: number,
): Career {
  const c = structuredClone(career);
  const offer = c.offers.find((o) => o.id === offerId);
  if (!offer || !offer.incoming || offer.status !== 'pending')
    throw new Error('Proposta não está disponível.');
  if (!Number.isFinite(fee) || fee <= offer.fee)
    throw new Error('Peça um valor acima da oferta atual.');
  offer.messages = threadOf(offer);
  const player = world.players.find((p) => p.id === offer.playerId)!;
  const ceiling = Math.min(
    c.finances[offer.fromClubId].transferBudget,
    Math.max(offer.fee * 1.1, offer.minimum * (0.95 + (hash(offer.id) % 20) / 100)),
  );
  const patience = offer.patience ?? 3;
  say(offer, {
    date: c.date,
    from: 'me',
    kind: 'counter',
    fee,
    text: `Por ${player.name}, só negociamos neste valor.`,
  });
  if (fee <= ceiling) {
    offer.fee = fee;
    say(offer, {
      date: c.date,
      from: 'club',
      kind: 'accept',
      fee,
      text: 'Aceitamos. Pode preparar a documentação.',
    });
    offer.status = 'accepted';
    finish(c, world, offer);
    return c;
  }
  if (fee > ceiling * 1.5 || patience <= 1) {
    offer.status = 'declined';
    say(offer, {
      date: c.date,
      from: 'club',
      kind: 'reject',
      text: `Muito acima do que podemos pagar. Desistimos de ${player.name}.`,
    });
    return c;
  }
  offer.fee = Math.max(
    offer.fee + 50000,
    roundUp(Math.min(ceiling, offer.fee + (fee - offer.fee) * 0.5), 50000),
  );
  offer.patience = patience - 1;
  offer.responseDate = addDays(c.date, 5);
  say(offer, {
    date: c.date,
    from: 'club',
    kind: 'counter',
    fee: offer.fee,
    text:
      offer.patience <= 1
        ? 'Este é o nosso limite. Última oferta.'
        : 'Não chegamos lá, mas melhoramos a proposta.',
  });
  return c;
}

/** Encerra conversas abertas quando a janela fecha ou o prazo de resposta expira. */
export function expireThread(offer: Offer, date: string, text: string) {
  offer.messages = threadOf(offer);
  offer.status = 'declined';
  say(offer, { date, from: 'system', kind: 'info', text });
}

export function processOffers(c: Career, world: World) {
  for (const offer of c.offers.filter(
    (o) => !o.incoming && o.status === 'pending' && o.responseDate <= c.date,
  )) {
    if (!transferWindow(c.date)) break;
    offer.messages = threadOf(offer);
    if (offer.stage === 'player') agentDecision(c, world, offer);
    else clubDecision(c, world, offer);
    notify(c, world, offer);
  }
  if (!transferWindow(c.date)) {
    for (const offer of c.offers.filter((o) => o.status === 'pending' || o.status === 'countered'))
      expireThread(offer, c.date, 'A janela de transferências fechou. Negociação encerrada.');
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
  const fee = roundUp(marketValue(c, player) * (0.75 + rng() * 0.5), 50000);
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
    patience: 3,
    messages: [
      {
        date: c.date,
        from: 'club',
        kind: 'offer',
        fee,
        text: pick(id, [
          `Olá! ${buyer.name} quer contratar ${player.name}. Segue nossa proposta oficial.`,
          `Acompanhamos ${player.name} há meses. Esta é a nossa oferta.`,
        ]),
      },
    ],
  });
  c.messages.unshift({
    id,
    date: c.date,
    kind: 'market',
    from: buyer.name,
    title: `Proposta por ${player.name}`,
    body: `${buyer.name} enviou uma proposta. Responda na aba Negociações das transferências.`,
    important: false,
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

export function renewContract(career: Career, world: World, playerId: string, months = 36): Career {
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
