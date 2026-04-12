// app/api/ci-status/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REPO = 'bon2362/poker-timer';
const BASE = 'https://api.github.com';

async function ghFetch(path: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
  return res.json();
}

async function getDeploymentStatus(deployId: number) {
  try {
    const statuses = await ghFetch(`/repos/${REPO}/deployments/${deployId}/statuses`);
    return statuses?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [runsData, prodDeploys, pagesDeploys] = await Promise.all([
      ghFetch(`/repos/${REPO}/actions/runs?per_page=5`),
      ghFetch(`/repos/${REPO}/deployments?environment=Production&per_page=1`),
      ghFetch(`/repos/${REPO}/deployments?environment=github-pages&per_page=1`),
    ]);

    const latestRun = runsData.workflow_runs?.[0] ?? null;
    const latestProd = prodDeploys?.[0] ?? null;
    const latestPages = pagesDeploys?.[0] ?? null;

    const [prodStatus, pagesStatus, allureData, codecovReport] = await Promise.all([
      latestProd ? getDeploymentStatus(latestProd.id) : Promise.resolve(null),
      latestPages ? getDeploymentStatus(latestPages.id) : Promise.resolve(null),
      fetch('https://bon2362.github.io/poker-timer/widgets/summary.json').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('https://api.codecov.io/api/v2/gh/bon2362/repos/poker-timer/report/?branch=main').then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    // Find commit message for prod deployment SHA from runs data
    const runsArr: Record<string, unknown>[] = runsData.workflow_runs ?? [];
    const matchingRun = latestProd
      ? runsArr.find((r) => (r.head_sha as string) === latestProd.sha)
      : null;
    const prodCommitMessage = matchingRun
      ? ((matchingRun.head_commit as Record<string, unknown>)?.message as string)?.split('\n')[0] ?? ''
      : '';

    return NextResponse.json({
      testRun: latestRun
        ? {
            status: latestRun.status as string,
            conclusion: latestRun.conclusion as string | null,
            createdAt: latestRun.created_at as string,
            updatedAt: latestRun.updated_at as string,
            url: latestRun.html_url as string,
            commit: {
              sha: (latestRun.head_sha as string).slice(0, 7),
              message:
                ((latestRun.head_commit as Record<string, unknown>)?.message as string)
                  ?.split('\n')[0] ?? '',
              author:
                ((latestRun.head_commit as Record<string, unknown>)?.author as Record<string, string>)?.name ?? '',
              timestamp:
                ((latestRun.head_commit as Record<string, unknown>)?.timestamp as string) ?? '',
            },
          }
        : null,
      prodDeploy: latestProd
        ? {
            state: (prodStatus?.state as string) ?? 'pending',
            description: (prodStatus?.description as string) ?? '',
            createdAt: latestProd.created_at as string,
            deployUrl: (prodStatus?.target_url as string) ?? '',
            sha: (latestProd.sha as string).slice(0, 7),
            commitMessage: prodCommitMessage,
          }
        : null,
      testReport: latestPages
        ? {
            state: (pagesStatus?.state as string) ?? 'pending',
            createdAt: latestPages.created_at as string,
            reportUrl: (pagesStatus?.environment_url as string) ?? 'https://bon2362.github.io/poker-timer/',
            sha: (latestPages.sha as string).slice(0, 7),
          }
        : null,
      codecov: codecovReport
        ? {
            coverage: codecovReport.totals?.coverage as number ?? null,
            lines:    codecovReport.totals?.lines    as number ?? 0,
            hits:     codecovReport.totals?.hits     as number ?? 0,
            misses:   codecovReport.totals?.misses   as number ?? 0,
            partials: codecovReport.totals?.partials as number ?? 0,
            files: ((codecovReport.files ?? []) as Record<string, unknown>[])
              .map(f => ({
                name:     f.name as string,
                coverage: (f.totals as Record<string, number>)?.coverage ?? 0,
                lines:    (f.totals as Record<string, number>)?.lines    ?? 0,
                hits:     (f.totals as Record<string, number>)?.hits     ?? 0,
                misses:   (f.totals as Record<string, number>)?.misses   ?? 0,
              }))
              .sort((a, b) => b.misses - a.misses)
              .slice(0, 10),
          }
        : null,
      allure: allureData
        ? {
            passed:  (allureData.statistic?.passed  as number) ?? 0,
            failed:  (allureData.statistic?.failed  as number) ?? 0,
            broken:  (allureData.statistic?.broken  as number) ?? 0,
            skipped: (allureData.statistic?.skipped as number) ?? 0,
            total:   (allureData.statistic?.total   as number) ?? 0,
            startMs: (allureData.time?.start as number) ?? null,
            durationMs: (allureData.time?.duration as number) ?? null,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
