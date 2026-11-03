import { useState } from 'react';
import { CheckCircle2, Cloud, FileUp, LogIn, LogOut, Upload } from 'lucide-react';
import { Modal } from './ui';
import { supabase, signIn, supabaseConfigError } from '../services/supabase';
import { parseWorldCsv, publishWorld } from '../services/importWorld';

export function Connection({
  userEmail,
  isAdmin,
  busy,
  onClose,
  run,
  onCloudLoad,
}: {
  userEmail: string | null;
  isAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  run: (operation: () => Promise<void>) => void;
  onCloudLoad: () => void;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [clubText, setClubs] = useState('');
  const [playerText, setPlayers] = useState('');
  const [source, setSource] = useState('');
  const [license, setLicense] = useState('');
  const [published, setPublished] = useState(false);
  return (
    <Modal title="Seu mundo conectado" onClose={onClose}>
      <div className="connection-status">
        <Cloud size={27} />
        <div>
          <h3>{supabase ? 'Supabase configurado' : 'Modo local ativo'}</h3>
          <p>
            {supabase
              ? 'Login, snapshots e saves na nuvem disponíveis.'
              : 'O jogo demonstrativo funciona offline. Para conectar, configure as duas variáveis públicas e faça o deploy das migrations e funções.'}
          </p>
        </div>
      </div>
      {supabaseConfigError && <p role="alert">{supabaseConfigError}</p>}
      {!supabase && (
        <div className="setup-instructions">
          <p className="eyebrow">CONFIGURAÇÃO DO FRONTEND</p>
          <pre>
            VITE_SUPABASE_URL=https://seu-projeto.supabase.co{'\n'}
            VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
          </pre>
          <p>
            A chave OpenAI é configurada exclusivamente nos Secrets das Edge Functions, nunca aqui.
            O guia completo está no README do projeto.
          </p>
        </div>
      )}
      {supabase && !userEmail && (
        <div className="login-form">
          <label>
            Seu e-mail
            <input
              type="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !email.includes('@')}
            onClick={() =>
              run(async () => {
                await signIn(email);
                setSent(true);
              })
            }
          >
            <LogIn size={17} /> Enviar link de acesso
          </button>
          {sent && (
            <p className="success-text">
              <CheckCircle2 size={16} /> Link enviado. Confira seu e-mail e mantenha esta origem na
              lista de URLs permitidas do Supabase.
            </p>
          )}
        </div>
      )}
      {userEmail && (
        <div className="logged-in">
          <p>
            Conectado como <strong>{userEmail}</strong>
          </p>
          <div className="button-row">
            <button className="primary" disabled={busy} onClick={onCloudLoad}>
              <Cloud size={16} /> Carreiras na nuvem
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { error } = await supabase!.auth.signOut();
                  if (error) throw error;
                })
              }
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      )}
      {isAdmin && (
        <section className="world-import">
          <h3>
            <Upload size={19} /> Publicar snapshot oficial
          </h3>
          <p className="muted small">
            Somente administrador. O mundo é validado e fica imutável depois de publicado. Use
            exclusivamente dados que você tem autorização para distribuir.
          </p>
          <div className="form-grid">
            <label>
              Fonte e data de coleta
              <input value={source} onChange={(e) => setSource(e.target.value)} />
            </label>
            <label>
              Licença ou autorização
              <input value={license} onChange={(e) => setLicense(e.target.value)} />
            </label>
          </div>
          <label className="file-button">
            <FileUp size={16} /> CSV de clubes
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV de clubes"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) run(async () => setClubs(await f.text()));
              }}
            />
          </label>
          <textarea
            rows={3}
            value={clubText}
            onChange={(e) => setClubs(e.target.value)}
            placeholder="Cole o CSV de clubes ou selecione um arquivo"
            aria-label="Conteúdo CSV de clubes"
          />
          <label className="file-button">
            <FileUp size={16} /> CSV de jogadores
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV de jogadores"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) run(async () => setPlayers(await f.text()));
              }}
            />
          </label>
          <textarea
            rows={3}
            value={playerText}
            onChange={(e) => setPlayers(e.target.value)}
            placeholder="Cole o CSV de jogadores ou selecione um arquivo"
            aria-label="Conteúdo CSV de jogadores"
          />
          <button
            className="primary"
            disabled={busy || !source || !license || !clubText || !playerText}
            onClick={() =>
              run(async () => {
                const world = parseWorldCsv(clubText, playerText, source, license);
                await publishWorld(world);
                setPublished(true);
              })
            }
          >
            Validar e publicar 40 clubes
          </button>
          {published && (
            <p className="success-text">
              Snapshot publicado. Já pode iniciar uma carreira oficial.
            </p>
          )}
        </section>
      )}
      <div className="connection-note">
        <strong>Dados oficiais não vêm de scraping.</strong>
        <p>
          O pacote inclui o importador e a validação, não uma base licenciada de atletas reais.
          Elencos demonstrativos nunca são publicados como oficiais.
        </p>
      </div>
    </Modal>
  );
}
