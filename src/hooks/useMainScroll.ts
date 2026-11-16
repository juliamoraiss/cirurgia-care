import { useEffect, useState } from "react";

/**
 * Acompanha a rolagem do <main> do Layout (é ele que rola, não a janela).
 * Retorna se passou de `threshold` px e a direção da última rolagem.
 */
export function useMainScroll(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("up");

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    let last = main.scrollTop;

    const onScroll = () => {
      const top = main.scrollTop;
      setScrolled(top > threshold);
      // Ignora tremidas pequenas (inércia do iOS)
      if (Math.abs(top - last) > 6) {
        setDirection(top > last && top > 0 ? "down" : "up");
        last = top;
      }
    };
    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return { scrolled, direction };
}
