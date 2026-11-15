import React, { useEffect, useState } from 'react';
import { Compass, Users, Plus, Sun, Moon, Menu, X, UserCircle2 } from 'lucide-react';
import { CollaboratorProfile } from '../types';

export type CleanMenuTab = 'research_workspace' | 'peer_network' | 'account_profile';

interface NavigationProps {
  activeTab: CleanMenuTab;
  onTabChange: (tab: CleanMenuTab) => void;
  onNewAnalysis: () => void;
  totalPeerSamples: number;
  currentUser: CollaboratorProfile | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onNewAnalysis,
  totalPeerSamples,
  currentUser,
  theme,
  onToggleTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayFirstName = currentUser ? currentUser.name.split(' ')[0] : null;

  const tabs: { id: CleanMenuTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'research_workspace',
      label: 'Pesquisa',
      icon: <Compass className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
    },
    {
      id: 'peer_network',
      label: 'Comunidade',
      icon: <Users className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
    },
    {
      id: 'account_profile',
      label: displayFirstName ? `Conta · ${displayFirstName}` : 'Entrar',
      icon: currentUser ? (
        <img
          src={currentUser.avatarUrl}
          alt=""
          className="w-4 h-4 rounded-full object-cover"
        />
      ) : (
        <UserCircle2 className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
      ),
    },
  ];

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleSelectTab = (tabId: CleanMenuTab) => {
    onTabChange(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#FFFFFF] dark:bg-[#161B22] shadow-[0_1px_0_0_rgba(15,23,42,0.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)] transition-colors duration-150">
      <div className="w-full max-w-[1680px] mx-auto px-3 sm:px-5 lg:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Mobile Hamburger Button + Brand Wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-[#0F172A] dark:text-[#F0F6FC] hover:bg-[#F1F5F9] dark:hover:bg-[#21262D] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('research_workspace')}
            className="font-poppins text-base sm:text-lg font-bold tracking-tight text-[#0F172A] dark:text-[#F0F6FC] hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA] rounded-md px-1"
          >
            African Analogs
          </button>
        </div>

        {/* Zone 2: Desktop Clean Underline Navigation */}
        <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-6 h-full">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleSelectTab(tab.id)}
                className={`h-full flex items-center gap-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA] ${
                  isActive
                    ? 'border-[#1E3A8A] dark:border-[#60A5FA] text-[#0F172A] dark:text-[#F0F6FC] font-semibold'
                    : 'border-transparent text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                }`}
              >
                <span className={isActive ? 'text-[#1E3A8A] dark:text-[#60A5FA]' : 'text-[#64748B] dark:text-[#8B949E]'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Switcher + Account Quick Pill + Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            className="min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-0 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-[#0F172A] dark:text-[#F0F6FC] bg-[#F1F5F9] dark:bg-[#21262D] hover:bg-[#E2E8F0] dark:hover:bg-[#30363D] rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-[#FBBF24]" strokeWidth={1.75} aria-hidden="true" />
                <span className="hidden sm:inline">Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-[#1E3A8A]" strokeWidth={1.75} aria-hidden="true" />
                <span className="hidden sm:inline">Escuro</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onNewAnalysis();
              setMobileMenuOpen(false);
            }}
            aria-label="Nova análise"
            className="min-h-[44px] min-w-[44px] sm:min-h-[40px] flex items-center justify-center gap-1.5 py-2 px-3 sm:px-4 text-sm font-medium text-[#FFFFFF] bg-[#1E3A8A] dark:bg-[#2563EB] rounded-md hover:bg-[#1E40AF] dark:hover:bg-[#1D4ED8] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161B22]"
          >
            <Plus className="w-5 h-5 sm:w-4 sm:h-4" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Nova Análise</span>
          </button>
        </div>
      </div>

      {/* Phones: bottom tab bar */}
      <nav
        aria-label="Navegação principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#FFFFFF] dark:bg-[#161B22] shadow-[0_-1px_0_0_rgba(15,23,42,0.08)] dark:shadow-[0_-1px_0_0_rgba(255,255,255,0.08)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleSelectTab(tab.id)}
                  className={`w-full min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA] ${
                    isActive ? 'text-[#1E3A8A] dark:text-[#60A5FA]' : 'text-[#64748B] dark:text-[#8B949E]'
                  }`}
                >
                  <span aria-hidden="true" className={`flex items-center justify-center h-7 w-12 rounded-full ${isActive ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/30' : ''}`}>
                    {tab.icon}
                  </span>
                  <span className="truncate max-w-full px-1">{tab.label.split(' · ')[0]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Responsive Hamburger Menu Drawer (Mobile) */}
      {mobileMenuOpen && (
        <nav
          id="mobile-nav-drawer"
          aria-label="Menu de navegação móvel"
          className="md:hidden bg-[#FFFFFF] dark:bg-[#161B22] px-4 py-3 space-y-1 shadow-md"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full min-h-[44px] px-3 py-2.5 rounded-md flex items-center gap-3 text-sm font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA] ${
                  isActive
                    ? 'bg-[#F1F5F9] dark:bg-[#21262D] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#21262D] hover:text-[#0F172A] dark:hover:text-[#F0F6FC]'
                }`}
              >
                <span className={isActive ? 'text-[#1E3A8A] dark:text-[#60A5FA]' : 'text-[#64748B] dark:text-[#8B949E]'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};

