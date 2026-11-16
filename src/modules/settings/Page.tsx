import { useCallback, useEffect, useState } from 'react';
import type { LlmFeature, UsageSummary } from '@/core/llm/contract';
import type { Project } from '@/core/project/schema';
import { llmErrorMessage } from '@/core/llm/llmErrors';
import { CONNECTION_TEST_MESSAGES, PROMPT_VERSIONS } from '@/core/llm/prompts';
import { budgetLevel, formatTokens } from '@/core/llm/usageView';
import { useApi } from '@/shared/api/apiContext';
import { ApiError } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/authContext';
import { useConsent } from '@/shared/llm/useConsent';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Meter } from '@/shared/ui/Meter';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Empty, Loading } from '@/shared/ui/StateNote';
import { useToast } from '@/shared/ui/toastContext';
import styles from './Page.module.css';

const labels: Record<LlmFeature, string> = {
  connection_test: 'Kiểm tra kết nối',
  fact_extraction: 'Trích dữ kiện',
  bank_matching: 'Khớp với Writing Bank',
  plan_suggestion: 'Gợi ý kế hoạch',
};
export default function Page() {
  const { user, ready, mode, signIn } = useAuth();
  const api = useApi();
  const consent = useConsent();
  const toast = useToast();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectsError, setProjectsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(false);
    try {
      setUsage(await api.getUsage());
    } catch {
      setUsageError(true);
    } finally {
      setUsageLoading(false);
    }
  }, [api]);
  const loadProjects = useCallback(async () => {
    setProjectsError(false);
    try {
      setProjects(await api.listProjects());
    } catch {
      setProjectsError(true);
      setProjects(null);
    }
  }, [api]);
  useEffect(() => {
    if (user) {
      void Promise.resolve().then(loadUsage);
      void Promise.resolve().then(loadProjects);
    }
  }, [user, loadUsage, loadProjects]);
  const project = projects
    ?.filter((p) => !p.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const testConnection = async () => {
    if (!project || !consent.ready) return;
    setBusy(true);
    try {
      const result = await api.chat({
        projectId: project.id,
        feature: 'connection_test',
        promptVersion: PROMPT_VERSIONS.connection_test,
        messages: CONNECTION_TEST_MESSAGES,
        maxOutputTokens: 16,
      });
      toast(
        'Kết nối tốt: đã dùng ' +
          formatTokens(result.usage.inputTokens + result.usage.outputTokens) +
          ' token',
      );
      await loadUsage();
    } catch (error) {
      toast(error instanceof ApiError ? llmErrorMessage(error.code, error.status) : llmErrorMessage('', -1));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader title="Cài đặt" lead="Tài khoản, đồng ý gửi dữ liệu cho AI và hạn mức token." />
      {!ready ? (
        <Loading />
      ) : !user ? (
        <Empty title="Đăng nhập để xem cài đặt" hint="Đăng nhập để quản lý tài khoản và hạn mức AI.">
          {mode !== 'unconfigured' && <Button onClick={() => void signIn()}>Đăng nhập</Button>}
        </Empty>
      ) : (
        <div className={styles.cards}>
          <Card>
            <h2>Tài khoản</h2>
            <p>{user.name}</p>
            <p>{user.email}</p>
            <p>{mode === 'dev' ? 'Chế độ phát triển' : 'Google'}</p>
          </Card>
          <Card>
            <h2>Gửi dữ liệu cho AI</h2>
            {consent.loading ? (
              <Loading />
            ) : consent.error ? (
              <Empty title={consent.error}>
                <Button onClick={() => void consent.reload()}>Thử lại</Button>
              </Empty>
            ) : (
              consent.state && (
                <>
                  <p className={styles.reading}>
                    Văn bản bài báo và kế hoạch bạn đang làm sẽ được gửi cho {consent.state.required.provider}
                    . Nhật ký sử dụng chỉ lưu số lượng, không lưu văn bản.
                  </p>
                  {!consent.state.configured ? (
                    <Badge tone="warning">AI chưa được cấu hình</Badge>
                  ) : consent.state.accepted ? (
                    <p>
                      Đã đồng ý ngày {new Date(consent.state.accepted.acceptedAt).toLocaleDateString('vi-VN')}
                    </p>
                  ) : (
                    <>
                      <p>Chưa đồng ý</p>
                      <Button variant="primary" onClick={() => void consent.accept()}>
                        Đồng ý
                      </Button>
                    </>
                  )}
                </>
              )
            )}
          </Card>
          <Card>
            <h2>Hạn mức token</h2>
            {usageLoading ? (
              <Loading />
            ) : usageError ? (
              <Empty title="Không tải được hạn mức token.">
                <Button onClick={() => void loadUsage()}>Thử lại</Button>
              </Empty>
            ) : (
              usage && (
                <>
                  <p>
                    {formatTokens(usage.today.inputTokens + usage.today.outputTokens)} /{' '}
                    {formatTokens(usage.dailyBudget)} token
                  </p>
                  <Meter
                    aria-label="Hạn mức token hôm nay"
                    value={usage.today.inputTokens + usage.today.outputTokens}
                    max={usage.dailyBudget}
                    tone={budgetLevel(usage.today.inputTokens + usage.today.outputTokens, usage.dailyBudget)}
                  />
                  <p>Hạn mức tính theo ngày UTC, đặt lại lúc 07:00 giờ Việt Nam</p>
                  <p>Tháng này: {formatTokens(usage.month.inputTokens + usage.month.outputTokens)} token</p>
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Tính năng</th>
                          <th>Số lần gọi</th>
                          <th>Token vào</th>
                          <th>Token ra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.byFeature.map((row) => (
                          <tr key={row.feature}>
                            <td>{labels[row.feature]}</td>
                            <td>{formatTokens(row.calls)}</td>
                            <td>{formatTokens(row.inputTokens)}</td>
                            <td>{formatTokens(row.outputTokens)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {usage.today.estimatedCalls > 0 && (
                    <p>Có {formatTokens(usage.today.estimatedCalls)} lần gọi được ước lượng</p>
                  )}
                </>
              )
            )}
            <Button disabled={!consent.ready || !project || busy} onClick={() => void testConnection()}>
              Kiểm tra kết nối
            </Button>
            {projects && !project && <p>Cần có một dự án để kiểm tra kết nối.</p>}
            {projectsError && (
              <p>
                Không tải được dự án. <Button onClick={() => void loadProjects()}>Thử lại</Button>
              </p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
