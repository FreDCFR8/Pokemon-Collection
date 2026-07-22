import type { HTMLAttributes, ReactNode } from 'react';

type SurfaceElement = 'article' | 'div' | 'section';

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: SurfaceElement;
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'subtle';
  elevation?: 'raised' | 'flat';
};

export function Surface({
  as: Component = 'section',
  children,
  className = '',
  padding = 'md',
  tone = 'default',
  elevation = 'raised',
  ...props
}: SurfaceProps) {
  const classes = [
    'ui-surface',
    `ui-surface--pad-${padding}`,
    tone === 'subtle' ? 'ui-surface--subtle' : '',
    elevation === 'flat' ? 'ui-surface--flat' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
