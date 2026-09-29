import React from 'react';

interface PageProps {
  title: string;
  children: React.ReactNode;
}

const Page: React.FC<PageProps> = ({ title, children }) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{title}</h1>
      {children}
    </div>
  );
};

export default Page;
