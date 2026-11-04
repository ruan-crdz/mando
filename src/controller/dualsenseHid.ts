/**
 * DualSense via WebHID (Chrome/Edge). A API de Gamepad do navegador não faz o
 * DualSense vibrar no Windows; aqui os motores são acionados direto pelo relatório
 * de saída do controle, por USB (0x02) ou Bluetooth (0x31, com CRC32).
 *
 * No Bluetooth, o primeiro relatório 0x31 coloca o controle no modo completo e ele
 * passa a enviar entradas 0x31, que o navegador não entende. Por isso, nesse caso,
 * os botões e analógicos também são lidos daqui e expostos como um Gamepad padrão.
 */
type HidReport = { reportId?: number };
type HidCollection = { outputReports?: HidReport[]; inputReports?: HidReport[] };
type HidDevice = EventTarget & {
  opened: boolean;
  vendorId: number;
  productId: number;
  productName: string;
  collections: HidCollection[];
  open: () => Promise<void>;
  sendReport: (id: number, data: Uint8Array) => Promise<void>;
};
type HidInputEvent = Event & { reportId: number; data: DataView; device: HidDevice };
type Hid = EventTarget & {
  getDevices: () => Promise<HidDevice[]>;
  requestDevice: (o: { filters: { vendorId: number; productId?: number }[] }) => Promise<HidDevice[]>;
};

const SONY = 0x054c;
const PRODUCTS = [0x0ce6, 0x0df2];
const hid = () =>
  (typeof navigator !== 'undefined' && (navigator as Navigator & { hid?: Hid }).hid) || null;

let device: HidDevice | null = null;
let bluetooth = false;
let seq = 0;
let pad: Gamepad | null = null;
let stopTimer: number | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const hidSupported = () => Boolean(hid());
export const hidConnected = () => Boolean(device?.opened);
export const subscribeHid = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Controle lido pelo WebHID (só no Bluetooth, depois do modo completo). */
export const hidGamepad = () => (bluetooth && device?.opened ? pad : null);

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function send(strong: number, weak: number) {
  if (!device?.opened) return;
  const common = new Uint8Array(47);
  // valid_flag0: vibração compatível + seleção de háptico; valid_flag2: vibração v2 (firmware novo).
  common[0] = 0x03;
  common[2] = Math.round(Math.min(1, weak) * 255);
  common[3] = Math.round(Math.min(1, strong) * 255);
  common[38] = 0x04;
  if (!bluetooth) {
    void device.sendReport(0x02, common).catch(() => undefined);
    return;
  }
  const data = new Uint8Array(77);
  data[0] = seq << 4;
  seq = (seq + 1) & 0x0f;
  data[1] = 0x10;
  data.set(common, 2);
  const crc = crc32(new Uint8Array([0xa2, 0x31, ...data.subarray(0, 73)]));
  new DataView(data.buffer).setUint32(73, crc, true);
  void device.sendReport(0x31, data).catch(() => undefined);
}

/** Toca uma sequência de pulsos [duração ms, motor forte, motor fraco]. */
export function hidRumble(pattern: [number, number, number][]) {
  if (!device?.opened) return false;
  window.clearTimeout(stopTimer);
  let delay = 0;
  for (const [duration, strong, weak] of pattern) {
    window.setTimeout(() => send(strong, weak), delay);
    delay += duration;
  }
  stopTimer = window.setTimeout(() => send(0, 0), delay);
  return true;
}

const button = (pressed: boolean, value = pressed ? 1 : 0): GamepadButton => ({
  pressed,
  touched: pressed,
  value,
});

function onInput(event: Event) {
  const e = event as HidInputEvent;
  if (e.reportId !== 0x31) return;
  // Relatório 0x31 do Bluetooth: um byte de cabeçalho antes do bloco comum.
  const d = (i: number) => e.data.getUint8(1 + i);
  const axis = (v: number) => Math.max(-1, Math.min(1, (v - 128) / 127));
  const b0 = d(7);
  const b1 = d(8);
  const b2 = d(9);
  const hat = b0 & 0x0f;
  const dir = (...values: number[]) => values.includes(hat);
  pad = {
    id: 'DualSense Wireless Controller (WebHID Vendor: 054c)',
    index: 99,
    connected: true,
    mapping: 'standard',
    timestamp: performance.now(),
    axes: [axis(d(0)), axis(d(1)), axis(d(2)), axis(d(3))],
    buttons: [
      button(Boolean(b0 & 0x20)),
      button(Boolean(b0 & 0x40)),
      button(Boolean(b0 & 0x10)),
      button(Boolean(b0 & 0x80)),
      button(Boolean(b1 & 0x01)),
      button(Boolean(b1 & 0x02)),
      button(d(4) > 30, d(4) / 255),
      button(d(5) > 30, d(5) / 255),
      button(Boolean(b1 & 0x10)),
      button(Boolean(b1 & 0x20)),
      button(Boolean(b1 & 0x40)),
      button(Boolean(b1 & 0x80)),
      button(dir(0, 1, 7)),
      button(dir(3, 4, 5)),
      button(dir(5, 6, 7)),
      button(dir(1, 2, 3)),
      button(Boolean(b2 & 0x01)),
      button(Boolean(b2 & 0x02)),
    ],
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;
}

async function open(d: HidDevice) {
  if (!d.opened) await d.open();
  bluetooth = d.collections.some((c) => c.outputReports?.some((r) => r.reportId === 0x31));
  device = d;
  d.addEventListener('inputreport', onInput);
  // Pulso curto confirma a conexão (e ativa o modo completo no Bluetooth).
  hidRumble([[120, 0.6, 0.8]]);
  emit();
}

const isDualSense = (d: HidDevice) => d.vendorId === SONY && PRODUCTS.includes(d.productId);

/** Reconecta sem pedir nada se o jogador já autorizou o controle antes. */
export async function restoreDualSense() {
  const api = hid();
  if (!api || device?.opened) return false;
  const known = (await api.getDevices()).find(isDualSense);
  if (!known) return false;
  await open(known);
  return true;
}

/** Abre o seletor do navegador (precisa de clique ou toque). */
export async function pairDualSense() {
  const api = hid();
  if (!api) throw new Error('Este navegador não tem WebHID. Use Chrome ou Edge no computador.');
  const [chosen] = await api.requestDevice({
    filters: PRODUCTS.map((productId) => ({ vendorId: SONY, productId })),
  });
  if (!chosen) return false;
  await open(chosen);
  return true;
}

if (typeof window !== 'undefined' && hid()) {
  hid()!.addEventListener('connect', () => void restoreDualSense().catch(() => undefined));
  hid()!.addEventListener('disconnect', (event) => {
    if ((event as HidInputEvent).device === device) {
      device = null;
      pad = null;
      emit();
    }
  });
  void restoreDualSense().catch(() => undefined);
}
