export const SHOP_SUMMARY_LIMIT = 240;
export const SHOP_DESCRIPTION_LIMIT = 6000;
export function shopProductSummary(product) {
    return (product.summary || (product.description || "").replace(/[#*]/g, "").replace(/\s+/g, " ").trim()).slice(0, SHOP_SUMMARY_LIMIT);
}
// Escape before applying the deliberately small Markdown vocabulary; raw HTML is never accepted.
export function renderShopDescription(value) {
    return value.split("\n").map((line) => {
        const escaped = line.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]))
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
        if (escaped.startsWith("## "))
            return `<h2>${escaped.slice(3)}</h2>`;
        if (escaped.startsWith("- "))
            return `<p class="list-item">• ${escaped.slice(2)}</p>`;
        return `<p>${escaped || "&nbsp;"}</p>`;
    }).join("");
}
