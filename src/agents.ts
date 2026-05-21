import { access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { AgentConfig, AgentType } from './types.ts';

async function dirExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Full agent registry — same as npx skills.
 * Each agent has a project-level skills dir and an optional global one.
 */
export const agents: AgentConfig[] = [
  {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    globalSkillsDir: join(homedir(), '.claude', 'skills'),
    detectInstalled: async () => dirExists(join(process.cwd(), '.claude')),
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    skillsDir: '.cursor/skills',
    globalSkillsDir: undefined,
    detectInstalled: async () => dirExists(join(process.cwd(), '.cursor')),
  },
  {
    name: 'codex',
    displayName: 'Codex',
    skillsDir: '.codex/skills',
    globalSkillsDir: undefined,
    detectInstalled: async () => dirExists(join(process.cwd(), '.codex')),
  },
  {
    name: 'copilot',
    displayName: 'GitHub Copilot',
    skillsDir: '.github/skills',
    globalSkillsDir: undefined,
    detectInstalled: async () => dirExists(join(process.cwd(), '.github')),
  },
  {
    name: 'windsurf',
    displayName: 'Windsurf',
    skillsDir: '.windsurf/skills',
    globalSkillsDir: undefined,
    detectInstalled: async () => dirExists(join(process.cwd(), '.windsurf')),
  },
  {
    name: 'continue',
    displayName: 'Continue',
    skillsDir: '.continue/skills',
    globalSkillsDir: undefined,
    detectInstalled: async () => dirExists(join(process.cwd(), '.continue')),
  },
  {
    name: 'cline',
    displayName: 'Cline',
    skillsDir: '.cline/skills',
    globalSkillsDir: undefined,
    detectInstalled: async () => dirExists(join(process.cwd(), '.cline')),
  },
  {
    name: 'opencode',
    displayName: 'OpenCode',
    skillsDir: '.opencode/skills',
    globalSkillsDir: undefined,
    detectInstalled: async () => dirExists(join(process.cwd(), '.opencode')),
  },
  {
    name: 'openhands',
    displayName: 'OpenHands',
    skillsDir: '.openhands/skills',
    globalSkillsDir: undefined,
    detectInstalled: async () => dirExists(join(process.cwd(), '.openhands')),
  },
  {
    name: 'goose',
    displayName: 'Goose',
    skillsDir: '.goose/skills',
    globalSkillsDir: undefined,
    detectInstalled: async () => dirExists(join(process.cwd(), '.goose')),
  },
  {
    name: 'universal',
    displayName: 'Universal (.agents)',
    skillsDir: '.agents/skills',
    globalSkillsDir: join(homedir(), '.agents', 'skills'),
    detectInstalled: async () => dirExists(join(process.cwd(), '.agents')),
  },
];

/**
 * Detect which agents are installed in the current project.
 */
export async function detectInstalledAgents(): Promise<AgentConfig[]> {
  const results: AgentConfig[] = [];
  for (const agent of agents) {
    if (await agent.detectInstalled()) {
      results.push(agent);
    }
  }
  return results;
}

/**
 * Get agent config by name.
 */
export function getAgentConfig(name: string): AgentConfig | undefined {
  return agents.find((a) => a.name === name);
}
