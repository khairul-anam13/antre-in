// Helper kelas CSS DS yang netral (dipakai server & client component). Komponen React DS ada di components/ios.tsx.
type Variant = "filled" | "tinted" | "gray" | "plain";
type Size = "small" | "medium" | "large";

export const cx = (...a: unknown[]) => a.filter(Boolean).join(" ");

/** Kelas .ios-btn untuk tautan/tombol biasa, mis. <a className={btnClass("filled","large")}>. */
export const btnClass = (variant: Variant = "filled", size: Size = "medium", destructive?: boolean, extra?: string) =>
  cx("ios-btn", `ios-btn--${variant}`, `ios-btn--${size}`, destructive && "ios-btn--destructive", extra);
