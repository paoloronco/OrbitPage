"use client";

import { newsletterRequest } from "../lib/api-client";
import NewsletterWorkspaceView, { type NewsletterWorkspaceProps } from "./newsletter-workspace";

type NewsletterUser = { uid: string; email?: string };

export default function NewsletterWorkspace({ user, ...props }: {
  user: NewsletterUser;
} & Pick<NewsletterWorkspaceProps, "selectedView" | "onViewChange">) {
  return <NewsletterWorkspaceView {...props} userKey={user.uid} request={newsletterRequest} />;
}
