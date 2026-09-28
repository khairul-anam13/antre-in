"use client";
// Port React/TS dari "iOS Design System" (window.IOS). Gaya ada di src/app/ios.css (salinan bundle.css).
// Ekstensi lokal (di luar DS): ikon tambahan, ListRow/NavigationBar dengan href, btnClass.
import Link from "next/link";
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

import { btnClass, cx } from "@/lib/ui";

/* ---------- Icon (garis 1.8px, kanvas 24px, seri dengan ikon DS) ---------- */
const ICONS = {
  home: ["M3.5 10.5 12 3.8l8.5 6.7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"],
  search: ["M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z", "M15.5 15.5 20.5 20.5"],
  star: ["M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"],
  person: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4.5 20.5c.6-3.6 3.6-5.5 7.5-5.5s6.9 1.9 7.5 5.5"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"],
  grid: ["M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z"],
  cup: ["M5 8h14", "M6.2 8l1.1 11.3a1.5 1.5 0 0 0 1.5 1.2h6.4a1.5 1.5 0 0 0 1.5-1.2L17.8 8", "M12.5 8 14 3.5h2.5"],
  bag: ["M5 8h14l-1 12H6z", "M9 8V6.5a3 3 0 0 1 6 0V8"],
  receipt: ["M6 3h12v18l-2.4-1.6L13.2 21 12 19.8 10.8 21 8.4 19.4 6 21z", "M9 8h6M9 12h6"],
  clock: ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M12 8v4.5l3 1.8"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  plus: ["M12 5v14M5 12h14"],
  minus: ["M5 12h14"],
  x: ["M6 6l12 12M18 6 6 18"],
  trash: ["M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"],
  bell: ["M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z", "M10 20.5a2 2 0 0 0 4 0"],
  logout: ["M10 4.5H5.5v15H10M14 8l4 4-4 4M18 12H9"],
  chart: ["M5 20V11M12 20V4M19 20v-6"],
  tag: ["M3.5 12.5V4.5h8l9 9-8 8z", "M7.5 8.5h.01"],
  calendar: ["M4.5 6.5h15v13h-15z", "M4.5 10.5h15", "M8.5 3.5v4", "M15.5 3.5v4"],
  edit: ["M4 20l1-4L16.5 4.5l3 3L8 19z"],
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className, size }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden width={size} height={size} className={className}>
      {ICONS[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ---------- Button ---------- */
type Variant = "filled" | "tinted" | "gray" | "plain";
type Size = "small" | "medium" | "large";

export function Button({ variant, size, destructive, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; destructive?: boolean }) {
  return <button type="button" {...rest} className={btnClass(variant, size, destructive, className)} />;
}

/* ---------- GlassCard ---------- */
export function GlassCard({ variant, eyebrow, title, className, children, ...rest }: { variant?: "regular" | "strong" | "subtle"; eyebrow?: string; title?: ReactNode; className?: string; children?: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("ios-card", variant && variant !== "regular" && `ios-card--${variant}`, className)}>
      {eyebrow && <p className="ios-card__eyebrow">{eyebrow}</p>}
      {title && <h3 className="ios-card__title">{title}</h3>}
      {typeof children === "string" ? <p className="ios-card__body">{children}</p> : children}
    </div>
  );
}

/* ---------- List / ListRow ---------- */
export function List({ header, footer, plain, className, children }: { header?: ReactNode; footer?: ReactNode; plain?: boolean; className?: string; children: ReactNode }) {
  return (
    <section className={cx("ios-list", plain && "ios-list--plain", className)}>
      {header && <div className="ios-list__header">{header}</div>}
      <div className="ios-list__body" role="list">{children}</div>
      {footer && <div className="ios-list__footer">{footer}</div>}
    </section>
  );
}

const chevron = (
  <svg className="ios-row__chevron" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1.5 1.5 6.5 7l-5 5.5" /></svg>
);
const checkGlyph = (
  <svg className="ios-row__check" viewBox="0 0 15 14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1.5 7.5 5.5 12 13.5 2" /></svg>
);

export function ListRow({ title, subtitle, detail, icon, iconColor, accessory, onClick, href, destructive, action, className, children }: {
  title: ReactNode; subtitle?: ReactNode; detail?: ReactNode; icon?: ReactNode; iconColor?: string;
  accessory?: "chevron" | "check" | "none" | ReactNode; onClick?: () => void; href?: string; destructive?: boolean; action?: boolean; className?: string; children?: ReactNode;
}) {
  const acc = accessory === "chevron" ? chevron : accessory === "check" ? checkGlyph : accessory && accessory !== "none" ? accessory : null;
  const tappable = !!(onClick || href);
  const cls = cx("ios-row", tappable && "ios-row--tappable", destructive && "ios-row--destructive", action && "ios-row--action", className);
  const body = (
    <>
      {icon && <span className="ios-row__icon" style={{ background: `var(--${iconColor ?? "system-blue"})` }}>{icon}</span>}
      <div className="ios-row__main">
        <div className="ios-row__text">
          <div className="ios-row__title">{title}</div>
          {subtitle && <div className="ios-row__subtitle">{subtitle}</div>}
          {children}
        </div>
        {detail != null && <span className="ios-row__detail">{detail}</span>}
        {acc}
      </div>
    </>
  );
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <div role="listitem" className={cls}>{body}</div>;
}

/* ---------- Switch ---------- */
export function Switch({ checked, defaultChecked, onChange, disabled, ...aria }: { checked?: boolean; defaultChecked?: boolean; onChange?: (v: boolean) => void; disabled?: boolean; "aria-label"?: string }) {
  const [inner, setInner] = useState(!!defaultChecked);
  const on = checked ?? inner;
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} aria-label={aria["aria-label"]} className="ios-switch"
      onClick={() => { if (checked === undefined) setInner(!on); onChange?.(!on); }} />
  );
}

/* ---------- SegmentedControl ---------- */
export function SegmentedControl<T extends string>({ options, value, defaultValue, onChange, ...aria }: { options: (T | { value: T; label: ReactNode })[]; value?: T; defaultValue?: T; onChange?: (v: T) => void; "aria-label"?: string }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const [inner, setInner] = useState<T | undefined>(defaultValue ?? opts[0]?.value);
  const cur = value ?? inner;
  return (
    <div className="ios-seg" role="tablist" aria-label={aria["aria-label"]}>
      {opts.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === cur} className="ios-seg__item"
          onClick={() => { if (value === undefined) setInner(o.value); onChange?.(o.value); }}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- NavigationBar ---------- */
const backGlyph = (
  <svg viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 2 2 10l8 8" /></svg>
);
export function NavigationBar({ title, large, leading, trailing, backLabel, backHref, onBack, className }: {
  title: ReactNode; large?: boolean; leading?: ReactNode; trailing?: ReactNode; backLabel?: string; backHref?: string; onBack?: () => void; className?: string;
}) {
  let lead = leading;
  if (backLabel && backHref) lead = <Link href={backHref} className="ios-nav__back">{backGlyph}{backLabel}</Link>;
  else if (backLabel) lead = <button type="button" className="ios-nav__back" onClick={onBack}>{backGlyph}{backLabel}</button>;
  return (
    <header className={cx("ios-nav", large && "ios-nav--large", className)}>
      <div className="ios-nav__bar">
        <div className="ios-nav__side">{lead}</div>
        {!large && <div className="ios-nav__title">{title}</div>}
        <div className="ios-nav__side ios-nav__side--trailing">{trailing}</div>
      </div>
      {large && <h1 className="ios-nav__large">{title}</h1>}
    </header>
  );
}

/* ---------- SearchField ---------- */
export function SearchField({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx("ios-search", className)}>
      <Icon name="search" />
      <input type="search" placeholder="Cari" {...rest} />
    </label>
  );
}

/* ---------- Alert ---------- */
export function Alert({ title, message, actions = [{ label: "OK", style: "cancel" }], className }: {
  title: ReactNode; message?: ReactNode; actions?: { label: string; style?: "cancel" | "destructive"; onPress?: () => void }[]; className?: string;
}) {
  return (
    <div className={cx("ios-alert", className)} role="alertdialog" aria-label={typeof title === "string" ? title : undefined}>
      <div className="ios-alert__content">
        <p className="ios-alert__title">{title}</p>
        {message && <p className="ios-alert__message">{message}</p>}
      </div>
      <div className={cx("ios-alert__actions", actions.length > 2 && "ios-alert__actions--stacked")}>
        {actions.map((a, i) => (
          <button key={i} type="button" onClick={a.onPress} className={cx("ios-alert__btn", a.style && `ios-alert__btn--${a.style}`)}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}
