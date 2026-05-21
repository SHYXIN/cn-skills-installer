import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { CONFIG_DIR } from './constants.ts';
import { join } from 'path';
import { fileURLToPath } from 'url';
import type { ZhSkillEntry } from './types.ts';

const INDEX_CACHE_FILE = join(CONFIG_DIR, 'zh-skills-index.json');
const INDEX_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时

/**
 * 获取内嵌的中文 skills 索引（打包在 npm 包里的默认数据）。
 * 作为远程索引不可用时的最终 fallback。
 */
async function getBundledIndex(): Promise<ZhSkillEntry[]> {
  try {
    // 从包内 index 目录读取（发布时包含在 files 字段中）
    const bundledPath = join(
      fileURLToPath(new URL('../index', import.meta.url)),
      'zh-skills.json'
    );
    const raw = await readFile(bundledPath, 'utf-8');
    return JSON.parse(raw) as ZhSkillEntry[];
  } catch {
    return [];
  }
}

/**
 * 获取中文 skills 索引。
 * 优先级：本地缓存（24h 内）→ 远程获取 → 本地缓存（过期）→ 内嵌索引
 */
export async function fetchIndex(indexUrl: string): Promise<ZhSkillEntry[]> {
  // 1. 尝试本地缓存（24 小时内）
  try {
    await access(INDEX_CACHE_FILE);
    const raw = await readFile(INDEX_CACHE_FILE, 'utf-8');
    const cached = JSON.parse(raw) as { timestamp: number; data: ZhSkillEntry[] };
    if (Date.now() - cached.timestamp < INDEX_CACHE_TTL) {
      return cached.data;
    }
  } catch {
    // 无缓存或缓存无效
  }

  // 2. 尝试远程获取
  try {
    const res = await fetch(indexUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as ZhSkillEntry[];

    // 写入缓存
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(
      INDEX_CACHE_FILE,
      JSON.stringify({ timestamp: Date.now(), data }),
      'utf-8'
    );

    return data;
  } catch {
    // 3. 远程失败，尝试过期缓存
    try {
      const raw = await readFile(INDEX_CACHE_FILE, 'utf-8');
      const cached = JSON.parse(raw) as { timestamp: number; data: ZhSkillEntry[] };
      return cached.data;
    } catch {
      // 4. 最终 fallback：内嵌索引
      return getBundledIndex();
    }
  }
}

/**
 * Search the index by keyword.
 */
export function searchIndex(index: ZhSkillEntry[], keyword: string): ZhSkillEntry[] {
  const lower = keyword.toLowerCase();
  return index.filter(
    (entry) =>
      entry.name.toLowerCase().includes(lower) ||
      entry.description.toLowerCase().includes(lower) ||
      entry.tags.some((t) => t.toLowerCase().includes(lower)) ||
      entry.category.toLowerCase().includes(lower)
  );
}
