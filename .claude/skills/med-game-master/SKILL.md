---
name: med-game-master
description: วิธีการสร้าง game pack การแพทย์สำหรับ Med Game Vault — ย่อเนื้อหาเป็นกฎ if-then + errata, แยกโรคคล้ายกันแบบ Guess Who/Clue, เลือกโหมดเกม 2–4 โหมด และเขียนทุกองค์ประกอบให้กลายเป็น review item ที่ FSRS ทวนได้ ใช้ทุกครั้งที่สร้าง/แก้/ตรวจ pack ใน content/packs (ร่วมกับ /new-pack, /debrief, /audit-pack)
---

# Med Game Master — วิธีการสร้าง game pack

ผู้ใช้: นิสิตแพทย์ปี 4 ในไทย ถนัดคณิตศาสตร์และบอร์ดเกม หาช่องโหว่/ทางชนะได้เร็ว แต่จำเนื้อหาแพทย์ได้ช้ากว่าจำกติกาเกม
งานของคุณ: แปลงเนื้อหาแพทย์เป็น **pack JSON** ที่ (1) ถูกต้องตามแหล่งอ้างอิง (2) ย่อเป็นกติกาให้ "คิดย้อน" ได้ (3) ทุกชิ้นกลายเป็น review item ที่ทวนได้ทันที

skill นี้รวมจุดดีของ skill `med-game-master` ส่วนกลาง (ตารางชนิดความรู้ → กลไก, ค่าแต้ม deduction, trap question, debrief loop) เข้ากับสเปกของโปรเจกต์นี้ — ถ้าสองที่ขัดกัน **ยึดไฟล์นี้** เพราะ output ต้องเป็น JSON ตาม schema ไม่ใช่ HTML

## หลักคิด (ห้ามข้าม)

1. **กฎแทนการท่องจำ** — ย่อหัวข้อเหลือ core rules 3–7 ข้อแบบ if-then และระบุว่าแต่ละกฎ "ให้กำเนิด" ข้อเท็จจริงอะไร (`generates[]`) ข้อเท็จจริงที่คิดย้อนจากกฎได้ไม่ต้องท่อง
2. **ข้อยกเว้นคือ errata** — แยกไว้ต่างหาก ผูกกับกฎที่มันฝ่าฝืน (`breaksRule`) ข้อสอบชอบออกตรงนี้
3. **การแยกโรคที่คล้ายกันคือทักษะหลักของข้อสอบ** — การ์ดทุกใบมี `lookAlikes` + `tells` (feature ที่ถูกที่สุดที่แยกได้) และใช้ Guess Who / Deduction ฝึก
4. **เล่น = ดึงความจำ (retrieval)** — ผู้เล่นต้องตอบก่อนเห็นเฉลยเสมอ ห้ามเกมที่เป็นแค่การอ่าน
5. **Post-game analysis แบบ chess engine** — ทุกเกมต้องมีเส้นทาง/คำตอบที่ดีที่สุดพร้อมเหตุผล (`optimalLine`, `optimalTree`, `why`, `explanation`)
6. **กลไกเกม ไม่ใช่เนื้อเรื่อง** — ห้ามตั้งชื่อแฟนตาซีหรือแต่งเรื่องที่ต้องจำเพิ่ม ใช้คำศัพท์แพทย์จริง
7. **ค่าจำ (memorize tax)** — ข้อมูลที่คิดย้อนไม่ได้ (ขนาดยา, cutoff, ชื่อเฉพาะ, ตัวเลข) ใส่ใน `memorize[]` ตรง ๆ พร้อม `sourceId` อย่าแกล้งทำเป็นว่าคิดย้อนได้
8. **ออกแบบเพื่อการทวน** — ก่อนเขียนอะไรต้องตอบได้ว่า "จะกลายเป็น review item ชนิดไหน หน้าการ์ดถามอะไร หลังการ์ดเฉลยอะไร" ถ้าตอบไม่ได้ อย่าเขียน (ดูตารางด้านล่าง)

## ชนิดความรู้ → กลไก

| ชนิดความรู้ | ตัวอย่าง | ใส่ที่ |
|---|---|---|
| กลไก/สรีรวิทยา, สมการ | Starling, RAAS, MAP = CO × SVR, A–a gradient | `coreRules` + `games.engine` |
| Classification / criteria / staging | NYHA vs ACC/AHA stage, PALM-COEIN, Tokyo | `games.legality` |
| โรคคล้ายกัน | สาเหตุ dyspnea, AUB, vaginitis | `cards[].tells` + `trapPairs` + `games.guessWho` / `games.deduction` |
| Management algorithm | guideline flowchart, ATLS | `games.campaign` (ต้องมี `guidelineSourceId`) |
| ยา × ภาวะ | contraindication, interaction | `games.matchups` |
| ตัวเลข/ชื่อเฉพาะ | dose, cutoff, eponym | `cards[].memorize` + `games.speedrun` |
| รูปแบบข้อสอบ | keyword tell, distractor | `exploits`, `distractorPatterns`, `games.mcq` |

เลือก **2–4 โหมด** ที่เหมาะกับเนื้อหาจริง (validator เตือนถ้านอกช่วงนี้) ไม่ต้องใช้ครบทุกโหมด

## Schema (ย่อ) — ดูตัวจริงที่ `src/core/schema/pack.ts`

ไฟล์: `content/packs/<subject>/<packId>.json` · `packId` kebab-case ตั้งครั้งเดียว ห้ามเปลี่ยน · `meta.subject` = ชื่อโฟลเดอร์

```
meta: { id, title, subject, rotation, tags[], status: draft|verified|needs-audit, schemaVersion: 1,
        createdAt: YYYY-MM-DD, verifiedAt: YYYY-MM-DD|null, sources[{id, title, url, type, accessedAt}] }
rulebook: { board, pieces[{id,name,role}], coreRules[{id, rule, generates[], ruleOfThumb?, sourceIds?, variants?}],
            winConditions[], loseConditions[], errata[{id, text, breaksRule, sourceIds?, ruleOfThumb?}] }
cards[]: { id, name, who, trigger{ruleId, text}, signature, lookAlikes[cardId], tells[{vs: cardId, feature}],
           counter, danger, memorize[{id, prompt, fact, sourceId, variants?}], sourceIds?, ruleOfThumb? }
exploits[]: { id, ifSee, think, strength: rule|heuristic, exception? }   ← heuristic ต้องมี exception
distractorPatterns[]: { id, pattern, kill }
trapPairs[]: { id, a: cardId, b: cardId, decider }
games: { deduction?, guessWho?, engine?, legality?, campaign?, matchups?, speedrun?, mcq? }
  ทุกข้อ: { id, targetSeconds, difficulty: 1|2|3, basedOn{rules?, errata?, trapPairs?}, hint? }
```

- `source.type`: guideline | thai-guideline | statpearls | review | article | textbook | other
- `variants[{region: TH|US|EU|intl, text, sourceId, examLikely?}]` — แนวทางต่างกัน เก็บทุกแบบ และติด `examLikely: true` ที่แบบที่ข้อสอบไทยน่าจะยึด
- `ruleOfThumb: true` ทุกครั้งที่ตัดทอนให้ง่ายกว่าความจริง
- tag ต้องอยู่ใน `content/taxonomy.json` (ถ้าใหม่จริง เพิ่มที่นั่นพร้อม aliases) — ห้ามสร้างชื่อซ้ำซ้อน เช่น `HF` กับ `heart-failure`

### รายละเอียดเกม
- **deduction**: `chiefComplaint`, `vitals?`, `budget`, `clues[{id, kind: history|pe|bedside|lab|imaging, cost, label, reveals, strength|lr{value, sourceId}, why}]`, `diagnosisOptions`, `nextStepOptions`, `answer{diagnosis, nextStep}`, `optimalLine[clueId]` (แต้มรวม ≤ budget), `explanation` · ค่าแต้มตั้งต้น: history 1 / PE 2 / bedside 3 / lab 4 / imaging 5 (ปรับตามความ invasive/แพง) · **ใช้ LR เฉพาะเมื่อมีแหล่งอ้างอิง** ไม่งั้นใช้ strength
- **guessWho**: 4–8 `candidates`, `questions[{id, text, yes[candidateId]}]`, `optimalTree` — validator คำนวณ brute force ว่า tree ตื้นที่สุดจริง
- **engine**: `perturbation`, `equation?`, `cells[{id, variable, answer: up|down|same, why, ruleId?, counterIntuitive?}]` — ต้องมีช่อง `counterIntuitive` ≥ 1
- **legality**: `case`, `question`, `options`, `answer`, `ruleIds`, `why`
- **campaign**: `guidelineSourceId`, `intro`, `startTurn`, `turns[{id, state, choices[{id, label, next|null, quality: best|ok|harmful, feedback}]}]`, `guidelineSequence[]` — ตัวเลือก harmful ควรพาไป turn ที่แสดงผลเสียจริงแล้วให้โอกาสแก้ตัว
- **matchups**: `conditions`, `rows[{id, drug, cells[{condition, verdict: legal|illegal|combo, why, sourceId?}]}]` — 1 แถว = 1 review item
- **speedrun**: `prompt`, `answer`, `sourceId?` (ใส่ถ้าเป็นตัวเลข)
- **mcq**: stem/ตัวเลือก **ภาษาอังกฤษแบบ NLE** 5 ตัวเลือก A–E, ตัวหลอกทุกตัวต้องมี `why`, `tell`, `explanation` (ไทยได้)

**ความยากต้องไต่ระดับในแต่ละโหมด**: ข้อแรก difficulty 1 ชนะได้ด้วย core rules · ข้อท้ายต้องใช้ errata หรือ trap pair (`basedOn.errata` / `basedOn.trapPairs`)

## กฎเรื่อง ID (สำคัญที่สุด — ประวัติการทวนผูกอยู่)

- review item ID = `${packId}:${type}:${elementId}` · `elementId` มาจากฟิลด์ `id` ไม่ใช่ข้อความ
- tell ใช้ `${cardId}~${vsCardId}` · แถว matchup ใช้ `${gridId}.${rowId}`
- **แก้ถ้อยคำ = คง id เดิม** (แอปจะคง progress และแสดงป้าย "เนื้อหาอัปเดต")
- **ความหมายเปลี่ยนจริง = ตั้ง id ใหม่ + ติด `"retired": true` ที่ของเก่า ห้ามลบ** (validator เทียบกับ git HEAD และ error ถ้า id หาย)
- ห้ามเปลี่ยน `packId` หลังสร้าง

## element → review item (หน้า/หลังการ์ด)

| element | type | หน้าการ์ด | หลังการ์ด |
|---|---|---|---|
| coreRule | `rule` | ข้อเท็จจริงใน `generates` → "มาจากกฎข้อไหน?" | `rule` |
| erratum | `erratum` | กฎที่ถูกฝ่าฝืน → "ข้อยกเว้นคืออะไร?" | `text` |
| card | `signature` / `counter` / `danger` | "<ชื่อโรค>: signature/counter/danger?" | ฟิลด์นั้น |
| card.tells[] | `tell` | "X vs Y: feature ไหนแยก?" | `feature` |
| card.memorize[] | `memorize` | `prompt` | `fact` |
| exploit | `exploit` | "ถ้าเห็น ifSee → คิดถึงอะไร?" | `think` (+ exception) |
| distractorPattern | `distractor` | pattern → "ฆ่ายังไง?" | `kill` |
| trapPair | `trapPair` | "A vs B: decider?" | `decider` |
| games.* | ชื่อโหมด (`matchup` สำหรับแถว) | เล่นเกม | post-game analysis + ตรวจอัตโนมัติ |

ดังนั้น: `prompt` ของ memorize ต้องเป็นคำถามที่ตอบได้ชัด, `generates` ต้องเพียงพอให้นึกกฎออก, `feature`/`decider` ต้องเป็น feature เดียวที่ชี้ขาด ไม่ใช่ย่อหน้ายาว

## มาตรฐานความถูกต้อง (ห้ามข้าม)

1. ค้นก่อนเขียนเสมอ (WebSearch/WebFetch/PubMed): guideline ของสมาคมวิชาชีพ, ราชวิทยาลัย/กรมการแพทย์/แนวทางไทย, StatPearls, PubMed/PMC, ตำรามาตรฐาน
2. ตัวเลข, cutoff, LR, sensitivity/specificity **ต้องมี `sourceId`** (validator บังคับกับ `memorize[]` และเตือนถ้าการ์ดมีตัวเลข+หน่วยแต่ไม่มี `sourceIds`) — **ห้ามแต่งตัวเลข ห้ามสร้าง citation ปลอม** ถ้าหาแหล่งไม่ได้ ให้ไม่ใส่ตัวเลขนั้น หรือใช้ strength แทน LR
3. ถ้าเปิดแหล่งไม่ได้ (paywall/บล็อก) ให้บอกผู้ใช้ตรง ๆ ว่าข้อไหนยืนยันจากต้นฉบับแล้ว ข้อไหนยังไม่ได้
4. โน้ตของผู้ใช้ผิด/ล้าสมัย → แก้ แล้วสรุปให้รู้ว่าแก้อะไร
5. แนวทางไทยกับสากลต่างกัน → `variants` ทั้งสองแบบ + `examLikely`
6. ความเป็นส่วนตัว: ห้ามข้อมูลระบุตัวผู้ป่วย (เคสจากวอร์ดต้องเปลี่ยนรายละเอียด) · ลิขสิทธิ์: ห้ามคัดลอกข้อความยาวจากตำรา/PDF เขียนใหม่ด้วยคำของตัวเอง · repo นี้ **public** — ทุกอย่างใน pack คนอื่นเห็นได้

## ขั้นตอนสร้าง pack

1. Intake: อ่านโน้ต/PDF ทั้งหมดก่อน (ถ้ามี) · ตัดสินใจ subject/rotation/tags จาก taxonomy
2. ค้นและยืนยันเนื้อหา → จดแหล่งที่ใช้จริงเป็น `meta.sources`
3. แยกชนิดความรู้ → เลือกโหมด 2–4 โหมด
4. เขียน rulebook → cards → exploits/distractors/trapPairs → games (ไต่ระดับความยาก)
5. `npm run pack:new -- <subject> <packId> "<title>"` สร้างโครง หรือเขียนไฟล์เองตาม schema
6. `npm run validate` (แก้จนไม่มี error, ดู warning ทุกข้อ) → `npm run build:index` → `npm test`
7. สรุปให้ผู้ใช้ก่อน commit (ดูรูปแบบใน `/new-pack`)

## Debrief loop (ใช้ใน /debrief)

| ชนิดความผิดพลาด | เพิ่มอะไร |
|---|---|
| ไม่รู้ข้อเท็จจริง (`fact`) | `memorize` ใหม่ (+ `speedrun` ถ้าเป็นตัวเลข) |
| ใช้กฎผิด (`rule`) | `engine` หรือ `legality` ใหม่ที่บังคับใช้กฎนั้น |
| ติดกับดัก (`trap`) | `trapPair` ใหม่ (+ `tell`/`exploit`) |
| อ่าน clue พลาด (`clue`) | `deduction` ใหม่ที่หมุนรอบ clue นั้น |
| leech | เขียน item ใหม่ให้เข้าใจง่ายขึ้น เช่น แปลงเป็นกฎหรือ trap pair — **คง id ถ้าความหมายเดิม**, ถ้าความหมายเปลี่ยนให้ retire ของเก่า |

## ท้ายสรุปทุกครั้ง
- **สรุปเกล็ดความรู้**: 1–3 กฎที่ให้กำเนิดเนื้อหาส่วนใหญ่ของหัวข้อ
- **อ้างอิง**: แหล่งที่ใช้จริง พร้อมลิงก์ ห้ามแต่ง
