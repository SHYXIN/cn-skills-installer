import { describe, it, expect } from 'vitest';
import { parseSource } from '../src/source-parser.ts';

describe('parseSource', () => {
  describe('本地路径', () => {
    it('应解析绝对路径', () => {
      const result = parseSource('/home/user/skills');
      expect(result.type).toBe('local');
      expect(result.url).toBe('/home/user/skills');
    });

    it('应解析相对路径 ./', () => {
      const result = parseSource('./my-skills');
      expect(result.type).toBe('local');
      expect(result.url).toBe('./my-skills');
    });

    it('应解析相对路径 ../', () => {
      const result = parseSource('../skills');
      expect(result.type).toBe('local');
    });

    it('应解析 Windows 路径', () => {
      const result = parseSource('C:\\Users\\skills');
      expect(result.type).toBe('local');
    });

    it('应解析 ~ 路径', () => {
      const result = parseSource('~');
      expect(result.type).toBe('local');
    });

    it('应解析 . 和 ..', () => {
      expect(parseSource('.').type).toBe('local');
      expect(parseSource('..').type).toBe('local');
    });
  });

  describe('Gitee 源', () => {
    it('应解析 gitee: 前缀', () => {
      const result = parseSource('gitee:owner/repo');
      expect(result.type).toBe('gitee');
      expect(result.url).toBe('https://gitee.com/owner/repo');
    });

    it('应解析 gitee: 前缀带子路径', () => {
      const result = parseSource('gitee:owner/repo/sub/path');
      expect(result.type).toBe('gitee');
      expect(result.url).toBe('https://gitee.com/owner/repo');
      expect(result.subpath).toBe('sub/path');
    });

    it('应解析 Gitee HTTPS URL', () => {
      const result = parseSource('https://gitee.com/owner/repo');
      expect(result.type).toBe('gitee');
      expect(result.url).toBe('https://gitee.com/owner/repo');
    });

    it('应解析 Gitee URL 带分支', () => {
      const result = parseSource('https://gitee.com/owner/repo/tree/main');
      expect(result.type).toBe('gitee');
      expect(result.ref).toBe('main');
    });

    it('应解析 Gitee URL 带分支和子路径', () => {
      const result = parseSource('https://gitee.com/owner/repo/tree/develop/skills');
      expect(result.type).toBe('gitee');
      expect(result.ref).toBe('develop');
      expect(result.subpath).toBe('skills');
    });

    it('应解析 Gitee SSH URL', () => {
      const result = parseSource('git@gitee.com:owner/repo.git');
      expect(result.type).toBe('gitee');
      expect(result.url).toBe('https://gitee.com/owner/repo');
    });

    it('应解析 Gitee .git URL', () => {
      const result = parseSource('https://gitee.com/owner/repo.git');
      expect(result.type).toBe('gitee');
    });
  });

  describe('GitHub 源', () => {
    it('应解析 github: 前缀', () => {
      const result = parseSource('github:owner/repo');
      expect(result.type).toBe('github');
      expect(result.url).toBe('https://github.com/owner/repo');
    });

    it('应解析 GitHub HTTPS URL', () => {
      const result = parseSource('https://github.com/owner/repo');
      expect(result.type).toBe('github');
      expect(result.url).toBe('https://github.com/owner/repo');
    });

    it('应解析 GitHub URL 带分支和子路径', () => {
      const result = parseSource('https://github.com/owner/repo/tree/main/skills');
      expect(result.type).toBe('github');
      expect(result.ref).toBe('main');
      expect(result.subpath).toBe('skills');
    });

    it('应解析 GitHub SSH URL', () => {
      const result = parseSource('git@github.com:owner/repo.git');
      expect(result.type).toBe('github');
    });
  });

  describe('GitLab 源', () => {
    it('应解析 gitlab: 前缀', () => {
      const result = parseSource('gitlab:owner/repo');
      expect(result.type).toBe('gitlab');
      expect(result.url).toBe('https://gitlab.com/owner/repo');
    });

    it('应解析 GitLab HTTPS URL', () => {
      const result = parseSource('https://gitlab.com/owner/repo');
      expect(result.type).toBe('gitlab');
    });

    it('应解析 GitLab 子组 URL', () => {
      const result = parseSource('https://gitlab.com/group/sub/repo');
      expect(result.type).toBe('gitlab');
      expect(result.url).toBe('https://gitlab.com/group/sub/repo');
    });
  });

  describe('Shorthand', () => {
    it('应解析 owner/repo 格式', () => {
      const result = parseSource('anthropics/skills');
      expect(result.type).toBe('git');
      expect(result.url).toBe('anthropics/skills');
    });

    it('应解析带子路径的 shorthand', () => {
      const result = parseSource('owner/repo/sub/path');
      expect(result.type).toBe('git');
      expect(result.subpath).toBe('sub/path');
    });

    it('应将含点号但无已知域名的路径解析为 shorthand', () => {
      // owner.repo 含点号但不含 .com 等已知域名，仍是 shorthand
      const result = parseSource('owner.repo/repo');
      expect(result.type).toBe('git');
      expect(result.url).toBe('owner.repo/repo');
    });

    it('不应将含已知域名的路径解析为 shorthand', () => {
      const result = parseSource('github.com/owner/repo');
      expect(result.type).not.toBe('git');
    });
  });

  describe('片段引用', () => {
    it('应解析 #branch 片段', () => {
      const result = parseSource('owner/repo#main');
      expect(result.ref).toBe('main');
      expect(result.url).toBe('owner/repo');
    });

    it('应解析 #branch@skill 片段', () => {
      const result = parseSource('owner/repo#develop@my-skill');
      expect(result.ref).toBe('develop');
      expect(result.skillFilter).toBe('my-skill');
    });

    it('应解析 GitHub URL 带片段', () => {
      const result = parseSource('https://github.com/owner/repo#v2.0');
      expect(result.ref).toBe('v2.0');
      expect(result.type).toBe('github');
    });
  });

  describe('Well-known URL', () => {
    it('应解析任意 HTTPS URL', () => {
      const result = parseSource('https://example.com/skills');
      expect(result.type).toBe('well-known');
      expect(result.url).toBe('https://example.com/skills');
    });
  });

  describe('路径安全', () => {
    it('应拒绝含 .. 的子路径', () => {
      const result = parseSource('gitee:owner/repo/../../../etc');
      expect(result.subpath).toBeUndefined();
    });

    it('应清理含 // 的子路径（去除多余分隔符）', () => {
      const result = parseSource('gitee:owner/repo//etc');
      // 双斜杠被 filter(Boolean) 清理后变成正常路径
      expect(result.subpath).toBe('etc');
    });
  });
});
