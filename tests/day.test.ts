import { describe, expect, it } from 'vitest';
import { addDaysToKey, dayStart, daysBetweenKeys, nextDayStart, studyDayKey } from '../src/core/srs/day';

const bkk = { timeZone: 'Asia/Bangkok', dayStartHour: 4 };

describe('วันของระบบทวน (Asia/Bangkok, เริ่ม 04:00)', () => {
  it('03:59 ยังนับเป็นวันก่อนหน้า, 04:00 เป็นวันใหม่', () => {
    // 2026-10-12 03:59 BKK = 2026-10-11 20:59 UTC
    expect(studyDayKey(new Date('2026-10-11T20:59:00Z'), bkk)).toBe('2026-10-11');
    expect(studyDayKey(new Date('2026-10-11T21:00:00Z'), bkk)).toBe('2026-10-12');
  });

  it('ข้ามเดือน/ปีถูกต้อง', () => {
    // 2027-01-01 02:00 BKK → ยังเป็น 2026-12-31
    expect(studyDayKey(new Date('2026-12-31T19:00:00Z'), bkk)).toBe('2026-12-31');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetweenKeys('2026-10-12', '2026-11-11')).toBe(30);
  });

  it('dayStart / nextDayStart เป็น 04:00 BKK = 21:00 UTC วันก่อน', () => {
    expect(dayStart('2026-10-12', bkk).toISOString()).toBe('2026-10-11T21:00:00.000Z');
    expect(nextDayStart(new Date('2026-10-12T05:00:00Z'), bkk).toISOString()).toBe('2026-10-12T21:00:00.000Z');
    // ตี 2 ของวันที่ 13 ยังอยู่ในวันทวน 12 → วันถัดไปเริ่ม 13 เวลา 04:00
    expect(nextDayStart(new Date('2026-10-12T19:00:00Z'), bkk).toISOString()).toBe('2026-10-12T21:00:00.000Z');
  });

  it('ตั้งค่าเวลาเริ่มวันได้', () => {
    const midnight = { timeZone: 'Asia/Bangkok', dayStartHour: 0 };
    expect(studyDayKey(new Date('2026-10-11T17:30:00Z'), midnight)).toBe('2026-10-12');
  });

  it('time zone ที่มี DST (America/New_York) ยังได้ 04:00 local', () => {
    const ny = { timeZone: 'America/New_York', dayStartHour: 4 };
    // 2026-03-08 คือวันเปลี่ยน DST ของสหรัฐฯ: 04:00 EDT = 08:00 UTC
    expect(dayStart('2026-03-08', ny).toISOString()).toBe('2026-03-08T08:00:00.000Z');
    expect(dayStart('2026-03-07', ny).toISOString()).toBe('2026-03-07T09:00:00.000Z');
  });
});
