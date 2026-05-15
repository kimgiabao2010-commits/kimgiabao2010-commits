import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'md', label }) => (
  <div className={`spinner-wrap spinner-wrap--${size}`} role="status" aria-label={label || 'Loading'}>
    <div className="spinner-ring" />
    {label && <span className="spinner-label">{label}</span>}
  </div>
);

export default LoadingSpinner;
