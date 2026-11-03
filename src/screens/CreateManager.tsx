import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Dices, Flag, UserRound } from 'lucide-react';
import { Badge, ManagerPortrait, money, SectionTitle } from '../components/ui';
import {
  challenges,
  difficulties,
  managerSchema,
  type Career,
  type Manager,
  type World,
} from '../game/types';
import { useControllerActions } from '../controller/GamepadProvider';

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

export function CreateManager({
  world,
  onStart,
  onBack,
  onError,
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
}) {
  const [step, setStep] = useState(0);
  const [manager, setManager] = useState<Manager>({
    firstName: '',
    lastName: '',
    nationality: 'Brasil',
    age: 30,
    style: 'Terno azul',
    appearance: 'Cabelo curto, barba curta, aparência jovem',
  });
  const [league, setLeague] = useState<'A' | 'B'>('A');
  const [clubId, setClub] = useState('sao-paulo');
  const [challenge, setChallenge] = useState<Career['challenge']>('Realista');
  const [difficulty, setDifficulty] = useState<Career['difficulty']>('Amador');
  const club = world.clubs.find((c) => c.id === clubId) || world.clubs[0];
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
  useControllerActions({
    back,
    previousTab: back,
    nextTab: () => {
      if (step < 2) next();
    },
  });
  return (
    <div className="creation screen-enter">
      <div className="step-track">
        {['SEU MANAGER', 'SEU CLUBE', 'SEU DESAFIO'].map((label, i) => (
          <span className={i === step ? 'active' : i < step ? 'done' : ''} key={label}>
            <b>{i < step ? <Check size={14} /> : `0${i + 1}`}</b>
            {label}
          </span>
        ))}
      </div>
      {world.mode === 'demo' && (
        <p className="demo-banner">
          MODO DEMONSTRAÇÃO · Atletas, atributos e finanças são sintéticos. Não é o elenco real de
          2026.
        </p>
      )}
      {step === 0 && (
        <>
          <SectionTitle kicker="NOVA CARREIRA / 01" title="Quem assume o Mando?" />
          <div className="creation-grid">
            <section className="panel manager-form">
              <div className="panel-heading">
                <UserRound size={20} />
                <h2>Uma identidade. Seu estilo.</h2>
              </div>
              <div className="form-grid">
                <label>
                  Nome
                  <input
                    value={manager.firstName}
                    maxLength={35}
                    placeholder="Seu nome"
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
                <label>
                  Nacionalidade
                  <select
                    value={manager.nationality}
                    onChange={(e) => setManager({ ...manager, nationality: e.target.value })}
                  >
                    {[
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
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Idade
                  <input
                    type="number"
                    min={18}
                    max={85}
                    value={manager.age}
                    onChange={(e) => setManager({ ...manager, age: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Roupa
                  <select
                    value={manager.style}
                    onChange={(e) =>
                      setManager({ ...manager, style: e.target.value as Manager['style'] })
                    }
                  >
                    {['Terno azul', 'Agasalho', 'Camisa social'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Aparência para o retrato por IA
                  <textarea
                    value={manager.appearance}
                    maxLength={400}
                    rows={3}
                    onChange={(e) => setManager({ ...manager, appearance: e.target.value })}
                  />
                </label>
              </div>
              <p className="muted small">
                O retrato pode ser gerado no escritório após sincronizar uma carreira oficial.
                Nenhuma chave fica no navegador.
              </p>
            </section>
            <div className="portrait-panel">
              <span className="portrait-grid" />
              <p className="eyebrow">À BEIRA DO CAMPO</p>
              <ManagerPortrait manager={manager} large />
              <div className="portrait-caption">
                <span>MANAGER</span>
                <h2>
                  {manager.firstName || 'Seu nome'} {manager.lastName}
                </h2>
                <p>
                  {manager.nationality} · {manager.age} anos
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <SectionTitle kicker="NOVA CARREIRA / 02" title="Qual camisa pesa mais?">
            <button
              onClick={() => {
                const list = world.clubs.filter((c) => c.league === league);
                setClub(
                  list[
                    Math.floor(
                      (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * list.length,
                    )
                  ].id,
                );
              }}
            >
              <Dices size={18} /> Clube aleatório
            </button>
          </SectionTitle>
          <div className="segmented">
            {(['A', 'B'] as const).map((l) => (
              <button key={l} className={league === l ? 'active' : ''} onClick={() => setLeague(l)}>
                BRASILEIRÃO SÉRIE {l}
              </button>
            ))}
          </div>
          <div className="club-grid">
            {world.clubs
              .filter((c) => c.league === league)
              .map((c) => (
                <button
                  key={c.id}
                  className={`club-option ${club.id === c.id ? 'selected' : ''}`}
                  onClick={() => setClub(c.id)}
                  aria-pressed={club.id === c.id}
                >
                  <Badge club={c} />
                  <h3>{c.name}</h3>
                  <span className="stars">
                    {'★'.repeat(Math.max(1, Math.round(c.reputation / 20)))}
                  </span>
                  <p>
                    {money(c.budget)} <span>orçamento</span>
                  </p>
                  <small>
                    {world.players.filter((p) => p.clubId === c.id).length} atletas · {c.state}
                  </small>
                  {club.id === c.id && <Check className="selected-check" size={18} />}
                </button>
              ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <SectionTitle kicker="NOVA CARREIRA / 03" title="Toda história tem um desafio." />
          <div className="challenge-layout">
            <section>
              <h2 className="subheading">AS REGRAS DA SUA CARREIRA</h2>
              <div className="challenge-grid">
                {challenges.map((ch) => (
                  <button
                    key={ch}
                    className={`choice-card ${challenge === ch ? 'selected' : ''}`}
                    aria-pressed={challenge === ch}
                    onClick={() => setChallenge(ch)}
                  >
                    <Flag size={19} />
                    <h3>{ch}</h3>
                    <p>{challengeDescriptions[ch]}</p>
                  </button>
                ))}
              </div>
            </section>
            <section className="panel">
              <p className="eyebrow">A EXPERIÊNCIA</p>
              <h2>Dificuldade</h2>
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
              <p className="muted small">
                Nenhum nível aumenta artificialmente os atributos do adversário.
              </p>
            </section>
          </div>
        </>
      )}
      <div className="creation-footer">
        <button className="text-button" onClick={back}>
          <ArrowLeft size={17} /> Voltar
        </button>
        <div className="selected-club">
          <Badge club={club} size="small" />
          <span>
            {club.name}
            <small>
              01 JAN 2026 · {world.mode === 'demo' ? 'Demonstração' : 'Snapshot oficial'}
            </small>
          </span>
        </div>
        <button className="primary" onClick={next}>
          {step === 2 ? 'Assumir o clube' : 'Continuar'}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
