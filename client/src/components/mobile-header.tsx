interface MobileHeaderProps {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

export default function MobileHeader({ title, subtitle, icon, color }: MobileHeaderProps) {
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'primary':
        return 'bg-primary';
      case 'secondary':
        return 'bg-secondary';
      case 'accent':
        return 'bg-accent';
      case 'red-600':
        return 'bg-red-600';
      default:
        return 'bg-primary';
    }
  };

  return (
    <header className="bg-white dark:bg-black shadow-sm border-b border-gray-200 dark:border-gray-800">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-10 h-10 ${getColorClasses(color)} rounded-xl flex items-center justify-center mr-3`}>
              <i className={`${icon} text-white`}></i>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <i className="fas fa-sign-out-alt text-xl"></i>
          </button>
        </div>
      </div>
    </header>
  );
}
