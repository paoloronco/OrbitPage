import type { LinkData } from "./LinkCard";
import { getSeparatorData } from "@/lib/link-blocks";
import { getPublicBlockPadding, getPublicBlockStyle } from "@/lib/public-block-style";

export const PublicSeparatorCard = ({ link }: { link: LinkData }) => {
  const { boxed, linePosition = "inline" } = getSeparatorData(link.content);
  const alignment = link.alignment || "left";
  const style = getPublicBlockStyle({ ...link, backgroundColor: boxed ? link.backgroundColor : undefined });

  return (
    <div
      className={`public-separator ${boxed ? `rounded-md border border-current/15 ${getPublicBlockPadding(link.size)}` : "public-unboxed-block public-block-content border border-transparent py-1"} flex items-center gap-3`}
      data-alignment={alignment}
      data-line-position={linePosition}
      style={style}
    >
      {(!link.title || linePosition !== "inline" || alignment !== "left") && <div className="public-separator__line" aria-hidden="true" />}
      {link.title && (
        <span
          className="public-separator__title text-xs font-semibold uppercase tracking-widest text-current opacity-75"
          style={{
            ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
            ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
          }}
        >
          {link.title}
        </span>
      )}
      {link.title && linePosition === "inline" && alignment !== "right" && <div className="public-separator__line" aria-hidden="true" />}
    </div>
  );
};
