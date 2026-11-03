import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Download,
  Gamepad2,
  LoaderCircle,
  Menu,
  Settings2,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { type User } from '@supabase/supabase-js';
import { GamepadProvider, useControllerActions, useGamepad } from './controller/GamepadProvider';
import { ControllerButtonHint } from './controller/ControllerButtonHint';
import { Badge, dateLabel, Modal, money } from './components/ui';
import { Connection } from './components/Connection';
import { MainMenu } from './screens/MainMenu';
import { CreateManager } from './screens/CreateManager';
import { CareerCentral } from './screens/CareerCentral';
import { Squad } from './screens/Squad';
import { Transfers } from './screens/Transfers';
import { Office } from './screens/Office';
import { Season } from './screens/Season';
import { MatchScreen } from './screens/Match';
import { createDemoWorld } from './game/world';
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
import { type Career, type Message, type Player, type World } from './game/types';
import {
  exportSave,
  importSave,
  listLocal,
  removeLocal,
  saveLocal,
  type SavedCareer,
} from './services/storage';
import {
  listCloud,
  loadPublishedWorld,
  requestAi,
  requestAvatar,
  saveCloud,
  supabase,
} from './services/supabase';
import { registerSW } from 'virtual:pwa-register';

const tabs = ['CENTRAL', 'TIME', 'TRANSFERÊNCIAS', 'ESCRITÓRIO', 'TEMPORADA'];
type Popup = 'connection' | 'world' | 'pause' | 'prematch' | 'cloud' | null;
type CloudRecord = Awaited<ReturnType<typeof listCloud>>[number];

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
  const [cloudSaves, setCloudSaves] = useState<CloudRecord[]>([]);
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
  const revisions = useRef(new Map<string, number>());
  const lastSaved = useRef<Career | null>(null);
  const lock = useRef(false);
  const fail = useCallback((message: string) => {
    setError(message);
    setNotice('');
  }, []);
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
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) fail(error.message);
      else setUser(data.session?.user || null);
    });
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
        fail(
          `Save local não gravado: ${e instanceof Error ? e.message : String(e)}. Exporte sua carreira antes de sair.`,
        );
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
    async (current: Career) => {
      if (!world) throw new Error('Mundo não carregado.');
      await queue.current;
      const revision = await saveCloud(current, revisions.current.get(current.id) || 0);
      revisions.current.set(current.id, revision);
      await saveLocal(current, world, revision);
      setNotice('Carreira sincronizada com o Supabase.');
    },
    [world],
  );
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
            if (!popup) setPopup('connection');
          },
          menu: () => {
            if (screen === 'career') setPopup((p) => (p === 'pause' ? null : 'pause'));
          },
        },
  );
  const ai = (m: Message) =>
    run(async () => {
      if (!career) return;
      await sync(career);
      const response = await requestAi(
        career.id,
        m.id,
        m.kind === 'news' ? 'news' : m.kind === 'staff' ? 'staff' : 'message',
      );
      const updated = {
        ...career,
        messages: career.messages.map((msg) =>
          msg.id === m.id ? { ...msg, aiText: response.message } : msg,
        ),
      };
      setCareer(updated);
      await sync(updated);
    });
  const loadCloudList = () =>
    run(async () => {
      setCloudSaves(await listCloud());
      setPopup('cloud');
    });
  const club = career && world?.clubs.find((club) => club.id === career.clubId);
  const isAdmin = user?.app_metadata?.role === 'admin';
  return (
    <div className={`game-shell input-${controller.input}`}>
      <header className="app-header">
        <button
          className="brand"
          onClick={screen === 'menu' ? () => setPopup('world') : menu}
          aria-label="Mando, menu principal"
        >
          <span className="brand-mark">M</span>
          <span>
            MANDO<small>CARREIRA DE MANAGER</small>
          </span>
        </button>
        {screen === 'career' && career && club && (
          <div className="club-header">
            <Badge club={club} size="small" />
            <span>
              <strong>{club.name}</strong>
              <small>
                {career.manager.firstName} {career.manager.lastName}
              </small>
            </span>
            <i />
            <span>
              {dateLabel(career.date)}
              <small>TEMPORADA {career.season}</small>
            </span>
            <i />
            <span>
              <strong>{money(career.finances[career.clubId].cash)}</strong>
              <small>CAIXA DISPONÍVEL</small>
            </span>
          </div>
        )}
        <div className="header-actions">
          {career && screen === 'career' && (
            <button
              className={`save-status ${saveState}`}
              title="Exportar backup da carreira"
              onClick={() => exportSave(career, world!)}
            >
              {saveState === 'saving' ? (
                <LoaderCircle size={15} className="spin" />
              ) : saveState === 'saved' ? (
                <CheckCircle2 size={15} />
              ) : (
                <Download size={15} />
              )}
              <span>
                {saveState === 'saving'
                  ? 'SALVANDO'
                  : saveState === 'saved'
                    ? 'SALVO LOCAL'
                    : 'ERRO NO SAVE'}
              </span>
            </button>
          )}
          {offline && (
            <span title="Offline">
              <WifiOff size={17} />
            </span>
          )}
          <span
            className={`controller-status ${controller.connected ? 'connected' : ''}`}
            title={controller.connected || 'Conecte um controle e pressione um botão'}
          >
            <Gamepad2 size={21} />
            <span>{controller.connected ? 'CONECTADO' : 'CONTROLE'}</span>
          </span>
          <button
            className="icon-button"
            aria-label={controller.sound ? 'Desativar sons' : 'Ativar sons'}
            onClick={controller.toggleSound}
          >
            {controller.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label="Conexão e configurações"
            onClick={() => setPopup('connection')}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      {screen === 'career' && !career?.activeMatch && (
        <nav className="main-nav" aria-label="Áreas do clube">
          <span className="nav-shoulder">{controller.hints.previousTab}</span>
          {tabs.map((name, i) => (
            <button
              key={name}
              onClick={() => setTab(i)}
              className={tab === i ? 'active' : ''}
              aria-current={tab === i ? 'page' : undefined}
            >
              <span>0{i + 1}</span>
              {name}
              {i === 3 && career!.messages.some((m) => m.important && !m.resolved) && (
                <b className="nav-dot" />
              )}
            </button>
          ))}
          <span className="nav-shoulder">{controller.hints.nextTab}</span>
          <button
            className="nav-menu"
            aria-label="Menu da carreira"
            onClick={() => setPopup('pause')}
          >
            <Menu size={19} />
          </button>
        </nav>
      )}
      <main inert={popup || deleting || busy ? true : undefined}>
        {screen === 'menu' && (
          <MainMenu
            saves={saves}
            onContinue={(record) => act(() => continueCareer(record))}
            onNew={() => setPopup('world')}
            onSettings={() => setPopup('connection')}
            onImport={(file) =>
              run(async () => {
                const record = await importSave(file);
                continueCareer(record);
              })
            }
            onDelete={setDeleting}
          />
        )}
        {screen === 'create' && world && (
          <CreateManager
            world={world}
            onError={fail}
            onBack={() => setScreen('menu')}
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
                <p className="demo-strip">
                  DEMONSTRAÇÃO · Atletas e finanças sintéticos · Mundo oficial requer importação
                  autorizada
                </p>
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
                  onRenew={(id) =>
                    act(() => {
                      setCareer(renewContract(career, live!, id));
                      setNotice('Contrato renovado. Luvas debitadas do caixa.');
                    })
                  }
                />
              )}
              {tab === 2 && (
                <Transfers
                  career={career}
                  world={live!}
                  onOffer={(id, fee, wage, exchange) =>
                    act(() => {
                      setCareer(createOffer(career, live!, id, fee, wage, exchange));
                      setNotice('Proposta enviada. A resposta chega em dois dias.');
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
                  aiAvailable={Boolean(user)}
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
                  onAi={ai}
                  onAvatar={() =>
                    run(async () => {
                      await sync(career);
                      const url = await requestAvatar(career.id);
                      const updated = { ...career, manager: { ...career.manager, avatar: url } };
                      setCareer(updated);
                      await sync(updated);
                    })
                  }
                />
              )}
              {tab === 4 && <Season career={career} world={live!} />}
            </>
          ))}
      </main>
      <footer className="app-footer">
        <div>
          <ControllerButtonHint action="confirm" label="Selecionar" />
          <ControllerButtonHint action="back" label="Voltar" />
          {screen === 'career' && !career?.activeMatch && (
            <>
              <ControllerButtonHint action="previousTab" label="Aba anterior" />
              <ControllerButtonHint action="nextTab" label="Próxima aba" />
              <ControllerButtonHint action="secondary" label="Avançar dia" />
            </>
          )}
        </div>
        <span>
          MANDO <i />{' '}
          {screen === 'career' ? 'SUA CARREIRA, SUA HISTÓRIA' : 'O FUTEBOL COMEÇA NA SUA DECISÃO'}
        </span>
      </footer>
      {controller.unsupported && (
        <div className="compatibility-note" role="status">
          Controle detectado sem mapeamento padrão. Use teclado ou ative o modo XInput do controle.
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
      {popup === 'connection' && (
        <Connection
          userEmail={user?.email || null}
          isAdmin={isAdmin}
          busy={busy}
          run={run}
          onClose={() => setPopup(null)}
          onCloudLoad={loadCloudList}
        />
      )}
      {popup === 'world' && (
        <Modal title="Onde sua história começa?" onClose={() => setPopup(null)}>
          <div className="world-options">
            <button
              className="world-option official"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setWorld(await loadPublishedWorld());
                  setCareer(null);
                  setScreen('create');
                  setPopup(null);
                })
              }
            >
              <Cloud size={29} />
              <h2>Carreira oficial</h2>
              <p>
                Snapshot autorizado e congelado em 01/01/2026. Requer Supabase configurado e um
                mundo publicado.
              </p>
              <span>
                CARREGAR MUNDO <ArrowRight size={17} />
              </span>
            </button>
            <button
              className="world-option"
              onClick={() =>
                act(() => {
                  setWorld(createDemoWorld());
                  setCareer(null);
                  setScreen('create');
                  setPopup(null);
                })
              }
            >
              <Gamepad2 size={29} />
              <h2>Experimentar a demonstração</h2>
              <p>
                40 clubes, 1.120 atletas sintéticos, temporada completa e save local. Nuvem e IA
                opcionais com login. Não representa os elencos reais.
              </p>
              <span>
                JOGAR OFFLINE <ArrowRight size={17} />
              </span>
            </button>
          </div>
          <p className="muted small">
            Não temos uma base licenciada de atletas reais incluída. A demonstração está
            identificada em todas as telas.
          </p>
        </Modal>
      )}
      {popup === 'pause' && career && world && (
        <Modal
          title={career.activeMatch ? 'Jogo pausado' : 'Sua carreira'}
          onClose={() => setPopup(null)}
        >
          <div className="pause-options">
            <button className="primary" onClick={() => setPopup(null)}>
              <ArrowLeft size={17} /> Voltar ao clube
            </button>
            <button onClick={() => exportSave(career, world)}>
              <Download size={17} /> Exportar backup completo
            </button>
            <button disabled={busy || !user} onClick={() => run(() => sync(career))}>
              <CloudUpload size={17} /> Sincronizar com Supabase
            </button>
            <button onClick={() => setPopup('connection')}>
              <Settings2 size={17} /> Conexão e configurações
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
                Instalar Mando neste dispositivo
              </button>
            )}
            <button onClick={menu}>Salvar e ir ao menu principal</button>
          </div>
          <p className="muted small">
            O save local é automático. A sincronização na nuvem é manual para evitar sobrescrever
            outra sessão.
          </p>
        </Modal>
      )}
      {popup === 'prematch' && career && world && (
        <Modal title="É dia de defender a camisa." onClose={() => setPopup(null)}>
          <div className="prematch-info">
            <p className="eyebrow">{dateLabel(career.date, true)}</p>
            <h2>
              {career.tactic.formation} · {career.tactic.mentality}
            </h2>
            <p>
              Auxiliar: confira lesões, suspensões e condição física. Todas as mudanças em campo
              passam a valer nos próximos minutos.
            </p>
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
                })
              }
            >
              Começar partida <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {popup === 'cloud' && (
        <Modal title="Carreiras na nuvem" onClose={() => setPopup('connection')}>
          <p className="muted">
            Carregar substitui a cópia local desta mesma carreira. Exporte seu progresso local antes
            se ele estiver mais recente.
          </p>
          {cloudSaves.length ? (
            cloudSaves.map((s) => (
              <button
                key={s.career.id}
                className="cloud-save"
                onClick={() =>
                  run(async () => {
                    await saveLocal(s.career, s.world, s.revision);
                    continueCareer({ ...s, cloudRevision: s.revision });
                  })
                }
              >
                <Cloud size={20} />
                <span>
                  <strong>
                    {s.career.manager.firstName} ·{' '}
                    {s.world.clubs.find((club) => club.id === s.career.clubId)!.name}
                  </strong>
                  <small>
                    {dateLabel(s.career.date)} · revisão {s.revision}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="empty-state">Nenhuma carreira sincronizada ainda.</p>
          )}
        </Modal>
      )}
      {deleting && (
        <Modal title="Excluir apenas deste navegador?" onClose={() => setDeleting(null)}>
          <p>O backup exportado e a cópia na nuvem não serão apagados.</p>
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
              Excluir carreira local
            </button>
          </div>
        </Modal>
      )}
      {updateReady && (
        <div className="pwa-update">
          <p>Uma atualização está pronta. Salve antes de recarregar.</p>
          <button
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
