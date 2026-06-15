import type { Catalog, Spec } from '@json-render/core';
import { describe, expect, test } from 'vitest';
import { buildSystem, DEFAULT_SYSTEM_PROMPT, sanitizePartialSpec } from '../internal.js';

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

describe('sanitizePartialSpec', () => {
  test('returns null until the root element exists', () => {
    expect(sanitizePartialSpec({ root: '', elements: {} } as Spec)).toBeNull();
    expect(sanitizePartialSpec({ root: 'a', elements: {} } as Spec)).toBeNull();
  });

  test('prunes child refs to missing elements without mutating the input', () => {
    const spec = {
      root: 'stack',
      elements: {
        stack: { type: 'Stack', props: {}, children: ['a', 'missing'] },
        a: { type: 'Text', props: { text: 'hi' } },
      },
    } as unknown as Spec;
    const safe = sanitizePartialSpec(spec);
    expect(safe?.elements.stack?.children).toEqual(['a']);
    expect(spec.elements.stack?.children).toEqual(['a', 'missing']);
  });

  test('passes a complete spec through unchanged in shape', () => {
    const spec = {
      root: 'stack',
      elements: {
        stack: { type: 'Stack', props: {}, children: ['a'] },
        a: { type: 'Text', props: { text: 'hi' } },
      },
      state: { x: 1 },
    } as unknown as Spec;
    expect(sanitizePartialSpec(spec)).toEqual(spec);
  });
});
