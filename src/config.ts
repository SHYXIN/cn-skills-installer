import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { CONFIG_DIR, CONFIG_FILE } from './constants.ts';
export { CONFIG_FILE } from './constants.ts';
import { DEFAULT_CONFIG, type CnSkillsConfig } from './types.ts';

export async function loadConfig(): Promise<CnSkillsConfig> {
  try {
    await access(CONFIG_FILE);
    const raw = await readFile(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CnSkillsConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: CnSkillsConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export async function initConfig(): Promise<CnSkillsConfig> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}
