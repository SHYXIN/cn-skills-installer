import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { CLONE_TIMEOUT_MS } from './constants.ts';

export class GitCloneError extends Error {
  readonly url: string;
  readonly isTimeout: boolean;
  readonly isAuthError: boolean;

  constructor(message: string, url: string, isTimeout = false, isAuthError = false) {
    super(message);
    this.name = 'GitCloneError';
    this.url = url;
    this.isTimeout = isTimeout;
    this.isAuthError = isAuthError;
  }
}

/**
 * 用 child_process.spawn 直接调用 git 克隆。
 * 绕过 simple-git 的 GIT_ASKPASS / filter.lfs 安全限制问题。
 */
export async function cloneRepo(
  url: string,
  ref?: string,
  mirrorUrl?: string
): Promise<string> {
  const cloneUrl = mirrorUrl ? applyMirror(url, mirrorUrl) : url;
  const tempDir = await mkdtemp(join(tmpdir(), 'cn-skills-'));

  const args = ['clone', '--depth', '1', '--no-recurse-submodules'];
  if (ref) {
    args.push('--branch', ref);
  }
  args.push(cloneUrl, tempDir);

  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_LFS_SKIP_SMUDGE: '1',
        GIT_ASKPASS: 'echo', // 禁用 askpass，避免安全限制
        GCM_INTERACTIVE: 'never', // 禁用 git credential manager 交互
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rm(tempDir, { recursive: true, force: true }).catch(() => {});
      reject(
        new GitCloneError(
          `克隆超时（${Math.round(CLONE_TIMEOUT_MS / 1000)}秒）。\n` +
            `  - 仓库太大：设置环境变量 CN_SKILLS_CLONE_TIMEOUT_MS=600000\n` +
            `  - 网络慢：重试，或手动克隆后传本地路径\n` +
            `  - 私有仓库：确保已配置 SSH 密钥或 HTTPS 凭据`,
          url,
          true,
          false
        )
      );
    }, CLONE_TIMEOUT_MS);

    child.on('close', async (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(tempDir);
        return;
      }

      await rm(tempDir, { recursive: true, force: true }).catch(() => {});

      const isAuthError =
        stderr.includes('Authentication failed') ||
        stderr.includes('could not read Username') ||
        stderr.includes('Permission denied') ||
        stderr.includes('Repository not found') ||
        stderr.includes('fatal: repository') ||
        stderr.includes('Could not resolve host');

      if (isAuthError) {
        reject(
          new GitCloneError(
            `认证失败：${url}\n` +
              `  - 私有仓库：确保你有访问权限\n` +
              `  - SSH：检查密钥 ssh -T git@github.com\n` +
              `  - HTTPS：配置 git 凭据\n` +
              `  - 网络：检查是否能访问该域名`,
            url,
            false,
            true
          )
        );
        return;
      }

      reject(new GitCloneError(`克隆失败：${url}\n${stderr || `退出码 ${code}`}`, url, false, false));
    });

    child.on('error', async (err) => {
      clearTimeout(timeout);
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      reject(new GitCloneError(`无法执行 git 命令：${err.message}\n请确保已安装 git。`, url, false, false));
    });
  });
}

/**
 * 应用镜像替换。
 * 例如：https://github.com/owner/repo → https://hub.fastgit.xyz/owner/repo
 */
function applyMirror(originalUrl: string, mirrorUrl: string): string {
  if (originalUrl.includes('github.com')) {
    return originalUrl.replace('https://github.com', mirrorUrl);
  }
  return originalUrl;
}

/**
 * 安全清理临时目录。
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  const normalizedDir = dir.replace(/\\/g, '/');
  const normalizedTmp = tmpdir().replace(/\\/g, '/');
  if (!normalizedDir.startsWith(normalizedTmp)) {
    throw new Error('Attempted to clean up directory outside of temp directory');
  }
  await rm(dir, { recursive: true, force: true });
}
