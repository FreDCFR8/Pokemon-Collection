import type { ReactNode } from 'react';

type BadgeProps = {
  children: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
};

export function Badge({ children, tone = 'brand' }: BadgeProps) {
  const toneClass = tone === 'brand' ? '' : ` ui-badge--${tone}`;
  return <span className={`ui-badge${toneClass}`}>{children}</span>;
}
