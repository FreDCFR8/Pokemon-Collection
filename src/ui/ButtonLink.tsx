import type { AnchorHTMLAttributes, ReactNode } from 'react';

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
  variant?: 'primary' | 'secondary' | 'quiet';
};

export function ButtonLink({ children, className = '', href, variant = 'primary', ...props }: ButtonLinkProps) {
  return (
    <a className={`ui-button ui-button--${variant} ${className}`.trim()} href={href} {...props}>
      {children}
    </a>
  );
}
