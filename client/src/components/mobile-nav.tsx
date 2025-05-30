interface Tab {
  id: string;
  label: string;
  icon: string;
}

interface MobileNavProps {
  activeTab: string;
  role: string;
  tabs: Tab[];
}

export default function MobileNav({ activeTab, role, tabs }: MobileNavProps) {
  const getActiveColor = (role: string) => {
    switch (role) {
      case 'merchant':
        return 'text-primary';
      case 'cashier':
        return 'text-accent';
      case 'finance':
        return 'text-secondary';
      case 'admin':
        return 'text-red-600';
      default:
        return 'text-primary';
    }
  };

  return (
    <nav className="mobile-nav">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => (
          <button 
            key={tab.id}
            className={`flex flex-col items-center py-2 transition-colors ${
              activeTab === tab.id 
                ? getActiveColor(role) 
                : 'text-gray-400 dark:text-gray-600'
            }`}
          >
            <i className={`${tab.icon} text-xl mb-1`}></i>
            <span className={`text-xs ${activeTab === tab.id ? 'font-medium' : ''}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
