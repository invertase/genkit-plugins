import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { shadcnComponentDefinitions as s } from '@json-render/shadcn/catalog';
import { z } from 'zod';
import { ICON_NAMES } from './ui/icons';

/**
 * A compact catalog of chat-friendly shadcn components. Shared by the server (the
 * renderUI tool's prompt + validation) and the client (the render registry).
 */
export const catalog = defineCatalog(schema, {
  actions: {
    submit: {
      params: z.object({ values: z.record(z.string(), z.unknown()) }),
      description:
        "Submit form values back to the assistant — they arrive as the user's next " +
        'message. Bind values to the form state: { "values": { "$state": "/form" } }.',
    },
  },
  components: {
    Card: s.Card,
    Stack: s.Stack,
    Grid: s.Grid,
    Heading: s.Heading,
    Text: s.Text,
    Badge: s.Badge,
    Alert: s.Alert,
    Table: s.Table,
    Progress: s.Progress,
    Separator: s.Separator,
    // Form components: fields two-way bind via { $bindState: "/form/<name>" };
    // a Button fires the `submit` action with the collected /form state.
    Input: s.Input,
    Select: s.Select,
    Button: s.Button,
    Icon: {
      props: z.object({
        name: z.enum(ICON_NAMES),
        className: z.string().nullable(),
      }),
      description:
        'A small inline lucide icon. Prefer this over emoji for visual cues — e.g. ' +
        'next to a Stat, in a Card title, or inside a Badge.',
    },
    Chart: {
      props: z.object({
        type: z.enum(['bar', 'line', 'area']),
        title: z.string().nullable(),
        data: z.array(z.object({ name: z.string(), value: z.number() })),
      }),
      description:
        'A chart (recharts). Use for trends, distributions, or comparisons across ' +
        'categories. `data` is an array of { name, value } points.',
    },
    Choices: {
      props: z.object({
        question: z.string().nullable(),
        options: z.array(z.object({ label: z.string(), value: z.string() })),
      }),
      description:
        'Clickable options for the user to pick from. The chosen value is sent back ' +
        'to you as the user’s next message — use it whenever the user should decide, ' +
        'instead of asking in prose. Labels and values must be literal strings.',
    },
  },
});
