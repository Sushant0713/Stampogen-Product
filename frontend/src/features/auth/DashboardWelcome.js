'use client';

import { Card } from '@/components/cards/Card';
import { useUser } from '@/contexts/UserContext';
import { ROLE_LABELS } from '@/constants';

export function DashboardWelcome({ role }) {
  const { fullName } = useUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{ROLE_LABELS[role]}</h1>
        <p className="page-subtitle">Welcome back{fullName ? `, ${fullName}` : ''}.</p>
      </div>

      <Card>
        <p className="text-sm text-muted-foreground">
          This is your {ROLE_LABELS[role]} dashboard shell. Modules will be added here as the
          platform grows.
        </p>
      </Card>
    </div>
  );
}
