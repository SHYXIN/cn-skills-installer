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
 * GitHub 镜像代理列表（按优先级排序）。
 * 参考 skills-cn 的方案，使用多个镜像源提高成功率。
 */
const GITHUB_MIRRORS = [
  'https://gh-proxy.org/https://github.com',   // gh-proxy.org 代理
  'https://kkgithub.com',                        // kkgithub.com 镜像
  'https://gitmirror.com/github.com',            // gitmirror 镜像
  'https://hub.gitmirror.com/github.com',        // gitmirror hub
  'https://ghproxy.net/https://github.com',     // ghproxy.net
];

/**
 * 检测可用的 GitHub 镜像。
 * 返回第一个可用的镜像 URL，如果都不可用则返回原始 GitHub URL。
 */
async function detectAvailableMirror(): Promise<string> {
  for (const mirror of GITHUB_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok || res.status === 302 || res.status === 301) {
        return mirror;
      }
    } catch {
      // 不可用，尝试下一个
    }
  }
  return 'https://github.com'; // fallback 到原始地址
}

/**
 * 用 child_process.spawn 直接调用 git 克隆。
 * 支持 GitHub 镜像加速，提升中国用户的克隆速度。
 */
export async function cloneRepo(
  url: string,
  ref?: string,
  mirrorUrl?: string
): Promise<string> {
  // 如果没有指定镜像 URL 且是 GitHub 仓库，自动检测可用镜像
  let cloneUrl = url;
  if (!mirrorUrl && url.includes('github.com')) {
    mirrorUrl = await detectAvailableMirror();
  }
  if (mirrorUrl) {
    cloneUrl = applyMirror(url, mirrorUrl);
  }

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
        GIT_ASKPASS: 'echo',
        GCM_INTERACTIVE: 'never',
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
 * 例如：https://github.com/owner/repo → https://gh-proxy.org/https://github.com/owner/repo
 */
function applyMirror(originalUrl: string, mirrorUrl: string): string {
  if (originalUrl.includes('github.com')) {
    // 处理不同镜像的 URL 格式
    if (mirrorUrl.includes('gh-proxy.org') || mirrorUrl.includes('ghproxy.net')) {
      // 代理模式：在 URL 前加代理前缀
      return originalUrl.replace('https://github.com', mirrorUrl);
    } else {
      // 镜像模式：替换域名
      return originalUrl.replace('https://github.com', mirrorUrl);
    }
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
