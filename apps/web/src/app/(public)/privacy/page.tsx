import type { Metadata } from 'next';
import { ShieldCheck } from '@beecompete/ui';
import {
  LegalLI,
  LegalLink,
  LegalList,
  LegalP,
  LegalPage,
  LegalSection,
} from '@/components/legal/legal-page';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';
import { pageMetadata } from '@/lib/seo';

// R1-12 · Privacy Policy (🔒 compliance). Honest to the R1 browse-only marketplace: no accounts,
// no personal profiles, no payments. Account/consent/payments language is deliberately deferred to
// R2. ⚠️ Pre-launch DRAFT — must be reviewed by privacy counsel before R1-17 (compliance.md gate).

// Force dynamic so the env-gated robots directive reflects the RUNTIME SEARCH_INDEXING flag —
// a statically prerendered public page would bake the build-time value (seo.ts LANDMINE L1).
export const revalidate = 0;

const SECTIONS = [
  { id: 'summary', label: 'The short version' },
  { id: 'collect', label: 'Information we collect' },
  { id: 'use', label: 'How we use information' },
  { id: 'children', label: "Children's privacy" },
  { id: 'ads', label: 'No selling, no targeted ads' },
  { id: 'cookies', label: 'Cookies and analytics' },
  { id: 'sharing', label: 'Who we share information with' },
  { id: 'retention', label: 'How long we keep information' },
  { id: 'choices', label: 'Your choices and rights' },
  { id: 'security', label: 'Security' },
  { id: 'changes', label: 'Changes to this policy' },
];

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Privacy Policy',
    description:
      'How BeeCompete handles data on our browse-only catalog of K-12 academic competitions: what we collect, how we protect children’s privacy, and what we never do (no selling data, no targeted ads).',
    path: '/privacy',
  });
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      icon={ShieldCheck}
      currentPath="/privacy"
      summary="BeeCompete is built for students, families, and educators — so privacy comes first. This policy explains what we collect on our catalog today, and just as importantly, what we don’t."
      sections={SECTIONS}
    >
      <LegalSection id="summary" heading="The short version">
        <LegalP>
          BeeCompete (&ldquo;BeeCompete,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is a free,
          browse-only catalog of K-12 academic competitions. You can search and read every listing{' '}
          <strong className="font-medium text-foreground">
            without an account and without giving us any personal information
          </strong>
          . We don&apos;t sell data, we don&apos;t run targeted advertising, and we don&apos;t track
          you across the web.
        </LegalP>
        <LegalP>
          This page covers the current version of BeeCompete. When we add optional features that
          collect information — like an email digest or saved competitions — we&apos;ll update this
          policy and, for any features involving children under 13, put verifiable parental consent
          in place first.
        </LegalP>
      </LegalSection>

      <LegalSection id="collect" heading="Information we collect">
        <LegalP>Because there are no accounts yet, we collect very little:</LegalP>
        <LegalList>
          <LegalLI>
            <strong className="font-medium text-foreground">
              Information you choose to send us.
            </strong>{' '}
            If you use a form — such as{' '}
            <LegalLink href="/suggest-a-correction">suggesting a correction</LegalLink> or{' '}
            <LegalLink href="/suggest-a-competition">requesting a competition</LegalLink> — we
            receive what you type into it. Please don&apos;t include sensitive personal details;
            these forms only need enough to act on your suggestion.
          </LegalLI>
          <LegalLI>
            <strong className="font-medium text-foreground">Basic technical logs.</strong> Like
            almost every website, our servers automatically record standard request data (such as IP
            address, browser type, and the pages requested) to keep the service secure, reliable,
            and working. We use these logs for operations and abuse-prevention, not to profile you.
          </LegalLI>
          <LegalLI>
            <strong className="font-medium text-foreground">
              Privacy-first, cookieless analytics.
            </strong>{' '}
            We measure which pages are useful using analytics that are configured without
            advertising cookies and without cross-site tracking. See{' '}
            <LegalLink href="/cookies">our Cookie Policy</LegalLink> for details.
          </LegalLI>
        </LegalList>
        <LegalP>
          We do <strong className="font-medium text-foreground">not</strong> ask you for a name,
          age, grade, school, or contact information to browse the catalog.
        </LegalP>
      </LegalSection>

      <LegalSection id="use" heading="How we use information">
        <LegalP>We use the limited information above only to:</LegalP>
        <LegalList>
          <LegalLI>operate, secure, and improve the catalog;</LegalLI>
          <LegalLI>
            review and act on corrections, competition requests, and feedback you send us;
          </LegalLI>
          <LegalLI>understand, in aggregate, which listings and pages are helpful; and</LegalLI>
          <LegalLI>comply with the law and prevent abuse.</LegalLI>
        </LegalList>
      </LegalSection>

      <LegalSection id="children" heading="Children's privacy (COPPA)">
        <LegalP>
          BeeCompete is directed to a K-12 audience, so protecting children is central to how we
          build. The current browse-only service is designed so that{' '}
          <strong className="font-medium text-foreground">
            no one needs to provide personal information to use it
          </strong>
          , and we do not knowingly collect personal information from children under 13.
        </LegalP>
        <LegalP>
          We are not yet offering accounts. Before we introduce any feature that would collect
          personal information from a child under 13, we will obtain verifiable parental consent and
          give parents the ability to review and delete their child&apos;s information, consistent
          with the Children&apos;s Online Privacy Protection Act (COPPA).
        </LegalP>
        <LegalP>
          If you are a parent or guardian and believe a child has sent us personal information (for
          example, through a form), please email us at{' '}
          <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</LegalLink> and we
          will delete it promptly.
        </LegalP>
      </LegalSection>

      <LegalSection id="ads" heading="No selling data, no targeted ads to students">
        <LegalP>These are hard rules for us, not preferences:</LegalP>
        <LegalList>
          <LegalLI>We never sell or rent personal information.</LegalLI>
          <LegalLI>
            We never use a student&apos;s activity to build a behavioral advertising profile or to
            serve targeted ads. Any promotion of a competition is based only on context — like the
            page or subject you&apos;re viewing — not on tracking an individual.
          </LegalLI>
          <LegalLI>We don&apos;t allow third-party advertising trackers on the site.</LegalLI>
        </LegalList>
      </LegalSection>

      <LegalSection id="cookies" heading="Cookies and analytics">
        <LegalP>
          We keep cookies to a minimum — essentially just what&apos;s needed to remember your light/
          dark theme choice and to keep the site secure. We do not use advertising or cross-site
          tracking cookies. Full details, and how to control cookies, are in our{' '}
          <LegalLink href="/cookies">Cookie Policy</LegalLink>.
        </LegalP>
      </LegalSection>

      <LegalSection id="sharing" heading="Who we share information with">
        <LegalP>
          We don&apos;t sell your information and we don&apos;t share it for advertising. We do rely
          on a small set of vetted service providers to run the site, who may process limited data
          only on our behalf and only to provide their service:
        </LegalP>
        <LegalList>
          <LegalLI>hosting and infrastructure providers;</LegalLI>
          <LegalLI>our database provider;</LegalLI>
          <LegalLI>a content-delivery and security provider that helps protect the site;</LegalLI>
          <LegalLI>
            an error-monitoring provider, configured to avoid capturing personal information and
            with session recording disabled.
          </LegalLI>
        </LegalList>
        <LegalP>
          We may also disclose information if required by law, or to protect the rights, safety, and
          security of our users and BeeCompete. When we outbound-link you to an organizer&apos;s
          official site to register, or to a resource, that third party&apos;s own privacy policy
          governs what happens there.
        </LegalP>
      </LegalSection>

      <LegalSection id="retention" heading="How long we keep information">
        <LegalP>
          We keep information only as long as we need it. Form submissions are retained long enough
          to review and act on them and to keep a basic record of catalog changes; technical logs
          are kept for a limited period for security and operations, then rotated out.
        </LegalP>
      </LegalSection>

      <LegalSection id="choices" heading="Your choices and rights">
        <LegalList>
          <LegalLI>
            <strong className="font-medium text-foreground">Browse anonymously.</strong> You can use
            the entire catalog without providing any personal information.
          </LegalLI>
          <LegalLI>
            <strong className="font-medium text-foreground">Access or delete.</strong> If
            you&apos;ve sent us information through a form, you can ask us to access or delete it by
            emailing{' '}
            <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</LegalLink>.
          </LegalLI>
          <LegalLI>
            <strong className="font-medium text-foreground">Global Privacy Control.</strong> Our
            analytics don&apos;t track individuals or sell data, so there&apos;s nothing to opt out
            of — but we honor browser Do-Not-Track / Global Privacy Control signals as an opt-out
            preference.
          </LegalLI>
        </LegalList>
        <LegalP>
          Depending on where you live, you may have additional rights under laws such as the
          California Consumer Privacy Act (CCPA/CPRA) or your state&apos;s privacy law. Email us to
          exercise them and we&apos;ll respond as the law requires.
        </LegalP>
      </LegalSection>

      <LegalSection id="security" heading="Security">
        <LegalP>
          We use reasonable technical and organizational measures to protect information, including
          encryption in transit, access controls, and least-privilege practices. No method of
          transmission or storage is ever completely secure, so we can&apos;t guarantee absolute
          security — but keeping data minimal is our first line of defense.
        </LegalP>
      </LegalSection>

      <LegalSection id="changes" heading="Changes to this policy">
        <LegalP>
          BeeCompete is a US-based service intended for users in the United States. As the product
          grows — especially when we add accounts — we&apos;ll update this policy and change the
          &ldquo;Last updated&rdquo; date at the top. For significant changes affecting how we
          handle personal information, we&apos;ll take reasonable steps to highlight them.
        </LegalP>
      </LegalSection>
    </LegalPage>
  );
}
