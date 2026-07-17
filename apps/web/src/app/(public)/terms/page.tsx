import type { Metadata } from 'next';
import { Scales } from '@beecompete/ui';
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

// R1-12 · Terms of Use. Scoped to the R1 browse-only catalog: no accounts, no registrations or
// payments taken on-platform, third-party organizers. ⚠️ Pre-launch DRAFT — must be reviewed by
// counsel before R1-17. TODO(R1-17): fill the governing-law state once the operating entity
// (LLC) is formed (setup-runbook §1b); today the clause references "the state in which BeeCompete
// is established" as a placeholder.

export const revalidate = 0;

const SECTIONS = [
  { id: 'acceptance', label: 'Agreement to these terms' },
  { id: 'what', label: 'What BeeCompete is (and isn’t)' },
  { id: 'eligibility', label: 'Who can use BeeCompete' },
  { id: 'listings', label: 'Accuracy of listings & beta status' },
  { id: 'third-parties', label: 'Organizer sites, links & resources' },
  { id: 'affiliate', label: 'Affiliate links' },
  { id: 'ip', label: 'Intellectual property & trademarks' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'submissions', label: 'What you submit' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'changes', label: 'Changes' },
  { id: 'governing-law', label: 'Governing law' },
];

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Terms of Use',
    description:
      'The terms for using BeeCompete, a free browse-only catalog of K-12 academic competitions. We list competitions run by third-party organizers; registration always happens on the organizer’s official site.',
    path: '/terms',
  });
}

export default function TermsOfUsePage() {
  return (
    <LegalPage
      title="Terms of Use"
      icon={Scales}
      currentPath="/terms"
      summary="These terms govern your use of BeeCompete, a free catalog that helps you discover K-12 academic competitions run by other organizations. Please read them — by using the site, you agree to them."
      sections={SECTIONS}
    >
      <LegalSection id="acceptance" heading="Agreement to these terms">
        <LegalP>
          These Terms of Use are an agreement between you and BeeCompete (&ldquo;BeeCompete,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us&rdquo;). By accessing or using our website, you agree to these
          terms and to our <LegalLink href="/privacy">Privacy Policy</LegalLink>. If you don&apos;t
          agree, please don&apos;t use the site.
        </LegalP>
      </LegalSection>

      <LegalSection id="what" heading="What BeeCompete is (and isn't)">
        <LegalP>
          BeeCompete is an independent, curated <em>catalog</em>: we gather publicly available
          information about academic competitions into one place so you can find and compare them.
        </LegalP>
        <LegalP>Just as importantly, here&apos;s what we are not:</LegalP>
        <LegalList>
          <LegalLI>
            We do <strong className="font-medium text-foreground">not</strong> organize, host,
            sponsor, judge, or administer the competitions we list.
          </LegalLI>
          <LegalLI>
            We do <strong className="font-medium text-foreground">not</strong> handle registrations,
            entries, or payments. When you&apos;re ready to enter, we send you to the
            organizer&apos;s official website, where their rules, fees, and terms apply.
          </LegalLI>
          <LegalLI>
            A listing on BeeCompete is not an endorsement, guarantee, or verification of a
            competition, its organizer, or any outcome. Being listed also doesn&apos;t imply the
            organizer is affiliated with or sponsors BeeCompete.
          </LegalLI>
        </LegalList>
      </LegalSection>

      <LegalSection id="eligibility" heading="Who can use BeeCompete">
        <LegalP>
          BeeCompete is a browse-only service that doesn&apos;t currently offer accounts and
          doesn&apos;t require you to provide personal information to use it. It&apos;s intended for
          students, families, and educators. If you are under 18, we encourage you to use BeeCompete
          together with a parent, guardian, or teacher — and always involve them before registering
          for anything or spending money on an organizer&apos;s site.
        </LegalP>
      </LegalSection>

      <LegalSection id="listings" heading="Accuracy of listings & beta status">
        <LegalP>
          We work hard to keep listings accurate — a real person reviews each one — but details like
          dates, fees, eligibility, and rules are set by the organizers and can change at any time.
          BeeCompete is also in <strong className="font-medium text-foreground">beta</strong>, so
          the catalog is still growing and information may be incomplete or out of date.
        </LegalP>
        <LegalP>
          <strong className="font-medium text-foreground">
            Always confirm the details on the organizer&apos;s official website before you rely on
            them, register, or pay.
          </strong>{' '}
          Listings are provided for general information on an &ldquo;as is&rdquo; basis, and you use
          them at your own discretion.
        </LegalP>
      </LegalSection>

      <LegalSection id="third-parties" heading="Organizer sites, links & resources">
        <LegalP>
          BeeCompete links to third-party websites — organizers&apos; official pages and prep
          resources. We don&apos;t control those sites and aren&apos;t responsible for their
          content, accuracy, products, or practices. Your use of a third-party site is governed by
          that site&apos;s own terms and privacy policy, not ours.
        </LegalP>
      </LegalSection>

      <LegalSection id="affiliate" heading="Affiliate links">
        <LegalP>
          Some resource links on BeeCompete are affiliate links, which means we may earn a small
          commission if you buy through them — at no extra cost to you. This never affects which
          competitions we list or how we present them. See our full{' '}
          <LegalLink href="/affiliate-disclosure">Affiliate Disclosure</LegalLink> for details.
        </LegalP>
      </LegalSection>

      <LegalSection id="ip" heading="Intellectual property & trademarks">
        <LegalP>
          The BeeCompete name, logo, site design, original written descriptions, and the selection
          and arrangement of the catalog are owned by BeeCompete and protected by
          intellectual-property laws. You may not copy, scrape, or reuse them except as allowed by
          these terms or applicable law.
        </LegalP>
        <LegalP>
          Competition names, organizer names, and logos belong to their respective owners. We refer
          to them only to describe the competitions factually and don&apos;t claim any affiliation
          or endorsement. If you own rights in a listing and would like a correction or removal,
          contact us at{' '}
          <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</LegalLink> or use
          the <LegalLink href="/suggest-a-correction">suggest a correction</LegalLink> form.
        </LegalP>
      </LegalSection>

      <LegalSection id="acceptable-use" heading="Acceptable use">
        <LegalP>When using BeeCompete, you agree not to:</LegalP>
        <LegalList>
          <LegalLI>break the law or infringe anyone&apos;s rights;</LegalLI>
          <LegalLI>
            scrape, harvest, or bulk-download the catalog, or use bots to access it in ways that
            burden or disrupt the service;
          </LegalLI>
          <LegalLI>
            attempt to gain unauthorized access to our systems, or interfere with the site&apos;s
            security or operation;
          </LegalLI>
          <LegalLI>
            submit false, misleading, abusive, or unlawful content through our forms.
          </LegalLI>
        </LegalList>
      </LegalSection>

      <LegalSection id="submissions" heading="What you submit">
        <LegalP>
          If you send us corrections, competition requests, or feedback, you confirm the information
          is accurate to the best of your knowledge and that you have the right to share it. You
          give us permission to use, store, and act on your submission to operate and improve the
          catalog. Don&apos;t include confidential or sensitive personal information in these forms.
        </LegalP>
      </LegalSection>

      <LegalSection id="disclaimers" heading="Disclaimers">
        <LegalP>
          BeeCompete is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
          warranties of any kind, whether express or implied, including implied warranties of
          merchantability, fitness for a particular purpose, and non-infringement. We don&apos;t
          warrant that the site will be uninterrupted or error-free, or that listings are complete,
          accurate, or current.
        </LegalP>
      </LegalSection>

      <LegalSection id="liability" heading="Limitation of liability">
        <LegalP>
          To the fullest extent permitted by law, BeeCompete will not be liable for any indirect,
          incidental, consequential, or special damages, or for any loss arising from your use of —
          or inability to use — the site, your reliance on any listing, or your dealings with any
          organizer or third-party site. Some jurisdictions don&apos;t allow certain limitations, so
          parts of this section may not apply to you.
        </LegalP>
      </LegalSection>

      <LegalSection id="changes" heading="Changes to the service and these terms">
        <LegalP>
          We may update, suspend, or discontinue parts of the site, and we may revise these terms
          from time to time. When we make material changes, we&apos;ll update the &ldquo;Last
          updated&rdquo; date above. Continuing to use BeeCompete after changes take effect means
          you accept the updated terms.
        </LegalP>
      </LegalSection>

      <LegalSection id="governing-law" heading="Governing law">
        <LegalP>
          These terms are governed by the laws of the United States and the state in which
          BeeCompete is established, without regard to conflict-of-laws principles. Questions about
          these terms? Email{' '}
          <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</LegalLink>.
        </LegalP>
      </LegalSection>
    </LegalPage>
  );
}
