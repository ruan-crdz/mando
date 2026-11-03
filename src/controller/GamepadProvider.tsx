import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { FocusManager } from './FocusManager';
import { standardButtons, xboxMapping } from './xboxMapping';
import { dualsenseMapping, isPlayStation } from './dualsenseMapping';

type Action = keyof typeof xboxMapping;
type Input = 'mouse' | 'keyboard' | 'xbox' | 'playstation';
type Actions = Partial<Record<Action, () => void>>;
type ControllerContext = {
  input: Input;
  connected: string | null;
  unsupported: boolean;
  sound: boolean;
  toggleSound: () => void;
  hints: Record<Action, string>;
  register: (actions: Actions) => () => void;
};
const Context = createContext<ControllerContext | null>(null);
const focus = new FocusManager();

export function GamepadProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState<Input>('mouse');
  const [connected, setConnected] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [sound, setSound] = useState(false);
  const [editing, setEditing] = useState<{
    element: HTMLInputElement | HTMLTextAreaElement;
    value: string;
  } | null>(null);
  const actions = useRef<Actions>({});
  const audio = useRef<AudioContext | null>(null);
  const editRef = useRef(editing);
  editRef.current = editing;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const register = useCallback((value: Actions) => {
    if (Object.keys(value).length === 0) return () => {};
    actions.current = value;
    return () => {
      if (actions.current === value) actions.current = {};
    };
  }, []);
  const beep = useCallback(() => {
    if (!soundRef.current) return;
    if (!audio.current || audio.current.state !== 'running') return;
    const osc = audio.current.createOscillator();
    const volume = audio.current.createGain();
    osc.frequency.value = 580;
    volume.gain.value = 0.025;
    osc.connect(volume);
    volume.connect(audio.current.destination);
    osc.start();
    osc.stop(audio.current.currentTime + 0.035);
  }, []);
  const applyEdit = useCallback((save: boolean) => {
    const edit = editRef.current;
    if (!edit) return;
    if (save) {
      const prototype =
        edit.element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(edit.element, edit.value);
      edit.element.dispatchEvent(new Event('input', { bubbles: true }));
      edit.element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setEditing(null);
    requestAnimationFrame(() => edit.element.focus());
  }, []);
  useEffect(() => {
    let frame = 0;
    let lastMove = 0;
    let held = new Set<number>();
    let activeIndex: number | null = null;
    let priorId: string | null = null;
    function unlock() {
      if (!soundRef.current) return;
      audio.current ??= new AudioContext();
      if (audio.current.state === 'suspended') void audio.current.resume();
    }
    const activate = (action: Action) => {
      if (action === 'back' && editRef.current) {
        applyEdit(false);
        return;
      }
      if (action === 'back') {
        const modal = [...document.querySelectorAll<HTMLElement>('[data-focus-scope="modal"]')].at(
          -1,
        );
        const close = modal?.querySelector<HTMLButtonElement>('[data-dialog-close]');
        if (close) {
          close.click();
          return;
        }
      }
      if (editRef.current && action !== 'confirm') return;
      if (action === 'confirm') {
        focus.ensure();
        const el = document.activeElement;
        if (
          (el instanceof HTMLInputElement &&
            ['text', 'email', 'number', 'search', 'password'].includes(el.type)) ||
          el instanceof HTMLTextAreaElement
        ) {
          setEditing({ element: el, value: el.value });
        } else if (el instanceof HTMLSelectElement) {
          el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el instanceof HTMLElement) el.click();
      } else actions.current[action]?.();
      beep();
    };
    const move = (dx: number, dy: number) => {
      const el = document.activeElement;
      if (dx && el instanceof HTMLSelectElement) {
        el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + dx));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (dx && el instanceof HTMLInputElement && el.type === 'range') {
        const value = Number(el.value) + dx * Number(el.step || 1);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          el,
          String(value),
        );
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else focus.move(dx, dy);
      beep();
    };
    const tick = (now: number) => {
      const pads = navigator.getGamepads
        ? [...navigator.getGamepads()].filter((p): p is Gamepad => p !== null && p.connected)
        : [];
      const touched = pads.find(
        (p) => p.buttons.some((b) => b.pressed) || p.axes.some((axis) => Math.abs(axis) > 0.55),
      );
      if (touched) activeIndex = touched.index;
      const pad = pads.find((p) => p.index === activeIndex) || pads[0];
      const id = pad?.id || null;
      if (priorId !== id) {
        setConnected(id);
        setUnsupported(Boolean(pad && pad.mapping !== 'standard'));
        priorId = id;
        held = new Set();
      }
      if (pad && pad.mapping === 'standard') {
        const buttons = new Set(pad.buttons.flatMap((b, i) => (b.pressed ? [i] : [])));
        const x = buttons.has(14)
          ? -1
          : buttons.has(15)
            ? 1
            : Math.abs(pad.axes[0] || 0) > 0.55
              ? Math.sign(pad.axes[0])
              : 0;
        const y = buttons.has(12)
          ? -1
          : buttons.has(13)
            ? 1
            : Math.abs(pad.axes[1] || 0) > 0.55
              ? Math.sign(pad.axes[1])
              : 0;
        if (buttons.size || x || y) setInput(isPlayStation(pad.id) ? 'playstation' : 'xbox');
        if ((x || y) && now - lastMove > 180) {
          move(Math.abs(x) >= Math.abs(y) ? x : 0, Math.abs(y) > Math.abs(x) ? y : 0);
          lastMove = now;
        }
        for (const [action, index] of Object.entries(standardButtons)) {
          if (index < 12 && buttons.has(index) && !held.has(index)) activate(action as Action);
        }
        held = buttons;
      } else held = new Set();
      frame = requestAnimationFrame(tick);
    };
    const keydown = (e: KeyboardEvent) => {
      unlock();
      setInput('keyboard');
      const target = e.target;
      const inField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      if (e.key === 'Tab' && document.querySelector('[data-focus-scope="modal"]')) {
        const elements = focus.elements();
        const index = elements.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? (index - 1 + elements.length) % elements.length
          : (index + 1) % elements.length;
        if (elements.length) {
          e.preventDefault();
          elements[next].focus();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        activate('back');
      } else if (!inField && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        move(
          e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0,
          e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0,
        );
      } else if (!inField && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        activate(e.key === '[' ? 'previousTab' : 'nextTab');
      }
    };
    const pointer = () => {
      setInput('mouse');
      unlock();
    };
    const observer = new MutationObserver(() => {
      if (
        !document.activeElement ||
        document.activeElement === document.body ||
        !document.activeElement.isConnected
      )
        focus.ensure();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    frame = requestAnimationFrame(tick);
    window.addEventListener('keydown', keydown);
    window.addEventListener('pointermove', pointer);
    window.addEventListener('pointerdown', pointer);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('pointermove', pointer);
      window.removeEventListener('pointerdown', pointer);
    };
  }, [applyEdit, beep]);
  useEffect(() => {
    if (editing) requestAnimationFrame(() => focus.ensure());
  }, [editing]);
  return (
    <Context.Provider
      value={{
        input,
        connected,
        unsupported,
        sound,
        toggleSound: () => setSound((s) => !s),
        register,
        hints: input === 'playstation' ? dualsenseMapping : xboxMapping,
      }}
    >
      <div inert={editing ? true : undefined}>{children}</div>
      {editing && (
        <div className="modal-backdrop">
          <section
            className="virtual-keyboard dialog"
            data-focus-scope="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Teclado do controle"
          >
            <p className="eyebrow">TECLADO DO CONTROLE</p>
            <output className="keyboard-value">
              {editing.element.type === 'password'
                ? '•'.repeat(editing.value.length)
                : editing.value || 'Digite aqui'}
            </output>
            <div className="keyboard-grid">
              {'1234567890QWERTYUIOPASDFGHJKLZXCVBNM@.-_áãâéêíóôõúç/+,:'.split('').map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setEditing((e) => e && { ...e, value: e.value + key.toLowerCase() })
                  }
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="button-row">
              <button onClick={() => setEditing((e) => e && { ...e, value: e.value + ' ' })}>
                Espaço
              </button>
              <button onClick={() => setEditing((e) => e && { ...e, value: e.value.slice(0, -1) })}>
                Apagar
              </button>
              <button onClick={() => setEditing((e) => e && { ...e, value: '' })}>Limpar</button>
              <button onClick={() => applyEdit(false)}>Cancelar</button>
              <button className="primary" onClick={() => applyEdit(true)}>
                Concluir
              </button>
            </div>
          </section>
        </div>
      )}
    </Context.Provider>
  );
}

export function useGamepad() {
  const value = useContext(Context);
  if (!value) throw new Error('useGamepad precisa de GamepadProvider.');
  return value;
}

export function useControllerActions(actions: Actions) {
  const { register } = useGamepad();
  useEffect(() => register(actions), [actions, register]);
}
