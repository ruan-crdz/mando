import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { FocusManager } from './FocusManager';
import { standardButtons, xboxMapping } from './xboxMapping';
import { dualsenseMapping, isPlayStation } from './dualsenseMapping';
import {
  hidConnected,
  hidGamepad,
  hidRumble,
  hidSupported,
  pairDualSense,
  subscribeHid,
} from './dualsenseHid';

type Action = keyof typeof xboxMapping;
type Input = 'mouse' | 'keyboard' | 'xbox' | 'playstation';
type Actions = Partial<Record<Action, () => void>>;
export type RumbleKind =
  'move' | 'confirm' | 'back' | 'tab' | 'goal' | 'concede' | 'whistle' | 'moment' | 'error';
const rumblePatterns: Record<RumbleKind, [number, number, number][]> = {
  move: [[42, 0.28, 0.55]],
  confirm: [[70, 0.55, 0.85]],
  back: [[55, 0.35, 0.7]],
  tab: [[55, 0.45, 0.7]],
  error: [
    [90, 0.75, 0.2],
    [90, 0.75, 0.2],
  ],
  whistle: [[260, 0.45, 0.6]],
  moment: [
    [70, 0.55, 0.3],
    [110, 0.15, 0.6],
  ],
  goal: [
    [180, 1, 1],
    [140, 0.4, 0.8],
    [420, 1, 1],
  ],
  concede: [[380, 0.8, 0.1]],
};
type HapticPad = Gamepad & {
  vibrationActuator?: {
    playEffect?: (
      type: string,
      params: {
        duration: number;
        strongMagnitude: number;
        weakMagnitude: number;
        startDelay?: number;
      },
    ) => Promise<unknown>;
  };
  hapticActuators?: { pulse?: (value: number, duration: number) => Promise<unknown> }[];
};
type ControllerContext = {
  input: Input;
  connected: string | null;
  unsupported: boolean;
  sound: boolean;
  toggleSound: () => void;
  vibration: boolean;
  toggleVibration: () => void;
  rumble: (kind: RumbleKind) => void;
  /** Diagnóstico de vibração do controle ativo. */
  haptics: () => 'ok' | 'unsupported' | 'nopad';
  /** DualSense conectado direto (WebHID): vibração real no Chrome/Edge. */
  hid: { supported: boolean; connected: boolean; pair: () => Promise<boolean> };
  hints: Record<Action, string>;
  register: (actions: Actions) => () => void;
};
type Editing = {
  element: HTMLInputElement | HTMLTextAreaElement;
  value: string;
  numeric: boolean;
};
const Context = createContext<ControllerContext | null>(null);
const focus = new FocusManager();
const STICK_X_EVENT = 'mando:stick-x';
const STEP_EVENT = 'mando:step';
const TOGGLE_EVENT = 'mando:toggle-edit';
const CANCEL_EVENT = 'mando:cancel-edit';
const R3 = 11;
const letterRows = ['1234567890', 'qwertyuiop', 'asdfghjklç', 'zxcvbnm-.@'];
const specialRows = ['!?#$%&*()_', '+=/\\:;,"\'´', 'áàâãéêíóôõ', 'úüñ~^<>[]|'];

const topModal = () =>
  [...document.querySelectorAll<HTMLElement>('[data-focus-scope="modal"]')].at(-1) || null;

/** LT/RT switch the sub-tabs (`.segmented`) of the screen in focus, like FIFA's sub-menus. */
function cycleView(delta: number) {
  const group = (topModal() || document.querySelector('main'))?.querySelector<HTMLElement>(
    '.segmented:not(.compact)',
  );
  if (!group) return;
  const buttons = [...group.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  if (!buttons.length) return;
  const current = Math.max(
    0,
    buttons.findIndex((b) => b.classList.contains('active')),
  );
  const next = buttons[(current + delta + buttons.length) % buttons.length];
  next.click();
  next.focus({ preventScroll: true });
}

const scrollable = (el: HTMLElement, axis: 'x' | 'y') => {
  const style = getComputedStyle(el);
  return axis === 'y'
    ? el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(style.overflowY)
    : el.scrollWidth > el.clientWidth + 4 && /(auto|scroll)/.test(style.overflowX);
};

/** Área rolável mais próxima do foco; senão, a maior área rolável visível da tela. */
function scrollTarget(axis: 'x' | 'y') {
  const scope = topModal() || document.querySelector('main');
  let el = document.activeElement as HTMLElement | null;
  while (el && el !== document.body) {
    if (scrollable(el, axis) && (!scope || scope.contains(el))) return el;
    el = el.parentElement;
  }
  if (!scope) return null;
  const candidates = [...scope.querySelectorAll<HTMLElement>('*')].filter(
    (node) => node.getClientRects().length > 0 && scrollable(node, axis),
  );
  return (
    candidates.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0] ||
    null
  );
}

const isTextField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  (el instanceof HTMLInputElement &&
    ['text', 'email', 'number', 'search', 'password', 'tel'].includes(el.type)) ||
  el instanceof HTMLTextAreaElement;

export function GamepadProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState<Input>('mouse');
  const [connected, setConnected] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [sound, setSound] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [caps, setCaps] = useState(false);
  const [specials, setSpecials] = useState(false);
  const actions = useRef<Actions>({});
  const audio = useRef<AudioContext | null>(null);
  const editRef = useRef(editing);
  editRef.current = editing;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const [vibration, setVibration] = useState(
    () => localStorage.getItem('mando-vibration') !== 'off',
  );
  const vibrationRef = useRef(vibration);
  vibrationRef.current = vibration;
  const padIndex = useRef<number | null>(null);
  const [hidOn, setHidOn] = useState(hidConnected);
  useEffect(() => subscribeHid(() => setHidOn(hidConnected())), []);
  const rumble = useCallback((kind: RumbleKind) => {
    if (!vibrationRef.current) return;
    if (hidRumble(rumblePatterns[kind])) return;
    if (padIndex.current === null || !navigator.getGamepads) return;
    const pad = navigator.getGamepads()[padIndex.current] as HapticPad | null;
    if (!pad?.connected) return;
    let delay = 0;
    for (const [duration, strongMagnitude, weakMagnitude] of rumblePatterns[kind]) {
      // Cada playEffect cancela o anterior: os pulsos são agendados em sequência.
      const fire = () => {
        const live = (navigator.getGamepads()[pad.index] as HapticPad | null) || pad;
        if (live.vibrationActuator?.playEffect)
          void live.vibrationActuator
            .playEffect('dual-rumble', { duration, strongMagnitude, weakMagnitude })
            .catch(() => undefined);
        else
          void live.hapticActuators?.[0]
            ?.pulse?.(strongMagnitude, duration)
            ?.catch(() => undefined);
      };
      if (delay) setTimeout(fire, delay);
      else fire();
      delay += duration + 60;
    }
  }, []);
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
  const type = useCallback((text: string) => {
    setEditing((e) => {
      if (!e) return e;
      if (e.numeric) {
        const digits = (e.value + text).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        return { ...e, value: digits.slice(0, 12) };
      }
      const max = e.element.maxLength > 0 ? e.element.maxLength : Infinity;
      return { ...e, value: (e.value + text).slice(0, max) };
    });
  }, []);
  const erase = useCallback(
    () => setEditing((e) => e && { ...e, value: e.value.slice(0, -1) }),
    [],
  );
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
    setSpecials(false);
    requestAnimationFrame(() => edit.element.focus());
  }, []);
  const openKeyboard = useCallback((el: HTMLInputElement | HTMLTextAreaElement) => {
    const numeric =
      (el instanceof HTMLInputElement && el.type === 'number') || el.inputMode === 'numeric';
    setEditing({ element: el, value: numeric && /^0*$/.test(el.value) ? '' : el.value, numeric });
  }, []);
  useEffect(() => {
    let frame = 0;
    let lastMove = 0;
    let lastStickX = 0;
    let scrollEl: HTMLElement | null = null;
    let held = new Set<number>();
    let activeIndex: number | null = null;
    let priorId: string | null = null;
    function unlock() {
      if (!soundRef.current) return;
      audio.current ??= new AudioContext();
      if (audio.current.state === 'suspended') void audio.current.resume();
    }
    /** Botões do controle enquanto o teclado virtual está aberto. */
    const keyboardAction = (action: Action | 'r3') => {
      const edit = editRef.current;
      if (!edit) return false;
      if (action === 'back') applyEdit(false);
      else if (action === 'menu') applyEdit(true);
      else if (action === 'secondary') erase();
      else if (action === 'info' && !edit.numeric) type(' ');
      else if (action === 'nextView' && !edit.numeric) setCaps((v) => !v);
      else if (action === 'r3' && !edit.numeric) setSpecials((v) => !v);
      else if (action === 'confirm') {
        focus.ensure();
        (document.activeElement as HTMLElement | null)?.click();
      } else return true;
      rumble(action === 'back' ? 'back' : 'confirm');
      beep();
      return true;
    };
    const activate = (action: Action) => {
      if (keyboardAction(action)) return;
      const active = document.activeElement;
      // Controles editáveis (ex.: sliders de tática) aceitam X para editar/salvar e B para sair da edição.
      if (
        active instanceof HTMLElement &&
        active.dataset.toggleEdit !== undefined &&
        (action === 'secondary' ||
          (action === 'back' && active.getAttribute('aria-pressed') === 'true'))
      ) {
        const cancel = new CustomEvent(CANCEL_EVENT, { cancelable: true });
        if (action === 'back') active.dispatchEvent(cancel);
        if (cancel.defaultPrevented) {
          // O controle tratou o cancelamento (ex.: descartar o rascunho).
        } else if (active instanceof HTMLInputElement)
          active.dispatchEvent(new CustomEvent(TOGGLE_EVENT));
        else active.click();
        rumble(action === 'back' ? 'back' : 'confirm');
        beep();
        return;
      }
      if (action === 'back') {
        const close = topModal()?.querySelector<HTMLButtonElement>('[data-dialog-close]');
        if (close) {
          close.click();
          rumble('back');
          return;
        }
        const screenBack =
          !topModal() &&
          (document.querySelector<HTMLElement>('[data-focus-trap] [data-trap-exit]') ||
            document.querySelector<HTMLElement>('main [data-back-action]'));
        if (screenBack) {
          screenBack.click();
          rumble('back');
          beep();
          return;
        }
      }
      if (action === 'previousView' || action === 'nextView') {
        if (actions.current[action]) actions.current[action]!();
        else cycleView(action === 'nextView' ? 1 : -1);
        rumble('tab');
        beep();
        return;
      }
      if (action === 'confirm') {
        focus.ensure();
        const el = document.activeElement;
        if (isTextField(el)) openKeyboard(el);
        else if (el instanceof HTMLSelectElement) {
          el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el instanceof HTMLElement) el.click();
        rumble('confirm');
      } else {
        actions.current[action]?.();
        rumble(action === 'back' ? 'back' : 'tab');
      }
      beep();
    };
    const move = (dx: number, dy: number) => {
      const el = document.activeElement;
      if (dx && el instanceof HTMLElement && el.dataset.stepper !== undefined) {
        el.dispatchEvent(new CustomEvent(STEP_EVENT, { detail: dx }));
      } else if (dx && el instanceof HTMLSelectElement) {
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
      if (padIndex.current !== null) rumble('move');
      beep();
    };
    /** Analógico direito: vertical rola a tela; horizontal é entregue à tela ou rola carrosséis. */
    const rightStick = (pad: Gamepad, now: number) => {
      if (editRef.current) return;
      const sx = pad.axes[2] || 0;
      const sy = pad.axes[3] || 0;
      if (Math.abs(sy) > 0.3 && Math.abs(sy) >= Math.abs(sx)) {
        scrollEl ??= scrollTarget('y');
        scrollEl?.scrollBy({ top: Math.sign(sy) * (sy * sy) * 26 });
      } else scrollEl = null;
      if (Math.abs(sx) > 0.6 && Math.abs(sx) > Math.abs(sy)) {
        if (now - lastStickX < 360) return;
        lastStickX = now;
        const dir = Math.sign(sx);
        const handled = !window.dispatchEvent(
          new CustomEvent(STICK_X_EVENT, { detail: dir, cancelable: true }),
        );
        if (!handled) {
          const target = scrollTarget('x');
          target?.scrollBy({ left: dir * target.clientWidth * 0.6, behavior: 'smooth' });
        }
        rumble('tab');
        beep();
      } else if (Math.abs(sx) < 0.3) lastStickX = 0;
    };
    const tick = (now: number) => {
      // No Bluetooth em modo completo o navegador para de ler o DualSense; o WebHID assume.
      const direct = hidGamepad();
      const pads = direct
        ? [direct]
        : navigator.getGamepads
          ? [...navigator.getGamepads()].filter((p): p is Gamepad => p !== null && p.connected)
          : [];
      const touched = pads.find(
        (p) => p.buttons.some((b) => b.pressed) || p.axes.some((axis) => Math.abs(axis) > 0.55),
      );
      if (touched) activeIndex = touched.index;
      const pad = pads.find((p) => p.index === activeIndex) || pads[0];
      padIndex.current = pad ? pad.index : null;
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
        if (buttons.has(R3) && !held.has(R3)) keyboardAction('r3');
        rightStick(pad, now);
        held = buttons;
      } else held = new Set();
      frame = requestAnimationFrame(tick);
    };
    const keydown = (e: KeyboardEvent) => {
      unlock();
      setInput('keyboard');
      if (editRef.current) {
        // Teclado físico também funciona com o teclado virtual aberto.
        if (e.key === 'Escape') applyEdit(false);
        else if (e.key === 'Enter') applyEdit(true);
        else if (e.key === 'Backspace') erase();
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) type(e.key);
        else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key))
          move(
            e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0,
            e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0,
          );
        else return;
        e.preventDefault();
        return;
      }
      const target = e.target;
      const inField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      if (e.key === 'Tab' && topModal()) {
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
      } else if (!inField && (e.key === 'q' || e.key === 'e')) {
        e.preventDefault();
        activate(e.key === 'q' ? 'previousView' : 'nextView');
      } else if (!inField && (e.key === ',' || e.key === '.')) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent(STICK_X_EVENT, { detail: e.key === ',' ? -1 : 1, cancelable: true }),
        );
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
  }, [applyEdit, beep, erase, openKeyboard, rumble, type]);
  useEffect(() => {
    if (editing) requestAnimationFrame(() => focus.ensure());
  }, [editing, specials]);
  const hints = input === 'playstation' ? dualsenseMapping : xboxMapping;
  const pad = input === 'xbox' || input === 'playstation';
  const keyHint = (label: string) => (pad ? <kbd>{label}</kbd> : null);
  const rows = specials ? specialRows : letterRows;
  return (
    <Context.Provider
      value={{
        input,
        connected,
        unsupported,
        sound,
        toggleSound: () => setSound((s) => !s),
        vibration,
        toggleVibration: () =>
          setVibration((v) => {
            localStorage.setItem('mando-vibration', v ? 'off' : 'on');
            return !v;
          }),
        rumble,
        hid: { supported: hidSupported(), connected: hidOn, pair: pairDualSense },
        haptics: () => {
          if (hidConnected()) return 'ok';
          const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
          const pad = (pads.find((p) => p?.connected) || null) as HapticPad | null;
          if (!pad) return 'nopad';
          return typeof pad.vibrationActuator?.playEffect === 'function' ||
            typeof pad.hapticActuators?.[0]?.pulse === 'function'
            ? 'ok'
            : 'unsupported';
        },
        register,
        hints,
      }}
    >
      <div inert={editing ? true : undefined}>{children}</div>
      {editing && (
        <div className="modal-backdrop">
          <section
            className={`virtual-keyboard dialog ${editing.numeric ? 'numeric' : ''}`}
            data-focus-scope="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Teclado do controle"
          >
            <p className="eyebrow">
              {editing.numeric ? 'TECLADO NUMÉRICO' : specials ? 'CARACTERES ESPECIAIS' : 'TECLADO'}
              {!editing.numeric && <span className="caps-state">{caps ? 'ABC' : 'abc'}</span>}
            </p>
            <output className="keyboard-value">
              {editing.element.type === 'password'
                ? '•'.repeat(editing.value.length)
                : editing.value || (editing.numeric ? '0' : 'Digite aqui')}
              <span className="caret" />
            </output>
            {editing.numeric ? (
              <div className="keypad-grid">
                {'123456789'.split('').map((key) => (
                  <button
                    key={key}
                    type="button"
                    data-autofocus={key === '5' ? '' : undefined}
                    onClick={() => type(key)}
                  >
                    {key}
                  </button>
                ))}
                <button type="button" onClick={() => setEditing((e) => e && { ...e, value: '' })}>
                  Limpar
                </button>
                <button type="button" onClick={() => type('0')}>
                  0
                </button>
                <button type="button" onClick={erase}>
                  ⌫
                </button>
                {['000', '00'].map((key) => (
                  <button key={key} type="button" onClick={() => type(key)}>
                    {key}
                  </button>
                ))}
              </div>
            ) : (
              <div className="keyboard-grid">
                {rows
                  .flatMap((row) => row.split(''))
                  .map((key, i) => {
                    const shown = caps ? key.toLocaleUpperCase('pt-BR') : key;
                    return (
                      <button
                        key={`${specials}-${i}`}
                        type="button"
                        data-autofocus={i === 10 ? '' : undefined}
                        onClick={() => type(shown)}
                      >
                        {shown}
                      </button>
                    );
                  })}
              </div>
            )}
            <div className="keyboard-actions">
              {!editing.numeric && (
                <>
                  <button
                    type="button"
                    className={caps ? 'active' : ''}
                    onClick={() => setCaps((v) => !v)}
                  >
                    {keyHint(hints.nextView)} {caps ? 'ABC' : 'abc'}
                  </button>
                  <button
                    type="button"
                    className={specials ? 'active' : ''}
                    onClick={() => setSpecials((v) => !v)}
                  >
                    {keyHint(hints.stick)} {specials ? 'Letras' : '#@ Especiais'}
                  </button>
                  <button type="button" onClick={() => type(' ')}>
                    {keyHint(hints.info)} Espaço
                  </button>
                </>
              )}
              <button type="button" onClick={erase}>
                {keyHint(hints.secondary)} Apagar
              </button>
              <button type="button" onClick={() => applyEdit(false)}>
                {keyHint(hints.back)} Cancelar
              </button>
              <button type="button" className="primary" onClick={() => applyEdit(true)}>
                {keyHint(hints.menu)} Salvar
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

/**
 * Analógico direito para os lados (ou teclas , e .) — a tela decide o que fazer,
 * por exemplo trocar de competição. Ignorado enquanto um modal está aberto.
 */
export function useStickX(handler: (dir: number) => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: Event) => {
      if (topModal()) return;
      e.preventDefault();
      ref.current((e as CustomEvent<number>).detail);
    };
    window.addEventListener(STICK_X_EVENT, listener);
    return () => window.removeEventListener(STICK_X_EVENT, listener);
  }, [enabled]);
}

/** Recebe os passos ←/→ do controle num elemento marcado com `data-stepper`. */
export function useStepper<T extends HTMLElement>(onStep: (dir: number) => void) {
  const ref = useRef<T>(null);
  const handler = useRef(onStep);
  useEffect(() => {
    handler.current = onStep;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = (e: Event) => handler.current((e as CustomEvent<number>).detail);
    el.addEventListener(STEP_EVENT, listener);
    return () => el.removeEventListener(STEP_EVENT, listener);
  }, []);
  return ref;
}

/** Campos de texto com modo edição (□ entra/sai, B sai) recebem este evento. */
export function useToggleEdit<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onToggle: () => void,
) {
  const handler = useRef(onToggle);
  useEffect(() => {
    handler.current = onToggle;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = () => handler.current();
    el.addEventListener(TOGGLE_EVENT, listener);
    return () => el.removeEventListener(TOGGLE_EVENT, listener);
  }, [ref]);
}

/** B no modo edição: o controle pode descartar o rascunho em vez de salvar. */
export function useCancelEdit<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onCancel: () => boolean,
) {
  const handler = useRef(onCancel);
  useEffect(() => {
    handler.current = onCancel;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = (e: Event) => {
      if (handler.current()) e.preventDefault();
    };
    el.addEventListener(CANCEL_EVENT, listener);
    return () => el.removeEventListener(CANCEL_EVENT, listener);
  }, [ref]);
}
