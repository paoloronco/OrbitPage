import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LinkData } from './LinkCard';

export const ClickAnalyticsChart = ({ links }: { links: LinkData[] }) => {
  const data = links
    .filter(l => l.type !== 'separator' && (l.clickCount ?? 0) > 0)
    .map(l => ({
      name: (l.title || 'Untitled').length > 18 ? (l.title || 'Untitled').slice(0, 18) + '…' : (l.title || 'Untitled'),
      clicks: l.clickCount ?? 0,
      id: l.id,
    }));

  if (data.length === 0) {
    return <p className="text-center text-muted-foreground text-sm py-8">No clicks recorded yet. Share your public page to start collecting analytics.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => [v, 'Clicks']} />
        <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
