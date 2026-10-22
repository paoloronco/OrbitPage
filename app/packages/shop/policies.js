export const SHOP_POLICIES = [
    { slug: "terms", title: "Terms", textField: "termsText", urlField: "termsUrl" },
    { slug: "digital-license", title: "Digital Product & License Terms", textField: "digitalLicenseText", urlField: "digitalLicenseUrl" },
    { slug: "privacy", title: "Privacy policy", textField: "privacyText", urlField: "privacyUrl" },
    { slug: "cookies", title: "Cookie policy", textField: "cookiePolicyText", urlField: "cookiePolicyUrl" },
    { slug: "refunds", title: "Refund policy", textField: "refundPolicyText", urlField: "refundPolicyUrl" },
    { slug: "withdrawal", title: "Withdrawal and contact", textField: "withdrawalText", urlField: "withdrawalUrl" },
];
export function shopPolicies(appearance, shopUrl) {
    return SHOP_POLICIES.filter((policy) => appearance[policy.textField] || appearance[policy.urlField]).map((policy) => ({
        ...policy,
        text: appearance[policy.textField],
        url: appearance[policy.textField]
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
