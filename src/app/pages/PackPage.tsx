import { useLiveQuery } from 'dexie-react-hooks';
import { extractItems } from '../../core/items/extract';
import { ITEM_TYPE_LABEL, type ItemType } from '../../core/items/types';
import { GAME_MODES, type GameMode, type Pack } from '../../core/schema/pack';
import { Badge, formatDate, RuleOfThumb, StatusBadge, Toggle } from '../components/ui';
import { findEntry, rotationLabel, subjectLabel } from '../data/vault';
import { db, setPackEnabled } from '../db';
import { usePack } from '../hooks';
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

function RulesTab({ pack }: { pack: Pack }) {
  const { rulebook } = pack;
  const ruleName = (id: string) => rulebook.coreRules.findIndex((r) => r.id === id) + 1;
  return (
    <div className="stack">
      <section className="panel">
        <h2>Board</h2>
        <p>{rulebook.board}</p>
      </section>
      <section className="panel">
        <h2>Pieces</h2>
        <ul className="plain">
          {rulebook.pieces.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong> — {p.role}
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h2>Core rules</h2>
        <ol className="rules">
          {rulebook.coreRules
            .filter((r) => !r.retired)
            .map((r) => (
              <li key={r.id}>
                <p>
                  {r.rule} {r.ruleOfThumb && <RuleOfThumb />} <SourceRefs pack={pack} ids={r.sourceIds} />
                </p>
                <p className="muted small">ให้กำเนิด:</p>
                <ul className="generates">
                  {r.generates.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
                <Variants pack={pack} variants={r.variants} />
              </li>
            ))}
        </ol>
      </section>
      <section className="panel">
        <h2>Errata (ข้อยกเว้น)</h2>
        <ul className="plain">
          {rulebook.errata
            .filter((e) => !e.retired)
            .map((e) => (
              <li key={e.id} className="erratum">
                <Badge tone="warn">ฝ่าฝืนกฎข้อ {ruleName(e.breaksRule)}</Badge> {e.text} {e.ruleOfThumb && <RuleOfThumb />}{' '}
                <SourceRefs pack={pack} ids={e.sourceIds} />
              </li>
            ))}
        </ul>
      </section>
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
  const nameOf = (id: string) => pack.cards.find((c) => c.id === id)?.name ?? id;
  const ruleIndex = (id: string) => pack.rulebook.coreRules.findIndex((r) => r.id === id) + 1;
  return (
    <div className="stack">
      {pack.cards
        .filter((c) => !c.retired)
        .map((c) => (
          <article key={c.id} className="panel unit-card" id={`card-${c.id}`}>
            <h2>
              {c.name} {c.ruleOfThumb && <RuleOfThumb />}
            </h2>
            <dl>
              <dt>Who</dt>
              <dd>{c.who}</dd>
              <dt>Trigger</dt>
              <dd>
                <Badge tone="muted">กฎข้อ {ruleIndex(c.trigger.ruleId)}</Badge> {c.trigger.text}
              </dd>
              <dt>Signature</dt>
              <dd>{c.signature}</dd>
              <dt>Tells</dt>
              <dd>
                <ul className="plain">
                  {c.tells
                    .filter((t) => !t.retired)
                    .map((t) => (
                      <li key={t.vs}>
                        <strong>vs {nameOf(t.vs)}:</strong> {t.feature}
                      </li>
                    ))}
                </ul>
              </dd>
              <dt>Counter</dt>
              <dd>{c.counter}</dd>
              <dt>Danger</dt>
              <dd>{c.danger}</dd>
              {c.memorize.length > 0 && (
                <>
                  <dt>ค่าจำ</dt>
                  <dd>
                    <ul className="plain">
                      {c.memorize
                        .filter((m) => !m.retired)
                        .map((m) => (
                          <li key={m.id} className="memo">
                            <span className="muted">{m.prompt}</span>
                            <br />
                            <strong>{m.fact}</strong> <SourceRefs pack={pack} ids={[m.sourceId]} />
                            <Variants pack={pack} variants={m.variants} />
                          </li>
                        ))}
                    </ul>
                  </dd>
                </>
              )}
            </dl>
            <p className="muted small">
              อ้างอิง: <SourceRefs pack={pack} ids={c.sourceIds} />
            </p>
          </article>
        ))}
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
  return (
    <div className="stack">
      <p className="hint">โหมดเล่นจริง (ตอบก่อนเห็นเฉลย + post-game analysis) จะเปิดใน Phase 3 — หน้านี้จึงแสดงแค่โจทย์ ไม่แสดงเฉลย</p>
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
  const items = extractItems(pack).filter((i) => !i.retired);
  const counts = new Map<ItemType, number>();
  for (const it of items) counts.set(it.type, (counts.get(it.type) ?? 0) + 1);
  return (
    <section className="panel">
      <h2>Review items ({items.length})</h2>
      <table className="table">
        <thead>
          <tr>
            <th>ชนิด</th>
            <th>จำนวน</th>
            <th>ใหม่</th>
          </tr>
        </thead>
        <tbody>
          {[...counts.entries()].map(([t, n]) => (
            <tr key={t}>
              <td>{ITEM_TYPE_LABEL[t]}</td>
              <td>{n}</td>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">สถิติการทวน (กำลังเรียน / ทวน / retention / ทวนล่าสุด) จะมาพร้อมระบบทวนใน Phase 2</p>
    </section>
  );
}
