import { SHOP_SUMMARY_LIMIT, SHOP_DESCRIPTION_LIMIT } from "./description.js";
export function isSafeShopBookingUrl(value) {
    if (!value)
        return true;
    try {
        const url = new URL(value);
        return url.protocol === "https:"
            && !url.username
            && !url.password
            && (!url.port || url.port === "443");
    }
    catch {
        return false;
    }
}
// Keep both backends on one contract while preserving their Zod errors and upload policy.
export function createShopSchemas(z, isOwnedLogo) {
    const shopAiDraftSchema = z.object({
        productId: z.string().uuid(), type: z.enum(["digital", "service"]),
        title: z.string().trim().min(2).max(90), description: z.string().trim().min(2).max(SHOP_DESCRIPTION_LIMIT),
        priceCents: z.number().int().min(100).max(1_000_000)
    }).strict();
    const shopProductCardStyleStorageSchema = z.object({
        backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().default(null),
        textColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().default(null),
        surfaceEffect: z.enum(["inherit", "solid", "transparent", "liquid-glass"]).default("inherit"),
        alignment: z.enum(["inherit", "left", "center"]).default("inherit")
    });
    const shopProductCardStyleInputSchema = shopProductCardStyleStorageSchema.strict();
    const shopProductInputSchema = z.object({
        productId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),
        type: z.enum(["digital", "service"]),
        title: z.string().trim().min(2).max(90),
        summary: z.string().trim().max(SHOP_SUMMARY_LIMIT).default(""),
        description: z.string().trim().min(2).max(SHOP_DESCRIPTION_LIMIT),
        fulfillmentText: z.string().trim().max(2_000).default(""),
        bookingUrl: z.string().trim().max(2_048).refine(isSafeShopBookingUrl, "Enter a secure HTTPS booking URL.").default(""),
        sessionsIncluded: z.number().int().min(1).max(50).default(1),
        intakeQuestions: z.array(z.object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
            prompt: z.string().trim().min(2).max(200),
            required: z.boolean().default(false)
        }).strict()).max(12).default([]),
        priceCents: z.number().int().min(100).max(1_000_000),
        active: z.boolean().default(false),
        removedFileIds: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(10).default([]),
        cardStyle: shopProductCardStyleInputSchema.default({
            backgroundColor: null,
            textColor: null,
            surfaceEffect: "inherit",
            alignment: "inherit"
        })
    }).strict().superRefine((input, context) => {
        if (input.active && input.type === "service" && !input.fulfillmentText && !input.bookingUrl) {
            context.addIssue({
                code: "custom",
                path: ["bookingUrl"],
                message: "Add a booking URL or post-payment instructions."
            });
        }
    });
    const DEFAULT_SHOP_DESCRIPTION = "";
    const DEFAULT_SHOP_HOME_DESCRIPTION = "Discover products and services.";
    const LEGACY_ENGLISH_SHOP_DESCRIPTION = "Digital products and services, available for secure purchase.";
    const LEGACY_ITALIAN_SHOP_DESCRIPTION = "Prodotti digitali e servizi, acquistabili in modo sicuro.";
    const LEGACY_SHOP_DESCRIPTIONS = new Set([
        LEGACY_ENGLISH_SHOP_DESCRIPTION,
        LEGACY_ITALIAN_SHOP_DESCRIPTION,
        "المنتجات والخدمات الرقمية، متاحة للشراء الآمن.",
        "Digitale Produkte und Dienstleistungen, die zum sicheren Kauf verfügbar sind.",
        "Productos y servicios digitales, disponibles para compra segura.",
        "Produits et services numériques, disponibles pour un achat sécurisé.",
        "デジタル製品とサービスを安全に購入できます。",
        "디지털 제품 및 서비스를 안전하게 구매할 수 있습니다.",
        "Digitale producten en diensten, beschikbaar voor veilige aankoop.",
        "Cyfrowe produkty i usługi dostępne do bezpiecznego zakupu.",
        "Produtos e serviços digitais, disponíveis para compra segura.",
        "Цифровые продукты и услуги, доступные для безопасной покупки.",
        "Güvenli satın alınabilecek dijital ürünler ve hizmetler.",
        "数字产品和服务，可安全购买。"
    ]);
    const LEGACY_ITALIAN_SHOP_HOME_DESCRIPTION = "Scopri prodotti e servizi.";
    const LEGACY_SHOP_HOME_DESCRIPTIONS = new Set([
        LEGACY_ITALIAN_SHOP_HOME_DESCRIPTION,
        "اكتشف المنتجات والخدمات.",
        "Entdecken Sie Produkte und Dienstleistungen.",
        "Descubra productos y servicios.",
        "Découvrez les produits et services.",
        "製品とサービスを発見してください。",
        "제품과 서비스를 찾아보세요.",
        "Ontdek producten en diensten.",
        "Odkryj produkty i usługi.",
        "Descubra produtos e serviços.",
        "Откройте для себя продукты и услуги.",
        "Ürün ve hizmetleri keşfedin.",
        "发现产品和服务。"
    ]);
    const shopAppearanceStorageSchema = z.object({
        locale: z.enum(["en", "it", "es", "fr", "de", "pt", "nl", "pl", "tr", "ru", "ar", "zh", "ja", "ko"]).default("en"),
        title: z.string().trim().max(80).default("Shop"),
        description: z.string().trim().max(320).default(DEFAULT_SHOP_DESCRIPTION),
        showTitle: z.boolean().default(true),
        showDescription: z.boolean().default(true),
        titleFontFamily: z.string().trim().min(1).max(120).regex(/^[a-z0-9\s,"'-]+$/i).nullable().default(null),
        titleFontSize: z.number().int().min(10).max(96).nullable().default(null),
        titleFontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]).default(800),
        titleColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().default(null),
        descriptionFontFamily: z.string().trim().min(1).max(120).regex(/^[a-z0-9\s,"'-]+$/i).nullable().default(null),
        descriptionFontSize: z.number().int().min(10).max(48).nullable().default(null),
        descriptionFontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]).default(400),
        descriptionColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().default(null),
        logoUrl: z.string().max(2048).refine((value) => !value || isOwnedLogo(value), "Choose an uploaded Shop logo.").default(""),
        backLinkLabel: z.string().trim().min(1).max(70).default("Back to the page"),
        backLinkDescription: z.string().trim().max(180).transform(() => "").default(""),
        inheritPageTheme: z.boolean().default(true),
        pageBackground: z.string().regex(/^#[0-9a-f]{6}$/i).default("#f4f7fb"),
        textColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#0c1528"),
        mutedColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#5f6d83"),
        accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#3568f4"),
        buttonTextColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#ffffff"),
        cardBackground: z.string().regex(/^#[0-9a-f]{6}$/i).default("#ffffff"),
        cardTextColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#0c1528"),
        borderColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#d8dfeb"),
        cardEffect: z.enum(["solid", "transparent", "liquid-glass"]).default("solid"),
        cardOpacity: z.number().min(0).max(1).default(1),
        cardRadius: z.number().int().min(0).max(32).default(8),
        shadowIntensity: z.number().int().min(0).max(100).default(18),
        layout: z.enum(["grid", "list"]).default("grid"),
        alignment: z.enum(["left", "center"]).default("left"),
        showProductType: z.boolean().default(true),
        newsletterEnabled: z.boolean().default(false),
        homeLinkEnabled: z.boolean().default(false),
        homeLinkTitle: z.string().trim().min(1).max(70).default("Shop"),
        homeLinkDescription: z.string().trim().max(180).default(DEFAULT_SHOP_HOME_DESCRIPTION),
        sellerType: z.enum(["unset", "trader", "private"]).default("unset"),
        sellerName: z.string().trim().max(120).default(""),
        sellerEmail: z.union([z.literal(""), z.string().trim().toLowerCase().max(254).email()]).default(""),
        sellerPhone: z.string().trim().max(30).refine((value) => !value || /^[+0-9().\s-]{6,30}$/.test(value), "Enter a valid public contact phone number.").default(""),
        sellerAddress: z.string().trim().max(300).default(""),
        sellerBusinessId: z.string().trim().max(120).default(""),
        termsText: z.string().trim().max(6_000).default(""),
        digitalLicenseText: z.string().trim().max(6_000).default(""),
        privacyText: z.string().trim().max(6_000).default(""),
        cookiePolicyText: z.string().trim().max(6_000).default(""),
        refundPolicyText: z.string().trim().max(6_000).default(""),
        withdrawalText: z.string().trim().max(6_000).default(""),
        termsUrl: z.string().trim().max(2_048).refine(isSafeShopBookingUrl, "Enter a secure HTTPS terms URL.").default(""),
        digitalLicenseUrl: z.string().trim().max(2_048).refine(isSafeShopBookingUrl, "Enter a secure HTTPS digital license URL.").default(""),
        privacyUrl: z.string().trim().max(2_048).refine(isSafeShopBookingUrl, "Enter a secure HTTPS privacy URL.").default(""),
        cookiePolicyUrl: z.string().trim().max(2_048).refine(isSafeShopBookingUrl, "Enter a secure HTTPS cookie policy URL.").default(""),
        refundPolicyUrl: z.string().trim().max(2_048).refine(isSafeShopBookingUrl, "Enter a secure HTTPS refund policy URL.").default(""),
        withdrawalUrl: z.string().trim().max(2_048).refine(isSafeShopBookingUrl, "Enter a secure HTTPS withdrawal URL.").default(""),
        sellerSelfCertified: z.boolean().default(false),
        checkout: z.object({
            phone: z.boolean().default(false),
            billingAddress: z.enum(["auto", "required"]).default("auto"),
            businessName: z.enum(["off", "optional", "required"]).default("off"),
            taxId: z.enum(["off", "optional", "if_supported"]).default("off"),
            customFields: z.array(z.object({
                key: z.string().regex(/^[a-zA-Z0-9]{1,200}$/),
                label: z.string().trim().min(1).max(50),
                type: z.enum(["text", "numeric"]),
                required: z.boolean()
            }).strict()).max(3).refine(fields => new Set(fields.map(field => field.key)).size === fields.length, "Each checkout field must have a unique key.").default([])
        }).strict().default({ phone: false, billingAddress: "auto", businessName: "off", taxId: "off", customFields: [] })
    });
    const shopAppearanceInputSchema = shopAppearanceStorageSchema.strict();
    function normalizeShopAppearance(value) {
        const rawCandidate = value && typeof value === "object" && !Array.isArray(value)
            ? value
            : {};
        const isLegacyItalianAppearance = rawCandidate.locale === undefined && (rawCandidate.description === LEGACY_ITALIAN_SHOP_DESCRIPTION
            || rawCandidate.homeLinkDescription === LEGACY_ITALIAN_SHOP_HOME_DESCRIPTION);
        const candidate = isLegacyItalianAppearance ? { ...rawCandidate, locale: "it" } : rawCandidate;
        const parsed = shopAppearanceStorageSchema.safeParse(candidate);
        const appearance = parsed.success ? parsed.data : shopAppearanceStorageSchema.parse({});
        return {
            ...appearance,
            description: LEGACY_SHOP_DESCRIPTIONS.has(appearance.description) ? "" : appearance.description,
            homeLinkDescription: LEGACY_SHOP_HOME_DESCRIPTIONS.has(appearance.homeLinkDescription)
                ? DEFAULT_SHOP_HOME_DESCRIPTION
                : appearance.homeLinkDescription
        };
    }
    function normalizeShopProductCardStyle(value) {
        const candidate = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        const parsed = shopProductCardStyleStorageSchema.safeParse(candidate);
        return parsed.success ? parsed.data : shopProductCardStyleStorageSchema.parse({});
    }
    return { shopAiDraftSchema, shopProductInputSchema, shopAppearanceInputSchema, normalizeShopAppearance, normalizeShopProductCardStyle };
}

export function shopComplianceReady(appearance) {
    return Boolean(appearance?.sellerSelfCertified && appearance.sellerType !== "unset"
        && appearance.sellerName?.trim() && appearance.sellerEmail?.trim()
        && (appearance.sellerType !== "trader" || appearance.sellerAddress?.trim())
        && (appearance.termsText?.trim() || appearance.termsUrl?.trim())
        && (appearance.privacyText?.trim() || appearance.privacyUrl?.trim())
        && (appearance.refundPolicyText?.trim() || appearance.refundPolicyUrl?.trim())
        && (appearance.withdrawalText?.trim() || appearance.withdrawalUrl?.trim()));
}
