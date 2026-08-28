'use client';

import { useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { Hub } from '../components/Hub';
import { Workbench } from '../components/Workbench';

type ViewState = 'hub' | 'workbench';

export default function StudioPage() {
  const [view, setView] = useState<ViewState>('hub');
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);

  const handleOpenWorkflow = (id: string) => {
    setActiveWorkflowId(id);
    setView('workbench');
  };

  const handleNavClick = (newView: ViewState) => {
    if (newView === 'hub') {
      setActiveWorkflowId(null);
    }
    setView(newView);
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans overflow-hidden">
      {/* Header Navigation - Fixed prop names to match AppHeader interface */}
      <AppHeader view={view} onViewChange={handleNavClick} />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {view === 'hub' ? (
          <Hub onOpenWorkflow={handleOpenWorkflow} />
        ) : (
          <Workbench initialWorkflowId={activeWorkflowId} />
        )}
      </main>
    </div>
  );
}
