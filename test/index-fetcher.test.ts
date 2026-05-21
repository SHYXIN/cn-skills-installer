import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchIndex } from '../src/index-fetcher.ts';
import type { ZhSkillEntry } from '../src/types.ts';

// 模拟索引数据
const mockIndex: ZhSkillEntry[] = [
  {
    name: 'ad-compliance-review',
    description: '广告合规审核技能',
    source: 'github',
    owner: 'test',
    repo: 'skills',
    category: '法律合规',
    tags: ['广告', '合规', '审核'],
  },
  {
    name: 'frontend-dev',
    description: '全栈前端开发',
    source: 'github',
    owner: 'test',
    repo: 'skills',
    category: '开发',
    tags: ['前端', 'UI', '设计'],
  },
  {
    name: 'contract-review',
    description: '合同审查技能',
    source: 'gitee',
    owner: 'test',
    repo: 'skills',
    category: '法律合规',
    tags: ['合同', '审查', '法律'],
  },
];

describe('searchIndex', () => {
  it('应按名称搜索', () => {
    const results = searchIndex(mockIndex, 'ad-compliance');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('ad-compliance-review');
  });

  it('应按描述搜索', () => {
    const results = searchIndex(mockIndex, '前端开发');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('frontend-dev');
  });

  it('应按标签搜索', () => {
    const results = searchIndex(mockIndex, '合规');
    expect(results).toHaveLength(2); // ad-compliance-review + contract-review
  });

  it('应按分类搜索', () => {
    const results = searchIndex(mockIndex, '法律合规');
    expect(results).toHaveLength(2);
  });

  it('应不区分大小写', () => {
    const results = searchIndex(mockIndex, 'FRONTEND');
    expect(results).toHaveLength(1);
  });

  it('无匹配时应返回空数组', () => {
    const results = searchIndex(mockIndex, '不存在的关键词');
    expect(results).toHaveLength(0);
  });

  it('空关键词应返回全部', () => {
    const results = searchIndex(mockIndex, '');
    expect(results).toHaveLength(3);
  });
});
