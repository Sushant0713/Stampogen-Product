'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const FeatureList = dynamic(
  () => import('@/features/super-admin/FeatureList').then((m) => m.FeatureList),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminFeaturesPage() {
  return <FeatureList />;
}
