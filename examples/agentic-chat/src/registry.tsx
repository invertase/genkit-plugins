import { defineRegistry } from '@json-render/react';
import { shadcnComponents as c } from '@json-render/shadcn';
import { catalog } from './catalog';
import { Chart, Choices } from './ui/components';
import { Icon } from './ui/icons';

/**
 * Build the registry and action handlers. A factory (not a module constant)
 * because the `submit` action closes over the chat's `send` — actions are how
 * generated UI calls back into the host app.
 */
export function createRegistry(onSubmit: (values: Record<string, unknown>) => void) {
  // Declared once, used twice: `defineRegistry` type-checks it against the
  // catalog's `submit` params schema; ActionProvider executes it. It reads no
  // state, so it can go to ActionProvider directly — params arrive with
  // bindings already resolved ($state refs replaced by live values).
  const submit = async (params?: { values?: Record<string, unknown> }) => {
    onSubmit(params?.values ?? {});
  };

  const { registry } = defineRegistry(catalog, {
    components: {
      Card: c.Card,
      Stack: c.Stack,
      Grid: c.Grid,
      Heading: c.Heading,
      Text: c.Text,
      Badge: c.Badge,
      Alert: c.Alert,
      Table: c.Table,
      Progress: c.Progress,
      Separator: c.Separator,
      Input: c.Input,
      Select: c.Select,
      Button: c.Button,
      Icon: ({ props }) => <Icon name={props.name} className={props.className ?? undefined} />,
      Chart: ({ props }) => <Chart type={props.type} title={props.title} data={props.data} />,
      Choices: ({ props }) => <Choices question={props.question} options={props.options} />,
    },
    actions: { submit },
  });

  return { registry, handlers: { submit } };
}
