"use client";

import { newsletterRequest } from "../lib/api-client";
import NewsletterWorkspaceView, { type NewsletterWorkspaceProps } from "./newsletter-workspace";
import { useAppI18n } from "../lib/i18n";

type NewsletterUser = { uid: string; email?: string };

export default function NewsletterWorkspace({ user, ...props }: {
  user: NewsletterUser;
} & Pick<NewsletterWorkspaceProps, "selectedView" | "onViewChange">) {
  const { tr } = useAppI18n();
  return <NewsletterWorkspaceView {...props} userKey={user.uid} request={newsletterRequest} subscriberTranslator={tr} />;
}
