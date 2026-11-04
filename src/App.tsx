import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Gamepad2,
  LoaderCircle,
  CalendarClock,
  Lock,
  Music,
  Radio,
  SkipForward,
  Square,
  Trophy,
  Vibrate,
  VibrateOff,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { type User } from '@supabase/supabase-js';
import { z } from 'zod';
import { GamepadProvider, useControllerActions, useGamepad } from './controller/GamepadProvider';
import { ControllerButtonHint } from './controller/ControllerButtonHint';
import { Badge, dateLabel, Modal, money } from './components/ui';
import { MainMenu } from './screens/MainMenu';
import { CreateManager } from './screens/CreateManager';
import { CareerCentral } from './screens/CareerCentral';
import { Squad } from './screens/Squad';
import { Transfers } from './screens/Transfers';
import { Office } from './screens/Office';
import { Season } from './screens/Season';
import { MatchScreen } from './screens/Match';
import { createDemoWorld } from './game/world';
import { loadWorld2026 } from './game/realWorld';
import {
  advanceDay,
  startNextSeason,
  createCareer,
  finishMatch,
  respondMessage,
  applyStaffPlan,
  advanceStep,
  validateCareerForWorld,
  acceptJobOffer,
  hireScout,
  fireScout,
  signProspect,
  playerConversation,
  setDevelopmentPlan,
  setReleaseClause,
  setPlayerRole,
} from './game/engine';
import { bestLineup, beginMatch, resolveMoment, substitute } from './game/matches';
import { careerWorld } from './game/live';
import { nextFixture } from './game/calendar';
import {
  answerIncoming,
  counterIncoming,
  createOffer,
  renewContract,
  respondCounter,
  arrangeLoan,
  signPreContract,
  exerciseReleaseClause,
  loanOutPlayer,
  listForSale,
  releasePlayer,
} from './game/transfers';
import { type Career, type Player, type World } from './game/types';
import { listLocal, removeLocal, saveLocal, type SavedCareer } from './services/storage';
import { ensureSession, requestPortrait, saveCloud, supabase } from './services/supabase';
import { registerSW } from 'virtual:pwa-register';
import {
  musicEnabled,
  setMusicSuspended,
  startMusic,
  subscribeMusic,
  toggleMusic,
} from './audio/music';
import { startCrowd, stopCrowd } from './audio/crowd';
import { applyPress, buildPress, buildPreMatchPress, type PressSession } from './game/press';
import { upgradeAnalyst } from './game/living';
import { MatchOdds } from './components/LivingPanels';
import { playVoice, skipVoice, stopVoice, useVoice } from './components/voice';
import { achievements, unlockAchievements, type Achievement } from './game/achievements';

const tabs = ['CENTRAL', 'TIME', 'TRANSFERÊNCIAS', 'ESCRITÓRIO', 'TEMPORADA'];
type Popup = 'world' | 'pause' | 'prematch' | 'achievements' | 'prefs' | null;
type AdvanceMode = Career['prefs']['advance'];
const advanceModes: { id: AdvanceMode; title: string; text: string }[] = [
  {
    id: 'day',
    title: 'Um dia por vez',
    text: 'Cada toque avança só um dia. Controle total do calendário.',
  },
  {
    id: 'event',
    title: 'Parar em eventos',
    text: 'Avança sozinho e para em qualquer mensagem, decisão ou dia de jogo.',
  },
  {
    id: 'auto',
    title: 'Nunca parar',
    text: 'Simula os jogos, responde decisões com apoio e só para no fim da temporada.',
  },
];
const stopNotes: Record<string, string> = {
  match: 'Dia de jogo! O avanço parou.',
  decision: 'Uma decisão espera por você no escritório.',
  message: 'Nova mensagem no escritório.',
  season: 'Temporada encerrada.',
  sacked: 'Você foi demitido. Escolha um novo clube na Diretoria.',
};

function Game() {
  const controller = useGamepad();
  const [screen, setScreen] = useState<'menu' | 'create' | 'career'>('menu');
  const [world, setWorld] = useState<World | null>(null);
  const [career, setCareer] = useState<Career | null>(null);
  // Mundo da carreira: snapshot imutável + divisões atuais e atletas da base.
  const live = useMemo(
    () => (world && career ? careerWorld(world, career) : world),
    [world, career],
  );
  const [saves, setSaves] = useState<SavedCareer[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState(0);
  const [popup, setPopup] = useState<Popup>(null);
  const [running, setRunning] = useState(false);
  const [played, setPlayed] = useState(0);
  const [hapticNote, setHapticNote] = useState('');
  const [press, setPress] = useState<PressSession | null>(null);
  const [pressStep, setPressStep] = useState(0);
  const [pressAnswers, setPressAnswers] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState<SavedCareer | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const cloudQueue = useRef<Promise<unknown>>(Promise.resolve());
  const revisions = useRef(new Map<string, number>());
  const lastSaved = useRef<Career | null>(null);
  const lock = useRef(false);
  const { rumble } = controller;
  const music = useSyncExternalStore(subscribeMusic, musicEnabled, musicEnabled);
  const voice = useVoice();
  const [unlocked, setUnlocked] = useState<Achievement[]>([]);
  useEffect(() => {
    if (controller.input === 'xbox' || controller.input === 'playstation') startMusic();
  }, [controller.input]);
  // Em jogo: a trilha some e entra o som do estádio.
  const matchOn = screen === 'career' && Boolean(career?.activeMatch);
  useEffect(() => {
    if (!matchOn) return;
    setMusicSuspended(true);
    if (music) startCrowd();
    return () => {
      stopCrowd();
      setMusicSuspended(false);
    };
  }, [matchOn, music]);
  useEffect(() => {
    if (!career) return;
    const result = unlockAchievements(career);
    if (!result.unlocked.length) return;
    setCareer(result.career);
    setUnlocked((list) => [...list, ...result.unlocked]);
    rumble('goal');
  }, [career, rumble]);
  useEffect(() => {
    if (!unlocked.length) return;
    const timer = window.setTimeout(() => setUnlocked((list) => list.slice(1)), 4200);
    return () => window.clearTimeout(timer);
  }, [unlocked]);
  // Recado ouvido na caixa postal conta como lido, mesmo fora do Escritório.
  const heard = voice.current?.id;
  useEffect(() => {
    if (!heard) return;
    setCareer((c) =>
      c && c.messages.some((m) => m.id === heard && !m.read)
        ? { ...c, messages: c.messages.map((m) => (m.id === heard ? { ...m, read: true } : m)) }
        : c,
    );
  }, [heard]);
  const fail = useCallback(
    (message: string) => {
      setError(message);
      setNotice('');
      rumble('error');
    },
    [rumble],
  );
  // Avisos somem sozinhos: no controle não faz sentido navegar até um botão de fechar.
  useEffect(() => {
    if (!error && !notice) return;
    const timer = window.setTimeout(
      () => {
        setError('');
        setNotice('');
      },
      error ? 4000 : 2600,
    );
    return () => window.clearTimeout(timer);
  }, [error, notice]);
  const run = useCallback(
    (operation: () => Promise<void>) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError('');
      setNotice('');
      void operation()
        .catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)))
        .finally(() => {
          lock.current = false;
          setBusy(false);
        });
    },
    [fail],
  );
  const act = useCallback(
    (operation: () => void) => {
      try {
        setError('');
        operation();
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
    },
    [fail],
  );
  useEffect(() => {
    void listLocal()
      .then((records) => {
        setSaves(records);
        records.forEach((s) => revisions.current.set(s.career.id, s.cloudRevision));
      })
      .catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
    if (!supabase) return;
    // Guest account is created silently: cloud backup and AI never ask the player to log in.
    void ensureSession()
      .then(() => supabase?.auth.getSession())
      .then((result) => setUser(result?.data.session?.user || null))
      .catch((e: unknown) => console.warn('guest_session_unavailable', e));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user || null),
    );
    return () => data.subscription.unsubscribe();
  }, [fail]);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    const install = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    window.addEventListener('beforeinstallprompt', install);
    if (import.meta.env.PROD)
      updateSW.current = registerSW({
        onNeedRefresh: () => setUpdateReady(true),
        onRegisterError: (e: unknown) => fail(`Modo offline indisponível: ${String(e)}`),
      });
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      window.removeEventListener('beforeinstallprompt', install);
    };
  }, [fail]);
  useEffect(() => {
    if (!career || !world) return;
    setSaveState('saving');
    const current = career;
    queue.current = queue.current
      .then(() => saveLocal(current, world, revisions.current.get(current.id) || 0))
      .then(() => {
        lastSaved.current = current;
        setSaveState('saved');
      })
      .catch((e: unknown) => {
        setSaveState('error');
        fail(`Save local não gravado: ${e instanceof Error ? e.message : String(e)}.`);
      });
  }, [career, world, fail]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (career && lastSaved.current !== career) e.preventDefault();
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [career]);

  const continueCareer = useCallback((record: SavedCareer) => {
    validateCareerForWorld(record.career, record.world);
    revisions.current.set(record.career.id, record.cloudRevision);
    setCareer(record.career);
    setWorld(record.world);
    setScreen('career');
    setPopup(null);
    setTab(0);
  }, []);
  const menu = useCallback(
    () =>
      run(async () => {
        await queue.current;
        if (career && world) await saveLocal(career, world, revisions.current.get(career.id) || 0);
        setSaves(await listLocal());
        stopVoice();
        setScreen('menu');
        setPopup(null);
        setDetail(null);
      }),
    [career, world, run],
  );
  const sync = useCallback(
    (current: Career) => {
      const target = world;
      const task = cloudQueue.current.then(async () => {
        if (!target) throw new Error('Mundo não carregado.');
        await ensureSession();
        await queue.current;
        const revision = await saveCloud(current, revisions.current.get(current.id) || 0);
        revisions.current.set(current.id, revision);
        await saveLocal(current, target, revision);
      });
      cloudQueue.current = task.catch(() => undefined);
      return task;
    },
    [world],
  );
  useEffect(() => {
    if (!career || !user || !z.string().uuid().safeParse(career.worldId).success) return;
    const timer = window.setTimeout(() => {
      sync(career).catch((e: unknown) => console.warn('cloud_backup_failed', e));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [career, user, sync]);
  const switchTab = useCallback(
    (delta: number) => {
      if (screen !== 'career' || career?.activeMatch || popup || detail || busy) return;
      setTab((t) => (t + delta + 5) % 5);
    },
    [screen, career?.activeMatch, popup, detail, busy],
  );
  const advance = useCallback(() => {
    if (!career || !live) return;
    const mode = career.prefs?.advance || 'day';
    if (career.sacked) return setTab(3);
    if (mode === 'day') return act(() => setCareer(advanceDay(career, live)));
    setPlayed(0);
    setRunning(true);
  }, [career, live, act]);
  const stopRunning = useCallback(() => setRunning(false), []);
  const step = useRef({ career, world });
  step.current = { career, world };
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      const { career: current, world: base } = step.current;
      if (!current || !base) return setRunning(false);
      try {
        const mode = current.prefs?.advance === 'auto' ? 'auto' : 'event';
        const result = advanceStep(current, base, mode);
        setCareer(result.career);
        if (result.played) setPlayed((n) => n + 1);
        if (result.stop) {
          setRunning(false);
          setNotice(stopNotes[result.stop]);
          rumble('whistle');
          if (result.stop === 'match') setPopup('prematch');
          else if (
            result.stop === 'decision' ||
            result.stop === 'message' ||
            result.stop === 'sacked'
          )
            setTab(3);
        }
      } catch (e) {
        setRunning(false);
        fail(e instanceof Error ? e.message : String(e));
      }
    }, 110);
    return () => window.clearTimeout(timer);
  }, [running, career, fail, rumble]);
  useControllerActions(
    screen === 'create' || busy
      ? {}
      : {
          back: () => {
            if (running) setRunning(false);
            else if (detail) setDetail(null);
            else if (deleting) setDeleting(null);
            else if (popup) setPopup(null);
            else if (screen === 'career') setPopup('pause');
          },
          previousTab: () => switchTab(-1),
          nextTab: () => switchTab(1),
          secondary: () => {
            if (running) return setRunning(false);
            if (career && screen === 'career' && !career.activeMatch && !popup && !running)
              advance();
          },
          info: () => {
            if (screen === 'career' && !career?.activeMatch && !popup) setTab(3);
          },
          menu: () => {
            if (screen !== 'career') return;
            if (running) return setRunning(false);
            // Na Central, START abre as preferências de avanço; nas demais telas, a pausa.
            if (tab === 0 && !career?.activeMatch && !popup) setPopup('prefs');
            else setPopup((p) => (p === 'pause' || p === 'prefs' ? null : 'pause'));
          },
        },
  );
  const portrait = (manager: Career['manager'], photo?: string) =>
    requestPortrait(
      {
        firstName: manager.firstName,
        lastName: manager.lastName,
        age: manager.age,
        nationality: manager.nationality,
        style: manager.style,
        appearance: manager.appearance,
      },
      photo,
    );
  const club = career && world?.clubs.find((club) => club.id === career.clubId);
  const inMatch = Boolean(career?.activeMatch);
  return (
    <div
      className={`game-shell input-${controller.input} on-${screen}${inMatch ? ' in-match' : ''}`}
    >
      <div className="bg-stage" aria-hidden="true" />
      <header className="app-header">
        <div className="brand" aria-label="Mando">
          <img
            className="brand-logo"
            src={`${import.meta.env.BASE_URL}logo-mando-160.png`}
            alt=""
          />
          <span className="brand-word">MANDO</span>
        </div>
        {screen === 'career' && !inMatch && (
          <nav className="main-nav" aria-label="Áreas do clube">
            <span className="nav-shoulder">
              <ControllerButtonHint action="previousTab" label="" />
            </span>
            {tabs.map((name, i) => (
              <button
                key={name}
                onClick={() => setTab(i)}
                className={tab === i ? 'active' : ''}
                aria-current={tab === i ? 'page' : undefined}
              >
                {name}
                {i === 3 && career!.messages.some((m) => m.important && !m.resolved) && (
                  <b className="nav-dot" />
                )}
              </button>
            ))}
            <span className="nav-shoulder">
              <ControllerButtonHint action="nextTab" label="" />
            </span>
          </nav>
        )}
        {screen === 'career' && career && club && (
          <div className="club-header">
            <Badge club={club} size="small" />
            <span className="club-header-text">
              <strong>{dateLabel(career.date)}</strong>
              <small>{money(career.finances[career.clubId].cash)}</small>
            </span>
          </div>
        )}
        <div className="header-status">
          {offline && (
            <span title="Offline" className="status-icon">
              <WifiOff size={18} />
            </span>
          )}
          <span
            className={`status-icon controller-status ${controller.connected ? 'connected' : ''}`}
            title={controller.connected || 'Conecte um controle e pressione um botão'}
          >
            <Gamepad2 size={20} />
          </span>
        </div>
      </header>
      <main
        key={`${screen}-${screen === 'career' ? (inMatch ? 'match' : tab) : ''}`}
        className="stage"
        inert={popup || press || deleting || busy ? true : undefined}
      >
        {screen === 'menu' && (
          <MainMenu
            saves={saves}
            onContinue={(record) => act(() => continueCareer(record))}
            onNew={() => setPopup('world')}
            onDelete={setDeleting}
          />
        )}
        {screen === 'create' && world && (
          <CreateManager
            world={world}
            onError={fail}
            onBack={() => setScreen('menu')}
            onPortrait={portrait}
            onStart={(manager, clubId, difficulty, challenge) =>
              act(() => {
                setCareer(createCareer(world, manager, clubId, difficulty, challenge));
                setScreen('career');
                setTab(0);
              })
            }
          />
        )}
        {screen === 'career' &&
          career &&
          world &&
          (career.activeMatch ? (
            <MatchScreen
              career={career}
              world={live!}
              onChange={setCareer}
              onError={fail}
              paused={Boolean(popup) || busy}
              onFinish={() =>
                act(() => {
                  let session: PressSession | null;
                  try {
                    session = buildPress(career, live!);
                  } catch {
                    session = null;
                  }
                  setCareer(finishMatch(career, live!));
                  setTab(0);
                  if (session) {
                    setPress(session);
                    setPressStep(0);
                    setPressAnswers({});
                  }
                })
              }
              onSubstitute={(outId, inId) =>
                act(() => setCareer(substitute(career, live!, outId, inId)))
              }
              onMoment={(id, action) =>
                act(() => setCareer(resolveMoment(career, live!, id, action)))
              }
            />
          ) : (
            <>
              {career.mode === 'demo' && (
                <p className="demo-strip">DEMONSTRAÇÃO · Atletas e finanças sintéticos</p>
              )}
              {tab === 0 && (
                <CareerCentral
                  career={career}
                  world={live!}
                  busy={busy}
                  onAdvance={advance}
                  onMatch={() => {
                    const f = nextFixture(career);
                    if (career.messages.some((m) => m.important && !m.resolved)) setTab(3);
                    else if (f && f.date <= career.date) setPopup('prematch');
                    else setTab(4);
                  }}
                  onTab={setTab}
                  onNewSeason={() =>
                    act(() => {
                      setCareer(startNextSeason(career, live!));
                      setNotice(
                        `Temporada ${career.season + 1} iniciada. Confira elenco e objetivos.`,
                      );
                    })
                  }
                />
              )}
              {tab === 1 && (
                <Squad
                  career={career}
                  world={live!}
                  onChange={setCareer}
                  detail={detail}
                  setDetail={setDetail}
                  onError={fail}
                  onRenew={(id, months) =>
                    act(() => {
                      setCareer(renewContract(career, live!, id, months));
                      setNotice('Contrato renovado. Luvas debitadas do caixa.');
                    })
                  }
                  onConversation={(id, choice) =>
                    act(() => {
                      setCareer(playerConversation(career, id, choice));
                      setNotice('Conversa registrada na memória do jogador.');
                    })
                  }
                  onDevelopment={(id, plan) => setCareer(setDevelopmentPlan(career, id, plan))}
                  onRole={(id, role) => setCareer(setPlayerRole(career, id, role))}
                  onSetClause={(id, amount) =>
                    act(() => {
                      setCareer(setReleaseClause(career, id, amount));
                      setNotice('Multa rescisória atualizada.');
                    })
                  }
                  onLoanOut={(id, clubId) =>
                    act(() => {
                      setCareer(loanOutPlayer(career, live!, id, clubId, 6));
                      setNotice('Empréstimo concluído. O jogador retornará em seis meses.');
                    })
                  }
                  onListForSale={(id, price) =>
                    act(() => {
                      setCareer(listForSale(career, live!, id, price));
                      setNotice(
                        price === null
                          ? 'Atleta retirado da lista de venda.'
                          : 'Atleta à venda. As propostas chegam em Transferências › Negociações.',
                      );
                    })
                  }
                  onRelease={(id) =>
                    act(() => {
                      const updated = releasePlayer(career, live!, id);
                      const lineup = bestLineup(updated, live!);
                      if (lineup.length === 11) updated.lineup = lineup;
                      setCareer(updated);
                      setDetail(null);
                      setNotice('Contrato rescindido. O atleta deixou o clube.');
                    })
                  }
                />
              )}
              {tab === 2 && (
                <Transfers
                  career={career}
                  world={live!}
                  onOffer={(id, fee, wage, exchange, terms) => {
                    let sent = false;
                    act(() => {
                      setCareer(createOffer(career, live!, id, fee, wage, exchange, terms));
                      setNotice('Proposta enviada. A resposta chega amanhã.');
                      sent = true;
                    });
                    return sent;
                  }}
                  onShortlist={(id) =>
                    setCareer({
                      ...career,
                      shortlist: career.shortlist.includes(id)
                        ? career.shortlist.filter((p) => p !== id)
                        : [...career.shortlist, id],
                    })
                  }
                  onLoan={(id) =>
                    act(() => {
                      setCareer(arrangeLoan(career, live!, id, 6));
                      setNotice('Empréstimo concluído por seis meses.');
                    })
                  }
                  onPrecontract={(id, wage) =>
                    act(() => {
                      setCareer(signPreContract(career, live!, id, wage));
                      setNotice('Pré-contrato assinado. O reforço chega ao fim do vínculo atual.');
                    })
                  }
                  onClause={(id) =>
                    act(() => {
                      setCareer(exerciseReleaseClause(career, live!, id));
                      setNotice('Multa rescisória paga e transferência concluída.');
                    })
                  }
                  onAnswer={(id, accept) =>
                    act(() => {
                      const updated = answerIncoming(career, live!, id, accept);
                      const lineup = bestLineup(updated, live!);
                      if (lineup.length === 11) updated.lineup = lineup;
                      setCareer(updated);
                    })
                  }
                  onRespond={(id, accept) =>
                    act(() => setCareer(respondCounter(career, live!, id, accept)))
                  }
                  onAsk={(id, fee) =>
                    act(() => {
                      const updated = counterIncoming(career, live!, id, fee);
                      const lineup = bestLineup(updated, live!);
                      if (lineup.length === 11) updated.lineup = lineup;
                      setCareer(updated);
                    })
                  }
                />
              )}
              {tab === 3 && (
                <Office
                  career={career}
                  world={live!}
                  busy={busy}
                  aiAvailable={Boolean(supabase) && !offline}
                  onMessage={(id, choice) =>
                    act(() => setCareer(respondMessage(career, id, choice)))
                  }
                  onRead={(id) => {
                    if (!career.messages.find((m) => m.id === id)?.read)
                      setCareer({
                        ...career,
                        messages: career.messages.map((m) =>
                          m.id === id ? { ...m, read: true } : m,
                        ),
                      });
                  }}
                  onApplyPlan={(id) =>
                    act(() => {
                      setCareer(applyStaffPlan(career, world!, id));
                      setNotice('Plano do auxiliar aplicado na tática e na escalação.');
                    })
                  }
                  onHireScout={(region) =>
                    act(() => {
                      setCareer(hireScout(career, live!, region));
                      setNotice(`Olheiro contratado para ${region}.`);
                    })
                  }
                  onFireScout={(id) =>
                    act(() => {
                      setCareer(fireScout(career, id));
                      setNotice('Olheiro demitido.');
                    })
                  }
                  onSignProspect={(id) =>
                    act(() => {
                      setCareer(signProspect(career, id));
                      setNotice('Jovem talento integrado às categorias de base.');
                    })
                  }
                  onAcceptJob={(id) =>
                    act(() => {
                      setCareer(acceptJobOffer(career, live!, id));
                      setNotice('Novo clube aceito. A carreira continua em um novo desafio.');
                    })
                  }
                  onLiving={(patch) =>
                    setCareer({ ...career, living: { ...career.living, ...patch } })
                  }
                  onUpgradeAnalyst={() =>
                    act(() => {
                      setCareer(upgradeAnalyst(career));
                      setNotice('Novo analista de desempenho contratado.');
                    })
                  }
                  onDeclineJob={(id) =>
                    setCareer({
                      ...career,
                      jobOffers: career.jobOffers.filter((offer) => offer.id !== id),
                    })
                  }
                  onAvatar={(photo) =>
                    run(async () => {
                      const url = await portrait(career.manager, photo);
                      setCareer({ ...career, manager: { ...career.manager, avatar: url } });
                      setNotice('Novo retrato pronto.');
                    })
                  }
                />
              )}
              {tab === 4 && <Season career={career} world={live!} />}
            </>
          ))}
      </main>
      <footer className="app-footer">
        <div className="hints">
          <ControllerButtonHint action="confirm" label="Selecionar" />
          <ControllerButtonHint action="back" label="Voltar" />
          {screen === 'career' && !inMatch && (
            <>
              <ControllerButtonHint action="secondary" label="Avançar dia" />
              <ControllerButtonHint action="nextView" label="Sub-menu" />
              <ControllerButtonHint action="menu" label="Pausa" />
            </>
          )}
        </div>
        {career && screen === 'career' && (
          <span className={`save-status ${saveState}`} role="status">
            {saveState === 'saving' ? (
              <LoaderCircle size={15} className="spin" />
            ) : saveState === 'saved' ? (
              <CheckCircle2 size={15} />
            ) : (
              <X size={15} />
            )}
            {saveState === 'saving' ? 'SALVANDO' : saveState === 'saved' ? 'SALVO' : 'ERRO NO SAVE'}
          </span>
        )}
      </footer>
      {controller.unsupported && (
        <div className="compatibility-note" role="status">
          Controle detectado sem mapeamento padrão. Ative o modo XInput do controle.
        </div>
      )}
      {(error || notice) && (
        <div className={`toast ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>
          <span>{error || notice}</span>
        </div>
      )}
      {voice.current && (
        <div className="voice-bar" role="status">
          <Radio size={18} className="pulse" />
          <span>
            <small>
              {voice.mailbox ? `Caixa postal · ${voice.position}/${voice.total}` : 'Recado'}
            </small>
            <b>{voice.current.title}</b>
          </span>
          {voice.total > 1 && (
            <button aria-label="Pular recado" onClick={skipVoice}>
              <SkipForward size={16} />
            </button>
          )}
          <button aria-label="Parar caixa postal" onClick={stopVoice}>
            <Square size={14} /> Parar
          </button>
        </div>
      )}
      {unlocked[0] && (
        <div className={`achievement-toast tier-${unlocked[0].tier}`} role="status">
          <Award size={30} />
          <span>
            <small>Conquista desbloqueada</small>
            <b>{unlocked[0].title}</b>
            <em>{unlocked[0].description}</em>
          </span>
        </div>
      )}
      {busy && (
        <div className="busy-indicator" role="status">
          <LoaderCircle className="spin" size={17} /> Processando…
        </div>
      )}
      {popup === 'world' && (
        <Modal title="Nova carreira" onClose={() => setPopup(null)} wide>
          <div className="world-options carousel">
            <button
              className="world-option official"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setWorld(await loadWorld2026());
                  setCareer(null);
                  setScreen('create');
                  setPopup(null);
                })
              }
            >
              <Trophy size={44} />
              <h2>Brasileirão 2026</h2>
              <p>Séries A e B com elencos reais e escudos. Mundo congelado em 01/01/2026.</p>
              <span>
                JOGAR <ArrowRight size={18} />
              </span>
            </button>
            <button
              className="world-option demo"
              onClick={() =>
                act(() => {
                  setWorld(createDemoWorld());
                  setCareer(null);
                  setScreen('create');
                  setPopup(null);
                })
              }
            >
              <Gamepad2 size={44} />
              <h2>Experimentar a demonstração</h2>
              <p>40 clubes e atletas fictícios para testar o jogo.</p>
              <span>
                JOGAR <ArrowRight size={18} />
              </span>
            </button>
          </div>
        </Modal>
      )}
      {popup === 'pause' && career && world && (
        <Modal title={career.activeMatch ? 'Jogo pausado' : 'Pausa'} onClose={() => setPopup(null)}>
          <div className="pause-options">
            <button className="primary" onClick={() => setPopup(null)}>
              <ArrowLeft size={18} /> Continuar
            </button>
            <button onClick={controller.toggleVibration}>
              {controller.vibration ? <Vibrate size={18} /> : <VibrateOff size={18} />}
              Vibração: {controller.vibration ? 'Ligada' : 'Desligada'}
            </button>
            <button
              onClick={() => {
                const status = controller.haptics();
                controller.rumble('goal');
                setHapticNote(
                  !controller.vibration
                    ? 'A vibração está desligada. Ligue no botão acima.'
                    : controller.hid.connected
                      ? 'DualSense conectado direto: deve ter vibrado agora.'
                      : controller.hid.supported
                        ? 'Não vibrou? Use "Conectar DualSense" abaixo e escolha o controle na lista.'
                        : status === 'nopad'
                          ? 'Nenhum controle detectado. Aperte qualquer botão do controle.'
                          : 'Este navegador não libera a vibração. Use Chrome ou Edge no computador.',
                );
              }}
            >
              <Vibrate size={18} /> Testar vibração
            </button>
            {controller.hid.supported && !controller.hid.connected && (
              <button
                onClick={() =>
                  void controller.hid
                    .pair()
                    .then((ok) =>
                      setHapticNote(
                        ok
                          ? 'DualSense conectado. A vibração agora funciona em todo o jogo.'
                          : 'Nenhum controle escolhido.',
                      ),
                    )
                    .catch((e: unknown) =>
                      setHapticNote(
                        e instanceof Error && e.name === 'SecurityError'
                          ? 'O navegador exige um clique: clique neste botão com o mouse uma vez.'
                          : e instanceof Error
                            ? e.message
                            : String(e),
                      ),
                    )
                }
              >
                <Gamepad2 size={18} /> Conectar DualSense (vibração)
              </button>
            )}
            {hapticNote && <p className="muted small haptic-note">{hapticNote}</p>}
            <button onClick={controller.toggleSound}>
              {controller.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              Sons do menu: {controller.sound ? 'Ligados' : 'Desligados'}
            </button>
            <button onClick={toggleMusic}>
              {music ? <Music size={18} /> : <VolumeX size={18} />}
              Música: {music ? 'Ligada' : 'Desligada'}
            </button>
            {voice.current && (
              <button onClick={stopVoice}>
                <Square size={16} /> Parar caixa postal
              </button>
            )}
            {!career.activeMatch && (
              <button onClick={() => setPopup('prefs')}>
                <CalendarClock size={18} /> Avanço do calendário:{' '}
                {advanceModes.find((m) => m.id === (career.prefs?.advance || 'day'))?.title}
              </button>
            )}
            <button onClick={() => setPopup('achievements')}>
              <Award size={18} /> Conquistas ({Object.keys(career.achievements || {}).length}/
              {achievements.length})
            </button>
            {installPrompt && (
              <button
                onClick={() =>
                  run(async () => {
                    await installPrompt.prompt();
                    setInstallPrompt(null);
                  })
                }
              >
                Instalar Mando
              </button>
            )}
            <button onClick={menu}>Salvar e sair para o menu</button>
          </div>
        </Modal>
      )}
      {press && career && live && (
        <PressConference
          session={press}
          step={pressStep}
          answers={pressAnswers}
          onAnswer={(questionId, index) => {
            rumble('confirm');
            const answers = { ...pressAnswers, [questionId]: index };
            setPressAnswers(answers);
            if (pressStep + 1 < press.questions.length) setPressStep(pressStep + 1);
            else {
              stopVoice();
              act(() => setCareer(applyPress(career, live, press, answers)));
              setPress(null);
              setNotice('Coletiva encerrada. A repercussão está no Escritório.');
            }
          }}
          onSkip={() => {
            stopVoice();
            if (Object.keys(pressAnswers).length)
              act(() => setCareer(applyPress(career, live, press, pressAnswers)));
            setPress(null);
          }}
        />
      )}
      {popup === 'prefs' && career && (
        <Modal title="Preferências de avanço" onClose={() => setPopup(null)}>
          <p className="muted">O que acontece quando você aperta Avançar (□ / X).</p>
          <div className="prefs-options">
            {advanceModes.map((m, i) => (
              <button
                key={m.id}
                className={`pref-card ${(career.prefs?.advance || 'day') === m.id ? 'active' : ''}`}
                aria-pressed={(career.prefs?.advance || 'day') === m.id}
                data-autofocus={(career.prefs?.advance || 'day') === m.id || undefined}
                onClick={() => {
                  setCareer({ ...career, prefs: { ...career.prefs, advance: m.id } });
                  setPopup(null);
                  setNotice(`Avanço: ${m.title}.`);
                }}
              >
                <b>{i + 1}</b>
                <strong>{m.title}</strong>
                <span>{m.text}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {running && career && (
        <div className="advance-overlay" role="status">
          <CalendarClock size={42} />
          <strong>{dateLabel(career.date, true)}</strong>
          <span>
            {career.prefs?.advance === 'auto'
              ? 'Simulando a temporada'
              : 'Avançando até o próximo evento'}
            {played
              ? ` · ${played} jogo${played > 1 ? 's' : ''} simulado${played > 1 ? 's' : ''}`
              : ''}
          </span>
          <button className="primary" data-autofocus data-stop-run onClick={stopRunning}>
            <Square size={16} /> Parar
          </button>
        </div>
      )}
      {popup === 'achievements' && career && (
        <Modal title="Conquistas" onClose={() => setPopup('pause')} wide>
          <div className="achievement-grid">
            {achievements.map((a) => {
              const date = career.achievements?.[a.id];
              return (
                <button
                  key={a.id}
                  className={`achievement-card tier-${a.tier}${date ? ' unlocked' : ''}`}
                  aria-label={`${a.title}: ${a.description}. ${date ? `Desbloqueada em ${dateLabel(date)}` : 'Bloqueada'}`}
                >
                  {date ? <Award size={30} /> : <Lock size={26} />}
                  <b>{a.title}</b>
                  <span>{a.description}</span>
                  <small>{date ? dateLabel(date) : 'Bloqueada'}</small>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {popup === 'prematch' && career && world && (
        <Modal title="Dia de jogo" onClose={() => setPopup(null)}>
          <div className="prematch-info">
            <p className="eyebrow">{dateLabel(career.date, true)}</p>
            <h2>
              {career.tactic.formation} · {career.tactic.mentality}
            </h2>
            <p>Confira lesões, suspensões e condição física antes de entrar em campo.</p>
            {(() => {
              const f = nextFixture(career);
              return f ? <MatchOdds career={career} world={live!} fixture={f} /> : null;
            })()}
          </div>
          <div className="button-row">
            <button
              onClick={() => {
                const session = buildPreMatchPress(career, live!);
                if (!session) return fail('Não foi possível iniciar a coletiva pré-jogo.');
                setPress(session);
                setPressStep(0);
                setPressAnswers({});
                setPopup(null);
              }}
            >
              Coletiva pré-jogo
            </button>
            <button
              onClick={() => {
                setPopup(null);
                setTab(1);
              }}
            >
              Revisar escalação
            </button>
            <button
              className="primary"
              onClick={() =>
                act(() => {
                  const fixture = nextFixture(career);
                  if (!fixture || fixture.date !== career.date)
                    throw new Error('Não há partida hoje.');
                  setCareer({ ...career, activeMatch: beginMatch(career, live!, fixture) });
                  setPopup(null);
                  controller.rumble('whistle');
                })
              }
            >
              Começar partida <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title="Excluir carreira?" onClose={() => setDeleting(null)}>
          <p>
            {deleting.career.manager.firstName} ·{' '}
            {deleting.world.clubs.find((c) => c.id === deleting.career.clubId)?.name} ·{' '}
            {dateLabel(deleting.career.date)}
          </p>
          <div className="button-row">
            <button onClick={() => setDeleting(null)}>Cancelar</button>
            <button
              className="danger"
              onClick={() =>
                run(async () => {
                  await removeLocal(deleting.career.id);
                  setSaves(await listLocal());
                  setDeleting(null);
                })
              }
            >
              Excluir
            </button>
          </div>
        </Modal>
      )}
      {updateReady && (
        <div className="pwa-update">
          <p>Nova versão do Mando disponível.</p>
          <button
            className="primary"
            disabled={saveState === 'saving'}
            onClick={() =>
              run(async () => {
                await queue.current;
                await updateSW.current?.(true);
              })
            }
          >
            Atualizar jogo
          </button>
          <button onClick={() => setUpdateReady(false)}>Depois</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <GamepadProvider>
      <Game />
    </GamepadProvider>
  );
}

function PressConference({
  session,
  step,
  answers,
  onAnswer,
  onSkip,
}: {
  session: PressSession;
  step: number;
  answers: Record<string, number>;
  onAnswer: (questionId: string, index: number) => void;
  onSkip: () => void;
}) {
  const q = session.questions[step];
  useEffect(() => {
    playVoice([
      {
        id: `press-${session.fixtureId}-${q.id}`,
        title: q.reporter,
        text: q.text,
        voice: 'reporter',
      },
    ]);
  }, [session.fixtureId, q]);
  return (
    <Modal title="Sala de imprensa" onClose={onSkip} wide>
      <div className="press-room">
        <p className="eyebrow">{session.headline}</p>
        <div
          className="press-progress"
          aria-label={`Pergunta ${step + 1} de ${session.questions.length}`}
        >
          {session.questions.map((item, i) => (
            <i key={item.id} className={i < step ? 'done' : i === step ? 'active' : ''} />
          ))}
        </div>
        <div className="press-question">
          <span className="press-mic" aria-hidden="true">
            🎙
          </span>
          <div>
            <strong>{q.reporter}</strong>
            <small>{q.outlet}</small>
            <p>{q.text}</p>
          </div>
        </div>
        <div className="press-answers">
          {q.answers.map((a, i) => (
            <button
              key={`${q.id}-${i}`}
              className={`press-answer${answers[q.id] === i ? ' active' : ''}`}
              data-autofocus={i === 0 || undefined}
              onClick={() => onAnswer(q.id, i)}
            >
              <b>{a.tone}</b>
              <span>{a.text}</span>
            </button>
          ))}
        </div>
        <p className="muted small">
          Suas respostas mexem com a confiança da diretoria e o moral do elenco.
        </p>
      </div>
    </Modal>
  );
}
