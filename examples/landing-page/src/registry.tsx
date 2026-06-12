import { defineRegistry } from '@json-render/react';
import { shadcnComponents as c } from '@json-render/shadcn';
import { catalog } from './catalog';

export const { registry } = defineRegistry(catalog, {
  components: {
    Stack: c.Stack,
    Grid: c.Grid,
    Card: c.Card,
    Heading: c.Heading,
    Text: c.Text,
    Badge: c.Badge,
    Button: c.Button,
    Separator: c.Separator,
  },
});
