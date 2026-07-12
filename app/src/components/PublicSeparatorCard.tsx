import type { LinkData } from "./LinkCard";
import { getPublicBlockPadding, getPublicBlockStyle } from "@/lib/public-block-style";

export const PublicSeparatorCard = ({ link }: { link: LinkData }) => {
  const hasPanel = Boolean(link.backgroundColor);
  const style = getPublicBlockStyle(link);

  return (
    <div
      className={`${hasPanel ? `rounded-md ${getPublicBlockPadding(link.size)}` : "py-1"} flex items-center gap-3`}
      style={style}
    >
      <div className="h-px flex-1 bg-current opacity-25" />
      {link.title && (
        <span
          className="px-2 text-xs font-semibold uppercase tracking-widest text-current opacity-75"
          style={{
            ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
            ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
          }}
        >
          {link.title}
        </span>
      )}
      <div className="h-px flex-1 bg-current opacity-25" />
    </div>
  );
};
