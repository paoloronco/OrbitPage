import type { LinkData } from "./LinkCard";
import { getSeparatorData } from "@/lib/link-blocks";
import { getPublicBlockPadding } from "@/lib/public-block-style";

export const PublicSeparatorCard = ({ link }: { link: LinkData }) => {
  const { boxed } = getSeparatorData(link.content);
  const style = {
    ...(boxed && link.backgroundColor ? { backgroundColor: link.backgroundColor } : {}),
    ...(link.textColor ? { color: link.textColor } : {}),
    ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
    ...(link.alignment ? { textAlign: link.alignment } : {}),
  };

  return (
    <div
      className={`${boxed ? `rounded-md border border-current/15 ${getPublicBlockPadding(link.size)}` : "py-1"} flex items-center gap-3`}
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
