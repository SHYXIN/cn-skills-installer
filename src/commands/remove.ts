import * as p from '@clack/prompts';
import pc from 'picocolors';
import { removeSkill } from '../installer.ts';
import { detectInstalledAgents, getAgentConfig } from '../agents.ts';

interface RemoveOptions {
  agent?: string[];
  global?: boolean;
  yes?: boolean;
}

/**
 * 移除已安装的 skill。
 */
export async function runRemove(args: string[], options: RemoveOptions): Promise<void> {
  if (args.length === 0) {
    p.log.error('请提供要移除的 skill 名称');
    p.log.info('用法：cn-skills remove <skill-name> [--agent claude-code]');
    process.exit(1);
  }

  const skillName = args[0];

  // 确定目标 agent
  let targetAgents: { name: string; displayName: string }[];
  if (options.agent && options.agent.length > 0) {
    targetAgents = options.agent.map((name) => ({ name, displayName: name }));
  } else {
    const installed = await detectInstalledAgents();
    targetAgents = installed.map((a) => ({ name: a.name, displayName: a.displayName }));
  }

  if (targetAgents.length === 0) {
    p.log.error('未检测到任何 agent');
    process.exit(1);
  }

  // 确认
  if (!options.yes) {
    const confirm = await p.confirm({
      message: `确认移除 "${skillName}"？`,
      initialValue: false,
    });
    if (p.isCancel(confirm) || !confirm) {
      process.exit(0);
    }
  }

  // 执行移除
  let removed = 0;
  for (const agentInfo of targetAgents) {
    const agentConfig = getAgentConfig(agentInfo.name);
    if (!agentConfig) continue;

    const success = await removeSkill(skillName, agentConfig, options.global || false);
    if (success) {
      p.log.success(`✓ 已从 ${agentInfo.displayName} 移除 ${skillName}`);
      removed++;
    }
  }

  if (removed === 0) {
    p.log.warn(`未找到已安装的 "${skillName}"`);
  } else {
    p.log.success(`\n移除完成！共从 ${removed} 个 agent 移除了 ${skillName}`);
  }
}
