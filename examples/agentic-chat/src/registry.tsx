import { defineRegistry } from '@json-render/react';
import { shadcnComponents as c } from '@json-render/shadcn';
import { catalog } from './catalog';
import { Chart, Choices } from './components';
import { Icon } from './icons';

export const { registry } = defineRegistry(catalog, {
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
    Icon: ({ props }) => <Icon name={props.name} className={props.className ?? undefined} />,
    Chart: ({ props }) => <Chart type={props.type} title={props.title} data={props.data} />,
    Choices: ({ props }) => <Choices question={props.question} options={props.options} />,
  },
});
