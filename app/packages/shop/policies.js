export const SHOP_POLICIES = [
    { slug: "terms", title: "Terms", textField: "termsText", urlField: "termsUrl" },
    { slug: "digital-license", title: "Digital Product & License Terms", textField: "digitalLicenseText", urlField: "digitalLicenseUrl" },
    { slug: "privacy", title: "Privacy policy", textField: "privacyText", urlField: "privacyUrl" },
    { slug: "cookies", title: "Cookie policy", textField: "cookiePolicyText", urlField: "cookiePolicyUrl" },
    { slug: "refunds", title: "Refund policy", textField: "refundPolicyText", urlField: "refundPolicyUrl" },
    { slug: "withdrawal", title: "Withdrawal and contact", textField: "withdrawalText", urlField: "withdrawalUrl" },
];
export function shopPolicies(appearance, shopUrl) {
    return SHOP_POLICIES.map((policy) => ({
        ...policy,
        text: appearance[policy.textField],
        url: appearance[policy.textField]
            ? `${shopUrl}/legal#${policy.slug}`
            : appearance[policy.urlField] || `${shopUrl}/legal/${policy.slug}`,
    }));
}
