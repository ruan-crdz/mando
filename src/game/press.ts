import { hash } from './random';
import { matchRatings, manOfTheMatch } from './matchRatings';
import { clubById, findPlayer } from './npc';
import { currentLeague, standings } from './engine';
import { competitionName } from './calendar';
import { type Career, type World } from './types';

export type PressEffect = {
  /** Variação na confiança da diretoria. */
  confidence?: number;
  /** Variação no moral de um atleta. */
  player?: number;
  /** Variação no moral de todo o elenco. */
  squad?: number;
};
export type PressAnswer = { text: string; tone: string; effect: PressEffect };
export type PressQuestion = {
  id: string;
  reporter: string;
  outlet: string;
  text: string;
  playerId?: string;
  answers: PressAnswer[];
};
export type PressSession = {
  fixtureId: string;
  headline: string;
  questions: PressQuestion[];
};

const reporters = [
  ['Marina Lopes', 'Rede Bola'],
  ['Caio Ferraz', 'Rádio Arquibancada'],
  ['Júlia Andrade', 'Portal Lance Livre'],
  ['Rafael Teles', 'TV Esporte Total'],
  ['Bruna Siqueira', 'Jornal da Torcida'],
  ['Diego Paiva', 'Canal Resenha FC'],
];

/** Coletiva pós-jogo: três perguntas ligadas ao que aconteceu em campo e na temporada. */
export function buildPress(career: Career, world: World): PressSession | null {
  const match = career.activeMatch;
  if (!match) return null;
  const fixture = career.fixtures.find((f) => f.id === match.fixtureId);
  if (!fixture) return null;
  const home = fixture.homeId === career.clubId;
  const ours = home ? match.homeGoals : match.awayGoals;
  const theirs = home ? match.awayGoals : match.homeGoals;
  const rival = clubById(world, home ? fixture.awayId : fixture.homeId).name;
  const club = clubById(world, career.clubId).name;
  const seed = hash(`${career.id}:${match.fixtureId}:press`);
  const pick = (i: number) => reporters[(seed + i * 7) % reporters.length];
  const result = ours > theirs ? 'win' : ours < theirs ? 'loss' : 'draw';
  const diff = Math.abs(ours - theirs);
  const score = `${ours} a ${theirs}`;
  const questions: PressQuestion[] = [];

  const [r1, o1] = pick(0);
  questions.push({
    id: 'result',
    reporter: r1,
    outlet: o1,
    text:
      result === 'win'
        ? diff >= 3
          ? `Goleada de ${score} contra o ${rival}. O ${club} chegou ao nível que você queria?`
          : `Vitória por ${score} sobre o ${rival}. O que decidiu o jogo hoje?`
        : result === 'draw'
          ? `Empate em ${score} com o ${rival}. Ficou um gosto amargo ou foi um bom ponto?`
          : diff >= 3
            ? `Derrota pesada, ${score} para o ${rival}. A torcida já pede explicações. O que aconteceu?`
            : `Derrota por ${score} para o ${rival}. Onde o time errou?`,
    answers:
      result === 'win'
        ? [
            {
              text: 'Mérito todo dos jogadores. Eles executaram o plano à risca.',
              tone: 'Humilde',
              effect: { squad: 4, confidence: 1 },
            },
            {
              text: 'Foi o plano tático que venceu. Preparamos cada detalhe dessa partida.',
              tone: 'Confiante',
              effect: { confidence: 3, squad: -1 },
            },
            {
              text: 'Ainda não estou satisfeito. Dá para jogar muito mais.',
              tone: 'Exigente',
              effect: { confidence: 2, squad: -2 },
            },
          ]
        : result === 'draw'
          ? [
              {
                text: 'Ponto importante fora de qualquer contexto. O grupo lutou até o fim.',
                tone: 'Positivo',
                effect: { squad: 3 },
              },
              {
                text: 'Perdemos dois pontos. Não aceito esse tipo de desatenção.',
                tone: 'Duro',
                effect: { confidence: 2, squad: -3 },
              },
              {
                text: 'O empate foi justo. Vamos corrigir os detalhes no treino.',
                tone: 'Equilibrado',
                effect: { confidence: 1, squad: 1 },
              },
            ]
          : [
              {
                text: 'A responsabilidade é minha. Eu errei na preparação, não os jogadores.',
                tone: 'Protetor',
                effect: { squad: 5, confidence: -3 },
              },
              {
                text: 'Faltou atitude. Quem não estiver comprometido vai perder espaço.',
                tone: 'Cobrança',
                effect: { squad: -5, confidence: 3 },
              },
              {
                text: 'Futebol tem dias assim. Vamos levantar a cabeça e virar a página.',
                tone: 'Sereno',
                effect: { squad: 1 },
              },
            ],
  });

  const ratings = matchRatings(career, world, match).filter((r) => r.clubId === career.clubId);
  const mvp = match.mvp || manOfTheMatch(matchRatings(career, world, match), match, fixture.homeId)?.id;
  const star = ratings.find((r) => r.id === mvp) || [...ratings].sort((a, b) => b.rating - a.rating)[0];
  const worst = [...ratings].filter((r) => r.minutes >= 45).sort((a, b) => a.rating - b.rating)[0];
  const [r2, o2] = pick(1);
  if (worst && worst.rating < 6.2 && (result !== 'win' || !star)) {
    const name = findPlayer(world, worst.id)?.name || 'o atleta';
    questions.push({
      id: 'player',
      reporter: r2,
      outlet: o2,
      playerId: worst.id,
      text: `${name} teve nota ${worst.rating.toFixed(1)} e foi muito criticado nas redes. Ele segue com sua confiança?`,
      answers: [
        {
          text: `Total. ${name} é peça importante e vai dar a volta por cima.`,
          tone: 'Apoio',
          effect: { player: 10 },
        },
        {
          text: 'Ninguém tem lugar garantido. Quem render mais, joga.',
          tone: 'Firme',
          effect: { player: -8, confidence: 2, squad: 1 },
        },
        {
          text: 'Não vou falar de individualidades. Ganhamos e perdemos juntos.',
          tone: 'Neutro',
          effect: { player: 2 },
        },
      ],
    });
  } else if (star) {
    const name = findPlayer(world, star.id)?.name || 'o atleta';
    const highlight = star.goals
      ? `${star.goals} gol${star.goals > 1 ? 's' : ''}`
      : `nota ${star.rating.toFixed(1)}`;
    questions.push({
      id: 'player',
      reporter: r2,
      outlet: o2,
      playerId: star.id,
      text: `${name} foi o destaque, com ${highlight}. Ele já merece uma chance na seleção?`,
      answers: [
        {
          text: `Sem dúvida. ${name} é um dos melhores do país na posição.`,
          tone: 'Elogio',
          effect: { player: 10, squad: -1 },
        },
        {
          text: 'Ele jogou bem, mas precisa manter isso por muitos jogos.',
          tone: 'Cauteloso',
          effect: { player: 3, confidence: 1 },
        },
        {
          text: 'O destaque foi o coletivo. Sem o grupo ninguém brilha.',
          tone: 'Coletivo',
          effect: { player: -2, squad: 3 },
        },
      ],
    });
  }

  const [r3, o3] = pick(2);
  const league = currentLeague(career, world);
  let position: number;
  try {
    position = standings(career, world, league).findIndex((r) => r.clubId === career.clubId) + 1;
  } catch {
    position = 0;
  }
  const cup = fixture.cup ? competitionName(fixture.cup) : '';
  questions.push({
    id: 'season',
    reporter: r3,
    outlet: o3,
    text: cup
      ? `Pensando na ${cup}: o ${club} entra para ser campeão?`
      : position && position <= 4
        ? `O ${club} está em ${position}º na Série ${league}. Dá para falar em título?`
        : position >= 15
          ? `O ${club} está em ${position}º, perto da zona de rebaixamento. Você teme pelo cargo?`
          : `Na ${position || '–'}ª posição da Série ${league}, qual é a meta real da temporada?`,
    answers: [
      {
        text: 'Viemos para ganhar tudo. Esse grupo tem tamanho para isso.',
        tone: 'Ambicioso',
        effect: { confidence: position >= 12 && !cup ? -2 : 3, squad: 2 },
      },
      {
        text: 'Jogo a jogo. Não adianta olhar a tabela agora.',
        tone: 'Pé no chão',
        effect: { confidence: 1 },
      },
      {
        text: 'Precisamos de reforços para brigar lá em cima. A diretoria sabe disso.',
        tone: 'Pressão',
        effect: { confidence: -4, squad: -1 },
      },
    ],
  });

  return {
    fixtureId: match.fixtureId,
    headline: `Coletiva · ${club} ${home ? match.homeGoals : match.awayGoals} x ${home ? match.awayGoals : match.homeGoals} ${rival}`,
    questions,
  };
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Aplica as respostas: diretoria, moral do atleta citado e do elenco, e vira notícia. */
export function applyPress(
  career: Career,
  world: World,
  session: PressSession,
  answers: Record<string, number>,
): Career {
  let confidence = career.confidence;
  const players = { ...career.players };
  const squadIds = Object.keys(players).filter((id) => players[id].clubId === career.clubId);
  const quotes: string[] = [];
  for (const q of session.questions) {
    const answer = q.answers[answers[q.id] ?? -1];
    if (!answer) continue;
    quotes.push(`"${answer.text}"`);
    const { effect } = answer;
    confidence += effect.confidence || 0;
    if (effect.squad)
      for (const id of squadIds)
        players[id] = { ...players[id], morale: clamp(players[id].morale + effect.squad) };
    if (effect.player && q.playerId && players[q.playerId])
      players[q.playerId] = {
        ...players[q.playerId],
        morale: clamp(players[q.playerId].morale + effect.player),
      };
  }
  if (!quotes.length) return career;
  const managerName = `${career.manager.firstName} ${career.manager.lastName}`;
  const club = clubById(world, career.clubId).name;
  const title = `${managerName} na coletiva: ${quotes[0].slice(1, 60).replace(/[".]+$/, '')}…`;
  return {
    ...career,
    confidence: clamp(confidence),
    players,
    messages: [
      {
        id: `msg-${hash(`${career.id}:${session.fixtureId}:press`)}`,
        date: career.date,
        from: 'Imprensa',
        title,
        body: `Após o jogo, o técnico do ${club} falou aos jornalistas. ${quotes.join(' ')}`,
        kind: 'news',
        important: false,
        read: false,
        resolved: true,
      },
      ...career.messages,
    ],
  };
}
