import { Card } from "@/components/ui/card";
import { LinkData } from "./LinkCard";

interface PublicHeadingCardProps {
  link: LinkData;
}

export const PublicHeadingCard = ({ link }: PublicHeadingCardProps) => {
  const hasStyles = {
    ...(link.backgroundColor ? { backgroundColor: link.backgroundColor } : {}),
    ...(link.textColor ? { color: link.textColor } : {}),
    ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
  };

  return (
    <Card
      className="border-none bg-transparent shadow-none"
      style={hasStyles}
    >
      <div className="px-1">
        <h2
          className="text-lg font-bold leading-tight"
          style={{
            ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
          }}
        >
          {link.title || "Heading"}
        </h2>
        {link.description ? (
          <p
            className="mt-2 text-sm"
            style={{ ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}) }}
          >
            {link.description}
          </p>
        ) : null}
      </div>
    </Card>
  );
};
