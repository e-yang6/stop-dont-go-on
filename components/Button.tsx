import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const baseStyles = 'px-6 py-3 rounded-full font-semibold text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  let variantStyles: string;

  switch (variant) {
    case 'primary':
      variantStyles = 'bg-zinc-600 hover:bg-zinc-700 active:bg-zinc-800 text-white focus:ring-zinc-500';
      break;
    case 'secondary':
      variantStyles = 'bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-zinc-100 focus:ring-zinc-400';
      break;
    case 'danger':
      variantStyles = 'bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white focus:ring-rose-600';
      break;
    default:
      variantStyles = 'bg-zinc-600 hover:bg-zinc-700 active:bg-zinc-800 text-white focus:ring-zinc-500';
  }

  const disabledStyles = 'opacity-50 cursor-not-allowed';

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${props.disabled ? disabledStyles : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;