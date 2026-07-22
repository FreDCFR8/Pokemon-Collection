import type { ReactNode } from 'react';

type FeedbackStateProps = {
  action?: ReactNode;
  message: string;
  title?: string;
  tone?: 'default' | 'empty' | 'error';
};

export function FeedbackState({ action, message, title, tone = 'default' }: FeedbackStateProps) {
  const toneClass = tone === 'default' ? '' : ` ui-feedback-state--${tone}`;

  return (
    <section className={`ui-feedback-state${toneClass}`} role={tone === 'error' ? 'alert' : undefined}>
      {title ? <strong>{title}</strong> : null}
      <span>{message}</span>
      {action}
    </section>
  );
}
