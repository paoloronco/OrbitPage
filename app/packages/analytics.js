const AI_DOMAINS = ['chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'copilot.microsoft.com', 'perplexity.ai', 'you.com', 'phind.com'];
const AI_TAGS = ['chatgpt', 'openai', 'claude', 'gemini', 'copilot', 'perplexity', 'you', 'phind'];
const SEARCH_DOMAINS = ['perplexity.ai', 'you.com', 'phind.com'];
const quoted = values => values.map(value => `'${value}'`).join(', ');

// Attribution is a referrer/UTM estimate; it cannot identify prompts or untagged AI visits.
export function aiAnalyticsConditions(source, utmSource, utmMedium) {
  return {
    tagged: `${utmSource} IN (${quoted(AI_TAGS)})`,
    referral: `${source} IN (${quoted(AI_DOMAINS)})`,
    traffic: `(${source} IN (${quoted(AI_DOMAINS)}) OR ${utmSource} IN (${quoted(AI_TAGS)}) OR ${utmMedium} = 'ai-search')`,
    search: `(${source} IN (${quoted(SEARCH_DOMAINS)}) OR ${utmSource} IN ('perplexity', 'you', 'phind') OR ${utmMedium} = 'ai-search')`,
  };
}
