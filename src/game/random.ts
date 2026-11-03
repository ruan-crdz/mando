export function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i++) value = Math.imul(value ^ input.charCodeAt(i), 16777619);
  return value >>> 0;
}

export function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export function ageAt(birth: string, date: string) {
  return (
    Number(date.slice(0, 4)) - Number(birth.slice(0, 4)) - (date.slice(5) < birth.slice(5) ? 1 : 0)
  );
}

export const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
