/**
 * "วัน" ของระบบทวน: เริ่มที่ dayStartHour (ค่าเริ่มต้น 04:00) ตาม time zone ที่ตั้งไว้
 * คำนวณด้วย Intl จึงไม่ขึ้นกับ time zone ของเครื่อง
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** เวลา wall-clock ใน timeZone ของ instant นี้ */
function wallClock(date: Date, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** offset (ms) ของ timeZone ณ instant นี้: wallClock − UTC */
function tzOffset(date: Date, timeZone: string): number {
  const w = wallClock(date, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** instant ของเวลา wall-clock (y-m-d h:00) ใน timeZone */
function zonedInstant(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  let result = guess - tzOffset(new Date(guess), timeZone);
  // แก้รอบสองเผื่อ offset เปลี่ยน (DST) ระหว่าง guess กับผลลัพธ์
  result = guess - tzOffset(new Date(result), timeZone);
  return new Date(result);
}

export interface DayConfig {
  timeZone: string;
  dayStartHour: number;
}

/** key ของวันทวน เช่น "2026-10-12" — ช่วง 00:00–03:59 นับเป็นวันก่อนหน้า */
export function studyDayKey(date: Date, cfg: DayConfig): string {
  const w = wallClock(date, cfg.timeZone);
  let { year, month, day } = w;
  if (w.hour < cfg.dayStartHour) {
    const prev = new Date(Date.UTC(year, month - 1, day) - DAY);
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth() + 1;
    day = prev.getUTCDate();
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseKey(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y!, m!, d!];
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = parseKey(key);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** instant ที่วันทวน key เริ่ม */
export function dayStart(key: string, cfg: DayConfig): Date {
  const [y, m, d] = parseKey(key);
  return zonedInstant(y, m, d, cfg.dayStartHour, cfg.timeZone);
}

/** instant ที่วันทวนถัดไปเริ่ม (= สิ้นสุดของวันนี้) */
export function nextDayStart(date: Date, cfg: DayConfig): Date {
  return dayStart(addDaysToKey(studyDayKey(date, cfg), 1), cfg);
}

/** จำนวนวันทวนระหว่างสอง key (b − a) */
export function daysBetweenKeys(a: string, b: string): number {
  const [ya, ma, da] = parseKey(a);
  const [yb, mb, db] = parseKey(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY);
}
