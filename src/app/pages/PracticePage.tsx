import { useState } from 'react';
import { rotationLabel, vaultIndex } from '../data/vault';
import { navigate } from '../router';

/** ตั้งค่าการฝึกนอกตาราง และ boss round */
export function PracticePage() {
  const [packs, setPacks] = useState<Set<string>>(new Set());
  const [tag, setTag] = useState('');
  const [types, setTypes] = useState('all');
  const [weak, setWeak] = useState(false);
  const [n, setN] = useState(15);

  const [bossRotation, setBossRotation] = useState('');
  const [bossN, setBossN] = useState(10);
  const [bossMinutes, setBossMinutes] = useState(0);
  const [bossFsrs, setBossFsrs] = useState(false);

  const tags = [...new Set(vaultIndex.packs.flatMap((p) => p.tags))].sort();
  const rotations = [...new Set(vaultIndex.packs.map((p) => p.rotation))];

  return (
    <div className="page">
      <header className="page-head">
        <h1>ฝึกนอกตาราง</h1>
        <p className="muted small">ไม่กระทบตาราง FSRS — เหมาะกับก่อนสอบหรือเก็บจุดอ่อน</p>
      </header>
      <div className="stack">
        <section className="panel">
          <h2>เลือกชุดฝึก</h2>
          <fieldset className="checklist">
            <legend className="muted small">pack (ไม่เลือก = ทุก pack)</legend>
            {vaultIndex.packs.map((p) => (
              <label key={p.id} className="field checkbox">
                <input
                  type="checkbox"
                  checked={packs.has(p.id)}
                  onChange={(e) =>
                    setPacks((s) => {
                      const next = new Set(s);
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                      return next;
                    })
                  }
                />
                <span>{p.title}</span>
              </label>
            ))}
          </fieldset>
          <div className="form-grid">
            <label className="field">
              <span>Tag</span>
              <select value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">ทุก tag</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>ชนิด item</span>
              <select value={types} onChange={(e) => setTypes(e.target.value)}>
                <option value="all">ทั้งหมด</option>
                <option value="memory">การ์ดความจำ</option>
                <option value="puzzle">เกม/ปริศนา</option>
                <option value="speedrun,memorize">Speedrun + ค่าจำ</option>
                <option value="mcq">MCQ</option>
              </select>
            </label>
            <label className="field">
              <span>จำนวน</span>
              <input type="number" min={1} max={200} value={n} onChange={(e) => setN(Number(e.target.value) || 1)} />
            </label>
            <label className="field checkbox">
              <input type="checkbox" checked={weak} onChange={(e) => setWeak(e.target.checked)} />
              <span>เฉพาะจุดอ่อน (แม่นต่ำ / leech)</span>
            </label>
          </div>
          <button
            type="button"
            className="primary big"
            onClick={() =>
              navigate('/play', {
                mode: 'practice',
                packs: packs.size ? [...packs].join(',') : undefined,
                tag: tag || undefined,
                types,
                weak: weak ? '1' : undefined,
                n: String(n),
              })
            }
          >
            เริ่มฝึก
          </button>
        </section>

        <section className="panel">
          <h2>👑 Boss round</h2>
          <p className="muted small">สุ่มผสมจากหลาย pack / rotation แบบจับเวลา</p>
          <div className="form-grid">
            <label className="field">
              <span>Rotation</span>
              <select value={bossRotation} onChange={(e) => setBossRotation(e.target.value)}>
                <option value="">ทุก rotation</option>
                {rotations.map((r) => (
                  <option key={r} value={r}>
                    {rotationLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>จำนวนข้อ</span>
              <input type="number" min={1} max={100} value={bossN} onChange={(e) => setBossN(Number(e.target.value) || 1)} />
            </label>
            <label className="field">
              <span>เวลา (นาที, 0 = ตาม targetSeconds รวม)</span>
              <input type="number" min={0} max={180} value={bossMinutes} onChange={(e) => setBossMinutes(Number(e.target.value) || 0)} />
            </label>
            <label className="field checkbox">
              <input type="checkbox" checked={bossFsrs} onChange={(e) => setBossFsrs(e.target.checked)} />
              <span>นับเข้าตาราง FSRS</span>
            </label>
          </div>
          <button
            type="button"
            className="primary big"
            onClick={() =>
              navigate('/play', {
                mode: 'boss',
                rotation: bossRotation || undefined,
                n: String(bossN),
                minutes: bossMinutes ? String(bossMinutes) : undefined,
                fsrs: bossFsrs ? '1' : undefined,
              })
            }
          >
            เริ่ม Boss round
          </button>
        </section>

        {import.meta.env.DEV && (
          <section className="panel">
            <h2>DEV: ทดลองทุกโหมด</h2>
            <p className="muted small">เล่น fixture tests/fixtures/demo-all-modes.json (ไม่บันทึก ไม่มีใน production)</p>
            <button type="button" className="secondary" onClick={() => navigate('/play', { demo: '1', types: 'puzzle' })}>
              เล่น demo
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
