import type { ReactNode } from 'react';

type SectionHeadingProps = {
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  level?: 2 | 3;
  title: string;
};

export function SectionHeading({ action, description, eyebrow, level = 2, title }: SectionHeadingProps) {
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <header className="ui-section-heading">
      <div className="ui-section-heading__copy">
        {eyebrow ? <p className="ui-section-heading__eyebrow">{eyebrow}</p> : null}
        <Heading>{title}</Heading>
        {description ? <p className="ui-section-heading__description">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
