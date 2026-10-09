export function shopOrderLabel(order) {
  return Number.isSafeInteger(order.orderNumber) && order.orderNumber > 0
    ? `#${String(order.orderNumber).padStart(6, "0")}`
    : `#${order.orderId.slice(0, 8).toUpperCase()}`;
}
