import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TemplateContextType {
  activeTemplateId: string;
  setActiveTemplateId: (id: string) => void;
  getThemeClass: () => string;
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

export function TemplateProvider({ children }: { children: ReactNode }) {
  const [activeTemplateId, setActiveTemplateIdState] = useState<string>(() => {
    return localStorage.getItem('selectedTemplate') || 't2'; // default to standard
  });

  const setActiveTemplateId = (id: string) => {
    setActiveTemplateIdState(id);
    localStorage.setItem('selectedTemplate', id);
  };

  const getThemeClass = () => {
    switch (activeTemplateId) {
      case 't3': return 'theme-dark';
      case 't5': return 'theme-minimal';
      case 't7': return 'theme-enterprise';
      case 't1': return 'theme-executive';
      default: return 'theme-default';
    }
  };

  useEffect(() => {
    // Apply theme class to body globally
    document.body.className = ''; // reset
    document.body.classList.add(getThemeClass());
  }, [activeTemplateId]);

  return (
    <TemplateContext.Provider value={{ activeTemplateId, setActiveTemplateId, getThemeClass }}>
      {children}
    </TemplateContext.Provider>
  );
}

export function useTemplate() {
  const context = useContext(TemplateContext);
  if (context === undefined) {
    throw new Error('useTemplate must be used within a TemplateProvider');
  }
  return context;
}
