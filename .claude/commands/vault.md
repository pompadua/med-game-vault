---
description: สรุปคลัง — จำนวน pack แยก subject/rotation, pack ที่ยังเป็น draft, pack ที่ verifiedAt เกิน 6 เดือน และหัวข้อที่ยังไม่มีใน rotation ปัจจุบัน
---

1. รัน `npm run build:index` (ให้ index ตรงกับไฟล์) แล้ว `npm run vault:report`
2. สรุปเป็นภาษาไทยแบบสั้น:
   - จำนวน pack / review item ทั้งหมด
   - pack แยกตาม subject และ rotation (ใช้ชื่อภาษาไทยจาก taxonomy)
   - pack ที่ยังเป็น `draft` และ `needs-audit` → แนะนำ `/audit-pack <packId>`
   - pack ที่ `verifiedAt` เก่ากว่า 6 เดือน → ควร audit
   - หัวข้อใน rotation ปัจจุบัน (`content/curriculum.json` → `currentRotation`) ที่ยังไม่มี pack → แนะนำ 3 หัวข้อที่ควรทำต่อ โดยดูว่าออกสอบบ่อยและต่อยอดจาก pack ที่มีได้
3. ถ้าผู้ใช้บอกว่าเปลี่ยน rotation ให้แก้ `currentRotation` และเพิ่มรายการหัวข้อของ rotation นั้นใน `content/curriculum.json` (ถามก่อนแก้)
