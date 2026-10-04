import { SITE } from "@/config/site";
import { UMAMI_BEFORE_SEND, UMAMI_SCRIPT, umamiBeforeSend, umamiWebsiteId } from "@/lib/umami";

/** Script de mesure d'audience Umami (src/lib/umami.ts) ; rien si UMAMI_WEBSITE_ID est vide. */
export function Umami() {
  const id = umamiWebsiteId();
  if (!id) return null;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `window.${UMAMI_BEFORE_SEND}=${umamiBeforeSend.toString()};` }} />
      <script
        defer
        src={UMAMI_SCRIPT}
        data-website-id={id}
        data-domains={`${SITE.domain},www.${SITE.domain}`}
        data-do-not-track="true"
        data-exclude-search="true"
        data-exclude-hash="true"
        data-before-send={UMAMI_BEFORE_SEND}
      />
    </>
  );
}
