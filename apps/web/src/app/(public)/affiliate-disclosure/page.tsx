import type { Metadata } from 'next';
import { Handshake } from '@beecompete/ui';
import {
  LegalLI,
  LegalLink,
  LegalList,
  LegalP,
  LegalPage,
  LegalSection,
} from '@/components/legal/legal-page';
import { pageMetadata } from '@/lib/seo';

// R1-12 · Affiliate Disclosure (🔒 DQ10 / FTC endorsement rule). The dedicated, linkable home for
// the disclosure that also renders inline with any resources row that contains an affiliate link
// (R1-8, components/detail/resources-row.tsx). ⚠️ Pre-launch DRAFT — counsel review before R1-17.

export const revalidate = 0;

const SECTIONS = [
  { id: 'summary', label: 'The short version' },
  { id: 'what', label: 'What affiliate links are' },
  { id: 'where', label: 'Where you’ll see them' },
  { id: 'promise', label: 'Our promise' },
  { id: 'why', label: 'Why we use them' },
];

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Affiliate Disclosure',
    description:
      'Some prep-resource links on BeeCompete are affiliate links — we may earn a small commission at no extra cost to you. It never affects which competitions we list or how we rank them.',
    path: '/affiliate-disclosure',
  });
}

export default function AffiliateDisclosurePage() {
  return (
    <LegalPage
      title="Affiliate Disclosure"
      icon={Handshake}
      currentPath="/affiliate-disclosure"
      summary="We want to be upfront: some resource links on BeeCompete are affiliate links. Here’s exactly what that means — and the line we never cross."
      sections={SECTIONS}
    >
      <LegalSection id="summary" heading="The short version">
        <LegalP>
          Some of the prep-resource links on BeeCompete are{' '}
          <strong className="font-medium text-foreground">affiliate links</strong>. If you click one
          and buy something, we may earn a small commission —{' '}
          <strong className="font-medium text-foreground">at no extra cost to you</strong>. This{' '}
          <strong className="font-medium text-foreground">never</strong> affects which competitions
          we list, how we rank them, or what we write about them.
        </LegalP>
      </LegalSection>

      <LegalSection id="what" heading="What affiliate links are">
        <LegalP>
          An affiliate link is a normal link with a tracking tag that tells a retailer (for example,
          a bookstore) that a purchase came from us. If you buy after clicking, the retailer pays us
          a small referral commission. You pay the same price you would have anyway — the commission
          comes out of the retailer&apos;s margin, not your pocket.
        </LegalP>
      </LegalSection>

      <LegalSection id="where" heading="Where you'll see them">
        <LegalList>
          <LegalLI>
            Affiliate links appear only among{' '}
            <strong className="font-medium text-foreground">prep resources</strong> (like books and
            study guides) on some competition pages.
          </LegalLI>
          <LegalLI>
            Each affiliate link is clearly labeled with an{' '}
            <strong className="font-medium text-foreground">&ldquo;Affiliate&rdquo;</strong> tag,
            and a short note appears alongside the resources whenever any affiliate link is present.
          </LegalLI>
          <LegalLI>
            Links that send you to a competition&apos;s official site to register are{' '}
            <strong className="font-medium text-foreground">not</strong> affiliate links — we make
            nothing from them.
          </LegalLI>
        </LegalList>
      </LegalSection>

      <LegalSection id="promise" heading="Our promise: commissions never influence our listings">
        <LegalP>
          Our catalog is curated on the merits — relevance, quality, and accuracy — full stop.
          Whether or not a resource earns us a commission plays{' '}
          <strong className="font-medium text-foreground">no part</strong> in:
        </LegalP>
        <LegalList>
          <LegalLI>which competitions we list;</LegalLI>
          <LegalLI>how competitions are ranked, sorted, or featured;</LegalLI>
          <LegalLI>the descriptions, dates, and facts we publish.</LegalLI>
        </LegalList>
        <LegalP>
          We&apos;d only ever suggest a resource we&apos;d be comfortable recommending regardless of
          any commission.
        </LegalP>
      </LegalSection>

      <LegalSection id="why" heading="Why we use them">
        <LegalP>
          Affiliate commissions are one modest, transparent way to help keep BeeCompete free to use.
          We disclose them in line with the U.S. Federal Trade Commission&apos;s endorsement
          guidelines, which call for clear and conspicuous disclosure wherever affiliate links
          appear. You can read more about how we handle data and links in our{' '}
          <LegalLink href="/privacy">Privacy Policy</LegalLink> and{' '}
          <LegalLink href="/terms">Terms of Use</LegalLink>.
        </LegalP>
      </LegalSection>
    </LegalPage>
  );
}
