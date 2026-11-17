import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addMetric } from '@/core/draft/measureOps';
import { addHypothesis, addThreat, type DraftResult } from '@/core/draft/ops';
import type { Draft } from '@/core/draft/schema';
import { ConsentGate } from '@/shared/llm/ConsentGate';
import { useConsent } from '@/shared/llm/useConsent';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { Drawer } from '@/shared/ui/Drawer';
import { Select } from '@/shared/ui/Select';
import { useSuggestions } from './useSuggestions';

type Target = 'hypotheses' | 'metrics' | 'threats';
export function SuggestDrawer({
  target,
  draft,
  change,
  close,
}: {
  target: Target;
  draft: Draft;
  change: (fn: (draft: Draft) => DraftResult) => Promise<boolean>;
  close: () => void;
}) {
  const { project } = useProject();
  const navigate = useNavigate();
  const consent = useConsent();
  const result = useSuggestions(target, draft);
  const [added, setAdded] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [questions, setQuestions] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const gateError = result.error === 'consent_required' || result.error === 'llm_not_configured';
  const over = result.error === 'budget_exceeded';
  async function add(text: string, index: number) {
    setBusy(index);
    const ok = await change((d) =>
      target === 'hypotheses'
        ? addHypothesis(d, {
            statement: text,
            kind: 'exploratory',
            question: questions[index] || null,
            claim: null,
          })
        : target === 'threats'
          ? addThreat(d, { name: text, mitigation: '', bank: null })
          : addMetric(d, {
              name: text,
              key: text
                .toLowerCase()
                .normalize('NFKD')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 250),
              unit: '',
              goal: null,
              aggregation: null,
              protocol: text,
              bank: null,
              protocolBank: null,
            }),
    );
    setBusy(null);
    if (ok) setAdded((current) => [...current, index]);
  }
  return (
    <Drawer open onClose={close} label="Gợi ý từ bảng so sánh" side="right">
      <h2>Gợi ý từ bảng so sánh</h2>
      {result.loading ? (
        <p>Đang tải dữ kiện…</p>
      ) : result.factCount === 0 && result.state !== 'failed' ? (
        <p>Chưa có dữ kiện nào được đặt Dùng.</p>
      ) : (
        result.factCount > 0 && (
          <>
            <p>
              Sẽ gửi {result.factCount} dữ kiện đã đặt Dùng (loại, giá trị, tên bài) cùng câu hỏi và giả
              thuyết của dự án. Không gửi câu trích hay nội dung Writing Bank.
            </p>
            {consent.loading ? (
              <p>Đang tải trạng thái đồng ý…</p>
            ) : gateError || over ? (
              <p>
                {over
                  ? 'Đã hết hạn mức token hôm nay.'
                  : gateError && result.error === 'llm_not_configured'
                    ? 'AI chưa được cấu hình.'
                    : 'Cần đồng ý gửi dữ liệu cho AI trước khi dùng tính năng này.'}{' '}
                <Link to="/settings">Cài đặt</Link>
              </p>
            ) : (
              <ConsentGate>
                <Button
                  variant="primary"
                  disabled={result.state === 'sending'}
                  onClick={() => void result.send()}
                >
                  Gửi và nhận gợi ý
                </Button>
              </ConsentGate>
            )}
          </>
        )
      )}
      {result.state === 'unreadable' && <p>AI trả lời không đúng định dạng; hãy thử lại.</p>}
      {result.state === 'failed' && !gateError && !over && <p>Không kết nối được máy chủ.</p>}
      {result.droppedCites > 0 && <p>Đã bỏ {result.droppedCites} trích dẫn không thuộc dữ kiện đã gửi.</p>}
      {result.suggestions.map(
        (item, index) =>
          !dismissed.includes(index) && (
            <Card key={index}>
              <p>{item.text}</p>
              <Badge>Gợi ý của AI</Badge>
              <p>
                {item.cites.map((cite) => (
                  <Chip key={cite} onClick={() => navigate('/p/' + project.id + '/evidence')}>
                    {result.citations[cite]}
                  </Chip>
                ))}
              </p>
              {added.includes(index) ? (
                <p>Đã thêm</p>
              ) : (
                <>
                  {target === 'hypotheses' && (
                    <Select
                      label="Câu hỏi"
                      value={questions[index] ?? ''}
                      onChange={(event) => setQuestions({ ...questions, [index]: event.target.value })}
                    >
                      <option value="">Không gắn câu hỏi</option>
                      {draft.questions.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.id} · {q.text}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Button disabled={busy !== null} onClick={() => void add(item.text, index)}>
                    Thêm vào bản nháp
                  </Button>{' '}
                  <Button
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => setDismissed([...dismissed, index])}
                  >
                    Bỏ qua
                  </Button>
                </>
              )}
            </Card>
          ),
      )}
    </Drawer>
  );
}
