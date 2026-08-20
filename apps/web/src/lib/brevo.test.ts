import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeWithAttributeList, type BrevoConfig } from './brevo';

// The read-first branching behind multi-competition Follow. These branches decide whether someone
// gets a confirmation EMAIL, so getting them wrong is either a lost signup or spam — worth pinning
// down without a live Brevo account.

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const cfg: BrevoConfig = {
  apiKey: 'test-key',
  followListId: 7,
  doiTemplateId: 1,
  senderEmail: 'no-reply@beecompete.com',
  senderName: 'BeeCompete',
  senderConfigured: true,
};

const ok = (body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const notFound = () => new Response('{}', { status: 404 });

/** Route the mocked fetch by method + URL so a test only states what it cares about. */
function mockBrevo(handlers: { get?: () => Response; doi?: () => Response; put?: () => Response }) {
  const calls: { method: string; url: string; body: Record<string, unknown> | null }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({
        method,
        url,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
      });
      if (method === 'GET') return (handlers.get ?? notFound)();
      if (method === 'PUT') return (handlers.put ?? (() => new Response(null, { status: 204 })))();
      if (url.includes('doubleOptinConfirmation')) {
        return (handlers.doi ?? (() => new Response('{}', { status: 201 })))();
      }
      return ok();
    }),
  );
  return calls;
}

const subscribe = (value: string) =>
  subscribeWithAttributeList(cfg, {
    email: 'sam@example.com',
    listId: 7,
    redirectUrl: 'https://beecompete.com/subscribed/follow',
    attribute: 'COMPETITION',
    value,
  });

afterEach(() => vi.unstubAllGlobals());

describe('subscribeWithAttributeList', () => {
  it('sends double opt-in for a brand-new contact', async () => {
    const calls = mockBrevo({ get: notFound });

    await expect(subscribe('AMC 10')).resolves.toBe('confirm');

    const doi = calls.find((c) => c.url.includes('doubleOptinConfirmation'));
    expect(doi?.body?.attributes).toEqual({ COMPETITION: '|AMC 10|' });
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('appends WITHOUT emailing when the contact already confirmed this list', async () => {
    const calls = mockBrevo({
      get: () =>
        ok({
          id: 1,
          email: 'sam@example.com',
          listIds: [7],
          attributes: { COMPETITION: '|AMC 10|' },
        }),
    });

    await expect(subscribe('MATHCOUNTS')).resolves.toBe('added');

    // The whole point: no second confirmation email.
    expect(calls.some((c) => c.url.includes('doubleOptinConfirmation'))).toBe(false);
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body?.attributes).toEqual({ COMPETITION: '|AMC 10|MATHCOUNTS|' });
  });

  it('writes nothing when they already follow that competition (double-submit / re-follow)', async () => {
    const calls = mockBrevo({
      get: () =>
        ok({
          id: 1,
          email: 'sam@example.com',
          listIds: [7],
          attributes: { COMPETITION: '|AMC 10|' },
        }),
    });

    await expect(subscribe('amc 10')).resolves.toBe('already');

    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  it('still double-opts-in an existing contact who is not on THIS list, carrying values over', async () => {
    // A digest subscriber following their first competition: consent is per-list, so the follow
    // list needs its own confirmation rather than a silent PUT.
    const calls = mockBrevo({
      get: () =>
        ok({
          id: 1,
          email: 'sam@example.com',
          listIds: [3],
          attributes: { COMPETITION: '|AMC 10|' },
        }),
    });

    await expect(subscribe('MATHCOUNTS')).resolves.toBe('confirm');

    const doi = calls.find((c) => c.url.includes('doubleOptinConfirmation'));
    expect(doi?.body?.attributes).toEqual({ COMPETITION: '|AMC 10|MATHCOUNTS|' });
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('falls back to a plain subscribe when the contact read fails, rather than losing the signup', async () => {
    const calls = mockBrevo({ get: () => new Response('rate limited', { status: 429 }) });

    await expect(subscribe('AMC 10')).resolves.toBe('confirm');

    const doi = calls.find((c) => c.url.includes('doubleOptinConfirmation'));
    expect(doi?.body?.attributes).toEqual({ COMPETITION: '|AMC 10|' });
  });

  it('upgrades a legacy single unwrapped value into the list form', async () => {
    // Contacts captured before multi-value encoding stored a bare name.
    const calls = mockBrevo({
      get: () =>
        ok({
          id: 1,
          email: 'sam@example.com',
          listIds: [7],
          attributes: { COMPETITION: 'AMC 10' },
        }),
    });

    await expect(subscribe('MATHCOUNTS')).resolves.toBe('added');

    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body?.attributes).toEqual({ COMPETITION: '|AMC 10|MATHCOUNTS|' });
  });
});
