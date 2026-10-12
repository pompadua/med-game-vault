---
description: สร้าง game pack ใหม่จากหัวข้อหรือไฟล์โน้ต/PDF (ตรวจแหล่งอ้างอิง → JSON draft → validate/test → สรุป → commit)
argument-hint: <หัวข้อ หรือ path ของไฟล์โน้ต/PDF>
---

สร้าง game pack ใหม่สำหรับ: **$ARGUMENTS**

ใช้ skill `med-game-master` (`.claude/skills/med-game-master/SKILL.md`) เป็นวิธีการหลัก และอ่าน `CLAUDE.md` ถ้ายังไม่ได้อ่านใน session นี้

ขั้นตอน:

1. **Intake**
   - ถ้า argument เป็น path ของไฟล์ ให้อ่านทั้งไฟล์ก่อน (PDF ยาว: อ่านทีละช่วงหน้าให้ครบ)
   - เปิด `content/taxonomy.json` แล้วเลือก subject / rotation / tags ที่มีอยู่ ถ้าต้องใช้ tag ใหม่จริง ให้เพิ่มใน taxonomy พร้อม aliases
   - ตั้ง `packId` แบบ kebab-case `<subject>-<topic>` และเช็คว่ายังไม่มีใน `content/index.json` (packId ห้ามเปลี่ยนภายหลัง)
   - ถามผู้ใช้เฉพาะสิ่งที่ตัดสินใจแทนไม่ได้จริง ๆ
2. **ตรวจเนื้อหาก่อนเขียน**: ค้น guideline ปัจจุบัน (สากล + แนวทางไทยถ้ามี), StatPearls และ PubMed ตัวเลขทุกตัวต้องมีแหล่ง ห้ามแต่ง citation ถ้าเปิดแหล่งไหนไม่ได้ให้จดไว้บอกผู้ใช้
3. **ออกแบบ**: core rules 3–7 ข้อ + errata → การ์ด (lookAlikes/tells/memorize) → exploits / distractorPatterns / trapPairs → เลือก 2–4 โหมดเกม โดยไต่ความยากจาก core rules ไปถึง errata/trap pair
4. **เขียนไฟล์** `content/packs/<subject>/<packId>.json` ด้วย `status: "draft"` และ `verifiedAt: null` (สร้างโครงได้ด้วย `npm run pack:new -- <subject> <packId> "<title>" [rotation]`)
   - เพิ่มหัวข้อใน `content/curriculum.json` ของ rotation นั้นพร้อม `packId`
5. **ตรวจ** (บน Windows ใช้ `npm.cmd` ใน PowerShell):
   - `npm run validate` → แก้จนไม่มี error และอธิบาย warning ที่เหลือ
   - `npm run build:index`
   - `npm test`
6. **สรุปให้ผู้ใช้ดูก่อน commit**:
   - กฎหลัก (เลขข้อ + กฎ) และ errata
   - จำนวน review item แยกตามชนิด (ดูจาก `countsByType` ใน `content/index.json`)
   - โหมดเกมที่เลือกและเหตุผล
   - **สิ่งที่แก้จากโน้ต** (ถ้ามีโน้ต) และจุดที่แนวทางไทยกับสากลต่างกัน
   - แหล่งอ้างอิงที่ใช้จริง และข้อที่ยังยืนยันจากต้นฉบับไม่ได้
   - สรุปเกล็ดความรู้ 1–3 กฎ
7. **Commit** เมื่อทุกอย่างผ่าน: `git add content` แล้ว `git commit -m "pack: add <packId> (draft)"` — **ห้ามสร้าง remote หรือ push เอง**
