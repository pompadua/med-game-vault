# Med Game Vault

คลังเกมการเรียนแพทย์ + ระบบทวน FSRS — เนื้อหาถูกจัดเป็น "กติกา" (core rules + errata) แล้วฝึกด้วยการดึงความจำผ่านเกม 8 โหมด

- **คลัง**: pack เป็น JSON ใน git (`content/packs/<subject>/<packId>.json`) ตรวจด้วย zod schema + validator
- **ทวน**: FSRS (`ts-fsrs`), คิวรายวันแบบสลับหัวข้อ, ให้คะแนนเกมอัตโนมัติ, review log, export/import
- **เล่น**: Deduction, Guess Who, Engine, Legality, Campaign, Matchups, Speedrun, MCQ (NLE) + post-game analysis
- **ใช้ได้บนมือถือและ offline** (PWA) · ข้อมูลการทวนเก็บในเบราว์เซอร์ของเครื่องนั้นเท่านั้น
- **ฟรีทั้งหมด**: ไม่มี backend/cloud DB และไม่เรียก AI API · deploy เป็น static site บน GitHub Pages

> เนื้อหาใช้เพื่อการเรียนเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์ · pack สถานะ `draft` ยังไม่ผ่านการ audit

## เริ่มใช้ (Windows PowerShell)

```bash
npm.cmd install
```
```bash
npm.cmd run dev
```

คำสั่งอื่น: `npm.cmd run check` (validate + test + build) · `npm.cmd run validate` · `npm.cmd test` · `npm.cmd run build` · `npm.cmd run vault:report`

สร้างเนื้อหาด้วย Claude Code: `/new-pack`, `/debrief`, `/audit-pack`, `/vault` — ดู `CLAUDE.md`
