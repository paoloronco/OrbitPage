import type { LinkData } from "./LinkCard";

export const PublicSeparatorCard = ({ link }: { link: LinkData }) => (
  <div className="flex items-center gap-3 py-1">
    <div className="h-px flex-1 bg-primary/20" />
    {link.title && (
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2">
        {link.title}
      </span>
    )}
    <div className="h-px flex-1 bg-primary/20" />
  </div>
);
