import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRespond } from './respond';

const AXIS = 'var(--muted-foreground)';
const GRID = 'var(--border)';
const BRAND = 'var(--primary)';

interface ChartPoint {
  name: string;
  value: number;
}

const axisProps = {
  stroke: AXIS,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--popover-foreground)',
  boxShadow: '0 4px 16px rgb(0 0 0 / 0.08)',
} as const;

export function Chart({
  type,
  title,
  data,
}: {
  type: 'bar' | 'line' | 'area';
  title?: string | null;
  data: ChartPoint[];
}) {
  return (
    <div>
      {title && <div className="mb-3 text-sm font-medium">{title}</div>}
      <ResponsiveContainer width="100%" height={208}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={36} />
            <Tooltip cursor={{ fill: 'var(--accent)' }} contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={44} />
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={36} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={BRAND}
              strokeWidth={2}
              dot={{ r: 3, fill: BRAND, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="jr-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={36} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={BRAND}
              strokeWidth={2}
              fill="url(#jr-area)"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

interface Option {
  label: string;
  value: string;
}

export function Choices({ question, options }: { question?: string | null; options: Option[] }) {
  const respond = useRespond();
  // Guard against unresolved state bindings ({$state}) the model may emit.
  const opts = (options as unknown as Array<{ label?: unknown; value?: unknown }>).filter(
    (o): o is Option => typeof o?.label === 'string' && typeof o?.value === 'string',
  );
  if (opts.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {typeof question === 'string' && <div className="text-sm font-medium">{question}</div>}
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button
            type="button"
            key={o.value}
            onClick={() => respond(o.value)}
            className="cursor-pointer rounded-lg border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent active:scale-[0.98]"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
