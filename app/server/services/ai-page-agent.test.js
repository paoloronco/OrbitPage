import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiPageAgentError,
  applyAiPageOperations,
  compactPageContext,
  decryptApiKey,
  encryptApiKey,
  planAiPageChanges,
  resolveOpenAiResponsesUrl,
} from './ai-page-agent.js';
import { dbGet } from '../database.js';

vi.mock('../database.js', () => ({
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

const operation = (overrides = {}) => ({
  kind: 'profile.set',
  targetId: null,
  field: 'bio',
  value: 'A clearer introduction.',
  blockType: null,
  title: null,
  description: null,
  url: null,
  content: null,
  index: null,
  ...overrides,
});

const page = {
  profile: {
    name: 'Orbit Studio',
    bio: 'Original bio',
    avatar: '',
    social_links: {},
    show_avatar: 1,
  },
  links: [{
    id: 'booking',
    title: 'Book',
    description: 'Choose a time',
    url: 'https://example.com/book',
    type: 'link',
    isActive: true,
    status: 'live',
    availability: 'available',
    backgroundColor: '#ff0000',
    textColor: '#ffffff',
  }],
  theme: {
    primary: '#2563eb',
    background: '#ffffff',
    foreground: '#0f172a',
  },
};

describe('self-hosted AI page agent', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'test-secret-that-is-longer-than-thirty-two-characters');
    vi.mocked(dbGet).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('encrypts provider keys without persisting plaintext', () => {
    const apiKey = 'sk-proj-example-secret-value-123456789';
    const encrypted = encryptApiKey(apiKey);

    expect(encrypted).not.toContain(apiKey);
    expect(encrypted.split('.')).toHaveLength(3);
    expect(decryptApiKey(encrypted)).toBe(apiKey);
  });

  it('keeps the provider endpoint fixed in production and limits test overrides to loopback', () => {
    vi.stubEnv('ORBITPAGE_TEST_OPENAI_RESPONSES_URL', 'https://attacker.example/v1/responses');
    vi.stubEnv('NODE_ENV', 'production');
    expect(resolveOpenAiResponsesUrl()).toBe('https://api.openai.com/v1/responses');

    vi.stubEnv('NODE_ENV', 'test');
    expect(() => resolveOpenAiResponsesUrl()).toThrow('loopback');

    vi.stubEnv('ORBITPAGE_TEST_OPENAI_RESPONSES_URL', 'http://127.0.0.1:3124/v1/responses');
    expect(resolveOpenAiResponsesUrl()).toBe('http://127.0.0.1:3124/v1/responses');
  });

  it('applies a coordinated card-theme edit and removes block overrides', () => {
    const result = applyAiPageOperations({
      page,
      permissions: ['theme:write'],
      operations: [
        operation({ kind: 'theme.set', field: 'card', value: '#13213a' }),
        operation({ kind: 'theme.set', field: 'contentCard.backgroundSecondary', value: '#1f3356' }),
        operation({ kind: 'theme.set', field: 'contentCardEffect', value: 'liquid-glass' }),
      ],
    });

    expect(result.changes.theme.card).toBe('#13213a');
    expect(result.changes.theme.contentCard.background).toBe('#13213a');
    expect(result.changes.theme.contentCard.backgroundSecondary).toBe('#1f3356');
    expect(result.changes.theme.contentCardEffect).toBe('liquid-glass');
    expect(result.changes.links[0]).toMatchObject({
      backgroundColor: null,
      textColor: null,
      surfaceEffect: 'inherit',
    });
  });

  it('rejects unsafe URLs before a proposal can be stored', () => {
    expect(() => applyAiPageOperations({
      page,
      permissions: ['links:write'],
      operations: [
        operation({
          kind: 'block.update',
          targetId: 'booking',
          field: 'url',
          value: 'javascript:alert(1)',
        }),
      ],
    })).toThrowError(AiPageAgentError);
  });

  it('blocks operations outside the current editor permissions', () => {
    expect(() => applyAiPageOperations({
      page,
      permissions: ['links:write'],
      operations: [operation({ kind: 'theme.set', field: 'background', value: '#101827' })],
    })).toThrow('cannot apply');
  });

  it('sends only editable theme data and excludes non-text block payloads from context', () => {
    const context = JSON.parse(compactPageContext({
      ...page,
      theme: {
        ...page.theme,
        customCSS: '.secret-internal-rule { display: none; }',
        backgroundMedia: { mediaUrl: 'https://private.example/media.mp4' },
      },
      links: [
        ...page.links,
        {
          id: 'embed',
          title: 'Embedded widget',
          type: 'embed',
          content: '<script>private-widget-configuration</script>',
          isActive: true,
        },
        {
          id: 'about',
          title: 'About',
          type: 'text',
          content: 'Public page copy',
          isActive: true,
        },
      ],
    }, ['links:write', 'theme:write'], 9));

    expect(context.page.theme).toEqual({
      primary: '#2563eb',
      background: '#ffffff',
      foreground: '#0f172a',
    });
    expect(context.page.blocks.find((block) => block.id === 'embed').content).toBe('');
    expect(context.page.blocks.find((block) => block.id === 'about').content).toBe('Public page copy');
    expect(JSON.stringify(context)).not.toContain('private-widget-configuration');
    expect(JSON.stringify(context)).not.toContain('private.example');
  });

  it('uses the Responses API with strict structured output and store disabled', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-proj-example-secret-value-123456789');
    const responsePlan = {
      intent: 'propose_changes',
      answer: 'I prepared a shorter bio for your review.',
      summary: 'Shorten the profile introduction.',
      operations: [operation()],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-request-id': 'req_test' }),
      json: async () => ({
        status: 'completed',
        output: [{
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(responsePlan) }],
        }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await planAiPageChanges({
      username: 'admin',
      permissions: ['profile:write'],
      rawRequest: { message: 'Make the bio shorter', history: [] },
      page,
      revision: 7,
    });

    expect(result.proposal.summary).toBe('Shorten the profile introduction.');
    expect(result.proposal.changes.profile.bio).toBe('A clearer introduction.');
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.store).toBe(false);
    expect(request.text.format).toMatchObject({
      type: 'json_schema',
      strict: true,
      name: 'orbitpage_page_plan',
    });
    expect(request.input[1].content).toContain('"revision":7');
    expect(JSON.stringify(request)).not.toContain('sk-proj-example-secret');
  });
});
