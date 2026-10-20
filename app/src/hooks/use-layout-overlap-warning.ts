import { toast } from "@/hooks/use-toast";
import { useAppI18n } from "@/lib/i18n";

export function useLayoutOverlapWarning() {
  const { tr } = useAppI18n();
  return () => toast({
    title: tr("Change not applied: space occupied", "Modifica non applicata: spazio occupato"),
    description: tr(
      "This position or size would overlap another element. The previous layout was kept. Move the element to a free area or make it smaller.",
      "Questa posizione o dimensione si sovrapporrebbe a un altro elemento. Il layout precedente è stato mantenuto. Sposta l’elemento in uno spazio libero o riducilo.",
    ),
    className: "page-layout-overlap-warning",
    duration: 4_000,
  });
}
