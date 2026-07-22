import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { getPublicBlockStyle } from "@/lib/public-block-style";

interface PublicHeadingCardProps {
  link: LinkData;
}

export const PublicHeadingCard = ({ link }: PublicHeadingCardProps) => {
  const headingStyles = getPublicBlockStyle(link);

  return (
    <Card
      className="public-unboxed-block border-none bg-transparent px-0 py-2 shadow-none"
      style={headingStyles}
    >
      <div className="px-1">
        <div className="mb-3 h-px w-full bg-gradient-to-r from-primary/45 via-primary/15 to-transparent" />
        <h2
          className="text-xl font-bold leading-tight"
          style={{
            ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
          }}
        >
          {link.title || "Heading"}
        </h2>
        {link.description ? (
          <p
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
            style={{
              ...(link.textColor ? { color: link.textColor, opacity: 0.78 } : {}),
              ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}),
              ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}),
            }}
          >
            {link.description}
          </p>
        ) : null}
      </div>
    </Card>
  );
};
