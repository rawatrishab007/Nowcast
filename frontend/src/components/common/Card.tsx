import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '' }) => {
  return (
    <div className={`bg-gray-800 p-5 rounded-xl border border-gray-700/80 shadow-lg ${className}`}>
      {title && <h3 className="text-lg font-semibold text-gray-200 mb-4">{title}</h3>}
      {children}
    </div>
  );
};

export default Card;
