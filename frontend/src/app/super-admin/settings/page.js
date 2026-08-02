'use client';

import Link from 'next/link';
import { BarChart3, FileText, Gift, QrCode, ScrollText } from 'lucide-react';

const PRIMARY = '#021A54';

const SETTINGS_ITEMS = [
  {
    title: 'Invoice setting',
    description: 'Edit invoice template, company details, payment info, and live preview.',
    href: '/super-admin/settings/invoice',
    icon: FileText,
  },
  {
    title: 'Terms and conditions',
    description: 'Manage Terms and Conditions for Affiliate Partners and Clients.',
    href: '/super-admin/settings/terms',
    icon: ScrollText,
  },
  {
    title: 'Free trial',
    description: 'Enable free trials, pick the default plan and days, and apply on public signup.',
    href: '/super-admin/settings/trial',
    icon: Gift,
  },
  {
    title: 'Free trial reports',
    description: 'See active, expired, and converted trial clients with filters and charts.',
    href: '/super-admin/settings/trial/reports',
    icon: BarChart3,
  },
  {
    title: 'QR codes',
    description: 'Paste a website link to generate a QR, add more, and manage the list.',
    href: '/super-admin/settings/qr',
    icon: QrCode,
  },
  {
    title: 'QR Reports',
    description: 'See scan counts per QR code with date and QR filters.',
    href: '/super-admin/settings/qr/reports',
    icon: BarChart3,
  },
];

export default function SuperAdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#101828]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#667085]">Manage platform-level configuration.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className="group rounded-xl border border-[#ECEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-primary/30 hover:shadow-[0_8px_20px_rgba(2,26,84,0.08)]"
            >
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${PRIMARY}14`, color: PRIMARY }}
              >
                <Icon size={18} />
              </span>
              <h2 className="mt-4 text-base font-semibold text-[#101828] group-hover:text-primary">
                {item.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[#667085]">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
