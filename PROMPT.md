# โปรเจกต์: Med Game Vault — คลังเกมการเรียนแพทย์ + ระบบทวน

## เป้าหมาย (เรียงตามความสำคัญ)
1. **ทวนได้**: ทุกอย่างที่สร้างต้องแตกเป็น review item ที่ FSRS ตั้งเวลาทวนให้อัตโนมัติ ไม่มีเนื้อหาไหนสร้างแล้วถูกลืม
2. **เก็บในคลังได้**: ทุก pack อยู่ในคลังเดียว ค้นหาและกรองได้ มีประวัติการแก้ ไม่มีวันหาย
3. **สร้าง game pack** จากเนื้อหาแพทย์ (โน้ต, PDF, ชื่อหัวข้อ) ตามวิธีการด้านล่าง
4. ใช้บนมือถือได้ และใช้ offline ได้

## บริบทผู้ใช้
ฉันเป็นนิสิตแพทย์ปี 4 ในไทย ถนัดคณิตศาสตร์และบอร์ดเกม หาช่องโหว่/ทางชนะได้เร็ว แก้ปัญหาเฉพาะหน้าเก่ง
แต่จำเนื้อหาแพทย์ได้ช้ากว่าการจำกติกาเกม จึงต้องการให้เนื้อหาถูกจัดเป็น "กติกา" แล้วฝึกด้วยการดึงความจำซ้ำ ๆ

## สภาพแวดล้อม
- Windows 11 + PowerShell: npm scripts ต้องรันได้ทุกแพลตฟอร์ม (เขียนสคริปต์ด้วย Node/tsx ห้ามใช้คำสั่งที่มีแค่ใน bash เช่น `rm -rf`, `&&` ใน shell script)
- โฟลเดอร์นี้ยังไม่เป็น git repo ให้ `git init` ใน Phase 1 แต่ต้องถามฉันก่อนสร้าง remote หรือ push
- Time zone: Asia/Bangkok วันใหม่ของระบบทวนเริ่มตอน 04:00 (ตั้งค่าได้)
- ถ้าเครื่องมี skill `med-game-master` อยู่แล้ว ให้อ่านก่อน แล้วรวมจุดดีเข้ากับวิธีการในไฟล์นี้ อย่าให้ทั้งสองขัดกัน

## สถาปัตยกรรม (ปรับได้ถ้ามีทางที่ดีกว่า แต่ให้อธิบายเหตุผลก่อนเปลี่ยน)
- **Claude Code = ตัวสร้างเนื้อหา**: ผ่าน project skill + slash commands ใน `.claude/`
- **Repo = คลัง**: pack เก็บเป็น JSON ใน git (ดูประวัติและย้อนกลับได้)
- **เว็บแอป = ที่เล่นและทวน**: Vite + React + TypeScript, PWA, mobile-first, ใช้ offline ได้
- **สถานะการทวน**: IndexedDB (Dexie) บนเครื่อง พร้อม export/import เป็น JSON
- **Scheduler**: FSRS ผ่าน `ts-fsrs` (เช็คเวอร์ชันล่าสุดและ API ปัจจุบันก่อนใช้ ห้ามเดา API)
- **Validation**: zod schema ใช้ร่วมกันทั้งสคริปต์และแอป pack ที่ไม่ผ่าน `npm run validate` เข้าคลังไม่ได้
- **Test**: Vitest
- **Deploy**: static site (GitHub Pages หรือ Vercel) ดูข้อควรระวังเรื่อง public/private ด้านล่าง

## คลัง (Vault)
- **1 pack = 1 ไฟล์**: `content/packs/<subject>/<packId>.json`
  - `packId` เป็น kebab-case เช่น `cardio-heart-failure` ตั้งครั้งเดียวแล้วห้ามเปลี่ยน (ID ของ review item อ้างอิงอยู่)
  - ทุก pack มี `schemaVersion` ถ้าเปลี่ยน schema ต้องมี migration และ test
- **Taxonomy กลาง**: `content/taxonomy.json` เก็บรายการ subject / rotation / tag ที่ใช้ได้ validator ต้องเตือนเมื่อเจอ tag ใหม่ที่ไม่อยู่ในรายการ เพื่อกันชื่อซ้ำซ้อน เช่น `HF` กับ `heart-failure`
- **Index**: `npm run build:index` สร้าง `content/index.json` (meta + จำนวน item + ข้อความสำหรับค้นหา) แอปโหลด index ก่อน แล้ว lazy-load pack ทีละไฟล์ (`import.meta.glob`) และ precache ทั้งหมดไว้ใช้ offline
- **สถานะ pack**: `draft` | `verified` | `needs-audit`
  - ในแอปมีสวิตช์ "เปิดทวน / พักไว้" ราย pack โดย pack ใหม่จะเข้าคิวทวนเมื่อฉันกดเปิดเท่านั้น
- **ค้นหา**: ค้นทั้งไทยและอังกฤษใน title, tags, ชื่อโรคในการ์ด, ข้อความกฎ (ภาษาไทยไม่มีเว้นวรรค ให้ใช้ substring/n-gram หรือ `Intl.Segmenter` อย่าพึ่ง tokenizer ที่ตัดคำด้วยช่องว่าง)
- **ตัวกรอง**: subject, rotation, tag, สถานะ, "มี item ครบกำหนด", "จุดอ่อน" (ความแม่น < X%)
- **การ์ด pack ในหน้าคลัง** แสดง progress: item ใหม่ / กำลังเรียน / ทวน, retention ของ pack, วันที่ทวนล่าสุด, verifiedAt
- **การลบ pack**: ถ้า pack หายจาก repo แอปต้องไม่ลบประวัติการทวน ให้แสดงเป็น "pack ที่ถูกถอด" ใน settings แทน

## วิธีการสร้าง game pack (หัวใจของโปรเจกต์ ให้บันทึกเป็น `.claude/skills/med-game-master/SKILL.md`)
หลักคิด:
- **กฎแทนการท่องจำ**: ย่อแต่ละหัวข้อเหลือ core rules 3–7 ข้อแบบ if-then ที่ใช้อธิบายข้อเท็จจริงส่วนใหญ่ได้ และระบุว่าแต่ละกฎ "ให้กำเนิด" ข้อเท็จจริงใดบ้าง
- **ข้อยกเว้นคือ errata**: แยกไว้ต่างหาก และผูกแต่ละข้อกับกฎที่มันฝ่าฝืน
- **การแยกโรคที่คล้ายกันคือทักษะหลักของข้อสอบ**: ใช้กลไกแบบ Guess Who / Clue
- **การเล่นต้องเป็นการดึงความจำ (retrieval)**: ผู้เล่นต้องตอบก่อนเห็นเฉลยเสมอ
- **มี post-game analysis แบบ chess engine**: แสดงเส้นทางที่ดีที่สุดพร้อมเหตุผล
- **ใช้กลไกเกม ไม่ใช้เนื้อเรื่อง**: ห้ามตั้งชื่อแฟนตาซีหรือแต่งเรื่องที่ต้องจำเพิ่ม
- **ค่าจำ**: ข้อมูลที่คิดย้อนไม่ได้ (ขนาดยา, cutoff, ชื่อเฉพาะ) ให้ติด tag `memorize` ตรง ๆ แล้วส่งเข้าระบบทวน
- **ออกแบบเพื่อการทวน**: ทุกองค์ประกอบที่เขียนต้องตอบได้ว่า "จะกลายเป็น review item อะไร หน้าการ์ดถามอะไร หลังการ์ดเฉลยอะไร" ถ้าตอบไม่ได้ อย่าเขียน

องค์ประกอบของ pack (ทุก rule / errata / card / exploit / ข้อในเกม ต้องมีฟิลด์ `id` ที่ตั้งเองแบบ slug และห้ามเปลี่ยนหลังสร้าง):
- **rulebook**: board (บริบททางกายวิภาค/สรีรวิทยา), pieces (ตัวละครหลัก), coreRules[{id, rule, generates[]}], winConditions, loseConditions, errata[{id, text, breaksRule}]
- **cards[]** (schema เดียวกันทุกใบ): id, who, trigger (ผูกกับ ruleId), signature, lookAlikes[cardId], tells[{vs: cardId, feature}], counter, danger, memorize[{id, fact, sourceId}]
- **exploits[]**: {id, ifSee, think, strength: "rule"|"heuristic", exception?} + distractorPatterns[] + trapPairs[{id, a, b, decider}]
- **games** (เลือก 2–4 โหมดที่เหมาะกับเนื้อหา ไม่ต้องใช้ครบทุกโหมด และทุกข้อมี `targetSeconds`):
  1. `deduction`: เคสเริ่มจาก chief complaint ผู้เล่นใช้แต้ม "ซื้อ" ข้อมูล (history/PE/bedside/lab/imaging คิดแต้มต่างกัน) ชนะเมื่อวินิจฉัยและเลือก next step ได้ถูกต้องภายในงบ เก็บ optimalLine + เหตุผลของแต่ละ clue (ใช้ LR เฉพาะเมื่อมีแหล่งอ้างอิง ถ้าไม่มีให้ใช้ระดับ strong/moderate/weak)
  2. `guessWho`: โรคคล้ายกัน 4–8 โรค ผู้เล่นต้องสร้าง decision tree ที่ตื้นที่สุดที่แยกทุกโรคได้ เก็บ optimalTree ไว้เทียบ
  3. `engine`: perturbation grid "↑X แล้วตัวแปรอื่น ↑/↓/↔" อธิบายด้วยสมการหรือ core rule และต้องมีช่องที่ขัดสัญชาตญาณอย่างน้อย 1 ช่อง
  4. `legality`: เคสสั้น ๆ ให้ตัดสินว่าเข้า class/stage/criteria ไหน เพราะกฎข้อใด
  5. `campaign`: management แบบ branching ทีละ turn ตาม guideline algorithm (ต้องระบุ guideline)
  6. `matchups`: ตาราง drug × condition แบ่งเป็น legal / illegal (contraindicated) / combo
  7. `speedrun`: เคส 1 บรรทัด หรือการ์ด memorize แบบจับเวลา
  8. `mcq`: แบบ NLE stem และตัวเลือกเป็นภาษาอังกฤษ 5 ตัวเลือก A–E แต่ละข้อมี tell, เหตุผลที่ตัดแต่ละตัวหลอก และระดับความยาก
- ความยากต้องไต่ระดับในแต่ละโหมด: ข้อแรกใช้แค่ core rules ก็ชนะได้ ข้อท้ายต้องใช้ errata หรือ trap pair
- **meta**: id, title, subject, rotation, tags, status, schemaVersion, createdAt, verifiedAt, sources[{id, title, url, type, accessedAt}]

## มาตรฐานความถูกต้อง (ห้ามข้าม)
- ก่อนเขียน pack ต้องค้นด้วย WebSearch/WebFetch จากแหล่งที่เชื่อถือได้ (PubMed/PMC, StatPearls, guideline ของสมาคมวิชาชีพ, ราชวิทยาลัย/กรมการแพทย์, ตำรามาตรฐาน)
- ถ้าโน้ตของฉันผิดหรือล้าสมัย ให้แก้ แล้วสรุปให้ฉันรู้ว่าแก้อะไรบ้าง
- ตัวเลข, cutoff, LR, sensitivity/specificity ต้องมี `sourceId` เสมอ (validator ต้องบังคับข้อนี้กับ `memorize[]`) ห้ามแต่งเอง ห้ามสร้าง citation ปลอม
- ถ้าต้องตัดทอนให้ง่ายขึ้น ให้ติดป้าย "rule of thumb"
- ถ้าแนวทางไทยกับแนวทางสากลต่างกัน ให้เก็บทั้งสองแบบและระบุว่าข้อสอบไทยน่าจะยึดแบบไหน

## ความเป็นส่วนตัวและลิขสิทธิ์
- ห้ามมีข้อมูลที่ระบุตัวผู้ป่วยได้ ถ้าเคสมาจากวอร์ด ให้เปลี่ยนรายละเอียดจนระบุตัวไม่ได้
- ห้ามคัดลอกข้อความยาว ๆ จากตำรา/PDF ลงใน pack ให้เขียนใหม่ด้วยคำของตัวเอง
- ถ้า deploy เป็นเว็บสาธารณะ ทุก pack จะถูกคนอื่นเห็นได้ ให้ถามฉันใน plan ว่าจะเอา public หรือ private (เช่น private repo + Vercel)

## ระบบทวน (สำคัญที่สุด)
### Review item
- แตก pack ออกเป็น review items แบบ deterministic (input เดิมได้ผลเดิมทุกครั้ง)
- ID: `${packId}:${type}:${elementId}` โดย `elementId` มาจากฟิลด์ `id` ใน JSON **ไม่ได้มาจากข้อความ** (แก้ถ้อยคำหรือสลับลำดับการ์ดแล้ว ID ต้องไม่เปลี่ยน)
- ทุก item มี `contentHash` ถ้า ID เดิมแต่ hash เปลี่ยน ให้คง progress ไว้และแสดงป้าย "เนื้อหาอัปเดต"
- ถ้าความหมายเปลี่ยนจริง Claude ต้องตั้ง `id` ใหม่ และติด `retired: true` ที่ของเก่า (ห้ามลบ) item ที่ retired ไม่เข้าคิว แต่ประวัติยังอยู่
- ชนิดของ item: tell (X vs Y), signature, counter, memorize, exploit, trapPair, speedrun, engine, guessWho, legality, matchup, mcq, deduction
- item ที่มาจากการ์ดใบเดียวกัน (sibling) ห้ามออกวันเดียวกัน ให้เลื่อนตัวที่เหลือไปวันถัดไป

### การให้คะแนน (เป็นค่าเริ่มต้น ตั้งค่าได้ และต้องมี unit test ครบทุกเงื่อนไข)
- **item ความจำ**: ต้องนึกคำตอบก่อนกดเปิดเฉลย แล้วให้คะแนนตัวเองเป็น Again / Hard / Good / Easy
- **item ปริศนา** ตรวจอัตโนมัติ:
  - ผิด → Again
  - ถูก แต่ใช้ hint หรือใช้เวลาเกิน `targetSeconds` หรือตอบมากกว่า 1 ครั้ง → Hard
  - ถูกภายใน `targetSeconds` → Good
  - ถูกครั้งแรก ไม่ใช้ hint และใช้เวลา ≤ 50% ของ `targetSeconds` → Easy
  - `deduction`: วินิจฉัยหรือ next step ผิด → Again / ถูกแต่เกินงบ → Hard / ภายในงบ → Good / ใช้แต้ม ≤ optimalLine → Easy
  - `guessWho`: tree แยกโรคไม่ครบ → Again / ลึกกว่า optimal ≥ 2 ชั้น → Hard / ลึกกว่า 1 ชั้น → Good / เท่า optimal → Easy
- เมื่อตอบผิด ให้เลือกชนิดความผิดพลาด: ไม่รู้ข้อเท็จจริง / ใช้กฎผิด / ติดกับดัก / อ่าน clue พลาด (+ โน้ตสั้น ๆ ถ้าต้องการ) แล้วบันทึกทุกครั้ง

### Review log และการสำรอง
- เก็บ review log แบบ append-only ทุกครั้งที่ทวน (เวลา, grade, เวลาที่ใช้, ชนิดความผิดพลาด) เพื่อใช้คำนวณ stats และ optimize FSRS parameter ภายหลัง
- Desired retention ตั้งค่าได้ (ค่าเริ่มต้น 0.9)
- Export ทั้งหมด (สถานะ + log + settings) เป็นไฟล์ JSON ไฟล์เดียวที่มี `schemaVersion`
- Import แบบ merge ตาม item ID (ใช้รายการที่ทวนล่าสุดกว่า) ต้องมี test แบบ round-trip
- เตือนให้สำรองถ้าไม่ได้ export เกิน 7 วัน

### คิวรายวัน
- ดึง item ที่ครบกำหนดจากทุก pack ที่ "เปิดทวน" อยู่ เรียงตามความเสี่ยงลืม (retrievability ต่ำก่อน) แล้วสลับหัวข้อ (interleave) ไม่ให้ item จาก pack เดียวกันติดกันถ้าเลี่ยงได้
- จำกัด item ใหม่ต่อวัน, จำกัด deduction/campaign (ใช้เวลานาน) ไม่เกิน N ต่อวัน และเลือกได้ว่า "วันนี้มีเวลา X นาที"
- ระหว่างทวนกดได้: พักไว้ (suspend), เลื่อนไปพรุ่งนี้ (bury), แจ้งว่า "เนื้อหาน่าจะผิด" + โน้ต (ส่งต่อให้ `/audit-pack`)
- **Leech**: item ที่ลืมซ้ำ ≥ 6 ครั้ง (ตั้งค่าได้) ให้ติดป้าย leech แล้วส่งออกไปให้ `/debrief` เขียนใหม่ (เช่น แปลงเป็นกฎหรือ trap pair)
- **ฝึกนอกตาราง**: เลือก pack / tag / จุดอ่อนมาฝึก โดยไม่กระทบตาราง FSRS
- **Boss round**: สุ่มผสมจากหลาย pack หรือหลาย rotation แบบจับเวลา (เลือกได้ว่าจะนับเข้า FSRS หรือไม่)

### Stats (ตัวเลขต้องคำนวณจาก log จริง ไม่ปั้น)
- retention จริงเทียบกับ desired retention, due forecast 30 วัน, ความแม่นแยกตามชนิดความผิดพลาด / pack / ชนิด item, รายชื่อ leech, streak, เวลาที่ใช้ต่อวัน

### Export สำหรับ Claude Code
- Export error log + leech + item ที่ถูกแจ้งว่าผิด เป็น JSON เพื่อให้ `/debrief` และ `/audit-pack` นำไปใช้ต่อ

## Slash commands ใน Claude Code
- `/new-pack <หัวข้อ หรือ path ของไฟล์โน้ต/PDF>`: ทำตามวิธีการข้างบน ตรวจแหล่งอ้างอิง เขียน JSON (status = `draft`) รัน validate + build:index + test แล้วสรุปให้ฉันดู (กฎ, จำนวน item แยกตามชนิด, สิ่งที่แก้จากโน้ต) จากนั้นจึง commit
- `/debrief <path ของไฟล์ export>`: จัดกลุ่มความผิดพลาด แล้วเพิ่ม item ใหม่เข้า pack ที่เกี่ยวข้อง (ไม่รู้ข้อเท็จจริง → memorize, ใช้กฎผิด → engine/legality ใหม่, ติดกับดัก → trapPair, อ่าน clue พลาด → deduction ใหม่, leech → เขียน item ใหม่โดยคง ID ถ้าความหมายเดิม) แล้วสรุปให้ฉันดูก่อน commit
- `/audit-pack <packId>`: ตรวจข้อเท็จจริงกับ guideline ปัจจุบันอีกรอบ (รวมรายการที่ถูกแจ้งว่าผิดจากแอป) แสดงรายการที่ต้องแก้ แก้หลังจากฉันยืนยัน อัปเดต verifiedAt และ status
- `/vault`: สรุปคลัง ได้แก่ จำนวน pack แยกตาม subject/rotation, pack ที่ยังเป็น draft, pack ที่ verifiedAt เกิน 6 เดือน (ควร audit), และหัวข้อที่ยังไม่มีใน rotation ปัจจุบัน
- เขียน `CLAUDE.md` อธิบายโครงสร้าง repo, schema, กฎเรื่อง ID และ workflow ให้ session ถัดไปทำงานต่อได้ทันที

## UI
- ข้อความ UI และคำอธิบายเป็นภาษาไทย ศัพท์แพทย์ใช้ภาษาอังกฤษ MCQ stem เป็นภาษาอังกฤษ
- หน้าหลัก: จำนวน item ที่ครบกำหนดวันนี้ + เวลาโดยประมาณ + ปุ่มเริ่มทวน (ปุ่มใหญ่ กดได้ทันที), ทางลัดไปคลัง, stats, settings
- หน้าคลัง: ค้นหา + ตัวกรอง + การ์ด pack พร้อม progress
- หน้า pack: แท็บ กติกา · การ์ด · เกม · ช่องโหว่ข้อสอบ · อ้างอิง · ความคืบหน้า และสวิตช์ "เปิดทวน / พักไว้"
- หน้าทวน: ใช้นิ้วเดียวได้ ปุ่ม Again/Hard/Good/Easy อยู่ล่างจอ แสดงเวลา interval ถัดไปบนปุ่ม
- รองรับ dark mode ดีไซน์สะอาด ไม่รก

## วิธีทำงาน
1. เริ่มด้วย plan mode เสนอแผนก่อน และถามฉันเฉพาะสิ่งที่ตัดสินใจแทนไม่ได้ (เช่น หัวข้อ sample pack, public/private, GitHub Pages หรือ Vercel)
2. ทำทีละ phase พอจบแต่ละ phase ให้บอกวิธีรัน (คำสั่ง PowerShell) และสิ่งที่ควรลองกด แล้วรอฉันก่อนไป phase ถัดไป:
   - **Phase 1 — คลัง**: scaffold + git init + zod schema + taxonomy + validator + build:index + sample pack 1 ชุด (ถามหัวข้อ) + หน้าคลัง (ค้นหา/กรอง) + หน้า pack
   - **Phase 2 — ทวน**: แตก item, FSRS, คิวรายวัน, การให้คะแนน, review log, IndexedDB, export/import และหน้าทวนสำหรับ item ความจำ (จบ phase นี้ต้องทวน sample pack ได้จริงแล้ว)
   - **Phase 3 — เกม**: UI ของทุกโหมด + post-game analysis + การให้คะแนนอัตโนมัติ
   - **Phase 4 — Claude Code**: `.claude/skills` + slash commands + CLAUDE.md
   - **Phase 5 — ใช้จริง**: stats dashboard + PWA/offline + deploy
3. เขียน test สำหรับ: schema, การแตก item, ความคงที่ของ ID (แก้ถ้อยคำ/สลับลำดับแล้ว ID เดิม, ID ซ้ำต้อง validate ไม่ผ่าน), การ map grade, scheduler, การสลับหัวข้อในคิว, sibling burying, export/import round-trip และ migration
4. ห้ามบอกว่าเสร็จจนกว่าจะรัน `npm run validate`, `npm test` และ `npm run build` ผ่านจริง และแสดงผลลัพธ์ให้ดู
