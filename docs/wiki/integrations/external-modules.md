# External modules

Connected-service blocks add links, players and forms to your page. Manage the original content with its provider, then paste its public URL into OrbitPage. No provider API key is needed.

![Add and edit connected-service blocks in Content](https://github.com/paoloronco/OrbitPage/releases/download/v4.21.74/orbitpage-feature-content-and-design-4.21.75.gif)

## Add a service

1. Open **Site editor → Content → Add content → Connected services**.
2. Choose the provider and enter its public URL.
3. Edit the title and description. For embeds, set **Embed height** and **Consent category**.
4. Save the page and check the public result on desktop and mobile.

The same blocks work on additional pages. See [Content and design](../dashboard/sections/content-and-design.md) for ordering, visibility and schedules.

## Direct links

### WhatsApp

Choose **WhatsApp** and enter `https://wa.me/NUMBER`. Use the full international phone number with digits only, without `+`, spaces or brackets. An optional `?text=` parameter contains a URL-encoded prepared message.

The block opens WhatsApp when clicked; the visitor sends the message. It does not connect a messaging API or send messages automatically. See [WhatsApp click to chat](https://faq.whatsapp.com/5913398998672934).

### GitHub

Choose **GitHub** and paste the HTTPS URL of a profile, repository or release. The block opens GitHub; it does not embed repository contents or request account access. Visitors need their own permissions for private repositories.

## Video players

| Provider | Source | Check |
| --- | --- | --- |
| **YouTube** | A `youtube.com/watch?v=VIDEO_ID`, `youtu.be/VIDEO_ID`, Shorts or live-video URL | Use one video, not a channel or playlist. The preset uses `youtube-nocookie.com`. |
| **Vimeo** | A public `vimeo.com/VIDEO_ID` or `player.vimeo.com/video/VIDEO_ID` URL | Allow your public domain in Vimeo's embedding settings. |

The original video must permit embedding. Vimeo access hashes for unlisted videos are not preserved by the preset; use a normal Link block for those videos. Provider age, region and domain restrictions still apply.

Provider guides: [YouTube embeds](https://support.google.com/youtube/answer/171780), [Vimeo embeds](https://help.vimeo.com/hc/en-us/articles/12426259908881-How-to-embed-my-video).

## Audio players

| Provider | What to enter |
| --- | --- |
| **Spotify** | An `open.spotify.com` URL for a track, album, playlist, artist, episode or show. Use the full web URL, not a `spotify:` URI. |
| **Apple Music** | A `music.apple.com` URL with its country and album, song, playlist, artist, station or music-video path. |
| **Deezer** | A `deezer.com` track, album or playlist URL with a numeric ID, or an official `widget.deezer.com/widget/` URL. Expand short links first. |
| **SoundCloud** | A public `soundcloud.com` track or playlist URL, or a `w.soundcloud.com/player/` URL from the official embed. |
| **Mixcloud** | A public `mixcloud.com/profile/show/` URL for an individual show. |

Playback length, availability and sign-in requirements depend on the provider. These blocks do not copy the audio into OrbitPage storage.

Provider guides: [Spotify](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed), [Apple Music](https://support.apple.com/guide/music-web/apdm0783785d/web), [Deezer widget](https://widget.deezer.com/), [SoundCloud](https://help.soundcloud.com/hc/en-us/categories/47989347228187-Share-Embed), [Mixcloud](https://help.mixcloud.com/hc/en-us/articles/360004031440-Embedding-content-using-the-Mixcloud-widget).

## Scheduling and forms

| Provider | What to enter | Check |
| --- | --- | --- |
| **Calendly** | The public `https://calendly.com/name/event` booking URL | Paste the URL directly; the preset displays the inline booking page. |
| **Typeform** | A published form's public `/to/FORM_ID` URL from **Share** | US and EU URLs are supported. Use the public form link, not the editor URL or a popup script. |
| **Google Forms** | The full `docs.google.com/forms/d/.../viewform` responder URL | Publish the form and permit the intended audience. Expand `forms.gle` short links; `/edit` URLs are not accepted. |

Bookings and responses stay with the provider. Configure availability, questions, access and notification emails there; they do not become OrbitPage newsletter subscribers automatically.

Provider guides: [Calendly](https://developer.calendly.com/api-docs/overview/embedding/getting-started), [Typeform sharing](https://help.typeform.com/hc/en-us/articles/360029252892-Share-your-form), [Google Forms sharing and embeds](https://support.google.com/docs/answer/183965).

For Cal.com or an external payment page, add a normal **Link** block with its public HTTPS URL. Native Cal.com booking synchronization and Stripe checkout belong to the [managed service](https://orbitpage.com/en-US/docs/cal-com).

## Other presets

Connected services also includes Instagram, Facebook, Loom, TikTok, Giphy, Google Calendar appointment schedules, Google Maps and newsletter embeds. Use a public content URL accepted by the selected provider; Google Maps uses its embed URL. A normal Link block remains useful when a service does not allow embedding.

## Consent and troubleshooting

| Preset | Default consent category |
| --- | --- |
| Audio players, Calendly, Google Calendar, Google Forms and Google Maps | Preferences |
| YouTube, Vimeo, Typeform and other embeds | Marketing |

Review the category for your use and configure [consent management](./consent-management.md) in **Privacy**. **Necessary** loads immediately; do not use it to bypass a missing optional consent choice.

Test the public page in a private window: reject optional categories, accept the block's category, then reopen preferences and withdraw it. If an embed stays blank, check:

- The full public URL, provider and access restrictions.
- The visitor's consent choice and the block's category.
- Embed height, browser blockers and provider domain settings.

Providers control audio/video autoplay. A working dashboard preview does not replace checking the public page.
