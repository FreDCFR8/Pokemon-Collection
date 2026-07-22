import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'quiet';
};

export function Button({ children, className = '', type = 'button', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button className={`ui-button ui-button--${variant} ${className}`.trim()} type={type} {...props}>
      {children}
    </button>
  );
}

type ButtonLinkProps = {
  children: ReactNode;
  className?: string;
  href: string;
  variant?: 'primary' | 'secondary' | 'quiet';
};

export function ButtonLink({ children, className = '', href, variant = 'primary' }: ButtonLinkProps) {
  return (
    <a className={`ui-button ui-button--${variant} ${className}`.trim()} href={href}>
      {children}
    </a>
  );
}
