# Med Game Vault — คู่มือสำหรับ Claude Code

คลังเกมการเรียนแพทย์ + ระบบทวน FSRS ของนิสิตแพทย์ปี 4 (ไทย) สเปกเต็มอยู่ที่ `PROMPT.md`
ลำดับความสำคัญ: **ทวนได้ > เก็บในคลังได้ > สร้าง game pack > ใช้บนมือถือ/offline**

## กฎเหล็ก
- **ศูนย์บาท**: ห้ามเพิ่มบริการ/dependency ที่มีค่าใช้จ่าย ต้องใส่บัตร หรือมี license key (ไม่มี backend, ไม่มี cloud DB, แอปไม่เรียก AI API) ถ้ามีทางเลือกที่อาจมีค่าใช้จ่าย ให้หยุดถามผู้ใช้ก่อน
- **Git**: commit ได้ แต่**ห้ามสร้าง remote หรือ push โดยไม่ถาม**
- **Repo เป็น public (GitHub Pages)**: ห้ามข้อมูลระบุตัวผู้ป่วย ห้ามคัดลอกข้อความยาวจากตำรา/PDF ข้อมูลการทวนของผู้ใช้อยู่ใน IndexedDB เท่านั้น (ไฟล์ export อยู่ใน .gitignore)
- **ความถูกต้อง**: ตัวเลข/cutoff/LR ต้องมี `sourceId` จากแหล่งที่ค้นยืนยันจริง ห้ามแต่ง citation · ตัดทอน = `ruleOfThumb: true` · แนวทางไทยต่างจากสากล = `variants` + `examLikely`
- **ห้ามบอกว่าเสร็จ** จนกว่า `npm run validate`, `npm test`, `npm run build` ผ่านจริง (หรือ `npm run check`)

## สภาพแวดล้อม
- Windows 11 + PowerShell 5.1 · Node 24 LTS · Git 2.55 (ติดตั้งผ่าน winget)
- ใน PowerShell ใช้ **`npm.cmd`** (execution policy อาจบล็อก `npm.ps1`) · ถ้า session เก่ายังหา node ไม่เจอ: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
- สคริปต์ทั้งหมดเขียนด้วย Node/tsx (ห้าม `rm -rf` หรือคำสั่งที่มีแค่ใน bash)
- Time zone ระบบทวน: Asia/Bangkok, วันใหม่ 04:00 (ตั้งค่าได้ในแอป)
- Preview ใน Claude desktop: `.claude/launch.json` → `vault-dev` (port 5173)

## โครงสร้าง repo
```
content/
  taxonomy.json            subject / rotation / tag (+aliases) ที่อนุญาต
  curriculum.json          หัวข้อต่อ rotation (ใช้กับ /vault) + currentRotation
  packs/<subject>/<packId>.json   1 pack = 1 ไฟล์
  index.json               สร้างโดย npm run build:index (commit ไว้; validate เช็คว่าไม่ stale)
src/core/                  TypeScript ล้วน ใช้ร่วมกันระหว่างสคริปต์และแอป (มี test)
  schema/pack.ts           zod schema ของ pack (แหล่งความจริงของ schema)
  schema/migrate.ts        migration ของ pack (schemaVersion)
  validate.ts              cross-ref, id ซ้ำ, taxonomy, guessWho optimal, ห้ามลบ id (เทียบ git HEAD)
  items/extract.ts         pack → review items (deterministic, contentHash)
  games/                   guessWho (min depth), score (ตรวจคำตอบแต่ละโหมด), lookup
  srs/                     settings, day (04:00 Asia/Bangkok), scheduler (ts-fsrs 5.x), grading,
                           queue (R ต่ำก่อน + interleave + sibling + limits), backup (export/import merge),
                           practice (ฝึกนอกตาราง/boss), progress, stats
  search.ts, vaultIndex.ts, vaultFilter.ts
src/app/                   Vite + React 19 PWA (hash router, Dexie/IndexedDB)
  db.ts (Dexie schema, เพิ่ม version ใหม่เมื่อเปลี่ยน — ห้ามแก้ version เก่า), repo.ts (อ่าน/เขียน DB)
  pages/ (Home, Vault, Pack, Review, Play, Practice, Stats, Settings), games/ (UI 8 โหมด), review/
scripts/                   validate, build-index, new-pack, vault-report, debrief-summary, deploy, clean
tests/                     Vitest (+ fixtures/demo-all-modes.json = pack ทุกโหมดสำหรับ test และหน้า DEV demo)
.claude/skills/med-game-master/SKILL.md   วิธีการสร้าง pack (อ่านทุกครั้งก่อนแตะ content/packs)
.claude/commands/          /new-pack, /debrief, /audit-pack, /vault
```

## Schema และกฎเรื่อง ID
- schema: `src/core/schema/pack.ts` · สรุปภาษาคนใน `.claude/skills/med-game-master/SKILL.md`
- review item ID = `${packId}:${type}:${elementId}` (tell = `${cardId}~${vsId}`, matchup row = `${gridId}.${rowId}`)
- `elementId` มาจากฟิลด์ `id` **ไม่ใช่ข้อความ** → แก้ถ้อยคำ/สลับลำดับแล้ว ID ไม่เปลี่ยน (มี test)
- ID เดิมแต่ `contentHash` เปลี่ยน → แอปคง progress และแสดง "เนื้อหาอัปเดต"
- ความหมายเปลี่ยนจริง → id ใหม่ + `retired: true` ที่ของเก่า **ห้ามลบ** (validate error ถ้า id ที่เคยมีใน HEAD หายไป)
- ห้ามเปลี่ยน `packId` · เปลี่ยน schema → เพิ่ม `CURRENT_PACK_SCHEMA_VERSION` + migration + test
- ชนิด item: memory = rule, erratum, signature, counter, danger, tell, memorize, exploit, distractor, trapPair · puzzle = speedrun, engine, guessWho, legality, matchup, mcq, deduction, campaign

## ระบบทวน (สรุป)
- FSRS ผ่าน `ts-fsrs` 5.4 (`fsrs(generatorParameters(...))`, `repeat`, `next`, `get_retrievability`) desired retention ตั้งได้ (0.9)
- คิว: due จาก pack ที่ "เปิดทวน" → R ต่ำก่อน → interleave ข้าม pack → sibling (การ์ดเดียวกัน) วันละ 1 → จำกัด new/วัน, deduction+campaign/วัน, งบเวลา
- เกรด puzzle อัตโนมัติ: ผิด Again / hint·เกินเวลา·ตอบ >1 ครั้ง Hard / ภายในเวลา Good / ครั้งแรก ≤50% เวลา Easy · deduction และ guessWho มีกฎเฉพาะ (`src/core/srs/grading.ts`) · ข้อเลือกตอบได้สูงสุด 2 ครั้ง
- ตอบผิด → บังคับเลือกชนิดความผิดพลาด (fact / rule / trap / clue)
- review log append-only · export/import JSON ไฟล์เดียว (merge ตาม item ID, เลือกที่ทวนล่าสุดกว่า) · เตือนสำรองเมื่อเกิน 7 วัน
- leech: lapses ≥ 6 · export สำหรับ Claude (`kind: med-game-vault-debrief`) = errors + leeches + flags

## Workflow
| งาน | ทำอย่างไร |
|---|---|
| สร้าง pack | `/new-pack <หัวข้อ หรือ path>` (ใช้ skill med-game-master) |
| ปรับ pack จากผลทวน | ผู้ใช้กด "Export สำหรับ /debrief" ในหน้าตั้งค่า → `/debrief <path>` |
| ตรวจข้อเท็จจริง | `/audit-pack <packId> [export path]` → แก้หลังผู้ใช้ยืนยัน → อัปเดต verifiedAt/status |
| ดูภาพรวมคลัง | `/vault` (`npm run vault:report`) |
| ตรวจทั้งหมด | `npm run check` (= validate + test + build) |
| dev server | `npm.cmd run dev` → http://localhost:5173 · DEV demo ทุกโหมด: `#/play?demo=1&types=puzzle` |
| deploy | `npm run deploy` (build + push `dist` ไป branch `gh-pages`) — ต้องมี remote ก่อน และ**ถามผู้ใช้ก่อนทุกครั้ง** |

## สถานะ (2026-10-12)
- Phase 1–5 เสร็จ (คลัง, ระบบทวน, เกม 8 โหมด, Claude Code commands, stats/PWA/deploy script)
- pack: `cardio-heart-failure` (draft) — แนวทางไทย HFCT ยังเปิด full text ไม่ได้ (jmatonline ปฏิเสธการเชื่อมต่อ) จึงยังไม่มี variant TH → ควร `/audit-pack cardio-heart-failure`
- remote: `origin` = https://github.com/pompadua/med-game-vault (public) · เว็บ: https://pompadua.github.io/med-game-vault/ (GitHub Pages จาก branch `gh-pages`)
- deploy ใหม่หลังแก้: `npm run deploy -- --yes` (ถามผู้ใช้ก่อนทุกครั้ง) · push `main` ก็ต้องถามก่อนเช่นกัน
