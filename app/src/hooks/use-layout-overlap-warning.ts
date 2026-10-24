import { toast } from "@/hooks/use-toast";
import { useAppI18n } from "@/lib/i18n";

export function useLayoutOverlapWarning() {
  const { tr } = useAppI18n();
  return () => toast({
    title: tr("Change not applied: layout limit reached", "Modifica non applicata: limite del layout raggiunto"),
    description: tr(
      "There is not enough room to move the following elements within the page limits. The previous layout was kept. Move the element higher or make it smaller.",
      "Non c’è spazio per spostare gli elementi successivi entro i limiti della pagina. Il layout precedente è stato mantenuto. Sposta l’elemento più in alto o riducilo.",
    ),
    className: "page-layout-overlap-warning",
    duration: 4_000,
  });
}
