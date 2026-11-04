import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, Dices, Flag, LoaderCircle } from 'lucide-react';
import { PortraitCamera } from '../components/PortraitCamera';
import { Badge, ManagerPortrait, money } from '../components/ui';
import {
  challenges,
  difficulties,
  managerSchema,
  type Career,
  type Manager,
  type World,
} from '../game/types';
import { useControllerActions, useGamepad } from '../controller/GamepadProvider';
import { ChipGroup, NumberStepper, OptionCycler } from '../components/controls';

const challengeDescriptions: Record<Career['challenge'], string> = {
  Realista: 'As condições iniciais do snapshot, sem modificadores.',
  'Do zero': 'Orçamento inicial de transferências zerado. Venda para reconstruir.',
  'Crise financeira': 'Dívida 60% maior e metade do caixa inicial.',
  'Só a base': 'Contrate apenas atletas até 23 anos. Três jovens devem começar cada partida.',
  'Venda necessária': 'Venda R$ 10 milhões em atletas antes de contratar.',
  'Pressão máxima': 'Confiança inicial menor. Derrotas pesam duas vezes mais.',
  Reconstrução: 'Veteranos começam com menor condição física e orçamento 40% menor.',
};
const difficultyDescriptions: Record<Career['difficulty'], string> = {
  Iniciante:
    'Informações claras, negociação tolerante, diretoria paciente e recomendações completas.',
  Amador: 'Negociação equilibrada, cobrança normal e adversários que reagem ao placar.',
  Profissional:
    'Scouting com incerteza, salários mais exigentes, moral sensível e ajustes táticos frequentes.',
};

const nationalities = [
  'Brasil',
  'Argentina',
  'Portugal',
  'Uruguai',
  'Chile',
  'Colômbia',
  'Espanha',
  'Itália',
  'França',
  'Alemanha',
  'Japão',
  'Angola',
];
const tileColors = [
  'tile-blue',
  'tile-green',
  'tile-orange',
  'tile-purple',
  'tile-pink',
  'tile-cyan',
];

export function CreateManager({
  world,
  onStart,
  onBack,
  onError,
  onPortrait,
}: {
  world: World;
  onStart: (
    manager: Manager,
    clubId: string,
    difficulty: Career['difficulty'],
    challenge: Career['challenge'],
  ) => void;
  onBack: () => void;
  onError: (message: string) => void;
  onPortrait: (manager: Manager, photo?: string) => Promise<string>;
}) {
  const { rumble } = useGamepad();
  const [step, setStep] = useState(0);
  const [manager, setManager] = useState<Manager>({
    firstName: '',
    lastName: '',
    nationality: 'Brasil',
    age: 38,
    style: 'Terno azul',
    appearance: 'Cabelo curto escuro, barba curta, olhos castanhos',
  });
  const [generating, setGenerating] = useState(false);
  const [camera, setCamera] = useState(false);
  const [league, setLeague] = useState<'A' | 'B'>('A');
  const [clubId, setClub] = useState('sao-paulo');
  const [challenge, setChallenge] = useState<Career['challenge']>('Realista');
  const [difficulty, setDifficulty] = useState<Career['difficulty']>('Amador');
  const carousel = useRef<HTMLDivElement>(null);
  const club = world.clubs.find((c) => c.id === clubId) || world.clubs[0];
  const clubs = world.clubs.filter((c) => c.league === league);
  useEffect(() => {
    if (step !== 1) return;
    carousel.current
      ?.querySelector<HTMLElement>('.club-option.selected')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [step, league]);
  const back = () => (step ? setStep(step - 1) : onBack());
  const next = () => {
    const result = managerSchema.safeParse(manager);
    if (!result.success) {
      onError(result.error.issues[0].message);
      return;
    }
    if (step === 2) onStart(result.data, club.id, difficulty, challenge);
    else setStep(step + 1);
  };
  const openCamera = () => {
    if (!manager.firstName.trim() || !manager.lastName.trim()) {
      onError('Preencha nome e sobrenome antes de gerar o retrato.');
      return;
    }
    setCamera(true);
  };
  const generate = async (photo?: string) => {
    setCamera(false);
    setGenerating(true);
    try {
      const avatar = await onPortrait(manager, photo);
      setManager((m) => ({ ...m, avatar }));
      rumble('confirm');
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };
  useControllerActions({
    back: () => {
      if (!camera) back();
    },
    previousTab: back,
    nextTab: () => {
      if (step < 2 && !camera) next();
    },
    info: () => {
      if (step === 0 && !generating && !camera) openCamera();
    },
  });
  return (
    <div className="screen creation">
      <div className="creation-top">
        <div className="step-track">
          {['MANAGER', 'CLUBE', 'DESAFIO'].map((label, i) => (
            <span className={i === step ? 'active' : i < step ? 'done' : ''} key={label}>
              <b>{i < step ? <Check size={14} /> : i + 1}</b>
              {label}
            </span>
          ))}
        </div>
        <h1 className="screen-title">
          {['Quem assume o Mando?', 'Escolha o seu clube', 'Toda história tem um desafio'][step]}
        </h1>
        {world.mode === 'demo' && <span className="demo-chip">DEMONSTRAÇÃO</span>}
      </div>
      {step === 0 && (
        <div className="creation-grid">
          <section className="panel manager-form">
            <div className="form-grid">
              <label>
                Nome
                <input
                  value={manager.firstName}
                  maxLength={35}
                  placeholder="Seu nome"
                  data-autofocus
                  onChange={(e) => setManager({ ...manager, firstName: e.target.value })}
                />
              </label>
              <label>
                Sobrenome
                <input
                  value={manager.lastName}
                  maxLength={45}
                  placeholder="Seu sobrenome"
                  onChange={(e) => setManager({ ...manager, lastName: e.target.value })}
                />
              </label>
              <OptionCycler
                label="Nacionalidade"
                value={manager.nationality}
                options={nationalities.map((s) => ({ value: s, label: s }))}
                onChange={(nationality) => setManager({ ...manager, nationality })}
              />
              <NumberStepper
                label="Idade"
                min={18}
                max={85}
                step={1}
                value={manager.age}
                onChange={(age) => setManager({ ...manager, age: age ?? 18 })}
              />
              <div className="full">
                <ChipGroup
                  label="Roupa"
                  value={manager.style}
                  options={(['Terno azul', 'Agasalho', 'Camisa social'] as const).map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  onChange={(style: Manager['style']) => setManager({ ...manager, style })}
                />
              </div>
              <label className="full">
                Aparência (para o retrato)
                <textarea
                  value={manager.appearance}
                  maxLength={400}
                  rows={2}
                  onChange={(e) => setManager({ ...manager, appearance: e.target.value })}
                />
              </label>
            </div>
          </section>
          <section className={`portrait-card ${generating ? 'generating' : ''}`}>
            <div className="portrait-frame">
              <ManagerPortrait manager={manager} large />
              {generating && (
                <div className="portrait-loading" role="status">
                  <LoaderCircle className="spin" size={42} />
                  <span>Produzindo seu retrato…</span>
                </div>
              )}
            </div>
            <div className="portrait-caption">
              <span>MANAGER</span>
              <h2>
                {manager.firstName || 'Seu nome'} {manager.lastName}
              </h2>
              <p>
                {manager.nationality} · {manager.age} anos
              </p>
            </div>
            <button className="ai-portrait-button" disabled={generating} onClick={openCamera}>
              <Camera size={18} />
              {generating
                ? 'Gerando…'
                : manager.avatar
                  ? 'Gerar outro retrato'
                  : 'Criar retrato com sua foto'}
            </button>
            {camera && (
              <PortraitCamera
                style={manager.style}
                onClose={() => setCamera(false)}
                onCapture={(photo) => void generate(photo)}
              />
            )}
          </section>
        </div>
      )}
      {step === 1 && (
        <div className="club-step">
          <div className="club-step-bar">
            <div className="segmented">
              {(['A', 'B'] as const).map((l) => (
                <button
                  key={l}
                  className={league === l ? 'active' : ''}
                  onClick={() => setLeague(l)}
                >
                  SÉRIE {l}
                </button>
              ))}
            </div>
            <button
              className="ghost-button"
              onClick={() =>
                setClub(
                  clubs[
                    Math.floor(
                      (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * clubs.length,
                    )
                  ].id,
                )
              }
            >
              <Dices size={18} /> Aleatório
            </button>
          </div>
          <div className="club-grid carousel" ref={carousel}>
            {clubs.map((c, i) => (
              <button
                key={c.id}
                className={`club-option ${tileColors[i % tileColors.length]} ${club.id === c.id ? 'selected' : ''}`}
                onClick={() => setClub(c.id)}
                onFocus={() => setClub(c.id)}
                aria-pressed={club.id === c.id}
              >
                <Badge club={c} size="large" />
                <h3>{c.name}</h3>
                <span className="stars">
                  {'★'.repeat(Math.max(1, Math.round(c.reputation / 20)))}
                  <i>{'★'.repeat(5 - Math.max(1, Math.round(c.reputation / 20)))}</i>
                </span>
                <p>
                  {money(c.budget)} <span>orçamento</span>
                </p>
                <small>
                  {world.players.filter((p) => p.clubId === c.id).length} atletas · {c.state}
                </small>
                {club.id === c.id && <Check className="selected-check" size={20} />}
              </button>
            ))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="challenge-layout">
          <div className="challenge-grid carousel">
            {challenges.map((ch, i) => (
              <button
                key={ch}
                className={`choice-card ${tileColors[i % tileColors.length]} ${challenge === ch ? 'selected' : ''}`}
                aria-pressed={challenge === ch}
                onClick={() => setChallenge(ch)}
              >
                <Flag size={24} />
                <h3>{ch}</h3>
                <p>{challengeDescriptions[ch]}</p>
                {challenge === ch && <Check className="selected-check" size={20} />}
              </button>
            ))}
          </div>
          <section className="difficulty-row">
            {difficulties.map((d) => (
              <button
                key={d}
                className={`difficulty-card ${difficulty === d ? 'selected' : ''}`}
                aria-pressed={difficulty === d}
                onClick={() => setDifficulty(d)}
              >
                <strong>{d}</strong>
                <p>{difficultyDescriptions[d]}</p>
              </button>
            ))}
          </section>
        </div>
      )}
      <div className="creation-footer">
        <button className="ghost-button" onClick={back}>
          <ArrowLeft size={17} /> Voltar
        </button>
        <div className="selected-club">
          <Badge club={club} size="small" />
          <span>
            {club.name}
            <small>01 JAN 2026</small>
          </span>
        </div>
        <button className="primary big" onClick={next}>
          {step === 2 ? 'Assumir o clube' : 'Continuar'}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
