import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../src/frontmatter.ts';

describe('parseFrontmatter', () => {
  it('应解析标准 frontmatter', () => {
    const raw = `---
name: my-skill
description: 一个测试 skill
---
# 正文内容
这里是 markdown 内容。`;

    const result = parseFrontmatter(raw);
    expect(result.data.name).toBe('my-skill');
    expect(result.data.description).toBe('一个测试 skill');
    expect(result.content).toContain('# 正文内容');
  });

  it('应解析带元数据的 frontmatter', () => {
    const raw = `---
name: skill-with-meta
description: 带元数据
metadata:
  category: 开发
  tags:
    - test
    - demo
---
内容`;

    const result = parseFrontmatter(raw);
    expect(result.data.name).toBe('skill-with-meta');
    expect(result.data.metadata).toEqual({
      category: '开发',
      tags: ['test', 'demo'],
    });
  });

  it('应处理无 frontmatter 的内容', () => {
    const raw = '# 没有 frontmatter\n纯内容';
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({});
    expect(result.content).toBe(raw);
  });

  it('应处理无效 YAML', () => {
    const raw = `---
: invalid yaml :
---
内容`;
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({});
  });

  it('应处理 Windows 换行符', () => {
    const raw = '---\r\nname: windows-skill\r\n描述: 测试\r\n---\r\n内容';
    const result = parseFrontmatter(raw);
    expect(result.data.name).toBe('windows-skill');
  });
});
