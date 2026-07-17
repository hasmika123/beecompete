import type { Metadata } from 'next';
import { Cookie } from '@beecompete/ui';
import {
  LegalLI,
  LegalLink,
  LegalList,
  LegalP,
  LegalPage,
  LegalSection,
  LegalSubheading,
} from '@/components/legal/legal-page';
import { pageMetadata } from '@/lib/seo';

// R1-12 · Cookie Policy. Honest to R1: cookies/local storage are kept minimal — a theme
// preference (next-themes → browser local storage), strictly-necessary security, and cookieless
// analytics. No advertising or cross-site tracking cookies. ⚠️ Pre-launch DRAFT — counsel review
// before R1-17.

export const revalidate = 0;

const SECTIONS = [
  { id: 'what', label: 'What cookies are' },
  { id: 'how', label: 'How we use them' },
  { id: 'none', label: 'What we don’t use' },
  { id: 'managing', label: 'Managing cookies' },
  { id: 'dnt', label: 'Do Not Track & GPC' },
  { id: 'changes', label: 'Changes' },
];

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Cookie Policy',
    description:
      'How BeeCompete uses cookies and local storage — kept to the minimum needed to remember your theme and keep the site secure. No advertising or cross-site tracking cookies.',
    path: '/cookies',
  });
}

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      icon={Cookie}
      currentPath="/cookies"
      summary="We keep cookies to a minimum. BeeCompete uses only what’s needed to remember your preferences and keep the site secure — no advertising cookies and no cross-site tracking."
      sections={SECTIONS}
    >
      <LegalSection id="what" heading="What cookies (and local storage) are">
        <LegalP>
          Cookies are small text files a website stores in your browser. &ldquo;Local storage&rdquo;
          is a similar technology that keeps a small preference in your browser without sending it
          back to a server. This policy covers both. We use them sparingly and never to build an
          advertising profile of you.
        </LegalP>
      </LegalSection>

      <LegalSection id="how" heading="How we use them">
        <LegalSubheading>Strictly necessary</LegalSubheading>
        <LegalP>
          These keep the site working and secure. For example, our content-delivery and security
          provider may set a strictly necessary cookie to help protect the site from abuse. These
          can&apos;t be switched off without breaking core functionality, and they aren&apos;t used
          to track you.
        </LegalP>

        <LegalSubheading>Preferences</LegalSubheading>
        <LegalP>
          When you choose light or dark mode, we remember it by storing a single value
          (&ldquo;light&rdquo; or &ldquo;dark&rdquo;) in your browser&apos;s local storage, so the
          site looks the way you left it next time. That value stays in your browser and isn&apos;t
          shared with anyone.
        </LegalP>

        <LegalSubheading>Analytics</LegalSubheading>
        <LegalP>
          To understand which pages are useful, we use privacy-first analytics configured to work{' '}
          <strong className="font-medium text-foreground">without tracking cookies</strong> and
          without following you across other sites. The measurement is aggregate — it tells us a
          page was viewed, not who you are.
        </LegalP>
      </LegalSection>

      <LegalSection id="none" heading="What we don't use">
        <LegalList>
          <LegalLI>No advertising or retargeting cookies.</LegalLI>
          <LegalLI>No cross-site or third-party tracking cookies.</LegalLI>
          <LegalLI>No social-media or ad-network trackers embedded in our pages.</LegalLI>
        </LegalList>
        <LegalP>
          This is a deliberate choice: BeeCompete serves a K-12 audience, and we don&apos;t do
          behavioral advertising. See our <LegalLink href="/privacy">Privacy Policy</LegalLink> for
          the bigger picture.
        </LegalP>
      </LegalSection>

      <LegalSection id="managing" heading="Managing cookies">
        <LegalP>
          You&apos;re always in control. You can view, block, or delete cookies and clear local
          storage from your browser&apos;s settings — most browsers explain how in their help pages.
          Because we use so few, blocking them mostly just means the site won&apos;t remember your
          theme choice; blocking strictly necessary cookies may prevent some pages from working
          correctly.
        </LegalP>
      </LegalSection>

      <LegalSection id="dnt" heading="Do Not Track & Global Privacy Control">
        <LegalP>
          Our analytics don&apos;t track individuals, so there&apos;s little to opt out of — but we
          honor browser Do-Not-Track and Global Privacy Control (GPC) signals as an opt-out
          preference and don&apos;t attempt to work around them.
        </LegalP>
      </LegalSection>

      <LegalSection id="changes" heading="Changes to this policy">
        <LegalP>
          If we add features that need additional cookies — for example, accounts in a future
          release — we&apos;ll update this page and the &ldquo;Last updated&rdquo; date, and add any
          consent controls the law requires before setting non-essential cookies.
        </LegalP>
      </LegalSection>
    </LegalPage>
  );
}
