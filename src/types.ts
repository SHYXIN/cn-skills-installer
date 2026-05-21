export type AgentType =
  | 'claude-code'
  | 'cursor'
  | 'codex'
  | 'copilot'
  | 'windsurf'
  | 'continue'
  | 'cline'
  | 'opencode'
  | 'openhands'
  | 'goose'
  | 'aider-desk'
  | 'amp'
  | 'antigravity'
  | 'augment'
  | 'bob'
  | 'openclaw'
  | 'codearts-agent'
  | 'codebuddy'
  | 'codemaker'
  | 'codestudio'
  | 'command-code'
  | 'cortex'
  | 'crush'
  | 'deepagents'
  | 'devin'
  | 'dexto'
  | 'droid'
  | 'firebender'
  | 'forgecode'
  | 'gemini-cli'
  | 'hermes-agent'
  | 'iflow-cli'
  | 'junie'
  | 'kilo'
  | 'kimi-cli'
  | 'kiro-cli'
  | 'kode'
  | 'mcpjam'
  | 'mistral-vibe'
  | 'mux'
  | 'neovate'
  | 'pi'
  | 'qoder'
  | 'qwen-code'
  | 'replit'
  | 'roo'
  | 'rovodev'
  | 'tabnine-cli'
  | 'trae'
  | 'trae-cn'
  | 'warp'
  | 'zencoder'
  | 'pochi'
  | 'adal'
  | 'universal';

export interface Skill {
  name: string;
  description: string;
  path: string;
  rawContent?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentConfig {
  name: string;
  displayName: string;
  skillsDir: string;
  globalSkillsDir: string | undefined;
  detectInstalled: () => Promise<boolean>;
}

export interface ParsedSource {
  type: 'github' | 'gitlab' | 'gitee' | 'git' | 'local' | 'well-known';
  url: string;
  subpath?: string;
  localPath?: string;
  ref?: string;
  skillFilter?: string;
}

export interface CnSkillsConfig {
  sourcePriority: ('gitee' | 'github')[];
  mirror: {
    github: string;
    gitee: string;
  };
  installMode: 'symlink' | 'copy';
  preferredAgents: string[];
  indexUrl: string;
}

export const DEFAULT_CONFIG: CnSkillsConfig = {
  sourcePriority: ['gitee', 'github'],
  mirror: {
    github: 'https://github.com',
    gitee: 'https://gitee.com',
  },
  installMode: 'symlink',
  preferredAgents: ['claude-code'],
  indexUrl: 'https://gitee.com/cn-skills/index/raw/main/zh-skills.json',
};

export interface ZhSkillEntry {
  name: string;
  description: string;
  source: 'gitee' | 'github';
  owner: string;
  repo: string;
  category: string;
  tags: string[];
}
