export const SHOP_POLICIES = [
    { slug: "terms", title: "Terms", textField: "termsText", urlField: "termsUrl", footerField: "showTermsInFooter" },
    { slug: "digital-license", title: "Digital Product & License Terms", textField: "digitalLicenseText", urlField: "digitalLicenseUrl", footerField: "showDigitalLicenseInFooter" },
    { slug: "privacy", title: "Privacy policy", textField: "privacyText", urlField: "privacyUrl", footerField: "showPrivacyInFooter" },
    { slug: "cookies", title: "Cookie policy", textField: "cookiePolicyText", urlField: "cookiePolicyUrl", footerField: "showCookiesInFooter" },
    { slug: "refunds", title: "Refund policy", textField: "refundPolicyText", urlField: "refundPolicyUrl", footerField: "showRefundsInFooter" },
    { slug: "withdrawal", title: "Withdrawal and contact", textField: "withdrawalText", urlField: "withdrawalUrl", footerField: "showWithdrawalInFooter" },
];
export function shopPolicies(appearance, shopUrl) {
    return SHOP_POLICIES.filter((policy) => policy.slug === "terms" || appearance[policy.textField] || appearance[policy.urlField]).map((policy) => ({
        ...policy,
        text: policy.slug === "terms"
            ? ["The page owner is the seller; OrbitPage provides the shop software.", appearance[policy.textField]].filter(Boolean).join("\n\n")
            : appearance[policy.textField],
        url: policy.slug === "terms" || appearance[policy.textField]
            ? `${shopUrl}/legal#${policy.slug}`
            : appearance[policy.urlField],
    }));
}
export function shopSellerNotice(appearance) {
    const core = appearance.sellerType === "private"
        ? "I understand that the page owner has declared they are a private seller. My legal rights depend on applicable law; this acknowledgement does not waive rights that cannot legally be waived."
        : "I understand that the page owner is the seller. Any seller policies shown on this page apply; my statutory rights are not waived.";
    return [core, appearance.sellerNoticeAddon].filter(Boolean).join(" ");
}
export function shopDigitalContentConsent(appearance) {
    const core = "I expressly consent to immediate supply of the digital content and acknowledge that I lose my withdrawal right once the download begins.";
    return [core, appearance.digitalContentConsentAddon].filter(Boolean).join(" ");
}

export function shopCheckoutAcknowledgements(appearance, productType) {
    return (appearance.checkoutAcknowledgements || []).filter(item => item.appliesTo === "all" || item.appliesTo === productType);
}

export function shopBuyerAcknowledgements(appearance, productType, accepted = []) {
    const items = shopCheckoutAcknowledgements(appearance, productType);
    if (!Array.isArray(accepted) || accepted.length > 5 || new Set(accepted).size !== accepted.length
        || accepted.some(id => typeof id !== "string" || !items.some(item => item.id === id))) {
        throw new Error("Invalid checkout acknowledgements. Reload the product and try again.");
    }
    if (items.some(item => item.required && !accepted.includes(item.id))) {
        throw new Error("Accept the required purchase acknowledgements before checkout.");
    }
    return items.map(item => ({ ...item, accepted: accepted.includes(item.id) }));
}
