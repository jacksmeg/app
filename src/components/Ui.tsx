import type { PropsWithChildren } from "react";
import { formatMoney, statusTone } from "../lib/format";
import type { OrderStatus, Product } from "../types";

export const SectionCard = ({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  action?: string;
  className?: string;
}>) => (
  <section className={`section-card ${className}`.trim()}>
    <header className="section-head">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {action ? <span className="section-action">{action}</span> : null}
    </header>
    {children}
  </section>
);

export const MetricCard = ({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "accent" | "success" | "neutral";
}) => (
  <article className={`metric-card metric-${tone}`}>
    <span className="metric-label">{label}</span>
    <strong>{value}</strong>
    <p>{detail}</p>
  </article>
);

export const ProductArt = ({ product }: { product: Product }) => (
  <div
    className="product-art"
    style={{
      background: product.imageUrl
        ? `linear-gradient(rgba(15, 20, 25, 0.15), rgba(15, 20, 25, 0.25)), url(${product.imageUrl}) center/cover`
        : `linear-gradient(135deg, ${product.palette[0]}, ${product.palette[1]})`,
    }}
  >
    <span>{product.artLabel}</span>
    <strong>{product.name.split(" ")[0]}</strong>
    <div className="art-orb" />
  </div>
);

export const TonePill = ({
  label,
  tone,
}: {
  label: string;
  tone: ReturnType<typeof statusTone> | "accent";
}) => <span className={`tone-pill tone-${tone}`}>{label}</span>;

export const Timeline = ({
  trail,
  current,
}: {
  trail: Array<OrderStatus | "Reviewing">;
  current: OrderStatus | "Reviewing";
}) => (
  <div className="timeline">
    {trail.map((step) => (
      <div key={`${current}-${step}`} className={`timeline-step ${step === current ? "current" : ""}`}>
        <span />
        <small>{step}</small>
      </div>
    ))}
  </div>
);

export const PriceLine = ({
  label,
  amount,
  emphasis = false,
}: {
  label: string;
  amount: number;
  emphasis?: boolean;
}) => (
  <div className={`price-line ${emphasis ? "price-line-strong" : ""}`}>
    <span>{label}</span>
    <strong>{formatMoney(amount)}</strong>
  </div>
);
