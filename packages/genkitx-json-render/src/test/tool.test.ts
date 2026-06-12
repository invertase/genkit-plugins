import type { Catalog, Spec } from '@json-render/core';
import type { Genkit } from 'genkit';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { defineRenderTool } from '../tool.js';

interface Captured {
  system?: string;
  prompt?: string;
}

/** Fake Genkit: `defineTool` returns the raw handler; `generateStream` replays chunks. */
function fakeAi(chunks: string[], captured: Captured = {}): Genkit {
  return {
    defineTool: (_config: unknown, handler: unknown) => handler,
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

/** Invoke a defined tool's handler directly. */
function callTool<R>(tool: unknown, input: unknown): Promise<R> {
  return (tool as (input: unknown) => Promise<R>)(input);
}

const PATCHES = [
  '{"op":"add","path":"/root","value":"hero-1"}\n',
  '{"op":"add","path":"/elements/hero-1","value":{"type":"Hero","props":{"headline":"Hi"}}}\n',
  '{"op":"add","path":"/elements/cta-1","value":{"type":"CTA","props":{"label":"Go"}}}\n',
];

interface ToolResult {
  rendered: boolean;
  elementCount: number;
  root: string;
}

afterEach(() => vi.restoreAllMocks());

describe('defineRenderTool', () => {
  test('returns a compact summary to the model', async () => {
    const tool = defineRenderTool(fakeAi(PATCHES), {
      name: 'renderUI',
      description: 'render a UI',
      catalog: fakeCatalog(),
      model: 'fake/model',
    });
    const result = await callTool<ToolResult>(tool, { intent: 'a landing page' });
    expect(result).toEqual({ rendered: true, elementCount: 2, root: 'hero-1' });
  });

  test('delivers the full spec out-of-band via onSpec', async () => {
    let captured: Spec | undefined;
    const tool = defineRenderTool(fakeAi(PATCHES), {
      name: 'renderUI',
      description: 'render a UI',
      catalog: fakeCatalog(),
      model: 'fake/model',
      onSpec: (spec) => {
        captured = spec;
      },
    });
    await callTool(tool, { intent: 'x' });
    expect(captured?.root).toBe('hero-1');
    expect(Object.keys(captured?.elements ?? {})).toEqual(['hero-1', 'cta-1']);
  });

  test('onPartial fires for each patch with a growing spec', async () => {
    const partials: number[] = [];
    const tool = defineRenderTool(fakeAi(PATCHES), {
      name: 'renderUI',
      description: 'render a UI',
      catalog: fakeCatalog(),
      model: 'fake/model',
      onPartial: (spec) => partials.push(Object.keys(spec.elements ?? {}).length),
    });
    await callTool(tool, { intent: 'x' });
    // one partial per applied patch; element count is non-decreasing and ends at 2
    expect(partials.length).toBe(3);
    expect(partials).toEqual([...partials].sort((a, b) => a - b));
    expect(partials.at(-1)).toBe(2);
  });

  test('default intent field is used as the generation prompt', async () => {
    const captured: Captured = {};
    const tool = defineRenderTool(fakeAi(PATCHES, captured), {
      name: 'renderUI',
      description: 'render a UI',
      catalog: fakeCatalog(),
      model: 'fake/model',
    });
    await callTool(tool, { intent: 'a pricing comparison' });
    expect(captured.prompt).toBe('a pricing comparison');
    expect(captured.system).toBe('CATALOG PROMPT');
  });

  test('custom inputSchema + buildPrompt', async () => {
    const captured: Captured = {};
    const tool = defineRenderTool(fakeAi(PATCHES, captured), {
      name: 'renderUI',
      description: 'render a UI',
      catalog: fakeCatalog(),
      model: 'fake/model',
      buildPrompt: (input: { topic: string }) => `render: ${input.topic}`,
    });
    await callTool(tool, { topic: 'onboarding' });
    expect(captured.prompt).toBe('render: onboarding');
  });

  test("validate 'throw' rejects an invalid spec", async () => {
    const tool = defineRenderTool(
      fakeAi(['{"op":"add","path":"/elements/a","value":{"type":"X"}}\n']),
      {
        name: 'renderUI',
        description: 'render a UI',
        catalog: fakeCatalog(),
        model: 'fake/model',
        validate: 'throw',
      },
    );
    await expect(callTool(tool, { intent: 'x' })).rejects.toThrow(/failed catalog validation/);
  });
});
