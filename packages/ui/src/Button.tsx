import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ variant = 'primary', style, ...rest }: ButtonProps): React.JSX.Element {
  const baseStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: variant === 'primary' ? '#4263eb' : '#e9ecef',
    color: variant === 'primary' ? 'white' : '#212529',
  };

  return <button style={{ ...baseStyle, ...style }} {...rest} />;
}
