import { Card } from "@/components/ui/card";
import { LinkData } from "./LinkCard";
import { getSocialRowData } from "@/lib/link-blocks";

interface PublicSocialRowCardProps {
  link: LinkData;
}

export const PublicSocialRowCard = ({ link }: PublicSocialRowCardProps) => {
  const { items } = getSocialRowData(link.content);

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="glass-card">
      <div className="space-y-2">
        <p className="font-semibold text-sm text-muted-foreground">
          {link.title || "Social links"}
        </p>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <a
              key={`${item.label}-${item.url}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-primary/5 hover:border-primary/40"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
};

