import * as p from '@clack/prompts';
import pc from 'picocolors';
import { parseSource, resolveShorthand } from '../source-parser.ts';
import { cloneRepo, cleanupTempDir, GitCloneError } from '../git.ts';
import { discoverSkills, getSkillDisplayName } from '../skills.ts';
import { installSkillForAgent } from '../installer.ts';
import { detectInstalledAgents, getAgentConfig, agents } from '../agents.ts';
import { loadConfig } from '../config.ts';
import type { Skill, AgentConfig } from '../types.ts';

interface AddOptions {
  /** 指定安装到哪些 agent，默认自动检测 */
  agent?: string[];
  /** 全局安装（~/.agent/skills/） */
  global?: boolean;
  /** 跳过确认直接安装 */
  yes?: boolean;
  /** 指定 skill 名称过滤 */
  skill?: string[];
  /** 强制使用指定源 */
  source?: 'gitee' | 'github';
}

/**
 * 安装命令核心逻辑。
 * 流程：解析源 → 解析 shorthand → 克隆仓库 → 发现 skills → 选择 agent → 安装
 */
export async function runAdd(args: string[], options: AddOptions): Promise<void> {
  if (args.length === 0) {
    p.log.error('请提供 skill 源。例如：cn-skills add owner/repo');
    p.log.info('用法：cn-skills add <source> [--agent claude-code] [--global] [--yes]');
    process.exit(1);
  }

  const config = await loadConfig();
  const sourceInput = args[0];

  // 1. 解析源
  let parsed = parseSource(sourceInput);

  // 2. 如果是 shorthand（owner/repo），根据配置优先级解析
  if (parsed.type === 'git' && parsed.url.includes('/')) {
    const priority = options.source ? [options.source] : config.sourcePriority;
    parsed = await resolveShorthand(parsed, priority);
  }

  // 3. 确定镜像 URL
  const mirrorUrl =
    parsed.type === 'github'
      ? config.mirror.github
      : parsed.type === 'gitee'
        ? config.mirror.gitee
        : undefined;

  p.log.info(`源：${pc.cyan(parsed.url)} (${parsed.type})`);
  if (mirrorUrl && mirrorUrl !== parsed.url) {
    p.log.info(`镜像：${pc.dim(mirrorUrl)}`);
  }

  // 4. 克隆仓库
  const spinner = p.spinner();
  spinner.start('正在克隆仓库...');

  let tempDir: string;
  try {
    tempDir = await cloneRepo(parsed.url, parsed.ref, mirrorUrl);
    spinner.stop('克隆完成');
  } catch (error) {
    spinner.stop('克隆失败');
    if (error instanceof GitCloneError) {
      p.log.error(error.message);
      if (error.isAuthError) {
        p.log.info('提示：如果是私有仓库，请确保已配置 SSH 密钥或 HTTPS 凭据');
      }
    } else {
      p.log.error(String(error));
    }
    process.exit(1);
  }

  // 5. 发现 skills
  let skills: Skill[];
  try {
    skills = await discoverSkills(tempDir, parsed.subpath);
  } catch (error) {
    p.log.error(`扫描 skills 失败：${error instanceof Error ? error.message : String(error)}`);
    await cleanupTempDir(tempDir);
    process.exit(1);
  }

  if (skills.length === 0) {
    p.log.warn('未找到任何 skill（SKILL.md）');
    await cleanupTempDir(tempDir);
    process.exit(0);
  }

  // 6. 如果指定了 skill 名称过滤
  if (options.skill && options.skill.length > 0) {
    skills = skills.filter((s) =>
      options.skill!.some(
        (name) =>
          s.name.toLowerCase() === name.toLowerCase() ||
          getSkillDisplayName(s).toLowerCase() === name.toLowerCase()
      )
    );
    if (skills.length === 0) {
      p.log.warn('指定的 skill 名称未匹配到任何结果');
      await cleanupTempDir(tempDir);
      process.exit(0);
    }
  }

  // 7. 选择要安装的 skill
  let selectedSkills: Skill[] = skills;
  if (skills.length > 1 && !options.yes) {
    const choices = skills.map((s) => ({
      value: s.name,
      label: s.name,
      hint: s.description.slice(0, 60),
    }));

    const selected = await p.multiselect({
      message: '选择要安装的 skill',
      options: choices,
      required: false,
    });

    if (p.isCancel(selected) || selected.length === 0) {
      await cleanupTempDir(tempDir);
      process.exit(0);
    }

    selectedSkills = skills.filter((s) => selected.includes(s.name));
  }

  // 8. 选择 agent
  let targetAgents: AgentConfig[];
  if (options.agent && options.agent.length > 0) {
    targetAgents = options.agent
      .map((name) => getAgentConfig(name))
      .filter((a): a is AgentConfig => a !== undefined);

    if (targetAgents.length === 0) {
      p.log.error('指定的 agent 未找到');
      await cleanupTempDir(tempDir);
      process.exit(1);
    }
  } else {
    // 自动检测已安装的 agent
    const installed = await detectInstalledAgents();
    if (installed.length === 0) {
      // 默认安装到 claude-code
      targetAgents = [getAgentConfig('claude-code')!];
      p.log.info('未检测到已安装的 agent，默认安装到 claude-code');
    } else if (installed.length === 1) {
      targetAgents = installed;
    } else if (options.yes) {
      targetAgents = installed;
    } else {
      const selected = await p.multiselect({
        message: '选择要安装到的 agent',
        options: installed.map((a) => ({
          value: a.name,
          label: a.displayName,
          hint: a.skillsDir,
        })),
        required: false,
      });

      if (p.isCancel(selected) || selected.length === 0) {
        await cleanupTempDir(tempDir);
        process.exit(0);
      }

      targetAgents = installed.filter((a) => selected.includes(a.name));
    }
  }

  // 9. 安装
  const installMode = config.installMode;
  const scope = options.global ? 'global' : 'project';

  for (const skill of selectedSkills) {
    for (const agent of targetAgents) {
      try {
        const dest = await installSkillForAgent(skill, agent, options.global || false, installMode);
        p.log.success(
          `✓ ${pc.bold(skill.name)} → ${pc.dim(agent.displayName)} (${scope}) ${pc.dim(dest)}`
        );
      } catch (error) {
        p.log.error(
          `✗ ${skill.name} → ${agent.displayName}：${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // 10. 清理临时目录
  await cleanupTempDir(tempDir);

  p.log.success(`\n安装完成！共安装 ${selectedSkills.length} 个 skill 到 ${targetAgents.length} 个 agent`);
}
