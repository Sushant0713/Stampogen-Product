'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AffiliateGuidePage = dynamic(
  () =>
    import('@/features/affiliate/AffiliateGuidePage').then((module) => module.AffiliateGuidePage),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AffiliateGuideRoutePage() {
  return <AffiliateGuidePage />;
}
