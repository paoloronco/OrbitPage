export const SHOP_SUMMARY_LIMIT: 240;
export const SHOP_DESCRIPTION_LIMIT: 6000;
export function shopProductSummary(product: { summary?: string; description?: string }): string;
export function renderShopDescription(value: string): string;
