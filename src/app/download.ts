/** ให้เบราว์เซอร์ดาวน์โหลด JSON เป็นไฟล์ (สร้างบนเครื่อง ไม่ส่งไปที่ไหน) */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse((await file.text()).replace(/^﻿/, ''));
}
