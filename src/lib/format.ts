import type { OrderStatus } from "../types";

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(value);

export const formatCompactMoney = (value: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export const statusTone = (status: OrderStatus | "Reviewing") => {
  switch (status) {
    case "Completed":
    case "Delivered":
      return "success";
    case "Rejected":
      return "danger";
    case "Pending":
    case "Accepted":
    case "Paid":
    case "Packed":
    case "Out for Delivery":
      return "warning";
    default:
      return "neutral";
  }
};
