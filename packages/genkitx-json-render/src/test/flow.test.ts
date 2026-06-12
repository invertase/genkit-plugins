import type { Catalog, Spec } from '@json-render/core';
import type { Genkit } from 'genkit';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { defineRenderFlow } from '../flow.js';

/** Captured arguments from the fake `generateStream`. */
interface Captured {
  system?: string;
  prompt?: string;
}

/**
 * A fake Genkit whose `generateStream` replays canned JSONL patch chunks and
 * whose `defineFlow` returns the raw handler so tests can invoke it directly.
 * Double-cast (not `any`) — only the members the plugin touches are implemented.
 */
function fakeAi(chunks: string[], captured: Captured = {}): Genkit {
  return {
    defineFlow: (_config: unknown, handler: unknown) => handler,
    generateStream: (opts: { system?: string; prompt?: string }) => {
      captured.system = opts.system;
      captured.prompt = opts.prompt;
      return {
        stream: (async function* stream() {
          for (const c of chunks) yield { text: c };
        })(),
        response: Promise.resolve({ text: '' }),
      };
    },
  } as unknown as Genkit;
}

/** A catalog double: canned prompt, and validate that fails on a missing root. */
function fakeCatalog(): Catalog {
  return {
    prompt: () => 'CATALOG PROMPT',
    validate: (spec: unknown) => {
      const s = spec as Spec;
      return s?.root
        ? { success: true, data: s }
        : { success: false, error: { issues: [{ path: ['root'], message: 'Required' }] } };
    },
  } as unknown as Catalog;
}

/** Invoke a defined flow's handler with a captured sendChunk. */
async function run(flow: unknown, input: unknown): Promise<{ result: Spec; chunks: Spec[] }> {
  const chunks: Spec[] = [];
  const handler = flow as (
    input: unknown,
    side: { context?: unknown; sendChunk: (s: Spec) => void },
  ) => Promise<Spec>;
  const result = await handler(input, { sendChunk: (s) => chunks.push(structuredClone(s)) });
  return { result, chunks };
}

const PATCHES = [
  '{"op":"add","path":"/root","value":"hero-1"}\n',
  '{"op":"add","path":"/elements/hero-1","value":{"type":"Hero","props":{"headline":"Hi"}}}\n',
  '{"op":"add","path":"/elements/cta-1","value":{"type":"CTA","props":{"label":"Go"}}}\n',
];

afterEach(() => vi.restoreAllMocks());

describe('defineRenderFlow', () => {
  test('compiles JSONL patches into the final spec', async () => {
    const flow = defineRenderFlow(fakeAi(PATCHES), {
      name: 't',
      catalog: fakeCatalog(),
      model: 'fake/model',
    });
    const { result } = await run(flow, { prompt: 'a landing page' });
    expect(result.root).toBe('hero-1');
    expect(Object.keys(result.elements)).toEqual(['hero-1', 'cta-1']);
    expect(result.elements['hero-1']).toMatchObject({ type: 'Hero', props: { headline: 'Hi' } });
  });

  test('streams a partial spec as each patch arrives', async () => {
    const flow = defineRenderFlow(fakeAi(PATCHES), {
      name: 't',
      catalog: fakeCatalog(),
      model: 'fake/model',
    });
    const { chunks } = await run(flow, { prompt: 'x' });
    expect(chunks.length).toBe(3);
    // root first, then one element per subsequent patch
    expect(chunks[0]).toMatchObject({ root: 'hero-1' });
    expect(Object.keys(chunks[2]?.elements ?? {})).toEqual(['hero-1', 'cta-1']);
  });

  test('default input: uses { prompt } as the user message and catalog prompt as system', async () => {
    const captured: Captured = {};
    const flow = defineRenderFlow(fakeAi(PATCHES, captured), {
      name: 't',
      catalog: fakeCatalog(),
      model: 'fake/model',
    });
    await run(flow, { prompt: 'a dog-walking SaaS' });
    expect(captured.prompt).toBe('a dog-walking SaaS');
    expect(captured.system).toBe('CATALOG PROMPT');
  });

  test('custom inputSchema + buildPrompt', async () => {
    const captured: Captured = {};
    const flow = defineRenderFlow(fakeAi(PATCHES, captured), {
      name: 't',
      catalog: fakeCatalog(),
      model: 'fake/model',
      buildPrompt: (input: { pitch: string }) => `pitch: ${input.pitch}`,
    });
    await run(flow, { pitch: 'tacos' });
    expect(captured.prompt).toBe('pitch: tacos');
  });

  test("validate 'throw' rejects an invalid spec", async () => {
    // No root patch -> fake validate fails.
    const flow = defineRenderFlow(
      fakeAi(['{"op":"add","path":"/elements/a","value":{"type":"X"}}\n']),
      {
        name: 't',
        catalog: fakeCatalog(),
        model: 'fake/model',
        validate: 'throw',
      },
    );
    await expect(run(flow, { prompt: 'x' })).rejects.toThrow(/failed catalog validation/);
  });

  test("validate 'warn' (default) logs issues via console.warn", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const flow = defineRenderFlow(
      fakeAi(['{"op":"add","path":"/elements/a","value":{"type":"X"}}\n']),
      {
        name: 'pitch',
        catalog: fakeCatalog(),
        model: 'fake/model',
      },
    );
    await run(flow, { prompt: 'x' });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('pitch');
  });

  test("validate 'off' skips validation entirely", async () => {
    const catalog = fakeCatalog();
    const spy = vi.spyOn(catalog, 'validate');
    const flow = defineRenderFlow(
      fakeAi(['{"op":"add","path":"/elements/a","value":{"type":"X"}}\n']),
      {
        name: 't',
        catalog,
        model: 'fake/model',
        validate: 'off',
      },
    );
    await run(flow, { prompt: 'x' });
    expect(spy).not.toHaveBeenCalled();
  });

  test('before hook runs and can abort by throwing', async () => {
    const flow = defineRenderFlow(fakeAi(PATCHES), {
      name: 't',
      catalog: fakeCatalog(),
      model: 'fake/model',
      before: () => {
        throw new Error('quota exceeded');
      },
    });
    await expect(run(flow, { prompt: 'x' })).rejects.toThrow('quota exceeded');
  });

  test('onIssues overrides the default warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onIssues = vi.fn();
    const flow = defineRenderFlow(
      fakeAi(['{"op":"add","path":"/elements/a","value":{"type":"X"}}\n']),
      {
        name: 't',
        catalog: fakeCatalog(),
        model: 'fake/model',
        onIssues,
      },
    );
    await run(flow, { prompt: 'x' });
    expect(onIssues).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
  });
});
