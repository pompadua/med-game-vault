/**
 * ค้นหาแบบ substring — ภาษาไทยไม่มีเว้นวรรคระหว่างคำ จึงไม่ใช้ tokenizer ที่ตัดคำด้วยช่องว่าง
 * คำค้นที่คั่นด้วยช่องว่างหลายคำ = ต้องเจอทุกคำ (AND)
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchTerms(query: string): string[] {
  return normalizeSearch(query).split(' ').filter(Boolean);
}

export function matchesQuery(haystackNormalized: string, query: string): boolean {
  const terms = searchTerms(query);
  return terms.every((t) => haystackNormalized.includes(t));
}
