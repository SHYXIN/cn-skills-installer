import { parse as parseYaml } from 'yaml';

export interface Frontmatter {
  data: Record<string, unknown>;
  content: string;
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Expects format:
 * ---
 * name: skill-name
 * description: A description
 * ---
 * (markdown content)
 */
export function parseFrontmatter(raw: string): Frontmatter {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: raw };
  }

  const [, frontmatter, content] = match;
  try {
    const data = parseYaml(frontmatter) as Record<string, unknown>;
    return { data: data ?? {}, content };
  } catch {
    return { data: {}, content: raw };
  }
}
