import simpleGit from 'simple-git';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
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
 * Clone a git repo to a temp directory.
 * Supports mirror URL substitution for faster Chinese network access.
 */
export async function cloneRepo(
  url: string,
  ref?: string,
  mirrorUrl?: string
): Promise<string> {
  // 应用镜像替换
  const cloneUrl = mirrorUrl ? applyMirror(url, mirrorUrl) : url;

  const tempDir = await mkdtemp(join(tmpdir(), 'cn-skills-'));
  const git = simpleGit({
    timeout: { block: CLONE_TIMEOUT_MS },
  }).env({
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_LFS_SKIP_SMUDGE: '1',
  });

  // 浅克隆 + 跳过 LFS，避免 filter 配置报错
  const cloneOptions = ['--depth', '1', '--no-recurse-submodules'];
  if (ref) {
    cloneOptions.push('--branch', ref);
  }

  try {
    await git.clone(cloneUrl, tempDir, cloneOptions);
    return tempDir;
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout =
      errorMessage.includes('block timeout') || errorMessage.includes('timed out');
    const isAuthError =
      errorMessage.includes('Authentication failed') ||
      errorMessage.includes('could not read Username') ||
      errorMessage.includes('Permission denied') ||
      errorMessage.includes('Repository not found');

    if (isTimeout) {
      const seconds = Math.round(CLONE_TIMEOUT_MS / 1000);
      throw new GitCloneError(
        `克隆超时（${seconds}秒）。常见原因：\n` +
          `  - 仓库太大：设置环境变量 CN_SKILLS_CLONE_TIMEOUT_MS=600000\n` +
          `  - 网络慢：重试，或手动克隆后传本地路径\n` +
          `  - 私有仓库无权限：确保已配置认证`,
        url,
        true,
        false
      );
    }

    if (isAuthError) {
      throw new GitCloneError(
        `认证失败：${url}\n` +
          `  - 私有仓库：确保你有访问权限\n` +
          `  - SSH：检查密钥 ssh -T git@gitee.com\n` +
          `  - HTTPS：配置 git 凭据`,
        url,
        false,
        true
      );
    }

    throw new GitCloneError(`克隆失败：${url}\n${errorMessage}`, url, false, false);
  }
}

/**
 * Apply mirror URL substitution.
 * E.g., https://github.com/owner/repo → https://hub.fastgit.xyz/owner/repo
 */
function applyMirror(originalUrl: string, mirrorUrl: string): string {
  if (originalUrl.includes('github.com')) {
    return originalUrl.replace('https://github.com', mirrorUrl);
  }
  return originalUrl;
}

/**
 * Safely clean up a temp directory.
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  const normalizedDir = dir.replace(/\\/g, '/');
  const normalizedTmp = tmpdir().replace(/\\/g, '/');

  if (!normalizedDir.startsWith(normalizedTmp)) {
    throw new Error('Attempted to clean up directory outside of temp directory');
  }

  await rm(dir, { recursive: true, force: true });
}
