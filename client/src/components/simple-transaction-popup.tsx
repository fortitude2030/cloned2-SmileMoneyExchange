import { useEffect } from "react";

interface SimpleTransactionPopupProps {
  isVisible: boolean;
  type: "success" | "failure";
  onClose: () => void;
}

export default function SimpleTransactionPopup({ isVisible, type, onClose }: SimpleTransactionPopupProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className={`
        w-32 h-32 rounded-full flex items-center justify-center
        animate-[scale-in_0.3s_ease-out]
        ${type === 'success' 
          ? 'bg-green-500 text-white' 
          : 'bg-red-500 text-white'
        }
      `}>
        <div className="text-center">
          <div className="text-4xl mb-2">
            {type === 'success' ? '✓' : '✕'}
          </div>
          <div className="text-sm font-medium leading-tight">
            {type === 'success' ? 'Transaction\nSuccessful' : 'Transaction\nUnsuccessful'}
          </div>
        </div>
      </div>
    </div>
  );
}