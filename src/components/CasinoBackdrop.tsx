import Image from "next/image";
import { CASINO_BACKGROUND_SRC } from "@/lib/critical-images";

export function CasinoBackdrop() {
  return (
    <div className="casino-backdrop" aria-hidden="true">
      <Image
        src={CASINO_BACKGROUND_SRC}
        alt=""
        width={1535}
        height={1413}
        priority
        unoptimized
        sizes="100vw"
      />
    </div>
  );
}
