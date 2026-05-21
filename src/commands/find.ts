import * as p from '@clack/prompts';
import pc from 'picocolors';
import { runAdd } from './add.ts';

interface GitHubRepo {
  full_name: string;
  description: string;
  stargazers_count: number;
  html_url: string;
  topics: string[];
}

/**
 * 从 GitHub 搜索 skills 仓库。
 * 搜索策略：
 * 1. 搜索包含 SKILL.md 的仓库
 * 2. 搜索 topic:agent-skills 的仓库
 * 3. 按 stars 排序，优先展示高质量 skills
 */
async function searchSkills(query: string): Promise<GitHubRepo[]> {
  const keywords = query.trim() || 'agent-skills';
  const searchQuery = encodeURIComponent(`${keywords} topic:agent-skills`);
  const apiUrl = `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=20`;

  const res = await fetch(apiUrl, {
    signal: AbortSignal.timeout(10000),
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'cn-skills-cli',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API 请求失败：HTTP ${res.status}`);
  }

  const data = await res.json();
  return (data.items || []) as GitHubRepo[];
}

/**
 * 搜索 skills 并交互式选择安装。
 * 对齐原版 npx skills find 命令。
 */
export async function runFind(args: string[]): Promise<void> {
  const keyword = args.join(' ');

  const spinner = p.spinner();
  spinner.start(keyword ? `正在搜索 "${keyword}"...` : '正在加载热门 skills...');

  let results: GitHubRepo[];
  try {
    results = await searchSkills(keyword);
    spinner.stop(`找到 ${results.length} 个 skill`);
  } catch (error) {
    spinner.stop('搜索失败');
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (results.length === 0) {
    p.log.warn('未找到匹配的 skill');
    p.log.info('尝试：cn-skills find python');
    p.log.info('浏览：https://skills.sh');
    process.exit(0);
  }

  // 显示搜索结果
  const choices = results.map((repo) => ({
    value: repo,
    label: pc.bold(repo.full_name),
    hint: `⭐ ${repo.stargazers_count} | ${(repo.description || '').slice(0, 50)}`,
  }));

  const selected = await p.select({
    message: `找到 ${results.length} 个 skill，选择一个查看详情`,
    options: choices,
  });

  if (p.isCancel(selected)) process.exit(0);

  const repo = selected as GitHubRepo;

  // 显示详情
  console.log('');
  p.log.message(
    `${pc.bold(repo.full_name)}\n\n` +
      `  描述：${repo.description || '无描述'}\n` +
      `  Stars：${repo.stargazers_count}\n` +
      `  地址：${repo.html_url}\n` +
      `  标签：${repo.topics?.join(', ') || '无'}`
  );

  // 询问是否安装
  const shouldInstall = await p.confirm({
    message: '是否安装此 skill？',
    initialValue: true,
  });

  if (p.isCancel(shouldInstall) || !shouldInstall) {
    process.exit(0);
  }

  // 从 full_name 提取 owner/repo
  await runAdd([repo.full_name], { yes: false });
}
