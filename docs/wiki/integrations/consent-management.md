# Consent management

**Privacy** can use OrbitPage's built-in banner or an external consent-management platform (CMP). Choose one banner. OrbitPage reads the supported provider's visitor choices to control analytics and optional embeds.

![Privacy settings and consent controls in the dashboard](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-analytics-and-privacy-4.21.75.gif)

## Configure an external provider

1. Configure your site in the CMP account using the public domain visitors will open.
2. Open **Privacy → Consent banner**, enable consent management and select the external provider option.
3. Choose the provider and enter its installation field below.
4. Set privacy and cookie policies under **Privacy → Documents**, then **Save**.
5. Test the saved public page in a private browser window.

A policy link or policy embed is separate from the banner installation. Languages, regional rules and provider subscriptions are managed with the CMP.

## Supported CMPs

### iubenda

In iubenda, open **Manage and Embed** for your site. Copy the complete **Privacy Controls and Cookie Solution** installation snippet into OrbitPage's iubenda snippet field. Keep the configuration and loader together; a privacy-policy link alone does not install the banner.

OrbitPage maps purposes **2 or 3 → Preferences**, **4 → Analytics**, **5 → Marketing**. Existing installations using site and cookie-policy IDs remain supported; the dashboard uses the complete snippet for new configurations.

[Find the iubenda installation snippet](https://www.iubenda.com/en/help/1209-how-to-use-the-cookie-solution-in-a-multilingual-wordpress-site/).

### CookieYes

Open the site's installation code in CookieYes. Find the identifier between `/client_data/` and `/script.js` in the script URL. Paste only that value into **CookieYes script ID**, then save.

OrbitPage loads the provider's script and maps **functional → Preferences**, **analytics → Analytics**, **advertisement → Marketing**.

[CookieYes installation code](https://www.cookieyes.com/documentation/banner-installation-code/).

### Cookiebot

Copy the `data-cbid` value from the installation code for your Cookiebot domain group. Paste it into **Cookiebot CBID**, then save. This is the public installation identifier, not a Cookiebot API key.

OrbitPage loads Cookiebot with automatic blocking enabled and maps **preferences → Preferences**, **statistics → Analytics**, **marketing → Marketing**.

[Cookiebot identifiers and categories](https://www.cookiebot.com/en/developer/).

### OneTrust

Publish the banner configuration in OneTrust. Copy `data-domain-script` from its installation code into **OneTrust domain script ID**. Use the production identifier on a production page.

The preset loads `cdn.cookielaw.org/scripttemplates/otSDKStub.js` and maps **C0003 → Preferences**, **C0002 → Analytics**, **C0004 → Marketing**. An installation with different category IDs or SDK hosting needs a custom bridge.

[OneTrust CMP methods](https://developer.onetrust.com/onetrust/docs/javascript-api).

## Custom CMP

Select **Custom** and paste the trusted provider snippet into **CMP script**. A custom banner must communicate acceptance and withdrawal to OrbitPage; displaying the banner alone does not connect its categories.

After each saved visitor choice, dispatch all three categories using the provider's current values:

```js
window.dispatchEvent(new CustomEvent('orbitpage-consent-update', {
  detail: {
    preferences: false,
    analytics: false,
    marketing: false,
  },
}));
```

The example represents rejection of every optional category. Set a value to `true` only when the visitor has granted it; update the event when they withdraw consent. Necessary remains enabled. Configure this callback in the provider integration, rather than pasting a fixed acceptance event.

**Reopen selector** is optional. Use a provider control's CSS selector, such as `.cky-btn-revisit`, if the normal **Cookie settings** action cannot reopen its preferences.

Executable CMP and policy snippets require administrator permission. After restoring a backup, an administrator must review and save Privacy settings before restored scripts can run. See [Security](../administration/Security.md).

## Verify the public page

1. Start with no saved consent. Check that one banner appears and policy links open.
2. Reject optional categories; matching embeds should remain blocked.
3. Accept Preferences, Analytics and Marketing separately and check the corresponding embeds and tags.
4. Reopen preferences, withdraw consent and reload to check that the choice persists.

If the banner is missing, check its identifier or snippet, provider publication state, domain and regional display rules. If two banners appear, remove a duplicate installation from custom scripts or a tag manager.

If the banner works but embeds do not follow it, check the provider category mapping and each block's **Consent category**. Avoid installing GA4 both in OrbitPage and through another script.

See [External modules](./external-modules.md#consent-and-troubleshooting) for block defaults and [Analytics and privacy](../dashboard/sections/analytics-and-privacy.md) for GA4 and built-in reports.
