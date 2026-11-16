import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { version as appVersion } from '../../../package.json';
import { checkChain } from '@/core/draft/checkChain';
import { checkDesign } from '@/core/draft/checkDesign';
import { checkPlan } from '@/core/draft/checkPlan';
import { freezeGate, nextVersion } from '@/core/draft/freezeGate';
import { setPlanTitle } from '@/core/draft/ops';
import { emptyPapersDoc, papersDocSchema, type PapersDoc } from '@/core/papers/papers';
import { exportPackage } from '@/core/plan/exportPackage';
import { planMarkdown } from '@/core/plan/planMarkdown';
import { runnerStubs } from '@/core/plan/runnerStubs';
import type { ExperimentPlan } from '@/core/plan/schema';
import type { PlanIssue } from '@/core/plan/validatePlan';
import { useApi } from '@/shared/api/apiContext';
import { useAuth } from '@/shared/auth/authContext';
import { useBank } from '@/shared/bank/useBank';
import { issueText, missingLink, missingText, ruleText } from '@/shared/draft/gateText';
import { useDraft } from '@/shared/draft/useDraft';
import { download } from '@/shared/plan/download';
import { usePlans } from '@/shared/plan/usePlans';
import { useProject } from '@/shared/project/projectContext';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { Drawer } from '@/shared/ui/Drawer';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { TextField } from '@/shared/ui/TextField';
import { useToast } from '@/shared/ui/toastContext';
import { Markdown } from './Markdown';
import styles from './Page.module.css';

export default function Page() {
  const { project, readOnly } = useProject();
  const { user } = useAuth();
  const api = useApi();
  const draftState = useDraft();
  const plans = usePlans();
  const bank = useBank();
  const toast = useToast();
  const [papers, setPapers] = useState<PapersDoc | null>(null);
  const [papersError, setPapersError] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ version: number; plan: ExperimentPlan; issues: PlanIssue[] } | null>(
    null,
  );
  const [deviation, setDeviation] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cache, setCache] = useState<Record<number, ExperimentPlan>>({});
  const [drawer, setDrawer] = useState<{ kind: 'plan' | 'runner'; plan: ExperimentPlan } | null>(null);
  const [versionError, setVersionError] = useState(false);
  useEffect(() => {
    let active = true;
    void api
      .getDoc(project.id, 'papers')
      .then((doc) => {
        if (active) setPapers(papersDocSchema.parse(doc?.data ?? emptyPapersDoc()));
      })
      .catch(() => {
        if (active) setPapersError(true);
      });
    return () => {
      active = false;
    };
  }, [api, project.id]);
  useEffect(() => {
    let active = true;
    const missing = plans.versions.filter((v) => !cache[v.version]);
    if (!missing.length || !api.getPlan) return;
    void Promise.all(missing.map((v) => api.getPlan!(project.id, v.version)))
      .then((items) => {
        if (active)
          setCache((old) => ({ ...old, ...Object.fromEntries(items.map((p) => [p.planVersion, p])) }));
      })
      .catch(() => {
        if (active) setVersionError(true);
      });
    return () => {
      active = false;
    };
  }, [api, project.id, plans.versions, cache]);
  const version = nextVersion(plans.versions.map((v) => v.version));
  const gate = freezeGate(
    draftState.draft,
    {
      planId: project.id,
      planVersion: version,
      title: draftState.draft.planTitle || project.title,
      frozenAt: new Date().toISOString(),
      frozenBy: user?.email ?? '',
      deviation: version === 1 ? null : 'preview',
      appVersion,
    },
    papers ?? undefined,
    plans.latest,
  );
  const reason =
    gate.state === 'not_a_plan'
      ? 'Bản nháp chưa đủ để thành kế hoạch.'
      : gate.unchanged
        ? `Bản nháp không khác phiên bản ${version - 1}.`
        : gate.blocked
          ? 'Còn quy tắc chặn.'
          : '';
  const designFlags = checkDesign(draftState.draft, bank.bank);
  const planFlags = checkPlan(draftState.draft).filter((f) => f.level !== 'note');
  const counts = [
    ['Thiết kế nghiên cứu', 'design', designFlags.length],
    [
      'Câu hỏi và giả thuyết',
      'questions',
      designFlags.filter((f) => draftState.draft.hypotheses.some((h) => h.id === f.subject)).length,
    ],
    ['Đo lường', 'measurement', checkChain(draftState.draft).length],
    ['Phân tích thống kê', 'analyses', planFlags.filter((f) => f.rule.startsWith('AN-')).length],
    ['Ma trận chạy', 'runs', planFlags.filter((f) => f.rule.startsWith('RM-')).length],
  ] as const;
  const base = `/p/${encodeURIComponent(project.id)}/`;
  const submit = async () => {
    setBusy(true);
    setDialogError('');
    const result = await plans.freeze({ deviation: dialog?.version === 1 ? null : deviation.trim() });
    setBusy(false);
    if (result.ok) {
      setDialog(null);
      setDeviation('');
      toast(`Đã đóng băng phiên bản ${result.plan.planVersion}.`);
    } else if (result.reason === 'conflict')
      setDialogError('Người khác vừa đóng băng phiên bản này. Danh sách đã được tải lại.');
    else if (result.reason === 'error') setDialogError('Không đóng băng được. Kiểm tra kết nối rồi thử lại.');
    else {
      setDialogError('Bản nháp đã thay đổi. Xem lại danh sách kiểm tra.');
      void draftState.reload();
    }
  };
  const destination = (subject: string | undefined, rule: string) => {
    const d = draftState.draft;
    if (d.hypotheses.some((h) => h.id === subject)) return 'questions';
    if (d.analyses.some((a) => a.id === subject)) return 'analyses';
    if (rule === 'PP-03' || rule === 'PP-07') return 'runs';
    return 'measurement';
  };
  return (
    <>
      <PageHeader
        title="Gói kế hoạch"
        lead="Kiểm tra, đóng băng và xuất gói cho Scientific Research Desktop."
      />
      {readOnly && <Badge>Đã lưu trữ · chỉ đọc</Badge>}
      {draftState.loading || plans.loading || bank.loading || (!papers && !papersError) ? (
        <Loading />
      ) : draftState.error || plans.error || bank.error || papersError ? (
        <Empty title="Không tải được gói kế hoạch.">
          <Button onClick={() => window.location.reload()}>Thử lại</Button>
        </Empty>
      ) : (
        <div className={styles.stack}>
          {!readOnly && (
            <Card>
              <h2>Bản nháp hiện tại</h2>
              <div className={styles.row}>
                <TextField
                  label="Tên kế hoạch"
                  placeholder={project.title}
                  value={title ?? draftState.draft.planTitle}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Button
                  onClick={() =>
                    void draftState
                      .change((d) => setPlanTitle(d, title ?? d.planTitle))
                      .then((r) => toast(r.ok ? 'Đã lưu tên.' : 'Không lưu được tên.'))
                  }
                >
                  Lưu tên
                </Button>
              </div>
              {gate.state === 'not_a_plan' ? (
                <>
                  <p>Bản nháp chưa đủ để thành kế hoạch.</p>
                  <ul>
                    {gate.missing.map((m, i) => (
                      <li key={i}>
                        <Link to={missingLink(m, project.id)}>{missingText(m, draftState.draft)}</Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <ul>
                    {Array.from({ length: 10 }, (_, i) => `PP-${String(i + 1).padStart(2, '0')}`).map(
                      (rule) => {
                        const issues = gate.issues.filter((issue) => issue.rule === rule);
                        const blocked = issues.some((issue) => issue.level === 'blocking');
                        return (
                          <li key={rule}>
                            {rule}: {ruleText(rule)}{' '}
                            {issues.length ? (
                              <Badge tone={blocked ? 'danger' : 'warning'}>
                                {blocked ? 'Chặn' : 'Cảnh báo'}
                              </Badge>
                            ) : (
                              'Đạt'
                            )}
                            {issues.length > 0 && (
                              <ul>
                                {issues.map((issue, i) => (
                                  <li key={i}>
                                    <Link to={base + destination(issue.subject, rule)}>
                                      {issueText(issue, gate.plan)}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      },
                    )}
                  </ul>
                </>
              )}
              <div className={styles.row}>
                <Button
                  variant="primary"
                  disabled={!!reason}
                  onClick={() => {
                    setDialogError('');
                    if (gate.state === 'plan') setDialog({ version, plan: gate.plan, issues: gate.issues });
                  }}
                >
                  Đóng băng phiên bản {version}
                </Button>
                {reason && <span>{reason}</span>}
              </div>
            </Card>
          )}
          <Card>
            <h2>Các phiên bản đã đóng băng</h2>
            {versionError && <p>Không tải được phiên bản. Kiểm tra kết nối rồi thử lại.</p>}
            {!plans.versions.length ? (
              <p>Chưa có phiên bản nào được đóng băng.</p>
            ) : (
              [...plans.versions]
                .sort((a, b) => b.version - a.version)
                .map((v) => {
                  const plan = cache[v.version];
                  return (
                    <div key={v.version}>
                      <p>
                        Phiên bản {v.version} · {v.frozenBy} · {new Date(v.frozenAt).toLocaleString('vi-VN')}
                      </p>
                      {plan?.deviation && <p className={styles.reading}>{plan.deviation}</p>}
                      <div className={styles.row}>
                        <Button
                          variant="ghost"
                          disabled={!plan}
                          onClick={() => plan && setDrawer({ kind: 'plan', plan })}
                        >
                          Xem
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={!plan}
                          onClick={() => {
                            if (plan)
                              void exportPackage(plan)
                                .then((file) => download(file.fileName, file.bytes, 'application/zip'))
                                .catch(() => toast('Không tải được gói.'));
                          }}
                        >
                          Tải gói (.zip)
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={!plan}
                          onClick={() => plan && setDrawer({ kind: 'runner', plan })}
                        >
                          Mã mẫu cho runner
                        </Button>
                      </div>
                    </div>
                  );
                })
            )}
          </Card>
          {!readOnly && (
            <Card>
              <h2>Cờ trên bản nháp</h2>
              {counts.some((c) => c[2]) ? (
                <ul>
                  {counts
                    .filter((c) => c[2])
                    .map(([label, path, count]) => (
                      <li key={path}>
                        <Link to={base + path}>
                          {label}: {count}
                        </Link>
                      </li>
                    ))}
                </ul>
              ) : (
                <p>Không còn cờ nào.</p>
              )}
            </Card>
          )}
        </div>
      )}
      {dialog && (
        <Dialog
          title={`Đóng băng phiên bản ${dialog.version}`}
          description={`${dialog.plan.runMatrix.expectedRuns} lần chạy`}
          onClose={() => setDialog(null)}
        >
          {dialog.issues
            .filter((i) => i.level === 'warning')
            .map((i, n) => (
              <p key={n}>{issueText(i, dialog.plan)}</p>
            ))}
          {dialog.version > 1 && (
            <TextField
              multiline
              label="Thay đổi so với phiên bản trước và lý do"
              required
              value={deviation}
              onChange={(e) => setDeviation(e.target.value)}
            />
          )}
          {dialogError && <p role="alert">{dialogError}</p>}
          <div className={styles.row}>
            <Button onClick={() => setDialog(null)}>Hủy</Button>
            <Button
              variant="primary"
              disabled={
                busy ||
                (!!dialogError && !dialogError.startsWith('Không đóng băng được.')) ||
                (dialog.version > 1 && !deviation.trim())
              }
              onClick={() => void submit()}
            >
              Đóng băng
            </Button>
          </div>
        </Dialog>
      )}
      {drawer && (
        <Drawer
          open
          side="right"
          label={
            drawer.kind === 'plan'
              ? `Phiên bản ${drawer.plan.planVersion} · đã đóng băng · chỉ đọc`
              : 'Mã mẫu cho runner'
          }
          onClose={() => setDrawer(null)}
        >
          {drawer.kind === 'plan' ? (
            <>
              <p>Phiên bản {drawer.plan.planVersion} · đã đóng băng · chỉ đọc</p>
              <Markdown text={planMarkdown(drawer.plan)} />
            </>
          ) : (
            <>
              <p>Điểm bắt đầu cho mã chạy; ứng dụng này không chạy chúng.</p>
              {Object.values(runnerStubs(drawer.plan))
                .filter((x): x is { fileName: string; text: string } => typeof x !== 'number')
                .map((file) => (
                  <section key={file.fileName}>
                    <h2>{file.fileName}</h2>
                    <pre className={styles.mono}>{file.text}</pre>
                    <div className={styles.row}>
                      <Button
                        onClick={() =>
                          void navigator.clipboard.writeText(file.text).then(() => toast('Đã sao chép.'))
                        }
                      >
                        Sao chép
                      </Button>
                      <Button
                        onClick={() =>
                          download(file.fileName, new TextEncoder().encode(file.text), 'text/plain')
                        }
                      >
                        Tải về
                      </Button>
                    </div>
                  </section>
                ))}
            </>
          )}
        </Drawer>
      )}
    </>
  );
}
