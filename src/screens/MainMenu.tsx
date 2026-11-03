import {
  ArrowRight,
  Cloud,
  Download,
  FolderOpen,
  Gamepad2,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Badge, dateLabel, ManagerPortrait, Tile } from '../components/ui';
import { type SavedCareer } from '../services/storage';

export function MainMenu({
  saves,
  onContinue,
  onNew,
  onSettings,
  onImport,
  onDelete,
}: {
  saves: SavedCareer[];
  onContinue: (save: SavedCareer) => void;
  onNew: () => void;
  onSettings: () => void;
  onImport: (file: File) => void;
  onDelete: (save: SavedCareer) => void;
}) {
  const recent = saves[0];
  return (
    <div className="menu-screen screen-enter">
      <div className="menu-heading">
        <p className="eyebrow">
          <span className="live-dot" /> FUTEBOL BRASILEIRO · CARREIRAS A PARTIR DE 2026
        </p>
        <h1>
          O clube é seu.
          <br />
          <span>A história também.</span>
        </h1>
        <p>
          Mais que escalar onze jogadores.
          <br />
          Assuma o Mando.
        </p>
      </div>
      <div className={`menu-grid ${recent ? '' : 'no-save'}`}>
        {recent && (
          <Tile className="continue-tile" onClick={() => onContinue(recent)}>
            <p className="eyebrow">CONTINUAR CARREIRA</p>
            <Badge
              club={recent.world.clubs.find((c) => c.id === recent.career.clubId)!}
              size="large"
            />
            <h2>{recent.world.clubs.find((c) => c.id === recent.career.clubId)!.name}</h2>
            <p>
              {recent.career.manager.firstName} {recent.career.manager.lastName}
            </p>
            <div className="tile-bottom">
              <span>{dateLabel(recent.career.date)}</span>
              <span className="pill">
                {recent.career.mode === 'demo' ? 'DEMONSTRAÇÃO' : 'CARREIRA OFICIAL'}
              </span>
            </div>
            <ManagerPortrait manager={recent.career.manager} />
          </Tile>
        )}
        <Tile className="new-career-tile" onClick={onNew}>
          <span className="outlined-icon">
            <Plus size={38} strokeWidth={1.3} />
          </span>
          <div>
            <p className="eyebrow">SEU PRÓXIMO CAPÍTULO</p>
            <h2>
              Nova carreira
              <br />
              de manager
            </h2>
            <p>Um primeiro dia. Infinitas decisões.</p>
          </div>
          <span className="tile-bottom">
            COMEÇAR SUA HISTÓRIA <ArrowRight size={20} />
          </span>
        </Tile>
        <div className="menu-side">
          <Tile className="connection-tile" onClick={onSettings}>
            <Cloud size={26} />
            <h3>Seu mundo conectado</h3>
            <p>Supabase, retrato por IA e um snapshot só seu.</p>
            <span className="text-link">
              CONFIGURAR <Settings2 size={15} />
            </span>
          </Tile>
          <div className="menu-small-print">
            <Gamepad2 size={20} />
            <span>
              Feito para jogar com controle.
              <br />
              Também funciona com teclado e mouse.
            </span>
          </div>
        </div>
      </div>
      <div className="menu-bottom">
        <span>
          <ShieldCheck size={17} /> SEU SAVE FICA NESTE NAVEGADOR. EXPORTE PARA TER UM BACKUP.
        </span>
        <label className="file-button">
          <Download size={16} /> IMPORTAR SAVE
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Importar save"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {saves.length > 1 && (
        <section className="saved-list">
          <h3>
            <FolderOpen size={18} /> Outras carreiras
          </h3>
          {saves.slice(1).map((s) => (
            <div key={s.career.id}>
              <button onClick={() => onContinue(s)}>
                {s.world.clubs.find((c) => c.id === s.career.clubId)!.name} ·{' '}
                {s.career.manager.firstName} · {dateLabel(s.career.date)}
              </button>
              <button
                aria-label={`Excluir carreira ${s.career.manager.firstName}`}
                onClick={() => onDelete(s)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
