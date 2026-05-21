import * as p from '@clack/prompts';
import pc from 'picocolors';
import { fetchIndex, searchIndex } from '../index-fetcher.ts';
import { runAdd } from './add.ts';
import { loadConfig } from '../config.ts';

/**
 * 搜索中文 skills 索引。
 * 支持关键词搜索，找到后可直接安装。
 */
export async function runSearch(args: string[]): Promise<void> {
  const config = await loadConfig();
  const keyword = args.join(' ');

  const spinner = p.spinner();
  spinner.start('正在获取中文 skill 索引...');

  const index = await fetchIndex(config.indexUrl);
  spinner.stop(`索引加载完成（共 ${index.length} 个 skill）`);

  if (index.length === 0) {
    p.log.warn('索引为空，可能是网络问题');
    p.log.info(`索引地址：${config.indexUrl}`);
    process.exit(0);
  }

  // 如果有关键词，直接搜索
  let results = keyword ? searchIndex(index, keyword) : index;

  if (results.length === 0) {
    p.log.warn(`未找到匹配 "${keyword}" 的 skill`);
    p.log.info('尝试浏览所有 skill，运行：cn-skills search');
    process.exit(0);
  }

  // 显示结果
  const choices = results.map((entry) => ({
    value: entry,
    label: pc.bold(entry.name),
    hint: `${entry.source} | ${entry.category} | ${entry.description.slice(0, 50)}`,
  }));

  const selected = await p.select({
    message: `找到 ${results.length} 个 skill，选择一个查看详情`,
    options: choices,
  });

  if (p.isCancel(selected)) process.exit(0);

  // 显示详情
  const entry = selected as (typeof results)[0];
  console.log('');
  p.log.message(
    `${pc.bold(entry.name)}\n\n` +
      `  描述：${entry.description}\n` +
      `  来源：${entry.source}\n` +
      `  仓库：${entry.owner}/${entry.repo}\n` +
      `  分类：${entry.category}\n` +
      `  标签：${entry.tags.join(', ')}`
  );

  // 询问是否安装
  const shouldInstall = await p.confirm({
    message: '是否安装此 skill？',
    initialValue: true,
  });

  if (p.isCancel(shouldInstall) || !shouldInstall) {
    process.exit(0);
  }

  // 构建源地址并安装
  const sourcePrefix = entry.source === 'gitee' ? 'gitee:' : 'github:';
  const source = `${sourcePrefix}${entry.owner}/${entry.repo}`;

  await runAdd([source], { yes: false });
}
