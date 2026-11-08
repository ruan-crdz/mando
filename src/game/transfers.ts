import { addDays, addMonths, ageAt, clamp, hash, random } from './random';
import { overall } from './ratings';
import { reconcileSquad, squad } from './matches';
import { nextWindowOpen, transferWindow } from './calendar';
import { clubById, foreignClubs, isForeign } from './npc';
import { notify as inbox, recordMove } from './chronicle';
import { checkPlayerSalaryBudget, directorEffect, staffLevel } from './staff';
import { addLedger, agentOf, clubRights, settleFee } from './market';
import {
  type Career,
  type LoanTerms,
  type NegotiationMessage,
  type Offer,
  type Player,
  type World,
} from './types';

/** Finanças de um clube; estrangeiros usam um caixa temporário pela reputação (não é salvo). */
export function financeOf(c: Career, world: World, clubId: string): Career['finances'][string] {
  const own = c.finances[clubId];
  if (own) return own;
  const budget = Math.max(8e6, (clubById(world, clubId).reputation - 60) * 6e6);
  return { cash: budget * 2, transferBudget: budget, debt: 0, history: [] };
}

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
  const buyer = clubById(world, buyerId);
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
  if (c.players[playerId]?.loanFrom)
    throw new Error('Um atleta emprestado não pode ser transferido novamente.');
  if (
    players.length <= 18 ||
    (p.position === 'GK' && players.filter((p) => p.position === 'GK').length <= 2)
  )
    throw new Error('A transferência deixaria o clube com menos de 18 atletas ou dois goleiros.');
}

const difficultyFactor = (c: Career) =>
  c.difficulty === 'Iniciante' ? 0.9 : c.difficulty === 'Profissional' ? 1.08 : 1;

export function requiredWage(c: Career, player: Player) {
  // Empresários influentes inflacionam a pedida salarial.
  const agent = 1 + (agentOf(player.id).influence - 1) * 0.015;
  return c.players[player.id].wage * (c.difficulty === 'Profissional' ? 1.15 : 1.05) * agent;
}

/**
 * Peso da pedida do vendedor: % dos direitos comprados e desconto pelo sell-on concedido.
 * O atleta sai inteiro do clube mesmo com fatia parcial, então ficar com 50% dos direitos
 * só desconta metade da fatia retida (50% dos direitos = 75% da pedida).
 */
export const dealFactor = (rights = 100, sellOn = 0) =>
  (0.5 + clamp(rights, 50, 100) / 200) * (1 - clamp(sellOn, 0, 30) / 200);

/** Comissão do empresário sobre a taxa da operação (paga pelo clube comprador). */
export const commissionOf = (playerId: string, fee: number) =>
  Math.round((fee * agentOf(playerId).commission) / 100);

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
  rights = 100,
  sellOn = 0,
) {
  const exact = Math.min(
    askingPrice(c, world, player) * difficultyFactor(c) * dealFactor(rights, sellOn),
    ask ?? Infinity,
  );
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
  (c.difficulty === 'Iniciante' ? 5 : c.difficulty === 'Profissional' ? 3 : 4) +
  directorEffect(staffLevel(c, 'director')).patience;
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
        ? `${agentOf(player.id).name} · empresário de ${player.name}`
        : clubName(world, offer.incoming ? offer.fromClubId : offer.toClubId),
    kind: 'market',
    title: offer.loan ? `Empréstimo de ${player.name}` : `Negociação por ${player.name}`,
    body: last.text,
    important: false,
    read: false,
    resolved: false,
    playerId: player.id,
  });
}

function checkBudget(c: Career, fee: number, bonus: number, extra = 0) {
  const f = c.finances[c.clubId];
  if (fee > f.transferBudget || fee + bonus + extra > f.cash)
    throw new Error('Proposta acima do orçamento disponível.');
}

export function createOffer(
  career: Career,
  world: World,
  playerId: string,
  fee: number,
  wage: number,
  exchangePlayerId?: string,
  terms: { years?: number; bonus?: number; rights?: number; sellOn?: number } = {},
): Career {
  const c = structuredClone(career);
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
  let existing = activeThread(c, playerId);
  if (existing?.awaitingWindow)
    throw new Error('O acordo já está fechado. O atleta se apresenta quando a janela abrir.');
  if (existing?.status === 'pending')
    throw new Error('Esta proposta já está com o outro lado. Aguarde a resposta.');
  if (existing?.lockedUntil && existing.lockedUntil > c.date)
    throw new Error(
      `${clubName(world, sellerId)} encerrou as conversas por ${player.name} até ${existing.lockedUntil.split('-').reverse().slice(0, 2).join('/')}.`,
    );
  // Trocar um pedido de empréstimo por proposta de compra abre uma nova conversa.
  if (existing?.loan) {
    if (existing.status === 'countered' || existing.status === 'rejected')
      expireThread(existing, c.date, 'Pedido de empréstimo substituído por proposta de compra.');
    existing = undefined;
  }
  const contractStage =
    existing?.stage === 'player' &&
    (existing.status === 'countered' || existing.status === 'rejected');
  let rights = clamp(Math.round(terms.rights ?? 100), 50, 100);
  let sellOn = clamp(Math.round(terms.sellOn ?? 0), 0, 30);
  // Com o acordo entre clubes fechado, só o contrato do atleta continua em discussão.
  if (contractStage) {
    fee = existing!.fee;
    exchangePlayerId = existing!.exchangePlayerId;
    rights = existing!.rights ?? 100;
    sellOn = existing!.sellOn ?? 0;
  }
  const bonus = Math.max(0, Math.round(terms.bonus || 0));
  const years = clamp(Math.round(terms.years || 3), 1, 5);
  checkBudget(c, fee, bonus, commissionOf(playerId, fee));
  checkOutgoing(c, world, playerId, sellerId);
  if (exchangePlayerId) {
    if (c.players[exchangePlayerId]?.clubId !== c.clubId)
      throw new Error('O atleta de troca não pertence ao seu clube.');
    if (clubRights(c, exchangePlayerId) < 100)
      throw new Error('Para usar um atleta na troca, o clube precisa possuir 100% dos direitos.');
    checkOutgoing(c, world, exchangePlayerId, c.clubId);
  }
  checkPlayerSalaryBudget(
    c,
    wage - (exchangePlayerId ? c.players[exchangePlayerId].wage : 0),
    playerId,
  );
  const minimum = askingPrice(c, world, player) * difficultyFactor(c) * dealFactor(rights, sellOn);
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
    } else if (!contractStage) {
      // Outra fatia de direitos ou sell-on muda a pedida na mesma proporção.
      const before = dealFactor(existing.rights, existing.sellOn);
      const after = dealFactor(rights, sellOn);
      if (before !== after) {
        offer.minimum = minimum;
        if (offer.ask !== undefined) offer.ask = Math.round((offer.ask * after) / before);
      }
    }
  } else c.offers.push(offer);
  Object.assign(offer, {
    fee,
    wage,
    exchangePlayerId,
    years,
    bonus: bonus || undefined,
    rights: rights < 100 ? rights : undefined,
    sellOn: sellOn || undefined,
    status: 'pending',
    counter: undefined,
    responseDate: addDays(c.date, 1),
  });
  const seed = `${offer.id}:${threadOf(offer).length}`;
  say(offer, {
    date: c.date,
    from: 'me',
    kind: 'offer',
    ...(contractStage
      ? {}
      : {
          fee,
          exchangePlayerId,
          rights: rights < 100 ? rights : undefined,
          sellOn: sellOn || undefined,
        }),
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

const windowLabel = (date: string) => date.slice(5).split('-').reverse().join('/');

function deferToWindow(c: Career, world: World, offer: Offer) {
  const player = world.players.find((p) => p.id === offer.playerId)!;
  offer.status = 'accepted';
  offer.awaitingWindow = true;
  say(offer, {
    date: c.date,
    from: 'system',
    kind: 'info',
    text: `Acordo fechado. ${player.name} ${offer.incoming || offer.outLoan ? 'deixa o clube' : 'se apresenta'} quando a janela abrir, em ${windowLabel(nextWindowOpen(c.date))}.`,
  });
}

function finish(c: Career, world: World, offer: Offer) {
  if (!transferWindow(c.date)) return deferToWindow(c, world, offer);
  offer.awaitingWindow = undefined;
  try {
    if (offer.outLoan) {
      Object.assign(
        c,
        loanOutPlayer(c, world, offer.playerId, offer.fromClubId, {
          ...offer.loan!,
          fee: offer.fee,
        }),
      );
      offer.status = 'completed';
      return;
    }
    if (offer.loan) completeLoan(c, world, offer);
    else completeTransfer(c, world, offer);
    const player = world.players.find((p) => p.id === offer.playerId)!;
    say(offer, {
      date: c.date,
      from: 'system',
      kind: 'info',
      text: offer.incoming
        ? `Venda concluída. ${player.name} deixou o clube.`
        : offer.loan
          ? `Empréstimo concluído. ${player.name} chega por ${offer.loan.months} meses.`
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
        `Temos acordo! ${player.name} assina por ${years} ${years === 1 ? 'ano' : 'anos'}. Minha comissão de ${agentOf(player.id).commission}% sai na assinatura.`,
        `Meu cliente está feliz. Pode preparar a apresentação de ${player.name}. Comissão de ${agentOf(player.id).commission}% conforme combinado.`,
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
      rights: offer.rights,
      sellOn: offer.sellOn,
      text: pick(seed, [
        `Proposta aceita. Vocês estão liberados para conversar com ${player.name}.`,
        `Negócio fechado entre os clubes. Agora é com o empresário de ${player.name}, ${agentOf(player.id).name}.`,
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
  const midpoint =
    offer.minimum - (offer.minimum - amount) * directorEffect(staffLevel(c, 'director')).concession;
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
    rights: offer.rights,
    sellOn: offer.sellOn,
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
  const t = offer.counter!;
  const fee = offer.stage === 'player' ? offer.fee : (t.fee ?? offer.fee);
  const bonus = t.bonus ?? offer.bonus ?? 0;
  checkBudget(c, fee, bonus, commissionOf(offer.playerId, fee));
  Object.assign(offer, {
    fee,
    wage: t.wage ?? offer.wage,
    years: t.years ?? offer.years,
    bonus: bonus || undefined,
    counter: undefined,
    ...(t.loan && offer.stage !== 'player' ? { loan: t.loan } : {}),
  });
  say(offer, {
    date: c.date,
    from: 'me',
    kind: 'accept',
    ...(offer.stage === 'player'
      ? offer.loan
        ? { bonus: offer.bonus }
        : { wage: offer.wage, years: offer.years, bonus: offer.bonus }
      : offer.loan
        ? { fee, loan: offer.loan }
        : {
            fee,
            exchangePlayerId: offer.exchangePlayerId,
            rights: offer.rights,
            sellOn: offer.sellOn,
          }),
    text:
      offer.stage === 'player'
        ? offer.loan
          ? 'Aceitamos as condições do atleta.'
          : 'Aceitamos os termos do contrato.'
        : offer.loan
          ? 'Aceitamos as condições do empréstimo.'
          : 'Aceitamos o valor pedido.',
  });
  if (offer.loan) {
    if (offer.stage === 'player') loanAgentDecision(c, world, offer);
    else loanClubDecision(c, world, offer);
  } else if (offer.stage === 'player') agentDecision(c, world, offer);
  else clubDecision(c, world, offer);
  return c;
}

export function completeTransfer(c: Career, world: World, offer: Offer) {
  if (!transferWindow(c.date)) throw new Error('Transferência fora da janela.');
  const buyer = financeOf(c, world, offer.fromClubId);
  if (c.players[offer.playerId]?.clubId !== offer.toClubId)
    throw new Error('O atleta já mudou de clube.');
  const bonus = offer.bonus || 0;
  const fees = offer.fromClubId === c.clubId ? commissionOf(offer.playerId, offer.fee) : 0;
  if (buyer.cash < offer.fee + bonus + fees || buyer.transferBudget < offer.fee)
    throw new Error('O comprador não tem mais orçamento suficiente.');
  checkOutgoing(c, world, offer.playerId, offer.toClubId);
  if (offer.exchangePlayerId) {
    if (c.players[offer.exchangePlayerId]?.clubId !== offer.fromClubId)
      throw new Error('Atleta de troca indisponível.');
    checkOutgoing(c, world, offer.exchangePlayerId, offer.fromClubId);
  }
  if (offer.fromClubId === c.clubId)
    checkPlayerSalaryBudget(
      c,
      offer.wage - (offer.exchangePlayerId ? c.players[offer.exchangePlayerId].wage : 0),
      offer.playerId,
    );
  else if (offer.toClubId === c.clubId && offer.exchangePlayerId)
    checkPlayerSalaryBudget(
      c,
      c.players[offer.exchangePlayerId].wage - c.players[offer.playerId].wage,
      offer.exchangePlayerId,
    );
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
  if (offer.exchangePlayerId) {
    if (clubRights(c, offer.exchangePlayerId) < 100)
      throw new Error('O clube não possui mais 100% dos direitos do atleta incluído na troca.');
    settleFee(c, world, {
      playerId: offer.exchangePlayerId,
      from: offer.fromClubId,
      to: offer.toClubId,
      fee: 0,
    });
    c.players[offer.exchangePlayerId].clubId = offer.toClubId;
  }
  // Comissão do empresário só nas compras do usuário (as da IA ficam fora do caixa salvo).
  const commission = offer.fromClubId === c.clubId ? commissionOf(offer.playerId, offer.fee) : 0;
  buyer.cash -= offer.fee + bonus + commission;
  buyer.transferBudget -= offer.fee;
  buyer.history.push({
    date: c.date,
    income: 0,
    expenses: offer.fee + bonus + commission,
    balance: buyer.cash,
  });
  if (commission)
    addLedger(c, {
      playerId: offer.playerId,
      kind: 'comissao',
      from: c.clubId,
      to: agentOf(offer.playerId).name,
      amount: commission,
    });
  const { net } = settleFee(c, world, {
    playerId: offer.playerId,
    from: offer.toClubId,
    to: offer.fromClubId,
    fee: offer.fee,
    rights: offer.rights,
    sellOn: offer.sellOn,
    budgetShare: 0.75,
  });
  const p = c.players[offer.playerId];
  p.clubId = offer.fromClubId;
  p.wage = offer.wage;
  p.contractEnd = `${Number(c.date.slice(0, 4)) + (offer.years || 3)}-12-31`;
  p.morale = clamp(p.morale + 8);
  delete p.listed;
  offer.status = 'completed';
  if (offer.toClubId === c.clubId) c.sales += net;
  recordMove(
    c,
    world,
    offer.playerId,
    offer.toClubId,
    offer.fromClubId,
    offer.fee,
    isForeign(offer.fromClubId) ? 'exterior' : 'compra',
  );
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
    if (!transferWindow(c.date)) {
      deferToWindow(c, world, offer);
      return c;
    }
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
    const s = c.players[offer.playerId];
    // Recusar o exterior frustra o atleta ambicioso, que passa a forçar a saída.
    if (isForeign(offer.fromClubId) && s && (s.personality === 'Ambicioso' || offer.fee >= 3e7)) {
      s.morale = clamp(s.morale - 15);
      s.relationship = clamp(s.relationship - 12);
      s.listed ??= offer.fee;
      const player = world.players.find((p) => p.id === offer.playerId)!;
      c.messages.unshift({
        id: `msg-force-${offer.id}`,
        date: c.date,
        kind: 'player',
        from: player.name,
        title: 'Quero jogar na Europa',
        body: `Professor, era o sonho da minha vida. Peço que o clube me libere na próxima proposta. A partir de agora estou na lista de transferências.`,
        important: false,
        read: false,
        resolved: true,
        playerId: player.id,
      });
    }
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
    financeOf(c, world, offer.fromClubId).transferBudget,
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
  if (transferWindow(c.date))
    for (const offer of c.offers.filter((o) => o.awaitingWindow && o.status === 'accepted')) {
      offer.messages = threadOf(offer);
      finish(c, world, offer);
      notify(c, world, offer);
    }
  for (const offer of c.offers.filter(
    (o) => !o.incoming && o.status === 'pending' && o.responseDate <= c.date,
  )) {
    const state = c.players[offer.playerId];
    if (!state || state.clubId !== offer.toClubId || state.loanFrom) {
      expireThread(offer, c.date, 'O atleta não está mais disponível neste clube.');
      notify(c, world, offer);
      continue;
    }
    offer.messages = threadOf(offer);
    if (offer.loan) {
      if (offer.stage === 'player') loanAgentDecision(c, world, offer);
      else loanClubDecision(c, world, offer);
    } else if (offer.stage === 'player') agentDecision(c, world, offer);
    else clubDecision(c, world, offer);
    notify(c, world, offer);
  }
  const rng = random(hash(`${c.seed}:${c.date}:market`));
  const own = squad(c, world).filter(
    (p) =>
      !c.players[p.id].loanFrom &&
      !c.offers.some((o) => o.playerId === p.id && (o.status === 'pending' || o.awaitingWindow)),
  );
  // Atletas à venda atraem propostas com frequência, perto do preço pedido.
  const listed = own.filter((p) => c.players[p.id].listed);
  const roll = rng();
  const forSale = listed.length > 0 && roll < 0.3;
  if (!forSale && roll > 0.045) return;
  const pool = forSale ? listed : own;
  const player = pool[Math.floor(rng() * pool.length)];
  // Destaques atraem o mercado europeu e árabe, que paga acima do valor.
  const ovr = player ? overall(player) : 99;
  const abroad = ovr >= 70 && rng() < (c.date.slice(5, 7) >= '07' ? 0.45 : 0.25);
  const buyers = abroad
    ? foreignClubs.filter((club) => club.reputation >= ovr + 2)
    : world.clubs.filter((club) => club.id !== c.clubId);
  const buyer = buyers[Math.floor(rng() * buyers.length)];
  if (!player || !buyer) return;
  const asking = c.players[player.id].listed;
  const fee = roundUp(
    forSale && asking
      ? asking * (0.6 + rng() * 0.35)
      : marketValue(c, player) * (abroad ? 1.2 + rng() * 0.6 : 0.75 + rng() * 0.5),
    50000,
  );
  if (fee > financeOf(c, world, buyer.id).transferBudget) return;
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
    minimum: forSale && asking ? asking : askingPrice(c, world, player, buyer.id),
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

export type LoanRequest = LoanTerms & { fee: number; bonus?: number };

function validateLoanRequest(req: LoanRequest) {
  if (!Number.isInteger(req.months) || req.months < 1 || req.months > 12)
    throw new Error('Escolha uma duração de empréstimo entre 1 e 12 meses.');
  if (!Number.isFinite(req.wagePct) || req.wagePct < 0 || req.wagePct > 100)
    throw new Error('Informe uma participação salarial entre 0% e 100%.');
  if (
    !Number.isFinite(req.fee) ||
    req.fee < 0 ||
    (req.bonus !== undefined && (!Number.isFinite(req.bonus) || req.bonus < 0))
  )
    throw new Error('Informe uma taxa e luvas válidas.');
  if (req.option !== undefined && (!Number.isFinite(req.option) || req.option <= 0))
    throw new Error('Informe um valor positivo para a opção de compra.');
  if (
    req.obligation &&
    (!Number.isFinite(req.obligation.fee) ||
      req.obligation.fee <= 0 ||
      !Number.isInteger(req.obligation.games) ||
      req.obligation.games < 1 ||
      req.obligation.games > 40)
  )
    throw new Error('Informe um valor de compra e uma meta de 1 a 40 jogos para a obrigação.');
  if (req.option !== undefined && req.obligation)
    throw new Error('Escolha uma opção ou uma obrigação de compra, não as duas.');
}

const money = (n: number) =>
  n >= 1e6 ? `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} mi` : `R$ ${Math.round(n / 1000)} mil`;
const ovrOf = (c: Career, p: Player) => overall(p, p.position, c.players[p.id]);

function normalizeLoan(req: LoanTerms): LoanTerms {
  const months = clamp(Math.round(req.months || 6), 1, 12);
  const wagePct = clamp(Math.round(req.wagePct ?? 100), 0, 100);
  const option = req.option && req.option > 0 ? Math.round(req.option) : undefined;
  const obligation =
    req.obligation && req.obligation.fee > 0
      ? {
          fee: Math.round(req.obligation.fee),
          games: clamp(Math.round(req.obligation.games || 15), 1, 40),
        }
      : undefined;
  return {
    months,
    wagePct,
    ...(obligation ? { obligation } : option !== undefined ? { option } : {}),
  };
}

/** Pedida do clube dono: taxa, % do salário e valores mínimos de opção e obrigação. */
export function loanAsk(c: Career, world: World, player: Player, months: number) {
  const young = ageAt(player.birthDate, c.date) <= 21;
  const price = askingPrice(c, world, player) * difficultyFactor(c);
  return {
    fee: roundUp(
      marketValue(c, player) * 0.1 * (months / 12) * (young ? 0.5 : 1) * difficultyFactor(c),
      50000,
    ),
    wagePct: young ? 60 : 100,
    option: roundUp(price, 100000),
    obligation: roundUp(price * 0.85, 100000),
  };
}

/** Motivo para o dono recusar o empréstimo: titular ou elenco curto na posição. */
export function loanBlock(c: Career, world: World, player: Player): string | null {
  const owner = c.players[player.id]?.clubId;
  if (!owner) return null;
  const roster = squad(c, world, owner);
  const rank = [...roster]
    .sort((a, b) => ovrOf(c, b) - ovrOf(c, a))
    .findIndex((p) => p.id === player.id);
  if (rank >= 0 && rank < 11 && ageAt(player.birthDate, c.date) > 21)
    return `${player.name} é titular aqui. Não emprestamos peças do time principal.`;
  const same = roster.filter((p) => p.position === player.position).length;
  if (same <= 2 || roster.length <= 20)
    return `Temos pouco elenco nessa posição. Não podemos abrir mão de ${player.name} agora.`;
  return null;
}

const loanValue = (fee: number, terms: LoanTerms, wage: number) =>
  fee + (terms.wagePct / 100) * wage * terms.months;

function loanTarget(ask: ReturnType<typeof loanAsk>, terms: LoanTerms, wage: number) {
  const base = ask.fee + (ask.wagePct / 100) * wage * terms.months;
  // Uma obrigação de compra digna reduz pela metade o que o dono exige pelo empréstimo.
  return terms.obligation && terms.obligation.fee >= ask.obligation ? base * 0.5 : base;
}

/** O atleta topa ir emprestado se terá minutos, se for jovem ou se o clube for do mesmo porte. */
function loanHappy(c: Career, world: World, player: Player) {
  const owner = c.players[player.id].clubId!;
  const best = Math.max(
    0,
    ...squad(c, world)
      .filter((p) => p.position === player.position)
      .map((p) => ovrOf(c, p)),
  );
  return (
    ageAt(player.birthDate, c.date) <= 23 ||
    ovrOf(c, player) >= best - 3 ||
    clubById(world, c.clubId).reputation >= clubById(world, owner).reputation - 8
  );
}
export const loanBonusAsk = (c: Career, player: Player) =>
  roundUp(c.players[player.id].wage * 2, 1000);

/** Leitura do diretor sobre um pedido de empréstimo (0–100 para clube e atleta). */
export function loanOutlook(
  c: Career,
  world: World,
  player: Player,
  fee: number,
  req: LoanTerms,
  bonus = 0,
  previousAsk?: number,
) {
  const terms = normalizeLoan(req);
  const wage = c.players[player.id].wage;
  const ask = loanAsk(c, world, player, terms.months);
  const blocked = loanBlock(c, world, player);
  const target = Math.min(loanTarget(ask, terms, wage), previousAsk ?? Infinity);
  let club = Math.round(
    clamp(((loanValue(fee, terms, wage) / Math.max(1, target) - 0.7) / 0.3) * 100),
  );
  if (
    (terms.option !== undefined && terms.option < ask.option) ||
    (terms.obligation && terms.obligation.fee < ask.obligation)
  )
    club = Math.min(club, 30);
  if (blocked) club = 0;
  const athlete = loanHappy(c, world, player) || bonus >= loanBonusAsk(c, player) ? 100 : 20;
  return { club, player: athlete, ask, blocked, minimum: Math.round(target) };
}

/** Pedido de empréstimo: passa pelo clube dono e depois pelo atleta/empresário. */
export function createLoanOffer(
  career: Career,
  world: World,
  playerId: string,
  req: LoanRequest,
): Career {
  const c = structuredClone(career);
  const player = world.players.find((p) => p.id === playerId);
  const state = c.players[playerId];
  if (
    !player ||
    !state?.clubId ||
    state.clubId === c.clubId ||
    state.loanFrom ||
    isForeign(state.clubId)
  )
    throw new Error('Este jogador não está disponível para empréstimo.');
  if (c.challenge === 'Só a base' && ageAt(player.birthDate, c.date) > 23)
    throw new Error('Este desafio permite contratar apenas jogadores de até 23 anos.');
  validateLoanRequest(req);
  if (addMonths(c.date, req.months) > state.contractEnd)
    throw new Error('O empréstimo não pode ultrapassar o contrato do atleta com o clube dono.');
  const ownerId = state.clubId;
  let existing = activeThread(c, playerId);
  if (existing?.awaitingWindow)
    throw new Error('O acordo já está fechado. O atleta se apresenta quando a janela abrir.');
  if (existing?.status === 'pending')
    throw new Error('Esta proposta já está com o outro lado. Aguarde a resposta.');
  if (existing?.lockedUntil && existing.lockedUntil > c.date)
    throw new Error(
      `${clubName(world, ownerId)} encerrou as conversas por ${player.name} até ${existing.lockedUntil.split('-').reverse().slice(0, 2).join('/')}.`,
    );
  if (existing && !existing.loan) {
    if (existing.status === 'countered' || existing.status === 'rejected')
      expireThread(existing, c.date, 'Proposta de compra substituída por pedido de empréstimo.');
    existing = undefined;
  }
  const contractStage =
    existing?.stage === 'player' &&
    (existing.status === 'countered' || existing.status === 'rejected');
  let fee = Math.round(req.fee);
  let terms = normalizeLoan(req);
  if (contractStage) {
    fee = existing!.fee;
    terms = existing!.loan!;
  }
  checkPlayerSalaryBudget(c, (state.wage * terms.wagePct) / 100, playerId);
  const bonus = Math.max(0, Math.round(req.bonus || 0));
  checkBudget(c, fee, bonus, commissionOf(playerId, fee));
  checkOutgoing(c, world, playerId, ownerId);
  const minimum = loanTarget(loanAsk(c, world, player, terms.months), terms, state.wage);
  const first = !existing;
  const offer: Offer = existing || {
    id: `loan-${hash(`${c.seed}-${c.date}-${playerId}-${c.offers.length}`)}`,
    playerId,
    fromClubId: c.clubId,
    toClubId: ownerId,
    fee,
    wage: state.wage,
    date: c.date,
    responseDate: c.date,
    status: 'pending',
    incoming: false,
    minimum,
    stage: 'club',
    patience: startPatience(c),
    messages: [],
    loan: terms,
  };
  if (existing) {
    offer.messages = threadOf(existing);
    if (existing.status === 'declined') {
      offer.stage = 'club';
      offer.patience = startPatience(c);
      offer.ask = undefined;
      say(offer, { date: c.date, from: 'system', kind: 'info', text: 'Negociação reaberta.' });
    }
    if (!contractStage) offer.minimum = minimum;
  } else c.offers.push(offer);
  Object.assign(offer, {
    fee,
    loan: terms,
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
    ...(contractStage ? { bonus: bonus || undefined } : { fee, loan: terms }),
    text: contractStage
      ? `Para ${player.name} vir emprestado, oferecemos estas condições.`
      : first
        ? pick(seed, [
            `Olá! Queremos ${player.name} por empréstimo. Seguem as condições.`,
            `${player.name} teria minutos aqui. Propomos um empréstimo nestes termos.`,
          ])
        : pick(seed, [
            'Revisamos as condições do empréstimo.',
            'Melhoramos o pedido de empréstimo.',
          ]),
  });
  return c;
}

function loanClubDecision(c: Career, world: World, offer: Offer) {
  const player = world.players.find((p) => p.id === offer.playerId)!;
  const terms = offer.loan!;
  const wage = c.players[player.id].wage;
  const seed = `${offer.id}:${threadOf(offer).length}:club`;
  const block = loanBlock(c, world, player);
  if (block) {
    offer.status = 'declined';
    say(offer, { date: c.date, from: 'club', kind: 'reject', text: block });
    return;
  }
  const ask = loanAsk(c, world, player, terms.months);
  const target = Math.min(loanTarget(ask, terms, wage), offer.ask ?? Infinity);
  offer.minimum = Math.round(target);
  const value = loanValue(offer.fee, terms, wage);
  const optionLow = terms.option !== undefined && terms.option < ask.option;
  const obligationLow = Boolean(terms.obligation && terms.obligation.fee < ask.obligation);
  const patience = offer.patience ?? startPatience(c);
  if (value >= target * 0.98 && !optionLow && !obligationLow) {
    say(offer, {
      date: c.date,
      from: 'club',
      kind: 'accept',
      fee: offer.fee,
      loan: terms,
      text: `Empréstimo aprovado. Falem com ${agentOf(player.id).name}, empresário de ${player.name}.`,
    });
    offer.stage = 'player';
    offer.patience = startPatience(c);
    loanAgentDecision(c, world, offer);
    return;
  }
  if (patience <= 0) {
    lock(c, offer);
    say(offer, {
      date: c.date,
      from: 'club',
      kind: 'reject',
      text: `Não vamos mais discutir o empréstimo de ${player.name} nesta janela.`,
    });
    return;
  }
  if (value < target * 0.5) {
    offer.patience = patience - 2;
    offer.status = 'rejected';
    say(offer, {
      date: c.date,
      from: 'club',
      kind: 'reject',
      text: `Emprestar ${player.name} nessas condições não faz sentido para nós. Pague o salário e uma taxa justa.`,
    });
    return;
  }
  const wagePct = Math.max(terms.wagePct, ask.wagePct);
  const wagePart = (wagePct / 100) * wage * terms.months;
  const needed = Math.max(0, target - wagePart);
  const concession = directorEffect(staffLevel(c, 'director')).concession;
  const fee = roundUp(
    Math.max(offer.fee, needed - Math.max(0, needed - offer.fee) * concession),
    50000,
  );
  const counter: LoanTerms = {
    ...terms,
    wagePct,
    ...(optionLow ? { option: ask.option } : {}),
    ...(obligationLow ? { obligation: { ...terms.obligation!, fee: ask.obligation } } : {}),
  };
  offer.ask = Math.round(fee + wagePart);
  offer.patience = patience - 1;
  offer.status = 'countered';
  offer.counter = { fee, loan: counter };
  say(offer, {
    date: c.date,
    from: 'club',
    kind: 'counter',
    fee,
    loan: counter,
    text:
      offer.patience <= 1
        ? `Estas são as nossas condições finais para emprestar ${player.name}.`
        : optionLow || obligationLow
          ? `Aceitamos conversar, mas o valor de compra previsto está baixo para ${player.name}.`
          : pick(seed, [
              `Emprestamos ${player.name}, mas nestas condições.`,
              'O salário e a taxa precisam melhorar. Nossa contraproposta:',
            ]),
  });
}

function loanAgentDecision(c: Career, world: World, offer: Offer) {
  const player = world.players.find((p) => p.id === offer.playerId)!;
  const agent = agentOf(player.id);
  const need = loanBonusAsk(c, player);
  const patience = offer.patience ?? startPatience(c);
  if (loanHappy(c, world, player) || (offer.bonus ?? 0) >= need * 0.995) {
    say(offer, {
      date: c.date,
      from: 'agent',
      kind: 'accept',
      bonus: offer.bonus,
      text: `${player.name} topa o empréstimo. Comissão de ${agent.commission}% sobre a taxa, como de praxe.`,
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
      text: `${player.name} prefere disputar posição onde está. Encerramos.`,
    });
    return;
  }
  offer.patience = patience - 1;
  offer.status = 'countered';
  offer.counter = { bonus: need };
  say(offer, {
    date: c.date,
    from: 'agent',
    kind: 'counter',
    bonus: need,
    text: `${player.name} não tem garantia de minutos aí. Só aceita sair emprestado com luvas de ${money(need)}.`,
  });
}

function completeLoan(c: Career, world: World, offer: Offer) {
  if (!transferWindow(c.date)) throw new Error('Empréstimo fora da janela.');
  const s = c.players[offer.playerId];
  if (s.clubId !== offer.toClubId || s.loanFrom) throw new Error('O atleta já mudou de clube.');
  checkPlayerSalaryBudget(c, (s.wage * offer.loan!.wagePct) / 100, offer.playerId);
  if (addMonths(c.date, offer.loan!.months) > s.contractEnd)
    throw new Error('O empréstimo ultrapassaria o contrato atual do atleta.');
  checkOutgoing(c, world, offer.playerId, offer.toClubId);
  const f = c.finances[c.clubId];
  const bonus = offer.bonus || 0;
  const commission = commissionOf(offer.playerId, offer.fee);
  if (f.cash < offer.fee + bonus + commission || f.transferBudget < offer.fee)
    throw new Error('O clube não tem mais orçamento suficiente.');
  f.cash -= offer.fee + bonus + commission;
  f.transferBudget -= offer.fee;
  f.history.push({
    date: c.date,
    income: 0,
    expenses: offer.fee + bonus + commission,
    balance: f.cash,
  });
  const owner = c.finances[offer.toClubId];
  if (owner && offer.fee) {
    owner.cash += offer.fee;
    owner.history.push({ date: c.date, income: offer.fee, expenses: 0, balance: owner.cash });
  }
  addLedger(c, {
    playerId: offer.playerId,
    kind: 'emprestimo',
    from: c.clubId,
    to: offer.toClubId,
    amount: offer.fee,
  });
  addLedger(c, {
    playerId: offer.playerId,
    kind: 'comissao',
    from: c.clubId,
    to: agentOf(offer.playerId).name,
    amount: commission,
  });
  const terms = offer.loan!;
  s.loanFrom = offer.toClubId;
  s.loanUntil = addMonths(c.date, terms.months);
  s.clubId = c.clubId;
  s.loan = { ...terms, fee: offer.fee, games: 0, ratingSum: 0 };
  s.morale = clamp(s.morale + 4);
  delete s.listed;
  offer.status = 'completed';
  reconcileSquad(c, world);
}

/**
 * Empresta um atleta do elenco a um clube da IA. O destino avalia na hora se a taxa,
 * o salário e a opção/obrigação cabem no que o atleta vale para ele.
 */
export function loanOutPlayer(
  career: Career,
  world: World,
  playerId: string,
  destinationId: string,
  req: LoanRequest = { months: 6, fee: 0, wagePct: 100 },
): Career {
  const c = structuredClone(career);
  const player = world.players.find((p) => p.id === playerId);
  const state = c.players[playerId];
  const dest = c.finances[destinationId];
  if (
    !player ||
    state?.clubId !== c.clubId ||
    state.loanFrom ||
    destinationId === c.clubId ||
    !dest
  )
    throw new Error('O jogador ou clube de destino não está disponível.');
  validateLoanRequest(req);
  if (addMonths(c.date, req.months) > state.contractEnd)
    throw new Error('O empréstimo não pode ultrapassar o contrato do atleta com o clube.');
  checkOutgoing(c, world, playerId, c.clubId);
  const terms = normalizeLoan(req);
  const fee = Math.max(0, Math.round(req.fee || 0));
  const name = clubName(world, destinationId);
  const ask = loanAsk(c, world, player, terms.months);
  const wagePart = (terms.wagePct / 100) * state.wage * terms.months;
  const limit = (ask.fee + state.wage * terms.months) * 1.15;
  if (fee + wagePart > limit)
    throw new Error(
      `O ${name} recusou: taxa e salário acima do que ${player.name} vale emprestado (taxa máx. ~${money(Math.max(0, roundUp(limit - wagePart, 50000)))}).`,
    );
  if (terms.obligation && terms.obligation.fee > ask.option * 1.05)
    throw new Error(
      `O ${name} recusou a obrigação de compra: aceita no máximo ~${money(roundUp(ask.option * 1.05, 100000))}.`,
    );
  if (dest.cash < fee || dest.transferBudget < fee)
    throw new Error(`O ${name} não tem orçamento para pagar a taxa.`);
  if (!transferWindow(c.date)) {
    if (c.offers.some((o) => o.playerId === playerId && o.awaitingWindow))
      throw new Error(`${player.name} já tem uma saída acertada para a próxima janela.`);
    const offer: Offer = {
      id: `outloan-${hash(`${c.id}:${playerId}:${c.date}`)}`,
      playerId,
      fromClubId: destinationId,
      toClubId: c.clubId,
      fee,
      wage: state.wage,
      date: c.date,
      responseDate: c.date,
      status: 'accepted',
      incoming: true,
      outLoan: true,
      minimum: 0,
      loan: terms,
      messages: [],
    };
    c.offers.push(offer);
    deferToWindow(c, world, offer);
    return c;
  }
  dest.cash -= fee;
  dest.transferBudget -= fee;
  dest.history.push({ date: c.date, income: 0, expenses: fee, balance: dest.cash });
  const f = c.finances[c.clubId];
  if (fee) {
    f.cash += fee;
    f.history.push({ date: c.date, income: fee, expenses: 0, balance: f.cash });
  }
  addLedger(c, { playerId, kind: 'emprestimo', from: destinationId, to: c.clubId, amount: fee });
  state.loanFrom = c.clubId;
  state.loanUntil = addMonths(c.date, terms.months);
  state.clubId = destinationId;
  state.loan = { ...terms, fee, games: 0, ratingSum: 0 };
  delete state.listed;
  for (const role of Object.keys(c.roles)) if (c.roles[role] === playerId) delete c.roles[role];
  reconcileSquad(c, world);
  return c;
}

/** Compra definitiva por opção ou obrigação (fora da janela: já estava no contrato). */
function buyOut(c: Career, world: World, playerId: string, from: string, to: string, fee: number) {
  const s = c.players[playerId];
  const buyer = c.finances[to];
  if (buyer) {
    buyer.cash -= fee;
    buyer.transferBudget = Math.max(0, buyer.transferBudget - fee);
    buyer.history.push({ date: c.date, income: 0, expenses: fee, balance: buyer.cash });
  }
  s.clubId = from;
  const { net } = settleFee(c, world, { playerId, from, to, fee, budgetShare: 0.6 });
  if (to === c.clubId)
    addLedger(c, { playerId, kind: 'opcao', from: c.clubId, to: from, amount: fee });
  if (from === c.clubId) {
    c.sales += net;
    addLedger(c, { playerId, kind: 'opcao', from: to, to: c.clubId, amount: net });
  }
  s.clubId = to;
  const minEnd = `${Number(c.date.slice(0, 4)) + 2}-12-31`;
  if (s.contractEnd < minEnd) s.contractEnd = `${Number(c.date.slice(0, 4)) + 3}-12-31`;
  delete s.listed;
  recordMove(c, world, playerId, from, to, fee, isForeign(to) ? 'exterior' : 'compra');
}

/** Fim do empréstimo: obrigação cumprida, decisão da IA sobre a opção ou retorno ao dono. */
export function endLoan(c: Career, world: World, playerId: string) {
  const s = c.players[playerId];
  if (!s?.loanFrom) return;
  const name = world.players.find((p) => p.id === playerId)?.name ?? 'O atleta';
  const deal = s.loan;
  const owner = s.loanFrom;
  const borrower = s.clubId;
  delete s.loan;
  delete s.loanFrom;
  delete s.loanUntil;
  if (deal && borrower && borrower !== owner) {
    if (deal.obligation && deal.games >= deal.obligation.games) {
      buyOut(c, world, playerId, owner, borrower, deal.obligation.fee);
      if (owner === c.clubId || borrower === c.clubId)
        inbox(c, {
          kind: 'market',
          from: 'Diretor de futebol',
          title: `Obrigação de compra: ${name}`,
          body: `${name} fez ${deal.games} jogos (meta: ${deal.obligation.games}) e a compra se tornou obrigatória: ${money(deal.obligation.fee)} do ${clubName(world, borrower)} ao ${clubName(world, owner)}.`,
          playerId,
          resolved: true,
        });
      return;
    }
    if (deal.option !== undefined) {
      if (borrower === c.clubId) {
        s.clubId = owner;
        c.living.loanOptions = c.living.loanOptions.filter((o) => o.playerId !== playerId);
        const expires = addDays(c.date, 10);
        c.living.loanOptions.push({ playerId, clubId: owner, fee: deal.option, expires });
        inbox(c, {
          kind: 'market',
          from: 'Diretor de futebol',
          title: `Opção de compra: ${name}`,
          body: `O empréstimo terminou e ${name} voltou ao ${clubName(world, owner)}. Podemos exercer a opção de ${money(deal.option)} até ${expires.split('-').reverse().join('/')} em Transferências › Contas.`,
          playerId,
          resolved: true,
        });
        return;
      }
      // A IA decide pela nota média e pela quantidade de jogos no empréstimo.
      const avg = deal.games ? deal.ratingSum / deal.games : 0;
      const fin = c.finances[borrower];
      const exercise = deal.games >= 8 && avg >= 6.6 && Boolean(fin && fin.cash >= deal.option);
      if (exercise) {
        buyOut(c, world, playerId, owner, borrower, deal.option);
        if (owner === c.clubId)
          inbox(c, {
            kind: 'market',
            from: clubName(world, borrower),
            title: `Opção exercida: ${name}`,
            body: `Com ${deal.games} jogos e nota média ${avg.toFixed(1).replace('.', ',')}, o ${clubName(world, borrower)} exerceu a opção de compra de ${money(deal.option)}.`,
            playerId,
            resolved: true,
          });
        return;
      }
      if (owner === c.clubId)
        inbox(c, {
          kind: 'market',
          from: clubName(world, borrower),
          title: `Opção não exercida: ${name}`,
          body: `O ${clubName(world, borrower)} não exerceu a opção de ${money(deal.option)} (${deal.games} jogos, nota média ${avg ? avg.toFixed(1).replace('.', ',') : '—'}). ${name} está de volta.`,
          playerId,
          resolved: true,
        });
    }
  }
  s.clubId = owner;
  if (owner === c.clubId)
    inbox(c, {
      kind: 'market',
      from: 'Diretor de futebol',
      title: `${name} retornou de empréstimo`,
      body: 'O vínculo temporário terminou e o jogador está novamente disponível no elenco.',
      playerId,
      resolved: true,
    });
}

/** Opção de compra do usuário: durante o empréstimo ou até 10 dias depois do fim. */
export function loanOptionFor(c: Career, playerId: string) {
  const s = c.players[playerId];
  if (s?.loanFrom && s.clubId === c.clubId && s.loan?.option !== undefined)
    return { fee: s.loan.option, owner: s.loanFrom, expires: s.loanUntil };
  const pending = c.living.loanOptions.find(
    (o) => o.playerId === playerId && o.expires >= c.date && s?.clubId === o.clubId,
  );
  return pending ? { fee: pending.fee, owner: pending.clubId, expires: pending.expires } : null;
}

export function exerciseLoanOption(career: Career, world: World, playerId: string): Career {
  const c = structuredClone(career);
  const option = loanOptionFor(c, playerId);
  if (!option) throw new Error('Não há opção de compra disponível para este atleta.');
  if (c.finances[c.clubId].cash < option.fee)
    throw new Error('Caixa insuficiente para exercer a opção de compra.');
  const s = c.players[playerId];
  delete s.loan;
  delete s.loanFrom;
  delete s.loanUntil;
  buyOut(c, world, playerId, option.owner, c.clubId, option.fee);
  c.living.loanOptions = c.living.loanOptions.filter((o) => o.playerId !== playerId);
  reconcileSquad(c, world);
  return c;
}

/** Remove opções vencidas (sem travar o avanço). */
export function expireLoanOptions(c: Career, world: World) {
  for (const o of c.living.loanOptions.filter((o) => o.expires < c.date)) {
    const name = world.players.find((p) => p.id === o.playerId)?.name ?? 'atleta';
    inbox(c, {
      kind: 'market',
      from: 'Diretor de futebol',
      title: `Opção expirada: ${name}`,
      body: `O prazo para exercer a opção de compra de ${name} (${money(o.fee)}) terminou.`,
      playerId: o.playerId,
      resolved: true,
    });
  }
  c.living.loanOptions = c.living.loanOptions.filter((o) => o.expires >= c.date);
}

export function signPreContract(
  career: Career,
  world: World,
  playerId: string,
  wage: number,
): Career {
  const c = structuredClone(career);
  const player = world.players.find((p) => p.id === playerId);
  const state = c.players[playerId];
  if (!player || !state?.clubId || state.clubId === c.clubId)
    throw new Error('Jogador indisponível para pré-contrato.');
  if (state.contractEnd <= c.date || state.contractEnd > addMonths(c.date, 6))
    throw new Error('O pré-contrato só pode ser assinado nos últimos seis meses do vínculo.');
  if (wage < requiredWage(c, player)) throw new Error('O salário está abaixo do pedido do atleta.');
  if (c.preContracts.some((contract) => contract.playerId === playerId && !contract.joined))
    throw new Error('Já existe um pré-contrato para este jogador.');
  checkPlayerSalaryBudget(c, wage);
  c.preContracts.push({ playerId, clubId: c.clubId, wage, joined: false });
  c.messages.unshift({
    id: `precontract-${hash(`${c.id}:${playerId}:${c.date}`)}`,
    date: c.date,
    from: `Agente de ${player.name}`,
    title: 'Pré-contrato assinado',
    body: `${player.name} chegará sem taxa de transferência quando terminar seu vínculo atual.`,
    kind: 'market',
    important: false,
    read: false,
    resolved: true,
    playerId,
  });
  return c;
}

export function exerciseReleaseClause(career: Career, world: World, playerId: string): Career {
  const c = structuredClone(career);
  const player = world.players.find((p) => p.id === playerId);
  const state = c.players[playerId];
  if (!player || !state?.clubId || state.clubId === c.clubId || !state.clause)
    throw new Error('Este jogador não tem multa rescisória disponível.');
  const wage = requiredWage(c, player);
  const offer: Offer = {
    id: `clause-${hash(`${c.id}:${playerId}:${c.date}`)}`,
    playerId,
    fromClubId: c.clubId,
    toClubId: state.clubId,
    fee: state.clause,
    wage,
    years: 3,
    date: c.date,
    responseDate: c.date,
    status: 'accepted',
    incoming: false,
    minimum: state.clause,
    stage: 'player',
    messages: [],
  };
  checkBudget(c, offer.fee, 0);
  if (!transferWindow(c.date)) {
    c.offers.push(offer);
    deferToWindow(c, world, offer);
    return c;
  }
  completeTransfer(c, world, offer);
  c.offers.push({ ...offer, status: 'completed' });
  return c;
}

export const renewalOptions = [6, 12, 24, 36, 48, 60] as const;

/** Novo salário, luvas e término para estender o contrato por `months` meses. */
/** Coloca (ou tira, com preço null) o atleta na lista de venda; os clubes passam a fazer propostas. */
export function listForSale(
  career: Career,
  world: World,
  playerId: string,
  price: number | null,
): Career {
  const c = structuredClone(career);
  const state = c.players[playerId];
  if (!state || state.clubId !== c.clubId || state.loanFrom)
    throw new Error('Só atletas do seu elenco podem ser colocados à venda.');
  if (price === null) delete state.listed;
  else {
    if (!Number.isFinite(price) || price <= 0) throw new Error('Defina um preço válido.');
    state.listed = roundUp(price, 50000);
    state.morale = clamp(state.morale - 4);
  }
  return c;
}

/** Multa para rescindir: metade dos salários restantes do contrato (mínimo de três salários). */
export function releaseCost(c: Career, playerId: string) {
  const state = c.players[playerId];
  const months = Math.max(
    0,
    (Number(state.contractEnd.slice(0, 4)) - Number(c.date.slice(0, 4))) * 12 +
      Number(state.contractEnd.slice(5, 7)) -
      Number(c.date.slice(5, 7)),
  );
  return Math.round(state.wage * Math.max(3, months * 0.5));
}

export function releasePlayer(career: Career, world: World, playerId: string): Career {
  const c = structuredClone(career);
  const state = c.players[playerId];
  if (!state || state.clubId !== c.clubId || state.loanFrom)
    throw new Error('Só atletas do seu elenco podem ser dispensados.');
  checkOutgoing(c, world, playerId, c.clubId);
  const cost = releaseCost(c, playerId);
  const finance = c.finances[c.clubId];
  if (finance.cash < cost) throw new Error('Caixa insuficiente para pagar a rescisão.');
  if (c.lineup.includes(playerId)) {
    const remaining = squad(c, world).filter(
      (p) =>
        p.id !== playerId && c.players[p.id].injuryDays === 0 && c.players[p.id].suspension === 0,
    );
    if (remaining.length < 11)
      throw new Error('A dispensa deixaria o clube sem onze atletas disponíveis.');
  }
  finance.cash -= cost;
  finance.history.push({ date: c.date, income: 0, expenses: cost, balance: finance.cash });
  state.clubId = null;
  delete state.listed;
  delete state.clause;
  for (const offer of c.offers.filter(
    (o) => o.playerId === playerId && (o.status === 'pending' || o.status === 'countered'),
  ))
    expireThread(offer, c.date, 'O atleta foi dispensado. Negociação encerrada.');
  for (const role of Object.keys(c.roles)) if (c.roles[role] === playerId) delete c.roles[role];
  reconcileSquad(c, world);
  return c;
}

export function renewalTerms(c: Career, playerId: string, months = 36) {
  const p = c.players[playerId];
  // Empresário influente endurece a renovação (salário e luvas mais altos).
  const agent = (agentOf(playerId).influence - 1) * 0.025;
  const increase =
    (c.difficulty === 'Profissional' ? 1.18 : 1.1) - (months < 12 ? 0.05 : 0) + agent;
  const wage = Math.round(p.wage * increase);
  const bonus = Math.round(wage * Math.max(0.5, (2 * months) / 36) * (1 + agent * 2));
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
  checkPlayerSalaryBudget(c, wage - c.players[playerId].wage);
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
