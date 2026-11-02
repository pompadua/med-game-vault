import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { extractItems } from '../../core/items/extract';
import { ITEM_TYPE_LABEL, type ItemType } from '../../core/items/types';
import { GAME_MODES, type Card, type GameMode, type Pack } from '../../core/schema/pack';
import { computeProgress } from '../../core/srs/progress';
import { Badge, formatDate, RuleOfThumb, StatusBadge, Toggle } from '../components/ui';
import { findEntry, rotationLabel, subjectLabel } from '../data/vault';
import { db, setPackEnabled } from '../db';
import { usePack, useReviewData } from '../hooks';
import { href } from '../router';

const TABS = [
  { id: 'rules', label: 'กติกา' },
  { id: 'cards', label: 'การ์ด' },
  { id: 'games', label: 'เกม' },
  { id: 'exploits', label: 'ช่องโหว่ข้อสอบ' },
  { id: 'refs', label: 'อ้างอิง' },
  { id: 'progress', label: 'ความคืบหน้า' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export const MODE_LABEL: Record<GameMode, string> = {
  deduction: 'Deduction (ซื้อ clue)',
  guessWho: 'Guess Who (decision tree)',
  engine: 'Engine (perturbation grid)',
  legality: 'Legality (จัด class/stage)',
  campaign: 'Campaign (management ทีละ turn)',
  matchups: 'Matchups (ยา × ภาวะ)',
  speedrun: 'Speedrun',
  mcq: 'MCQ (NLE style)',
};

export function PackPage({ packId, tab }: { packId: string; tab?: string }) {
  const entry = findEntry(packId);
  const state = usePack(packId);
  const pref = useLiveQuery(() => db.packPrefs.get(packId), [packId]);
  const active: TabId = TABS.some((t) => t.id === tab) ? (tab as TabId) : 'rules';

  if (!entry) {
    return (
      <div className="page">
        <p className="empty">ไม่พบ pack “{packId}”</p>
        <a href={href('/vault')}>กลับไปคลัง</a>
      </div>
    );
  }

  return (
    <div className="page">
      <a className="back" href={href('/vault')}>
        ← คลัง
      </a>
      <header className="page-head">
        <h1>{entry.title}</h1>
        <div className="badges">
          <StatusBadge status={entry.status} />
          <Badge tone="accent">{subjectLabel(entry.subject)}</Badge>
          <Badge tone="muted">{rotationLabel(entry.rotation)}</Badge>
          {entry.tags.map((t) => (
            <Badge key={t} tone="muted">
              #{t}
            </Badge>
          ))}
        </div>
      </header>

      <div className="review-switch">
        <Toggle checked={pref?.enabled ?? false} onChange={(v) => void setPackEnabled(packId, v)} label={pref?.enabled ? 'เปิดทวน' : 'พักไว้'} />
        <span className="muted small">{pref?.enabled ? 'item ของ pack นี้จะเข้าคิวทวน' : 'กดเปิดเพื่อให้ item เข้าคิวทวน'}</span>
      </div>

      <nav className="subtabs" aria-label="ส่วนของ pack">
        {TABS.map((t) => (
          <a key={t.id} href={href(`/pack/${packId}`, { tab: t.id })} className={active === t.id ? 'subtab active' : 'subtab'} aria-current={active === t.id ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>

      {state.status === 'loading' && <p className="muted">กำลังโหลด…</p>}
      {state.status === 'error' && <p className="error">โหลด pack ไม่ได้: {state.error}</p>}
      {state.status === 'ready' && <TabBody tab={active} pack={state.value} />}
    </div>
  );
}

function TabBody({ tab, pack }: { tab: TabId; pack: Pack }) {
  switch (tab) {
    case 'rules':
      return <RulesTab pack={pack} />;
    case 'cards':
      return <CardsTab pack={pack} />;
    case 'games':
      return <GamesTab pack={pack} />;
    case 'exploits':
      return <ExploitsTab pack={pack} />;
    case 'refs':
      return <RefsTab pack={pack} />;
    case 'progress':
      return <ProgressTab pack={pack} />;
  }
}

function SourceRefs({ pack, ids }: { pack: Pack; ids?: string[] }) {
  if (!ids?.length) return null;
  return (
    <span className="source-refs">
      {ids.map((id) => {
        const s = pack.meta.sources.find((x) => x.id === id);
        return s ? (
          <a key={id} href={s.url} target="_blank" rel="noreferrer" title={s.title} className="source-ref">
            [{id}]
          </a>
        ) : (
          <span key={id} className="source-ref">
            [{id}]
          </span>
        );
      })}
    </span>
  );
}

function Variants({ pack, variants }: { pack: Pack; variants?: { region: string; text: string; sourceId: string; examLikely?: boolean }[] }) {
  if (!variants?.length) return null;
  return (
    <ul className="variants">
      {variants.map((v, i) => (
        <li key={i}>
          <Badge tone="muted">{v.region}</Badge> {v.text} <SourceRefs pack={pack} ids={[v.sourceId]} />
          {v.examLikely && <Badge tone="accent">ข้อสอบไทยน่าจะยึด</Badge>}
        </li>
      ))}
    </ul>
  );
}

/** สีประจำกฎแต่ละข้อ (วนใช้ 7 สี) — การ์ดที่เกิดจากกฎเดียวกันจะมีแถบสีเดียวกัน */
function ruleHue(index: number): CSSProperties {
  return { '--gc': `var(--h${(((index - 1) % 7) + 7) % 7 + 1})` } as CSSProperties;
}

function RuleId({ index }: { index: number }) {
  return (
    <span className="rule-id" style={ruleHue(index)}>
      R{index}
    </span>
  );
}

function RulesTab({ pack }: { pack: Pack }) {
  const { rulebook } = pack;
  const ruleIndex = (id: string) => rulebook.coreRules.findIndex((r) => r.id === id) + 1;
  return (
    <div className="stack">
      <section className="lede-block">
        <p className="lede">{rulebook.board}</p>
        <div className="chips">
          {rulebook.pieces.map((p) => (
            <span key={p.id} className="piece" title={p.role}>
              <strong>{p.name}</strong> <span className="muted">{p.role}</span>
            </span>
          ))}
        </div>
      </section>

      <h2 className="h2">
        Core rules <span className="tag">{rulebook.coreRules.filter((r) => !r.retired).length}</span>
      </h2>
      <div className="rules">
        {rulebook.coreRules
          .filter((r) => !r.retired)
          .map((r) => (
            <article key={r.id} className="rule" style={ruleHue(ruleIndex(r.id))}>
              <div className="rule-head">
                <RuleId index={ruleIndex(r.id)} />
                <p className="rule-text">
                  {r.rule} {r.ruleOfThumb && <RuleOfThumb />} <SourceRefs pack={pack} ids={r.sourceIds} />
                </p>
              </div>
              <ul className="generates">
                {r.generates.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
              <Variants pack={pack} variants={r.variants} />
            </article>
          ))}
      </div>

      <h2 className="h2">
        Errata <span className="tag">ข้อยกเว้นที่ข้อสอบชอบออก</span>
      </h2>
      <div className="errata">
        {rulebook.errata
          .filter((e) => !e.retired)
          .map((e) => (
            <div key={e.id} className="err">
              <b className="num">R{ruleIndex(e.breaksRule)}</b>
              <div>
                {e.text} {e.ruleOfThumb && <RuleOfThumb />} <SourceRefs pack={pack} ids={e.sourceIds} />
                <Variants pack={pack} variants={e.variants} />
              </div>
            </div>
          ))}
      </div>

      <section className="panel two-col">
        <div>
          <h2>Win</h2>
          <ul>
            {rulebook.winConditions.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Lose</h2>
          <ul>
            {rulebook.loseConditions.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function CardsTab({ pack }: { pack: Pack }) {
  const [query, setQuery] = useState('');
  const [rule, setRule] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const ruleIndex = (id: string) => pack.rulebook.coreRules.findIndex((r) => r.id === id) + 1;
  const cards = pack.cards.filter((c) => !c.retired);
  const q = query.trim().toLowerCase();
  const shown = cards.filter(
    (c) => (!rule || c.trigger.ruleId === rule) && (!q || [c.name, c.who, c.signature, c.trigger.text].join(' ').toLowerCase().includes(q)),
  );
  const usedRules = pack.rulebook.coreRules.filter((r) => !r.retired && cards.some((c) => c.trigger.ruleId === r.id));
  const open = cards.find((c) => c.id === openId);

  return (
    <div className="stack">
      <div className="card-filters">
        <input className="search pill-search" type="search" placeholder="ค้นหาการ์ด…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="ค้นหาการ์ด" />
        <div className="chips" role="group" aria-label="กรองตามกฎ">
          <button type="button" className="chip" aria-pressed={rule === null} onClick={() => setRule(null)}>
            ทั้งหมด
          </button>
          {usedRules.map((r) => (
            <button key={r.id} type="button" className="chip rule-chip" style={ruleHue(ruleIndex(r.id))} aria-pressed={rule === r.id} onClick={() => setRule(rule === r.id ? null : r.id)} title={r.rule}>
              R{ruleIndex(r.id)}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <p className="empty">ไม่พบการ์ดที่ตรงกับตัวกรอง</p>}
      <div className="ucards">
        {shown.map((c) => (
          <button key={c.id} type="button" className="ucard" style={ruleHue(ruleIndex(c.trigger.ruleId))} onClick={() => setOpenId(c.id)}>
            <span className="ucard-rule num">R{ruleIndex(c.trigger.ruleId)}</span>
            <h3>{c.name}</h3>
            <span className="ucard-sig">{c.signature}</span>
          </button>
        ))}
      </div>
      {open && <CardSheet pack={pack} card={open} onClose={() => setOpenId(null)} onOpen={setOpenId} />}
    </div>
  );
}

function CardSheet({ pack, card: c, onClose, onOpen }: { pack: Pack; card: Card; onClose: () => void; onOpen: (id: string) => void }) {
  const ruleIndex = (id: string) => pack.rulebook.coreRules.findIndex((r) => r.id === id) + 1;
  const nameOf = (id: string) => pack.cards.find((x) => x.id === id)?.name ?? id;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [c.id, onClose]);

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cardsheet" role="dialog" aria-modal="true" aria-labelledby="cardsheet-title" style={ruleHue(ruleIndex(c.trigger.ruleId))}>
        <div className="cardsheet-head">
          <div>
            <h3 id="cardsheet-title">
              {c.name} {c.ruleOfThumb && <RuleOfThumb />}
            </h3>
            <p className="meta">
              R{ruleIndex(c.trigger.ruleId)} · {c.trigger.text}
            </p>
          </div>
          <button ref={closeRef} type="button" className="xbtn" onClick={onClose}>
            ปิด
          </button>
        </div>
        <dl className="rows">
          <div className="row">
            <dt>Who</dt>
            <dd>{c.who}</dd>
          </div>
          <div className="row">
            <dt>Signature</dt>
            <dd>{c.signature}</dd>
          </div>
          {c.tells.some((t) => !t.retired) && (
            <div className="row tell">
              <dt>Tells</dt>
              <dd>
                <ul className="plain">
                  {c.tells
                    .filter((t) => !t.retired)
                    .map((t) => (
                      <li key={t.vs}>
                        <button type="button" className="vs-link" onClick={() => onOpen(t.vs)}>
                          vs {nameOf(t.vs)}
                        </button>{' '}
                        {t.feature}
                      </li>
                    ))}
                </ul>
              </dd>
            </div>
          )}
          <div className="row">
            <dt>Counter</dt>
            <dd>{c.counter}</dd>
          </div>
          <div className="row danger">
            <dt>Danger</dt>
            <dd>{c.danger}</dd>
          </div>
          {c.memorize.some((m) => !m.retired) && (
            <div className="row memo">
              <dt>
                ค่าจำ <span className="memo-tag">ท่อง</span>
              </dt>
              <dd>
                <ul className="plain">
                  {c.memorize
                    .filter((m) => !m.retired)
                    .map((m) => (
                      <li key={m.id}>
                        <span className="muted">{m.prompt}</span>
                        <br />
                        <strong>{m.fact}</strong> <SourceRefs pack={pack} ids={[m.sourceId]} />
                        <Variants pack={pack} variants={m.variants} />
                      </li>
                    ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
        {c.sourceIds?.length ? (
          <p className="muted small">
            อ้างอิง: <SourceRefs pack={pack} ids={c.sourceIds} />
          </p>
        ) : null}
      </div>
    </div>
  );
}

function gamePreview(mode: GameMode, g: Record<string, unknown>): string {
  const pick = (k: string) => (typeof g[k] === 'string' ? (g[k] as string) : '');
  switch (mode) {
    case 'engine':
      return pick('perturbation');
    case 'legality':
      return pick('case');
    case 'mcq':
      return pick('stem');
    case 'speedrun':
      return pick('prompt');
    case 'deduction':
      return `${pick('title')} — ${pick('chiefComplaint')}`;
    default:
      return pick('title');
  }
}

function GamesTab({ pack }: { pack: Pack }) {
  const modes = GAME_MODES.filter((m) => (pack.games[m]?.length ?? 0) > 0);
  const items = extractItems(pack);
  const itemsFor = (m: GameMode, id: string) =>
    items.filter((i) => !i.retired && (m === 'matchups' ? i.type === 'matchup' && i.elementId.startsWith(`${id}.`) : i.elementId === id && i.kind === 'puzzle'));
  return (
    <div className="stack">
      <p className="hint">กด “เล่น” เพื่อฝึกข้อนั้นนอกตาราง (ไม่กระทบ FSRS) — ต้องตอบก่อนจึงเห็นเฉลยและ post-game analysis</p>
      <a className="button-link" href={href('/play', { mode: 'practice', packs: pack.meta.id, types: 'puzzle', n: '50' })}>
        เล่นทุกเกมของ pack นี้
      </a>
      {modes.map((m) => (
        <section key={m} className="panel">
          <h2>{MODE_LABEL[m]}</h2>
          <ol className="game-list">
            {(pack.games[m] ?? [])
              .filter((g) => !g.retired)
              .map((g) => (
                <li key={g.id}>
                  <span className="difficulty" aria-label={`ความยาก ${g.difficulty}`}>
                    {'●'.repeat(g.difficulty)}
                    {'○'.repeat(3 - g.difficulty)}
                  </span>{' '}
                  <span className="clamp">{gamePreview(m, g as unknown as Record<string, unknown>)}</span>
                  <span className="muted small"> · {g.targetSeconds} วิ</span>
                  <div className="play-links">
                    {itemsFor(m, g.id).map((it) => (
                      <a key={it.id} className="chip" href={href('/play', { item: it.id })}>
                        ▶ {m === 'matchups' ? (it.context?.split(' · ').pop() ?? 'เล่น') : 'เล่น'}
                      </a>
                    ))}
                  </div>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function ExploitsTab({ pack }: { pack: Pack }) {
  const nameOf = (id: string) => pack.cards.find((c) => c.id === id)?.name ?? id;
  return (
    <div className="stack">
      <section className="panel">
        <h2>ถ้าเห็น X → คิดถึง Y</h2>
        <ul className="plain">
          {pack.exploits
            .filter((x) => !x.retired)
            .map((x) => (
              <li key={x.id} className="exploit">
                <Badge tone={x.strength === 'rule' ? 'accent' : 'warn'}>{x.strength}</Badge> <strong>{x.ifSee}</strong> → {x.think}
                {x.exception && <p className="muted small">ข้อยกเว้น: {x.exception}</p>}
              </li>
            ))}
        </ul>
      </section>
      <section className="panel">
        <h2>รูปแบบตัวหลอก</h2>
        <ul className="plain">
          {pack.distractorPatterns
            .filter((d) => !d.retired)
            .map((d) => (
              <li key={d.id}>
                <strong>{d.pattern}</strong>
                <p className="muted small">วิธีฆ่า: {d.kill}</p>
              </li>
            ))}
        </ul>
      </section>
      <section className="panel">
        <h2>Trap pairs</h2>
        <ul className="plain">
          {pack.trapPairs
            .filter((t) => !t.retired)
            .map((t) => (
              <li key={t.id}>
                <strong>
                  {nameOf(t.a)} vs {nameOf(t.b)}
                </strong>
                <p className="muted small">ตัวตัดสิน: {t.decider}</p>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  guideline: 'Guideline',
  'thai-guideline': 'แนวทางไทย',
  statpearls: 'StatPearls',
  review: 'Review/สรุป',
  article: 'Article',
  textbook: 'Textbook',
  other: 'อื่น ๆ',
};

function RefsTab({ pack }: { pack: Pack }) {
  return (
    <section className="panel">
      <h2>แหล่งอ้างอิง</h2>
      <ol className="refs">
        {pack.meta.sources.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title}
            </a>
            <div className="muted small">
              [{s.id}] · {SOURCE_TYPE_LABEL[s.type] ?? s.type} · เข้าถึง {formatDate(s.accessedAt)}
            </div>
          </li>
        ))}
      </ol>
      <p className="muted small">
        สร้าง {formatDate(pack.meta.createdAt)} · verified {formatDate(pack.meta.verifiedAt)}
      </p>
    </section>
  );
}

function ProgressTab({ pack }: { pack: Pack }) {
  const data = useReviewData();
  const items = extractItems(pack).filter((i) => !i.retired);
  if (!data) return <p className="muted">กำลังโหลด…</p>;
  const now = new Date();
  const logs = data.logs.filter((l) => l.packId === pack.meta.id);
  const overall = computeProgress(items, data.states, logs, now);
  const byType = new Map<ItemType, typeof items>();
  for (const it of items) byType.set(it.type, [...(byType.get(it.type) ?? []), it]);
  const pct = (v: number | undefined) => (v === undefined ? '—' : `${Math.round(v * 100)}%`);
  return (
    <section className="panel">
      <h2>Review items ({items.length})</h2>
      <p className="small">
        ใหม่ {overall.newCount} · กำลังเรียน {overall.learning} · ทวน {overall.review} · ครบกำหนด {overall.due} · พักไว้ {overall.suspended} · leech {overall.leeches}
      </p>
      <p className="small">
        retention จริง {pct(overall.retention)} (n={overall.retentionN}) · ความแม่น {pct(overall.accuracy)} · ทวนล่าสุด {formatDate(overall.lastReviewedAt)}
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ชนิด</th>
              <th>ทั้งหมด</th>
              <th>ใหม่</th>
              <th>เรียน</th>
              <th>ทวน</th>
              <th>แม่น</th>
            </tr>
          </thead>
          <tbody>
            {[...byType.entries()].map(([t, list]) => {
              const ids = new Set(list.map((i) => i.id));
              const p = computeProgress(list, data.states, logs.filter((l) => ids.has(l.itemId)), now);
              return (
                <tr key={t}>
                  <td>{ITEM_TYPE_LABEL[t]}</td>
                  <td>{p.total}</td>
                  <td>{p.newCount}</td>
                  <td>{p.learning}</td>
                  <td>{p.review}</td>
                  <td>{pct(p.accuracy)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
