import { symlink, unlink, mkdir, readdir, readFile, writeFile, lstat, rm, realpath } from 'fs/promises';
import { join, basename, dirname, resolve, normalize, sep } from 'path';
import { homedir, tmpdir } from 'os';
import { AGENTS_DIR, SKILLS_SUBDIR } from './constants.ts';
import type { AgentConfig, Skill } from './types.ts';

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isPathSafe(targetPath: string, basePath: string): boolean {
  const normalizedTarget = normalize(resolve(targetPath));
  const normalizedBase = normalize(resolve(basePath));
  return normalizedTarget.startsWith(normalizedBase + sep) || normalizedTarget === normalizedBase;
}

async function createSymlink(src: string, dest: string): Promise<boolean> {
  try {
    await mkdir(dirname(dest), { recursive: true });

    // Remove existing symlink/file
    try {
      const stats = await lstat(dest);
      if (stats.isSymbolicLink() || stats.isFile() || stats.isDirectory()) {
        await unlink(dest);
      }
    } catch {
      // Doesn't exist
    }

    await symlink(src, dest, 'dir');
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.name === '.git' || entry.name === '__pycache__') continue;

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      const content = await readFile(srcPath);
      await writeFile(destPath, content);
    }
  }
}

/**
 * Install a skill for a specific agent.
 */
export async function installSkillForAgent(
  skill: Skill,
  agent: AgentConfig,
  global: boolean,
  mode: 'symlink' | 'copy'
): Promise<string> {
  const baseDir = global
    ? agent.globalSkillsDir || join(homedir(), agent.skillsDir)
    : join(process.cwd(), agent.skillsDir);

  const dest = join(baseDir, sanitizeName(skill.name));

  if (!isPathSafe(dest, baseDir)) {
    throw new Error(`Path traversal detected: ${dest}`);
  }

  // 如果源路径在临时目录中（会被清理），强制使用 copy 模式
  const isTempPath = skill.path.includes('cn-skills-') && skill.path.includes(tmpdir());
  const effectiveMode = isTempPath ? 'copy' : mode;

  if (effectiveMode === 'symlink') {
    const success = await createSymlink(skill.path, dest);
    if (!success) {
      await copyDirectory(skill.path, dest);
    }
  } else {
    await copyDirectory(skill.path, dest);
  }

  return dest;
}

/**
 * List all installed skills across all agents.
 */
export async function listInstalledSkills(): Promise<
  { name: string; path: string; agent: string; scope: 'project' | 'global' }[]
> {
  const results: { name: string; path: string; agent: string; scope: 'project' | 'global' }[] = [];

  // Universal skills
  const universalDir = join(process.cwd(), AGENTS_DIR, SKILLS_SUBDIR);
  try {
    const entries = await readdir(universalDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        results.push({
          name: entry.name,
          path: join(universalDir, entry.name),
          agent: 'universal',
          scope: 'project',
        });
      }
    }
  } catch {
    // Doesn't exist
  }

  return results;
}

/**
 * Remove an installed skill.
 */
export async function removeSkill(name: string, agent: AgentConfig, global: boolean): Promise<boolean> {
  const baseDir = global
    ? agent.globalSkillsDir || join(homedir(), agent.skillsDir)
    : join(process.cwd(), agent.skillsDir);

  const dest = join(baseDir, sanitizeName(name));

  try {
    await rm(dest, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
