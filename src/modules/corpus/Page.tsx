import { useRef, useState } from 'react';
import type { Paper } from '@/core/papers/papers';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Dialog } from '@/shared/ui/Dialog';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { Tabs, TabCount } from '@/shared/ui/Tabs';
import { TextField } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/toastContext';
import { AddPaperDialog } from './AddPaperDialog';
import { PaperLabDialog } from './PaperLabDialog';
import { PaperRow } from './PaperRow';
import { counts, decisionLabels, filterPapers, logSentences, type Filter } from './view';
import { useCorpus } from './useCorpus';
import styles from './Page.module.css';

const reasons: Record<string, string> = {
  too_large: 'Tệp vượt quá giới hạn 8 MiB.',
  not_json: 'Tệp không phải JSON.',
  not_a_paper_model: 'Tệp không phải paper model.',
  unsupported_version: 'Phiên bản paper model không được hỗ trợ.',
  invalid: 'Paper model không hợp lệ.',
  network: 'Không thể nhập paper model. Vui lòng thử lại.',
};
export default function Page() {
  const { readOnly } = useProject();
  const corpus = useCorpus();
  const toast = useToast();
  const [tab, setTab] = useState<'papers' | 'log'>('papers');
  const [filter, setFilter] = useState<Filter>('all');
  const [paperlabOpen, setPaperlabOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [excluded, setExcluded] = useState<Paper | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [refusal, setRefusal] = useState<{ error: string; issues?: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const allCounts = counts(corpus.doc.papers);
  const visible = filterPapers(corpus.doc.papers, filter);
  const changeDecision = async (paper: Paper, decision: Paper['decision'], value: string | null) => {
    const result = await corpus.decide(paper.id, decision, value);
    if (!result.ok) {
      if (result.error === 'reason_required') setReasonError('Vui lòng nhập lý do.');
      else {
        setReasonError('Không lưu được quyết định. Vui lòng thử lại.');
        toast('Không cập nhật được quyết định.');
      }
      return;
    }
    setExcluded(null);
  };
  const importFile = async (file: File) => {
    const result = await corpus.importModel(file);
    if (result.ok) {
      setRefusal(null);
      toast(
        result.created
          ? `Đã thêm «${result.paper.title}» từ paper model`
          : `Đã nhập paper model cho «${result.paper.title}»`,
      );
    } else setRefusal({ error: result.error, issues: 'issues' in result ? result.issues : undefined });
  };
  return (
    <>
      <PageHeader title="Tập bài báo" lead="Các bài đã chọn, kèm paper model nhập từ PaperLab.">
        {!readOnly && (
          <>
            <Button variant="primary" onClick={() => setAdding(true)}>
              Thêm bài báo
            </Button>
            {corpus.paperlab && <Button onClick={() => setPaperlabOpen(true)}>Thêm từ PaperLab</Button>}
            <Button onClick={() => fileInput.current?.click()}>Nhập paper model</Button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void importFile(file);
              }}
            />
          </>
        )}
      </PageHeader>
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      {refusal && (
        <div className={styles.notice} role="alert">
          <p>{reasons[refusal.error] ?? 'Không thể nhập paper model.'}</p>
          {refusal.error === 'invalid' && (
            <ul>
              {refusal.issues?.slice(0, 5).map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
          <Button onClick={() => setRefusal(null)}>Đóng</Button>
        </div>
      )}
      {corpus.loading ? (
        <Loading />
      ) : corpus.error ? (
        <Empty title="Không tải được bài báo.">
          <Button onClick={() => void corpus.reload()}>Thử lại</Button>
        </Empty>
      ) : (
        <>
          <Tabs label="Tập bài báo">
            <Button role="tab" aria-selected={tab === 'papers'} onClick={() => setTab('papers')}>
              Bài báo <TabCount value={corpus.doc.papers.length} />
            </Button>
            <Button role="tab" aria-selected={tab === 'log'} onClick={() => setTab('log')}>
              Nhật ký <TabCount value={corpus.doc.log.length} />
            </Button>
          </Tabs>
          {tab === 'papers' ? (
            <>
              <div className={styles.filters}>
                {(['all', 'undecided', 'included', 'excluded'] as const).map((key) => (
                  <Chip
                    key={key}
                    count={allCounts[key]}
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                  >
                    {key === 'all' ? 'Tất cả' : decisionLabels[key]}
                  </Chip>
                ))}
              </div>
              {corpus.doc.papers.length === 0 ? (
                <Empty
                  title="Chưa có bài báo nào"
                  hint={readOnly ? undefined : 'Dùng Thêm bài báo hoặc Nhập paper model để bắt đầu.'}
                />
              ) : visible.length === 0 ? (
                <Empty title="Không có bài báo trong bộ lọc này" />
              ) : (
                visible.map((paper) => (
                  <PaperRow
                    key={paper.id}
                    paper={paper}
                    readOnly={readOnly}
                    hasFacts={corpus.factsIds.includes(paper.id)}
                    fetchFacts={
                      corpus.paperlab
                        ? () => {
                            void corpus.fetchFacts(paper).then((result) => {
                              if (result.ok)
                                toast(
                                  result.dropped
                                    ? result.dropped + ' quyết định bị bỏ vì dữ kiện không còn.'
                                    : 'Đã lấy dữ kiện.',
                                );
                              else
                                toast(
                                  result.error === 'not_found'
                                    ? 'PaperLab chưa có dữ kiện cho bài này.'
                                    : result.error === 'not_experiment_facts'
                                      ? 'Dữ liệu không phải dữ kiện thí nghiệm.'
                                      : result.error === 'unsupported_version'
                                        ? 'Phiên bản dữ kiện không được hỗ trợ.'
                                        : result.error === 'invalid'
                                          ? 'Dữ kiện không hợp lệ.'
                                          : 'Không thể lấy dữ kiện. Vui lòng thử lại.',
                                );
                            });
                          }
                        : undefined
                    }
                    decide={(decision) => void changeDecision(paper, decision, null)}
                    exclude={() => {
                      setExcluded(paper);
                      setReason('');
                      setReasonError('');
                    }}
                  />
                ))
              )}
            </>
          ) : corpus.doc.log.length === 0 ? (
            <Empty title="Chưa có quyết định nào" />
          ) : (
            <ul>
              {logSentences(corpus.doc).map((sentence, i) => (
                <li key={i}>{sentence}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {paperlabOpen && corpus.paperlab && (
        <PaperLabDialog
          client={corpus.paperlab}
          close={() => setPaperlabOpen(false)}
          select={async (id) => {
            const result = await corpus.importPaperLab(id);
            if (result.ok) {
              setPaperlabOpen(false);
              toast('Đã nhập paper model cho «' + result.paper.title + '»');
            } else
              toast(
                result.error === 'too_large'
                  ? 'Paper model này vượt quá 8 MiB nên chưa lưu được vào dự án.'
                  : (reasons[result.error] ?? 'Không thể nhập paper model.'),
              );
          }}
        />
      )}
      {adding && <AddPaperDialog close={() => setAdding(false)} add={corpus.add} />}
      {excluded && (
        <Dialog
          title="Loại bài báo"
          description={`Nhập lý do loại «${excluded.title}».`}
          onClose={() => setExcluded(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void changeDecision(excluded, 'excluded', reason);
            }}
            className={styles.form}
          >
            <TextField
              label="Lý do"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={reasonError}
            />
            <div className={styles.actions}>
              <Button onClick={() => setExcluded(null)}>Hủy</Button>
              <Button type="submit" variant="primary">
                Loại
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
