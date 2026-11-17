import { useState } from 'react';
import { Link } from 'react-router-dom';
import { findBenchmark, findMetric } from '@/core/bank/readSnapshot';
import type { BankDoc } from '@/core/bank/snapshot';
import { matchState, offerMatches, resolveMatch } from '@/core/facts/match';
import { Badge } from '@/shared/ui/Badge';
import { resolveAnchors } from '@/core/facts/anchors';
import type { ExperimentFact } from '@/core/facts/experimentFacts';
import type { FactsDoc } from '@/core/facts/factsDoc';
import type { Paper } from '@/core/papers/papers';
import type { PaperModelView } from '@/core/papers/paperModel';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { TextField } from '@/shared/ui/TextField';
import styles from './Page.module.css';

export function FactDrawer({
  paper,
  fact,
  doc,
  model,
  projectId,
  readOnly,
  close,
  change,
  bank,
  match,
}: {
  bank: BankDoc | null;
  match: (id: string | null) => void;
  paper: Paper;
  fact: ExperimentFact;
  doc: FactsDoc;
  model?: PaperModelView;
  projectId: string;
  readOnly: boolean;
  close: () => void;
  change: (action: 'use' | 'exclude' | 'clear', reason: string | null) => void;
}) {
  const [reason, setReason] = useState('');
  const [excluding, setExcluding] = useState(false);
  const anchors = model && resolveAnchors(fact, model);
  const decision = doc.decisions[fact.id];
  const confirmed = doc.matches?.[fact.id]?.bank;
  const resolved = confirmed && resolveMatch(confirmed, bank);
  const entry = resolved
    ? fact.kind === 'metric'
      ? findMetric(bank, resolved)
      : findBenchmark(bank, resolved)
    : undefined;
  const offers = offerMatches(fact, bank);
  const value = (id: string | null) => doc.facts.facts.find((entry) => entry.id === id)?.value ?? id;
  return (
    <Drawer open onClose={close} side="right" label="Chi tiết dữ kiện">
      <div className={`${styles.stack} ${styles.drawer}`}>
        <h2>{fact.value}</h2>
        {fact.number !== null && <p>Số: {fact.number}</p>}
        {fact.unit && <p>Đơn vị: {fact.unit}</p>}
        {fact.uncertainty && <p>Độ bất định: {fact.uncertainty}</p>}
        {fact.condition && <p>Điều kiện: {fact.condition}</p>}
        {fact.metric && <p>Metric: {value(fact.metric)}</p>}
        {fact.dataset && <p>Dataset: {value(fact.dataset)}</p>}
        {fact.system && <p>Hệ thống: {value(fact.system)}</p>}
        <p>PaperLab: {fact.status === 'candidate' ? 'Chưa duyệt' : 'Đã duyệt'}</p>
        {!anchors && <p>Đang tải paper model…</p>}
        {anchors?.sentences.map((sentence) =>
          sentence.found ? (
            <blockquote className={styles.quote} key={sentence.key}>
              <p>{sentence.text}</p>
              <Link to={`/p/${encodeURIComponent(projectId)}/corpus`}>
                {paper.title}
                {sentence.page !== null ? ` · trang ${sentence.page}` : ''}
              </Link>
            </blockquote>
          ) : (
            <p key={sentence.key}>Không tìm thấy trong paper model đang giữ ({sentence.key})</p>
          ),
        )}
        {anchors?.tableCell &&
          (anchors.tableCell.found ? (
            <div className={styles.quote}>
              <p>
                Bảng, hàng {anchors.tableCell.row}, cột {anchors.tableCell.column}
              </p>
              <p>
                {anchors.tableCell.rowHeader} {anchors.tableCell.columnHeader}
              </p>
              <p>{anchors.tableCell.blockText}</p>
            </div>
          ) : (
            <p>Không tìm thấy trong paper model đang giữ</p>
          ))}
        {bank && (fact.kind === 'metric' || fact.kind === 'dataset') && (
          <div className={styles.stack}>
            <h3>Writing Bank</h3>
            {confirmed ? (
              <div>
                <p>
                  {entry?.name ?? fact.value} · <span className={styles.mono}>{confirmed.id}</span> ·{' '}
                  {confirmed.release} {entry?.status === 'draft' && <Badge>Bản nháp</Badge>}{' '}
                  {matchState(confirmed, bank) === 'other_release' && (
                    <Badge tone="warning">Khác bản phát hành</Badge>
                  )}
                </p>
                {!readOnly && (
                  <Button variant="ghost" onClick={() => match(null)}>
                    Bỏ khớp
                  </Button>
                )}
              </div>
            ) : offers.length ? (
              offers.map((offer) => (
                <div key={offer.id}>
                  Khớp theo tên: {offer.name}{' '}
                  {(findMetric(bank, offer.id) ?? findBenchmark(bank, offer.id))?.status === 'draft' && (
                    <Badge>Bản nháp</Badge>
                  )}{' '}
                  {!readOnly && (
                    <Button variant="secondary" onClick={() => match(offer.id)}>
                      Xác nhận
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className={styles.quiet}>Không có mục trùng tên trong Writing Bank</p>
            )}
          </div>
        )}
        {decision && (
          <p>
            {decision.decision === 'use' ? 'Dùng' : 'Loại'} · {decision.by} ·{' '}
            {new Date(decision.at).toLocaleString('vi-VN')}
            {decision.reason && ` · ${decision.reason}`}
          </p>
        )}
        {!readOnly && (
          <div className={styles.stack}>
            <div className={styles.actions}>
              <Button disabled={!anchors?.anchored} onClick={() => change('use', null)}>
                Dùng
              </Button>
              <Button variant="secondary" onClick={() => setExcluding(true)}>
                Loại
              </Button>
              <Button variant="ghost" onClick={() => change('clear', null)}>
                Bỏ quyết định
              </Button>
            </div>
            {anchors && !anchors.anchored && <p>Không tìm thấy trong paper model đang giữ</p>}
            {excluding && (
              <>
                <TextField
                  label="Lý do loại"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <Button variant="secondary" onClick={() => change('exclude', reason)}>
                  Xác nhận loại
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
