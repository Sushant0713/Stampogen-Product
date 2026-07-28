'use client';

import { Card } from '@/components/cards/Card';

export function PortalPlaceholder({ title, description }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">
          {description || `${title} module will be available here soon.`}
        </p>
      </div>

      <Card>
        <p className="text-sm text-muted-foreground">
          This is a placeholder page for the Super Admin portal.
        </p>
      </Card>
    </div>
  );
}
