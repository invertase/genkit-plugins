import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { shadcnComponentDefinitions as s } from '@json-render/shadcn/catalog';

/**
 * One catalog, shared by the server (drives the flow's prompt + validation) and
 * the client (drives the render registry). Components come straight from
 * `@json-render/shadcn` — a real shadcn/Tailwind component library.
 */
export const catalog = defineCatalog(schema, {
  actions: {},
  components: {
    Stack: s.Stack,
    Grid: s.Grid,
    Card: s.Card,
    Heading: s.Heading,
    Text: s.Text,
    Badge: s.Badge,
    Button: s.Button,
    Separator: s.Separator,
  },
});
