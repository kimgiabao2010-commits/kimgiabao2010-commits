import React from 'react';
import './InputField.css';

const InputField = ({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  error,
  ...rest
}) => (
  <div className={`input-field ${className}`}>
    {label && <label className="input-field__label" htmlFor={id}>{label}</label>}
    <input
      id={id}
      type={type}
      className={`input-field__input ${error ? 'input-field__input--error' : ''}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      {...rest}
    />
    {error && <span className="input-field__error">{error}</span>}
  </div>
);

export default InputField;
