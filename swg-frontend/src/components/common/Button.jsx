import React from 'react';
import './Button.css';

/**
 * @param {'primary'|'secondary'|'ghost'|'danger'} variant
 * @param {'sm'|'md'|'lg'} size
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  id,
  className = '',
  type = 'button',
  ...rest
}) => {
  return (
    <button
      id={id}
      type={type}
      className={`btn btn--${variant} btn--${size} ${loading ? 'btn--loading' : ''} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading && <span className="btn-spinner" />}
      <span className={loading ? 'btn-content--hidden' : ''}>{children}</span>
    </button>
  );
};

export default Button;
