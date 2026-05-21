#!/usr/bin/env node

import pc from 'picocolors';
import { runAdd } from './commands/add.ts';
import { runSearch } from './commands/search.ts';
import { runList } from './commands/list.ts';
import { runRemove } from './commands/remove.ts';

const VERSION = '0.1.0';

function showHelp(): void {
  console.log(`
${pc.bold('cn-skills')} v${VERSION}
${pc.dim('中国优化的 AI Agent Skills 安装工具')}

${pc.bold('用法：')}
  cn-skills <command> [options]

${pc.bold('命令：')}
  ${pc.cyan('add')} <source>     安装 skill
  ${pc.cyan('search')} [关键词]  搜索中文 skill 索引
  ${pc.cyan('list')}            列出已安装的 skills
  ${pc.cyan('remove')} <name>   移除已安装的 skill
  ${pc.cyan('config')}          查看/初始化配置文件
  ${pc.cyan('help')}            显示帮助信息
  ${pc.cyan('version')}         显示版本号

${pc.bold('add 命令选项：')}
  ${pc.dim('--agent <name>')}    指定 agent（默认自动检测）
  ${pc.dim('--global')}          全局安装（~/.agent/skills/）
  ${pc.dim('--yes')}             跳过确认
  ${pc.dim('--source <gitee|github>')}  强制使用指定源

${pc.bold('示例：')}
  cn-skills add gitee:owner/repo
  cn-skills add github:anthropics/skills
  cn-skills add owner/repo --source gitee
  cn-skills search 代码审查
  cn-skills list
  cn-skills remove my-skill

${pc.bold('支持的源格式：')}
  ${pc.dim('·')} owner/repo               shorthand（按配置优先级自动选择源）
  ${pc.dim('·')} gitee:owner/repo         强制从 Gitee 安装
  ${pc.dim('·')} github:owner/repo        强制从 GitHub 安装
  ${pc.dim('·')} https://gitee.com/...    完整 URL
  ${pc.dim('·')} https://github.com/...   完整 URL
  ${pc.dim('·')} git@host:owner/repo.git  SSH 地址
  ${pc.dim('·')} ./local/path             本地路径
`);
}

function showVersion(): void {
  console.log(`cn-skills v${VERSION}`);
}

/**
 * 解析命令行参数，分离命令、位置参数和选项。
 */
function parseArgs(argv: string[]): {
  command: string;
  positional: string[];
  options: Record<string, string | boolean>;
} {
  const args = argv.slice(2); // 跳过 node 和脚本路径
  const command = args[0] || 'help';
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, options };
}

async function main(): Promise<void> {
  const { command, positional, options } = parseArgs(process.argv);

  try {
    switch (command) {
      case 'add':
      case 'install':
        await runAdd(positional, {
          agent: options.agent ? String(options.agent).split(',') : undefined,
          global: options.global as boolean,
          yes: options.yes as boolean,
          source: options.source as 'gitee' | 'github' | undefined,
        });
        break;

      case 'search':
      case 'find':
        await runSearch(positional);
        break;

      case 'list':
      case 'ls':
        await runList();
        break;

      case 'remove':
      case 'rm':
      case 'uninstall':
        await runRemove(positional, {
          agent: options.agent ? String(options.agent).split(',') : undefined,
          global: options.global as boolean,
          yes: options.yes as boolean,
        });
        break;

      case 'config':
        const { loadConfig, initConfig, CONFIG_FILE } = await import('./config.ts');
        if (options.init) {
          await initConfig();
          console.log(`配置文件已初始化：${CONFIG_FILE}`);
        } else {
          const config = await loadConfig();
          console.log(`配置文件路径：${CONFIG_FILE}`);
          console.log(JSON.stringify(config, null, 2));
        }
        break;

      case 'version':
      case '-v':
      case '--version':
        showVersion();
        break;

      case 'help':
      case '-h':
      case '--help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error(pc.red('错误：'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
