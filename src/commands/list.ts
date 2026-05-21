import * as p from '@clack/prompts';
import pc from 'picocolors';
import { listInstalledSkills } from '../installer.ts';
import { detectInstalledAgents, agents } from '../agents.ts';
import { readdir, lstat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';

/**
 * 列出所有已安装的 skills。
 * 扫描所有已检测到的 agent 目录。
 */
export async function runList(): Promise<void> {
  const installed = await detectInstalledAgents();

  if (installed.length === 0) {
    p.log.warn('未检测到任何 agent');
    p.log.info('支持的 agent：' + agents.map((a) => a.displayName).join('、'));
    process.exit(0);
  }

  const allSkills: { name: string; agent: string; path: string; scope: string }[] = [];

  for (const agent of installed) {
    // 项目级
    const projectDir = join(process.cwd(), agent.skillsDir);
    try {
      const entries = await readdir(projectDir);
      for (const entry of entries) {
        const stat = await lstat(join(projectDir, entry));
        if (stat.isDirectory() || stat.isSymbolicLink()) {
          allSkills.push({
            name: entry,
            agent: agent.displayName,
            path: join(projectDir, entry),
            scope: '项目',
          });
        }
      }
    } catch {
      // 目录不存在
    }

    // 全局级
    if (agent.globalSkillsDir) {
      try {
        const entries = await readdir(agent.globalSkillsDir);
        for (const entry of entries) {
          const stat = await lstat(join(agent.globalSkillsDir, entry));
          if (stat.isDirectory() || stat.isSymbolicLink()) {
            allSkills.push({
              name: entry,
              agent: agent.displayName,
              path: join(agent.globalSkillsDir, entry),
              scope: '全局',
            });
          }
        }
      } catch {
        // 目录不存在
      }
    }
  }

  // 也检查通用目录
  const universalDir = join(process.cwd(), '.agents', 'skills');
  try {
    const entries = await readdir(universalDir);
    for (const entry of entries) {
      const stat = await lstat(join(universalDir, entry));
      if (stat.isDirectory() || stat.isSymbolicLink()) {
        allSkills.push({
          name: entry,
          agent: 'Universal',
          path: join(universalDir, entry),
          scope: '项目',
        });
      }
    }
  } catch {
    // 目录不存在
  }

  if (allSkills.length === 0) {
    p.log.info('未安装任何 skill');
    p.log.info('安装 skill：cn-skills add <owner/repo>');
    process.exit(0);
  }

  console.log('');
  p.log.message(pc.bold(`已安装的 skills（${allSkills.length} 个）`));
  console.log('');

  // 按 agent 分组显示
  const grouped = new Map<string, typeof allSkills>();
  for (const skill of allSkills) {
    const existing = grouped.get(skill.agent) || [];
    existing.push(skill);
    grouped.set(skill.agent, existing);
  }

  for (const [agentName, skills] of grouped) {
    console.log(`  ${pc.cyan(agentName)}`);
    for (const skill of skills) {
      const scopeLabel = skill.scope === '全局' ? pc.dim('[全局]') : pc.dim('[项目]');
      console.log(`    ${pc.bold(skill.name)} ${scopeLabel}`);
      console.log(`      ${pc.dim(skill.path)}`);
    }
    console.log('');
  }
}
