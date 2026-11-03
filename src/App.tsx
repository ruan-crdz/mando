import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gamepad2,
  LoaderCircle,
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
  validateCareerForWorld,
} from './game/engine';
import { bestLineup, beginMatch, substitute } from './game/matches';
import { careerWorld } from './game/live';
import { nextFixture } from './game/calendar';
import { answerIncoming, createOffer, renewContract } from './game/transfers';
import { type Career, type Player, type World } from './game/types';
import { listLocal, removeLocal, saveLocal, type SavedCareer } from './services/storage';
import {
  ensureSession,
  requestPortrait,
  saveCloud,
  supabase,
} from './services/supabase';
import { registerSW } from 'virtual:pwa-register';

const tabs = ['CENTRAL', 'TIME', 'TRANSFERÊNCIAS', 'ESCRITÓRIO', 'TEMPORADA'];
type Popup = 'world' | 'pause' | 'prematch' | null;

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
  const fail = useCallback(
    (message: string) => {
      setError(message);
      setNotice('');
      rumble('error');
    },
    [rumble],
  );
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
  useControllerActions(
    screen === 'create' || busy
      ? {}
      : {
          back: () => {
            if (detail) setDetail(null);
            else if (deleting) setDeleting(null);
            else if (popup) setPopup(null);
            else if (screen === 'career') setPopup('pause');
          },
          previousTab: () => switchTab(-1),
          nextTab: () => switchTab(1),
          secondary: () => {
            if (career && screen === 'career' && !career.activeMatch && !popup)
              act(() => setCareer(advanceDay(career, live!)));
          },
          info: () => {
            if (screen === 'career' && !career?.activeMatch && !popup) setTab(3);
          },
          menu: () => {
            if (screen === 'career') setPopup((p) => (p === 'pause' ? null : 'pause'));
          },
        },
  );
  const portrait = (manager: Career['manager']) =>
    requestPortrait({
      firstName: manager.firstName,
      lastName: manager.lastName,
      age: manager.age,
      nationality: manager.nationality,
      style: manager.style,
      appearance: manager.appearance,
    });
  const club = career && world?.clubs.find((club) => club.id === career.clubId);
  const inMatch = Boolean(career?.activeMatch);
  return (
    <div className={`game-shell input-${controller.input} on-${screen}${inMatch ? ' in-match' : ''}`}>
      <div className="bg-stage" aria-hidden="true">
        <i className="beam b1" />
        <i className="beam b2" />
        <i className="beam b3" />
      </div>
      <header className="app-header">
        <div className="brand" aria-label="Mando">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo-mando-160.png`} alt="" />
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
        inert={popup || deleting || busy ? true : undefined}
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
                  setCareer(finishMatch(career, live!));
                  setTab(0);
                })
              }
              onSubstitute={(outId, inId) =>
                act(() => setCareer(substitute(career, live!, outId, inId)))
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
                  onAdvance={() => act(() => setCareer(advanceDay(career, live!)))}
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
                      setNotice('Proposta enviada. A resposta chega em dois dias.');
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
                  onAnswer={(id, accept) =>
                    act(() => {
                      const updated = answerIncoming(career, live!, id, accept);
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
                  onAvatar={() =>
                    run(async () => {
                      const url = await portrait(career.manager);
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
          <button
            aria-label="Fechar aviso"
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            <X size={18} />
          </button>
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
            <button onClick={controller.toggleSound}>
              {controller.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              Sons do menu: {controller.sound ? 'Ligados' : 'Desligados'}
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
      {popup === 'prematch' && career && world && (
        <Modal title="Dia de jogo" onClose={() => setPopup(null)}>
          <div className="prematch-info">
            <p className="eyebrow">{dateLabel(career.date, true)}</p>
            <h2>
              {career.tactic.formation} · {career.tactic.mentality}
            </h2>
            <p>Confira lesões, suspensões e condição física antes de entrar em campo.</p>
          </div>
          <div className="button-row">
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
