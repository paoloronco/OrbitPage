import type { LinkData } from "./LinkCard";
import { getSeparatorData } from "@/lib/link-blocks";
import { getPublicBlockPadding, getPublicBlockStyle } from "@/lib/public-block-style";

export const PublicSeparatorCard = ({ link }: { link: LinkData }) => {
  const { boxed } = getSeparatorData(link.content);
  const style = getPublicBlockStyle({ ...link, backgroundColor: boxed ? link.backgroundColor : undefined });

  return (
    <div
      className={`public-separator ${boxed ? `rounded-md border border-current/15 ${getPublicBlockPadding(link.size)}` : "public-unboxed-block public-block-content border border-transparent py-1"} flex items-center gap-3`}
      data-alignment={link.alignment || "left"}
      style={style}
    >
      <div className="h-px flex-1 bg-current opacity-25" />
      {link.title && (
        <span
          className="text-xs font-semibold uppercase tracking-widest text-current opacity-75"
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
