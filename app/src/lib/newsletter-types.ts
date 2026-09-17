export type NewsletterSmtpSettings = {
  configured: boolean;
  passwordConfigured: boolean;
  host: string;
  port: 465 | 587 | 2525;
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  verifiedAt: string | null;
  updatedAt: string | null;
};
export type NewsletterSubscriberStatus = "pending" | "active" | "unsubscribed";

export type NewsletterSubscriber = {
  subscriberId: string;
  email: string;
  name: string | null;
  status: NewsletterSubscriberStatus;
  source: "manual" | "public" | "import";
  consentAt: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewsletterCampaignContent = {
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
  imageAlt: string;
  logoUrl: string;
  accentColor: string;
  backgroundColor: string;
  contentBackgroundColor: string;
  contentColor: string;
  buttonTextColor: string;
  fontFamily: "system" | "editorial" | "modern";
  textAlign: "left" | "center";
  containerWidth: 520 | 640 | 720;
  cornerRadius: number;
  buttonRadius: number;
  footerNote: string;
};

export type NewsletterCampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "canceled" | "failed";

export function canDeleteNewsletterCampaign(status: NewsletterCampaignStatus) {
  return status !== "sending";
}

export type NewsletterCampaign = {
  campaignId: string;
  name: string;
  subject: string;
  preheader: string;
  content: NewsletterCampaignContent;
  status: NewsletterCampaignStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  targetCount: number;
  stats: {
    attempted: number;
    accepted: number;
    rejected: number;
    openedUnique: number;
    clickedUnique: number;
    unsubscribed: number;
  };
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewsletterDashboardData = {
  available: boolean;
  canManage: boolean;
  planId: string;
  limits: {
    maxSubscribers: number | null;
    maxSendsPerMonth: number | null;
    sendsThisMonth: number;
    reservedThisMonth: number;
  };
  settings: NewsletterSmtpSettings;
  subscriberCounts: {
    total: number;
    active: number;
    pending: number;
    unsubscribed: number;
  };
  subscribers: NewsletterSubscriber[];
  campaigns: NewsletterCampaign[];
  signupUrl: string | null;
};
