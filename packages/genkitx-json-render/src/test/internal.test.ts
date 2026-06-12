import type { Catalog } from '@json-render/core';
import { describe, expect, test } from 'vitest';
import { buildSystem, DEFAULT_SYSTEM_PROMPT } from '../internal.js';

/** Catalog double whose prompt() echoes the options it received as JSON. */
const echoCatalog = {
  prompt: (opts: unknown) => JSON.stringify(opts),
} as unknown as Catalog;

describe('buildSystem', () => {
  test('defaults the system intro to DEFAULT_SYSTEM_PROMPT', () => {
    const opts = JSON.parse(buildSystem(echoCatalog));
    expect(opts.system).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(opts.mode).toBe('standalone');
  });

  test('uses the provided system + rules when given', () => {
    const opts = JSON.parse(buildSystem(echoCatalog, { system: 'Custom.', rules: ['r1', 'r2'] }));
    expect(opts.system).toBe('Custom.');
    expect(opts.customRules).toEqual(['r1', 'r2']);
  });

  test('DEFAULT_SYSTEM_PROMPT is a non-empty string', () => {
    expect(typeof DEFAULT_SYSTEM_PROMPT).toBe('string');
    expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});
