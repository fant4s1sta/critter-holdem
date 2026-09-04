import { ANIMAL_AVATAR_SRCS, ANIMAL_STANDEE_SRCS } from "@/lib/animal-display";
import { BRAND_LOGO_WEBP_SRC } from "@/lib/critical-images";

const EARLY_PRELOAD_SRCS = [
  BRAND_LOGO_WEBP_SRC,
  ...ANIMAL_AVATAR_SRCS,
  ...ANIMAL_STANDEE_SRCS,
];

export function CriticalImagePreload() {
  const preloadScript = `(function(){${JSON.stringify(EARLY_PRELOAD_SRCS)}.forEach(function(s){var i=new Image();i.decoding="sync";i.src=s;});})();`;

  return (
    <>
      <link
        rel="preload"
        href="/brand-logo.webp"
        as="image"
        type="image/webp"
        fetchPriority="high"
      />
      {ANIMAL_AVATAR_SRCS.slice(0, 4).map((src) => (
        <link key={src} rel="preload" href={src} as="image" type="image/webp" />
      ))}
      {ANIMAL_STANDEE_SRCS.slice(0, 4).map((src) => (
        <link key={src} rel="preload" href={src} as="image" type="image/webp" />
      ))}
      <script dangerouslySetInnerHTML={{ __html: preloadScript }} />
    </>
  );
}
