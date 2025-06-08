import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TransactionResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSuccess: boolean;
  amount?: string;
  vmfNumber?: string;
  reason?: string;
}

export default function TransactionResultModal({ 
  isOpen, 
  onClose, 
  isSuccess, 
  amount, 
  vmfNumber, 
  reason 
}: TransactionResultModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowAnimation(true);
      // Auto close after 3 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowAnimation(false);
    }
  }, [isOpen, onClose]);

  const formatCurrency = (amount: string | number) => {
    return `ZMW ${Math.round(parseFloat(amount.toString())).toLocaleString()}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-sm mx-4 text-center">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isSuccess ? "Transaction Successful" : "Transaction Failed"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Animated Icon */}
          <div className={`mx-auto transition-all duration-1000 ${showAnimation ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
            {isSuccess ? (
              <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto relative">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                  <i className="fas fa-check text-white text-3xl"></i>
                </div>
                {/* Success animation rings */}
                <div className="absolute inset-0 rounded-full border-4 border-green-300 animate-ping"></div>
                <div className="absolute inset-2 rounded-full border-2 border-green-400 animate-ping" style={{ animationDelay: '0.5s' }}></div>
              </div>
            ) : (
              <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto relative">
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <i className="fas fa-times text-white text-3xl"></i>
                </div>
                {/* Failure animation rings */}
                <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"></div>
                <div className="absolute inset-2 rounded-full border-2 border-red-400 animate-ping" style={{ animationDelay: '0.5s' }}></div>
              </div>
            )}
          </div>

          {/* Transaction Details */}
          {amount && (
            <div className={`${isSuccess ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
              <p className="text-2xl font-bold mb-2">{formatCurrency(amount)}</p>
              {vmfNumber && (
                <p className="text-sm opacity-75">VMF: {vmfNumber}</p>
              )}
            </div>
          )}

          {/* Status Message */}
          <div className={`p-4 rounded-lg ${
            isSuccess 
              ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-700' 
              : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-700'
          }`}>
            <p className={`font-medium ${
              isSuccess ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
            }`}>
              {isSuccess ? "Cash digitization completed successfully!" : "Transaction could not be processed"}
            </p>
            
            {reason && !isSuccess && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-2">
                Reason: {reason}
              </p>
            )}
            
            {isSuccess && (
              <p className="text-green-600 dark:text-green-400 text-sm mt-2">
                E-value has been credited to merchant wallet
              </p>
            )}
          </div>

          {/* Auto-close indicator */}
          <div className="flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs">
            <i className="fas fa-clock mr-1"></i>
            <span>Closing automatically...</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}