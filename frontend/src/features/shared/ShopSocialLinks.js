'use client';

/** Shared social link definitions for admin edit + customer display. */

export const SOCIAL_LINK_FIELDS = [
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/your-page',
    color: '#1877F2',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/your-handle',
    color: '#E4405F',
  },
  {
    key: 'x',
    label: 'X',
    placeholder: 'https://x.com/your-handle',
    color: '#111827',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@your-channel',
    color: '#FF0000',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    placeholder: 'https://wa.me/91XXXXXXXXXX',
    color: '#25D366',
  },
  {
    key: 'googleReview',
    label: 'Google Review',
    placeholder: 'https://g.page/r/your-review-link',
    color: '#EA4335',
  },
];

export function emptySocialLinks() {
  return Object.fromEntries(SOCIAL_LINK_FIELDS.map((f) => [f.key, '']));
}

export function normalizeHref(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^whatsapp:/i.test(value)) return value;
  if (/^wa\.me\//i.test(value) || /^www\./i.test(value)) return `https://${value}`;
  if (/^\+?\d{8,15}$/.test(value.replace(/[\s-]/g, ''))) {
    const digits = value.replace(/\D/g, '');
    return `https://wa.me/${digits}`;
  }
  return `https://${value}`;
}

export function activeSocialLinks(links = {}) {
  return SOCIAL_LINK_FIELDS.filter((f) => String(links?.[f.key] || '').trim()).map((f) => ({
    ...f,
    href: normalizeHref(links[f.key]),
  }));
}

function IconBase({ children, ...props }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      {children}
    </svg>
  );
}

export function SocialPlatformIcon({ platform }) {
  switch (platform) {
    case 'facebook':
      return (
        <IconBase>
          <path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H8v3h3v7h3v-7h3l1-3h-4V9c0-.6.4-1 1-1z" />
        </IconBase>
      );
    case 'instagram':
      return (
        <IconBase>
          <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 4.5A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5zm0 7.2A2.7 2.7 0 1 1 14.7 12 2.7 2.7 0 0 1 12 14.7zM17.8 6.9a1.1 1.1 0 1 0 1.1 1.1 1.1 1.1 0 0 0-1.1-1.1z" />
        </IconBase>
      );
    case 'x':
      return (
        <IconBase>
          <path d="M4 4h4.6l3.5 4.8L16.8 4H20l-5.5 6.5L20 20h-4.6l-3.8-5.2L7.2 20H4l5.8-6.9L4 4z" />
        </IconBase>
      );
    case 'youtube':
      return (
        <IconBase>
          <path d="M23 12.2s0-3.4-.4-5a2.9 2.9 0 0 0-2-2C18.7 4.7 12 4.7 12 4.7s-6.7 0-8.6.5a2.9 2.9 0 0 0-2 2c-.4 1.6-.4 5-.4 5s0 3.4.4 5a2.9 2.9 0 0 0 2 2c1.9.5 8.6.5 8.6.5s6.7 0 8.6-.5a2.9 2.9 0 0 0 2-2c.4-1.6.4-5 .4-5zM9.8 15.5v-6.6l6.3 3.3-6.3 3.3z" />
        </IconBase>
      );
    case 'whatsapp':
      return (
        <IconBase>
          <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3zm0 1.6a7.4 7.4 0 0 1 6.2 11.4l-.3.4.2 1.3-1.3-.2-.4.2A7.4 7.4 0 0 1 12 4.6zm4.2 9.5c-.2-.1-1.3-.6-1.5-.7s-.3-.1-.5.1-.6.7-.7.8-.3.2-.5.1a5.2 5.2 0 0 1-2.5-2.2c-.2-.3 0-.4.1-.6l.4-.5.1-.3-.1-.4c0-.1-.5-1.2-.7-1.6s-.4-.4-.5-.4h-.4c-.1 0-.4.1-.6.3s-.8.8-.8 1.9.8 2.2.9 2.3a7.8 7.8 0 0 0 3.3 2.7c1.2.5 1.6.4 1.9.4.3 0 .9-.4 1-.7s.1-.6.1-.7 0-.2-.1-.3z" />
        </IconBase>
      );
    case 'googleReview':
      return (
        <IconBase>
          <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z" />
        </IconBase>
      );
    default:
      return null;
  }
}

export function ShopSocialLinks({ links, className = '' }) {
  const items = activeSocialLinks(links);
  if (!items.length) return null;

  return (
    <div className={className}>
      <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94A3B8]">
        Connect with us
      </p>
      <div className="flex flex-wrap gap-2.5">
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-2.5 shadow-[0_6px_16px_rgba(2,26,84,0.06)] transition hover:-translate-y-0.5 hover:border-transparent hover:shadow-[0_10px_22px_rgba(2,26,84,0.12)]"
            style={{ ['--brand']: item.color }}
            aria-label={item.label}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition group-hover:scale-105"
              style={{ backgroundColor: item.color }}
            >
              <SocialPlatformIcon platform={item.key} />
            </span>
            <span className="pr-1 text-[12px] font-bold text-[#021A54]">{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
