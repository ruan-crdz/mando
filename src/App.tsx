import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Gamepad2,
  HeartPulse,
  LoaderCircle,
  CalendarClock,
  MapPin,
  ShieldAlert,
  Smartphone,
  Trophy,
  Vibrate,
  VibrateOff,
  WifiOff,
  X,
} from 'lucide-react';
import { type User } from '@supabase/supabase-js';
import { ZodError, z } from 'zod';
import { GamepadProvider, useControllerActions, useGamepad } from './controller/GamepadProvider';
import { ControllerButtonHint } from './controller/ControllerButtonHint';
import { Badge, dateLabel, Modal, money } from './components/ui';
import { PlayerFace } from './components/PlayerFace';
import { MainMenu, SavedGameList } from './screens/MainMenu';
import { CreateManager } from './screens/CreateManager';
import { CareerCentral } from './screens/CareerCentral';
import { Squad } from './screens/Squad';
import { Transfers } from './screens/Transfers';
import { Office } from './screens/Office';
import { AudioDirector } from './components/AudioDirector';
import { audioState, subscribeAudio, toggleMusic, toggleCrowd } from './audio/sound';
import { PRIMARY_TABS, TAB } from './navigation';
import { MatchScreen } from './screens/Match';
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
  reassignScout,
  signProspect,
  reviewAcademyCandidate,
  ensureAcademy,
  promoteAcademyPlayer,
  updateManager,
  setReleaseClause,
  blocks,
} from './game/engine';
import { available, bestLineup, beginMatch, substitute, syncBenchWithLineup } from './game/matches';
import { careerWorld } from './game/live';
import { fixtureLabel, nextFixture, transferWindow } from './game/calendar';
import { clubById } from './game/npc';
import {
  answerIncoming,
  counterIncoming,
  createOffer,
  renewContract,
  respondCounter,
  createLoanOffer,
  exerciseLoanOption,
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
import { AdvanceOverlay } from './components/CareerCalendar';

type OfficeSeasonView = 'table' | 'calendar' | 'stats' | 'legacy';
type Popup = 'world' | 'load' | 'contract' | 'tutorial' | 'pause' | 'prematch' | 'prefs' | null;
const onboardingTour = [
  {
    title: 'Central',
    body: 'Aqui você acompanha o elenco, a escalação e o próximo compromisso do clube.',
  },
  {
    title: 'Mensagens e notificações',
    body: 'Leia recados na caixa de entrada e acompanhe conversas registradas com os atletas em Notificações.',
  },
  {
    title: 'Time',
    body: 'Use a área Time para acompanhar a equipe e ajustar a formação e as funções dos atletas.',
  },
  {
    title: 'Transferências',
    body: 'Consulte o mercado e conduza negociações dentro dos recursos disponíveis para o clube.',
  },
  {
    title: 'Escritório',
    body: 'Aqui ficam objetivos, orçamento, carreira do manager e atalhos para tabelas, calendário e estatísticas.',
  },
];
const contractChallengeObjectives: Record<Career['challenge'], string> = {
  Realista: 'Cumprir o plano dentro das condições iniciais do clube.',
  'Do zero': 'Reconstruir o elenco sem orçamento inicial de transferências.',
  'Crise financeira': 'Conduzir o clube com atenção redobrada às contas.',
  'Só a base': 'Dar protagonismo aos atletas de até 23 anos.',
  'Venda necessária': 'Concluir R$ 10 milhões em vendas antes de contratar.',
  Reconstrução: 'Renovar o elenco e controlar o orçamento disponível.',
};

function readableError(error: unknown) {
  if (error instanceof ZodError) {
    const paths = [
      ...new Set(error.issues.map((issue) => issue.path.map(String).join('.')).filter(Boolean)),
    ].slice(0, 3);
    const location = paths.length ? `: ${paths.join(', ')}` : '';
    return (
      `Dados incompatíveis no save (${error.issues.length} campos${location}). ` +
      'Atualize a página e tente novamente.'
    );
  }
  return error instanceof Error ? error.message : String(error);
}
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
  message: 'Nova mensagem em Notificações.',
  season: 'Temporada encerrada.',
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
  const inMatch = Boolean(career?.activeMatch);
  const audio = useSyncExternalStore(subscribeAudio, audioState);
  const matchdayFixture = career ? nextFixture(career) : null;
  const matchdayHome = matchdayFixture && live ? clubById(live, matchdayFixture.homeId) : null;
  const matchdayAway = matchdayFixture && live ? clubById(live, matchdayFixture.awayId) : null;
  const matchdayLabel = matchdayFixture ? fixtureLabel(matchdayFixture) : null;
  const matchdayUnavailable =
    career && live
      ? live.players.filter((player) => {
          const state = career.players[player.id];
          if (!state || state.clubId !== career.clubId) return false;
          return !available(career, player.id);
        })
      : [];
  const [saves, setSaves] = useState<SavedCareer[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<number>(TAB.CENTRAL);
  const [officeSeasonView, setOfficeSeasonView] = useState<OfficeSeasonView | null>(null);
  const [popup, setPopup] = useState<Popup>(null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [contractSigning, setContractSigning] = useState(false);
  const [running, setRunning] = useState(false);
  const [played, setPlayed] = useState(0);
  const [advanceStartedAt, setAdvanceStartedAt] = useState<string | null>(null);
  const prefsFromPause = useRef(false);
  const [hapticNote, setHapticNote] = useState('');
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
  const saveVersion = useRef(0);
  const latestSave = useRef({ career, world });
  latestSave.current = { career, world };
  const lock = useRef(false);
  const { rumble } = controller;
  const fail = useCallback(
    (error: unknown) => {
      setError(readableError(error));
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
        .catch(fail)
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
        fail(e);
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
      .catch(fail);
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
    const version = ++saveVersion.current;
    if (!career || !world) return;
    setSaveState('saving');
    const current = career;
    queue.current = queue.current
      .then(() => saveLocal(current, world, revisions.current.get(current.id) || 0))
      .then(() => {
        lastSaved.current = current;
        if (version === saveVersion.current) setSaveState('saved');
      })
      .catch((e: unknown) => {
        if (version === saveVersion.current) setSaveState('error');
        fail(new Error(`Save local não gravado: ${readableError(e)}.`));
      });
  }, [career, world, fail]);
  useEffect(() => {
    const flush = () => {
      const { career: current, world: base } = latestSave.current;
      if (!current || !base || lastSaved.current === current) return;
      const write = queue.current.then(() =>
        saveLocal(current, base, revisions.current.get(current.id) || 0),
      );
      queue.current = write.catch((error: unknown) => {
        if (latestSave.current.career === current) setSaveState('error');
        fail(new Error(`Save local não gravado: ${readableError(error)}.`));
      });
      void write
        .then(() => {
          lastSaved.current = current;
          if (latestSave.current.career === current) setSaveState('saved');
        })
        .catch(() => undefined);
    };
    const leave = (e: BeforeUnloadEvent) => {
      const { career: current } = latestSave.current;
      if (current && lastSaved.current !== current) {
        e.preventDefault();
        e.returnValue = '';
      }
      flush();
    };
    window.addEventListener('beforeunload', leave);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', leave);
      window.removeEventListener('pagehide', flush);
    };
  }, [fail]);

  const continueCareer = useCallback((record: SavedCareer) => {
    validateCareerForWorld(record.career, record.world);
    const restored = ensureAcademy(structuredClone(record.career), record.world);
    validateCareerForWorld(restored, record.world);
    revisions.current.set(record.career.id, record.cloudRevision);
    setCareer(restored);
    setWorld(record.world);
    setScreen('career');
    setPopup(
      record.career.onboarding?.contractSigned === false
        ? 'contract'
        : record.career.onboarding?.tutorialComplete === false
          ? 'tutorial'
          : null,
    );
    setTutorialStep(0);
    setTab(TAB.CENTRAL);
    setOfficeSeasonView(null);
  }, []);
  const signContract = () => {
    if (contractSigning) return;
    setContractSigning(true);
    window.setTimeout(() => {
      setCareer((current) =>
        current
          ? {
              ...current,
              onboarding: {
                contractSigned: true,
                tutorialComplete: false,
              },
            }
          : current,
      );
      setContractSigning(false);
      setTutorialStep(0);
      setPopup('tutorial');
    }, 850);
  };
  const finishTutorial = () => {
    setCareer((current) =>
      current
        ? {
            ...current,
            onboarding: {
              contractSigned: true,
              tutorialComplete: true,
            },
          }
        : current,
    );
    setPopup(null);
  };
  const menu = useCallback(
    () =>
      run(async () => {
        await queue.current;
        const { career: current, world: base } = latestSave.current;
        if (current && base) {
          await saveLocal(current, base, revisions.current.get(current.id) || 0);
          lastSaved.current = current;
        }
        setSaves(await listLocal());
        setScreen('menu');
        setPopup(null);
        setDetail(null);
      }),
    [run],
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
        const latest = latestSave.current;
        if (latest.career?.id === current.id && latest.world) {
          const newest = latest.career;
          const newestWorld = latest.world;
          const write = queue.current.then(() => saveLocal(newest, newestWorld, revision));
          queue.current = write.catch((error: unknown) => {
            if (latestSave.current.career === newest) setSaveState('error');
            fail(new Error(`Save local não gravado: ${readableError(error)}.`));
          });
          await write;
          lastSaved.current = newest;
          if (latestSave.current.career === newest) setSaveState('saved');
        }
      });
      cloudQueue.current = task.catch(() => undefined);
      return task;
    },
    [fail, world],
  );
  useEffect(() => {
    if (!career || !user || !z.string().uuid().safeParse(career.worldId).success) return;
    const backupLatest = () => {
      const latest = latestSave.current.career;
      if (!latest || !z.string().uuid().safeParse(latest.worldId).success) return;
      sync(latest).catch((error: unknown) => {
        console.warn('cloud_backup_failed', error);
        if (navigator.onLine) setNotice('Save local preservado. Backup na nuvem pendente.');
      });
    };
    const timer = window.setTimeout(backupLatest, 1200);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(timer);
        backupLatest();
      }
    };
    window.addEventListener('online', backupLatest);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', backupLatest);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [career, user, sync]);
  const switchTab = useCallback(
    (delta: number) => {
      if (screen !== 'career' || inMatch || popup || detail || busy || running) return;
      setOfficeSeasonView(null);
      setTab((t) => (t + delta + PRIMARY_TABS.length) % PRIMARY_TABS.length);
    },
    [screen, inMatch, popup, detail, busy, running],
  );
  const advance = useCallback(() => {
    if (!career || !live || running || busy || inMatch) return;
    const mode = career.prefs?.advance || 'day';
    if (mode === 'day') return act(() => setCareer(advanceDay(career, live)));
    setPlayed(0);
    setAdvanceStartedAt(career.date);
    setRunning(true);
  }, [career, live, act, running, busy, inMatch]);
  const [runUntil, setRunUntil] = useState<string | null>(null);
  const simulateTo = useCallback(
    (date: string) => {
      if (!career || running || busy || inMatch || date <= career.date) return;
      setRunUntil(date);
      setPlayed(0);
      setAdvanceStartedAt(career.date);
      setRunning(true);
    },
    [career, running, busy, inMatch],
  );
  const stopRunning = useCallback(() => {
    setRunning(false);
    setRunUntil(null);
  }, []);
  useEffect(() => {
    if (!running) setRunUntil(null);
  }, [running]);
  const step = useRef({ career, world });
  step.current = { career, world };
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      const { career: current, world: base } = step.current;
      if (!current || !base) return setRunning(false);
      try {
        if (runUntil && current.date >= runUntil) {
          setRunning(false);
          setRunUntil(null);
          setNotice('Data alcançada.');
          return;
        }
        const mode = runUntil ? 'event' : current.prefs?.advance === 'auto' ? 'auto' : 'event';
        const result = advanceStep(current, base, mode);
        setCareer(result.career);
        if (result.played) setPlayed((n) => n + 1);
        if (result.stop && !(runUntil && result.stop === 'message')) {
          setRunning(false);
          setRunUntil(null);
          setNotice(stopNotes[result.stop]);
          rumble('whistle');
          if (result.stop === 'match') setPopup('prematch');
          else if (result.stop === 'decision' || result.stop === 'message') {
            setOfficeSeasonView(null);
            setTab(TAB.NOTIFICATIONS);
          }
        }
      } catch (e) {
        setRunning(false);
        fail(e);
      }
    }, 110);
    return () => window.clearTimeout(timer);
  }, [running, career, fail, rumble, runUntil]);
  useControllerActions(
    screen === 'create' || busy
      ? {}
      : {
          back: () => {
            if (running) setRunning(false);
            else if (detail) setDetail(null);
            else if (deleting) setDeleting(null);
            else if (popup === 'contract') return;
            else if (popup === 'tutorial') finishTutorial();
            else if (popup) setPopup(null);
            else if (screen === 'career' && tab === TAB.OFFICE && officeSeasonView)
              setOfficeSeasonView(null);
            else if (screen === 'career') setPopup('pause');
          },
          previousTab: () => switchTab(-1),
          nextTab: () => switchTab(1),
          secondary: () => {
            if (running) return setRunning(false);
            if (!career || screen !== 'career' || inMatch || popup || tab !== TAB.CENTRAL) return;
            if (career.seasonEnded) {
              act(() => setCareer(startNextSeason(career, live!)));
            } else if (
              career.prefs.advance !== 'auto' &&
              career.messages.some((message) => blocks(career, message))
            ) {
              setTab(TAB.NOTIFICATIONS);
            } else if (
              career.prefs.advance !== 'auto' &&
              nextFixture(career)?.date === career.date
            ) {
              setPopup('prematch');
            } else advance();
          },
          info: () => {
            if (screen === 'career' && tab === TAB.CENTRAL && !inMatch && !popup && !running)
              setTab(TAB.NOTIFICATIONS);
          },
          menu: () => {
            if (screen !== 'career') return;
            if (running) return setRunning(false);
            if (popup === 'contract' || popup === 'tutorial') return;
            // Na Central, START abre as preferências de avanço; nas demais telas, a pausa.
            if (tab === TAB.CENTRAL && !inMatch && !popup) {
              prefsFromPause.current = false;
              setPopup('prefs');
            } else
              setPopup((p) =>
                p === 'prefs' && prefsFromPause.current
                  ? 'pause'
                  : p === 'pause' || p === 'prefs'
                    ? null
                    : 'pause',
              );
          },
        },
  );
  const portrait = (manager: Career['manager'], photo?: string) => requestPortrait(manager, photo);
  const club = career && world?.clubs.find((club) => club.id === career.clubId);
  return (
    <div
      className={`game-shell input-${controller.input} on-${screen}${inMatch ? ' in-match' : ''}`}
    >
      <div className="orientation-warning" role="status">
        <Smartphone size={42} aria-hidden="true" />
        <strong>Vire o celular</strong>
        <span>O Mando foi pensado para jogar com a tela na horizontal.</span>
      </div>
      <div className="bg-stage" aria-hidden="true" />
      <AudioDirector inMatch={inMatch} />
      <header className="app-header" inert={running ? true : undefined}>
        <div className="brand" aria-label="Mando">
          <picture>
            <source
              media="(max-width: 1000px)"
              srcSet={`${import.meta.env.BASE_URL}logo-mando-160.png`}
            />
            <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo-mando.png`} alt="" />
          </picture>
        </div>
        {screen === 'career' && !inMatch && (
          <nav className="main-nav" aria-label="Áreas do clube">
            <span className="nav-shoulder">
              <ControllerButtonHint action="previousTab" label="" />
            </span>
            {PRIMARY_TABS.map((name, i) => (
              <button
                key={name}
                onClick={() => {
                  setOfficeSeasonView(null);
                  setTab(i);
                }}
                className={tab === i ? 'active' : ''}
                aria-current={tab === i ? 'page' : undefined}
              >
                {name}
                {i === TAB.NOTIFICATIONS &&
                  career!.messages.some((m) => m.important && !m.resolved) && (
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
        inert={popup || deleting || busy || running ? true : undefined}
      >
        {screen === 'menu' && (
          <MainMenu
            saves={saves}
            onContinue={(record) => act(() => continueCareer(record))}
            onNew={() => setPopup('world')}
            onLoad={() => setPopup('load')}
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
                setPopup('contract');
                setTutorialStep(0);
                setTab(TAB.CENTRAL);
                setOfficeSeasonView(null);
              })
            }
          />
        )}
        {screen === 'career' &&
          career &&
          world &&
          (inMatch ? (
            <MatchScreen
              career={career}
              world={live!}
              onChange={setCareer}
              onError={fail}
              paused={Boolean(popup) || busy}
              onFinish={() =>
                act(() => {
                  setCareer(finishMatch(career, live!));
                  setTab(TAB.CENTRAL);
                })
              }
              onSubstitute={(outId, inId) =>
                act(() => {
                  setCareer(substitute(career, live!, outId, inId));
                })
              }
            />
          ) : (
            <>
              {tab === TAB.CENTRAL && (
                <CareerCentral
                  career={career}
                  world={live!}
                  busy={busy}
                  onAdvance={advance}
                  onOpenSeason={(view) => {
                    setOfficeSeasonView(view);
                    setTab(TAB.OFFICE);
                  }}
                  onMatch={() => {
                    const f = nextFixture(career);
                    if (career.messages.some((m) => blocks(career, m))) setTab(TAB.NOTIFICATIONS);
                    else if (f && f.date <= career.date) setPopup('prematch');
                    else {
                      setOfficeSeasonView('table');
                      setTab(TAB.OFFICE);
                    }
                  }}
                  onTab={setTab}
                  onPreferences={() => {
                    prefsFromPause.current = false;
                    setPopup('prefs');
                  }}
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
              {tab === TAB.SQUAD && (
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
                  onSetClause={(id, amount) =>
                    act(() => {
                      setCareer(setReleaseClause(career, id, amount));
                      setNotice('Multa rescisória atualizada.');
                    })
                  }
                  onLoanOut={(id, clubId, terms) =>
                    act(() => {
                      setCareer(loanOutPlayer(career, live!, id, clubId, terms));
                      setNotice(
                        transferWindow(career.date)
                          ? `Empréstimo concluído por ${terms.months} meses.`
                          : 'Empréstimo acertado. O atleta sai quando a janela abrir.',
                      );
                    })
                  }
                  onExerciseOption={(id) =>
                    act(() => {
                      setCareer(exerciseLoanOption(career, live!, id));
                      setNotice('Opção de compra exercida. O atleta é definitivamente do clube.');
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
                      if (lineup.length === 11)
                        Object.assign(updated, syncBenchWithLineup(updated, lineup));
                      setCareer(updated);
                      setDetail(null);
                      setNotice('Contrato rescindido. O atleta deixou o clube.');
                    })
                  }
                />
              )}
              {tab === TAB.TRANSFERS && (
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
                  onLoan={(id, terms) => {
                    let sent = false;
                    act(() => {
                      setCareer(createLoanOffer(career, live!, id, terms));
                      setNotice('Pedido de empréstimo enviado. A resposta chega amanhã.');
                      sent = true;
                    });
                    return sent;
                  }}
                  onExerciseOption={(id) =>
                    act(() => {
                      setCareer(exerciseLoanOption(career, live!, id));
                      setNotice('Opção de compra exercida. O atleta é definitivamente do clube.');
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
                      if (lineup.length === 11)
                        Object.assign(updated, syncBenchWithLineup(updated, lineup));
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
                      if (lineup.length === 11)
                        Object.assign(updated, syncBenchWithLineup(updated, lineup));
                      setCareer(updated);
                    })
                  }
                />
              )}
              {(tab === TAB.NOTIFICATIONS || tab === TAB.ACADEMY || tab === TAB.OFFICE) && (
                <Office
                  key={tab}
                  area={
                    tab === TAB.NOTIFICATIONS
                      ? 'notifications'
                      : tab === TAB.ACADEMY
                        ? 'academy'
                        : 'office'
                  }
                  career={career}
                  world={live!}
                  busy={busy}
                  aiAvailable={Boolean(supabase) && !offline}
                  initialSeasonView={officeSeasonView ?? undefined}
                  onChange={setCareer}
                  onError={fail}
                  onManager={(manager) =>
                    act(() => {
                      setCareer(updateManager(career, manager));
                    })
                  }
                  onPromote={(id) =>
                    act(() => {
                      setCareer(promoteAcademyPlayer(career, id));
                      setNotice('Atleta promovido ao elenco profissional.');
                    })
                  }
                  onMessage={(id, choice) =>
                    act(() => setCareer(respondMessage(career, id, choice)))
                  }
                  onRead={(id) => {
                    setCareer((current) => {
                      if (!current || current.messages.find((message) => message.id === id)?.read)
                        return current;
                      return {
                        ...current,
                        messages: current.messages.map((message) =>
                          message.id === id ? { ...message, read: true } : message,
                        ),
                      };
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
                      const name = career.scouts.find((s) => s.id === id)?.name;
                      setCareer(fireScout(career, id));
                      setNotice(`${name || 'Olheiro'} foi dispensado. A vaga está livre na rede.`);
                    })
                  }
                  onReassignScout={(id, region) =>
                    act(() => {
                      setCareer(reassignScout(career, id, region));
                      setNotice(`Olheiro realocado para ${region}. A observação recomeça do zero.`);
                    })
                  }
                  onSignProspect={(id) =>
                    act(() => {
                      setCareer(signProspect(career, id));
                      setNotice('Jovem talento integrado às categorias de base.');
                    })
                  }
                  onReviewAcademy={(id, decision) =>
                    act(() => {
                      setCareer(reviewAcademyCandidate(career, id, decision));
                      setNotice(
                        decision === 'promote'
                          ? 'Candidato integrado ao elenco profissional.'
                          : 'Candidato dispensado da peneira.',
                      );
                    })
                  }
                  onSimulateTo={simulateTo}
                  onAcceptJob={(id) =>
                    act(() => {
                      setCareer(acceptJobOffer(career, live!, id));
                      setNotice('Novo clube aceito. A carreira continua em um novo desafio.');
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
            </>
          ))}
      </main>
      <footer className="app-footer">
        <div className="hints">
          <ControllerButtonHint action="confirm" label="Selecionar" />
          <ControllerButtonHint action="back" label="Voltar" />
          {screen === 'career' && !inMatch && (
            <>
              {tab === TAB.CENTRAL && (
                <ControllerButtonHint action="secondary" label="Avançar dia" />
              )}
              <ControllerButtonHint action="nextView" label="Sub-menu" />
              <ControllerButtonHint action="menu" label="Pausa" />
            </>
          )}
        </div>
        {career && screen === 'career' && (
          <span className={`save-status ${saveState}`} role="status" hidden={saveState !== 'error'}>
            {saveState === 'saving' ? (
              <LoaderCircle size={15} className="spin" />
            ) : saveState === 'saved' ? (
              <CheckCircle2 size={15} />
            ) : (
              <X size={15} />
            )}
            {saveState === 'saving'
              ? 'SALVANDO LOCAL'
              : saveState === 'saved'
                ? 'SALVO LOCAL'
                : 'ERRO NO SAVE LOCAL'}
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
      {busy && (
        <div className="busy-indicator" role="status">
          <LoaderCircle className="spin" size={17} /> Processando…
        </div>
      )}
      {popup === 'load' && (
        <Modal title="Carregar jogo" onClose={() => setPopup(null)} wide>
          {saves.length ? (
            <SavedGameList
              saves={saves}
              onContinue={(record) => act(() => continueCareer(record))}
              onDelete={setDeleting}
            />
          ) : (
            <p>Nenhuma carreira salva. Volte ao menu para começar uma nova carreira.</p>
          )}
        </Modal>
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
                {busy ? (
                  <>
                    <LoaderCircle className="spin" size={18} /> CARREGANDO ELENCOS…
                  </>
                ) : (
                  <>
                    JOGAR <ArrowRight size={18} />
                  </>
                )}
              </span>
            </button>
          </div>
        </Modal>
      )}
      {popup === 'contract' && career && world && club && (
        <Modal
          title="Proposta da presidência"
          onClose={() => undefined}
          wide
          className="onboarding-modal contract-modal"
        >
          <div className={`contract-document ${contractSigning ? 'signing' : ''}`}>
            <div className="contract-heading">
              <Badge club={club} size="large" />
              <div>
                <span className="eyebrow">TERMO DE CONTRATAÇÃO · TEMPORADA {career.season}</span>
                <h2>{club.name}</h2>
                <p>
                  A presidência oferece a {career.manager.formOfAddress || 'Sr.'}{' '}
                  {career.manager.firstName} {career.manager.lastName} o cargo de treinador
                  principal.
                </p>
              </div>
            </div>
            <div className="contract-finances">
              <div>
                <span>Orçamento de transferências</span>
                <strong>{money(career.finances[club.id]?.transferBudget ?? club.budget)}</strong>
              </div>
              <div>
                <span>Caixa do clube</span>
                <strong>{money(career.finances[club.id]?.cash ?? club.budget * 2)}</strong>
              </div>
              <div>
                <span>Dívida registrada</span>
                <strong>{money(career.finances[club.id]?.debt ?? club.debt)}</strong>
              </div>
              <div className="salary">
                <span>Salário semanal</span>
                <strong>{money(Math.round((club.reputation * 10000) / 4))}</strong>
              </div>
            </div>
            <section className="contract-objectives">
              <h3>Objetivos da temporada</h3>
              <ul>
                <li>
                  {club.league === 'A'
                    ? 'Buscar uma colocação entre os seis primeiros.'
                    : 'Disputar o acesso e manter o clube competitivo.'}
                </li>
                <li>
                  Desafio {career.challenge}: {contractChallengeObjectives[career.challenge]}
                </li>
              </ul>
            </section>
            <div className="contract-signature">
              <div className="signature-line">
                {contractSigning && (
                  <span className="signature-mark" aria-label="Assinando">
                    {career.manager.firstName} {career.manager.lastName}
                  </span>
                )}
              </div>
              <span>
                {career.manager.firstName} {career.manager.lastName} · treinador
              </span>
            </div>
            <button
              className="primary big contract-sign-button"
              data-autofocus
              disabled={contractSigning}
              onClick={signContract}
            >
              {contractSigning ? 'Assinando contrato…' : 'Assinar contrato'}
              <CheckCircle2 size={19} />
            </button>
          </div>
        </Modal>
      )}
      {popup === 'tutorial' && career && (
        <Modal
          title="Primeiros passos"
          onClose={finishTutorial}
          className="onboarding-modal tutorial-modal"
        >
          <div className="tutorial-content">
            <span className="eyebrow">
              ORIENTAÇÃO {tutorialStep + 1} DE {onboardingTour.length}
            </span>
            <h2>{onboardingTour[tutorialStep].title}</h2>
            <p>{onboardingTour[tutorialStep].body}</p>
            <div className="tutorial-progress" aria-hidden="true">
              {onboardingTour.map((step, index) => (
                <span
                  key={step.title}
                  className={index === tutorialStep ? 'active' : index < tutorialStep ? 'done' : ''}
                />
              ))}
            </div>
            <div className="button-row tutorial-actions">
              <button onClick={finishTutorial}>Pular tutorial</button>
              <button
                className="primary"
                data-autofocus
                onClick={() => {
                  if (tutorialStep === onboardingTour.length - 1) finishTutorial();
                  else setTutorialStep((step) => step + 1);
                }}
              >
                {tutorialStep === onboardingTour.length - 1 ? 'Concluir' : 'Próximo'}
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {popup === 'pause' && career && world && (
        <Modal
          title={inMatch ? 'Jogo pausado' : 'Pausa'}
          onClose={() => setPopup(null)}
          className="hub-modal pause-modal"
        >
          <div className="hub-dialog-summary">
            {club && <Badge club={club} size="small" />}
            <span>
              <strong>{club?.name}</strong>
              <small>
                {dateLabel(career.date, true)} · {career.manager.firstName}{' '}
                {career.manager.lastName}
              </small>
            </span>
          </div>
          <div className="pause-options">
            <button className="primary" data-autofocus onClick={() => setPopup(null)}>
              <ArrowLeft size={18} /> Continuar
            </button>
            <button onClick={controller.toggleVibration}>
              {controller.vibration ? <Vibrate size={18} /> : <VibrateOff size={18} />}
              Vibração: {controller.vibration ? 'Ligada' : 'Desligada'}
            </button>
            <button onClick={toggleMusic}>
              Trilha eletrônica: {audio.music ? 'Ligada' : 'Desligada'} · 10 faixas
            </button>
            <button onClick={toggleCrowd}>
              Som de torcida: {audio.crowd ? 'Ligado' : 'Desligado'}
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
            {!inMatch && (
              <button
                onClick={() => {
                  prefsFromPause.current = true;
                  setPopup('prefs');
                }}
              >
                <CalendarClock size={18} /> Avanço do calendário:{' '}
                {advanceModes.find((m) => m.id === (career.prefs?.advance || 'day'))?.title}
              </button>
            )}
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
      {popup === 'prefs' && career && (
        <Modal
          title="Preferências de avanço"
          onClose={() => setPopup(prefsFromPause.current ? 'pause' : null)}
          className="hub-modal prefs-modal"
          wide
        >
          <p className="prefs-intro">
            Escolha como o calendário progride ao usar{' '}
            <ControllerButtonHint action="secondary" label="Avançar" />.
          </p>
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
                <em className="pref-state">
                  {career.prefs.advance === m.id ? 'MODO ATIVO' : 'SELECIONAR MODO'}
                </em>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {running && career && live && advanceStartedAt && (
        <AdvanceOverlay
          career={career}
          world={live}
          startedAt={advanceStartedAt}
          played={played}
          onStop={stopRunning}
        />
      )}
      {popup === 'prematch' && career && world && (
        <Modal title="Dia de jogo" onClose={() => setPopup(null)} className="prematch-modal" wide>
          <div className="matchday-overview">
            <div className="matchday-kicker">
              <p className="eyebrow">
                <CalendarDays size={15} /> {dateLabel(career.date, true)}
              </p>
              {matchdayLabel && (
                <span>
                  {matchdayLabel.name} · {matchdayLabel.stage}
                </span>
              )}
            </div>
            {matchdayFixture && matchdayHome && matchdayAway ? (
              <section
                className="matchday-fixture"
                aria-label={`${matchdayHome.name} contra ${matchdayAway.name}`}
              >
                <div className="matchday-team home">
                  <Badge club={matchdayHome} size="large" />
                  <div>
                    <small>
                      {matchdayFixture.homeId === career.clubId ? 'MANDANTE' : 'VISITANTE'}
                    </small>
                    <strong>{matchdayHome.name}</strong>
                  </div>
                </div>
                <div className="matchday-versus">
                  <span>VS</span>
                  <small>{matchdayLabel?.stage}</small>
                </div>
                <div className="matchday-team away">
                  <div>
                    <small>
                      {matchdayFixture.awayId === career.clubId ? 'MANDANTE' : 'VISITANTE'}
                    </small>
                    <strong>{matchdayAway.name}</strong>
                  </div>
                  <Badge club={matchdayAway} size="large" />
                </div>
                <p className="matchday-venue">
                  <MapPin size={15} /> {matchdayHome.stadium}
                </p>
              </section>
            ) : (
              <p className="muted">Não há partida disponível para exibir agora.</p>
            )}
            <div className="matchday-details">
              <div className="matchday-plan">
                <span>PLANO DE JOGO</span>
                <strong>{career.tactic.formation}</strong>
                <small>{career.tactic.mentality}</small>
              </div>
              <section className="matchday-absences" aria-label="Desfalques do elenco">
                <h3>
                  <ShieldAlert size={16} /> Desfalques confirmados
                </h3>
                {matchdayUnavailable.length ? (
                  <ul>
                    {matchdayUnavailable.slice(0, 5).map((player) => {
                      const state = career.players[player.id];
                      if (!state) return null;
                      return (
                        <li key={player.id}>
                          <PlayerFace player={player} size="sm" />
                          <span>
                            <strong>{player.name}</strong>
                            <small>
                              {state.injuryDays
                                ? `Lesão · ${state.injuryDays} dia${state.injuryDays === 1 ? '' : 's'}`
                                : state.suspension
                                  ? `Suspensão · ${state.suspension} jogo${state.suspension === 1 ? '' : 's'}`
                                  : 'Condição insuficiente'}
                            </small>
                          </span>
                        </li>
                      );
                    })}
                    {matchdayUnavailable.length > 5 && (
                      <li className="matchday-more">
                        +{matchdayUnavailable.length - 5} outros desfalques
                      </li>
                    )}
                  </ul>
                ) : (
                  <p>
                    <HeartPulse size={15} /> Nenhuma lesão ou suspensão registrada.
                  </p>
                )}
              </section>
            </div>
          </div>
          <div className="button-row matchday-actions">
            <button
              data-controller-info
              onClick={() => {
                setPopup(null);
                setTab(TAB.SQUAD);
              }}
            >
              Revisar escalação{' '}
              <span aria-hidden="true">
                <ControllerButtonHint action="info" label="" />
              </span>
            </button>
            <button
              className="primary"
              data-autofocus=""
              data-controller-secondary
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
              <span aria-hidden="true">
                <ControllerButtonHint action="secondary" label="" />
              </span>
            </button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title="Excluir carreira?" onClose={() => setDeleting(null)}>
          <div className="delete-save-summary">
            <strong>
              {deleting.career.manager.firstName} {deleting.career.manager.lastName}
            </strong>
            <span>
              {deleting.world.clubs.find((c) => c.id === deleting.career.clubId)?.name} ·{' '}
              {dateLabel(deleting.career.date)}
            </span>
            <p>Esta ação não pode ser desfeita. O backup em nuvem não será removido.</p>
          </div>
          <div className="button-row">
            <button onClick={() => setDeleting(null)}>Cancelar</button>
            <button
              className="danger"
              onClick={() =>
                run(async () => {
                  const previous = latestSave.current;
                  const deletingCurrent = previous.career?.id === deleting.career.id;
                  if (deletingCurrent) {
                    latestSave.current = { career: null, world: null };
                    setCareer(null);
                    setWorld(null);
                  }
                  try {
                    await queue.current;
                    await removeLocal(deleting.career.id);
                  } catch (error) {
                    if (deletingCurrent) {
                      latestSave.current = previous;
                      setCareer(previous.career);
                      setWorld(previous.world);
                    }
                    throw error;
                  }
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
