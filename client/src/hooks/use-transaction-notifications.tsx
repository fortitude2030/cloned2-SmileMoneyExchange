import { createContext, useContext, useState, ReactNode } from "react";
import SimpleTransactionPopup from "@/components/simple-transaction-popup";

interface TransactionNotificationContextType {
  showSuccessNotification: () => void;
  showFailureNotification: () => void;
  showPendingNotification: () => void;
}

const TransactionNotificationContext = createContext<TransactionNotificationContextType | undefined>(undefined);

export function TransactionNotificationProvider({ children }: { children: ReactNode }) {
  const [currentPopup, setCurrentPopup] = useState<{ type: "success" | "failure"; visible: boolean } | null>(null);

  const showSuccessNotification = () => {
    setCurrentPopup({ type: "success", visible: true });
  };

  const showFailureNotification = () => {
    setCurrentPopup({ type: "failure", visible: true });
  };

  const showPendingNotification = () => {
    // For pending notifications, we'll just ignore them since we simplified to success/failure only
  };

  const closePopup = () => {
    setCurrentPopup(null);
  };

  const value = {
    showSuccessNotification,
    showFailureNotification,
    showPendingNotification
  };

  return (
    <TransactionNotificationContext.Provider value={value}>
      {children}
      {currentPopup && (
        <SimpleTransactionPopup
          isVisible={currentPopup.visible}
          type={currentPopup.type}
          onClose={closePopup}
        />
      )}
    </TransactionNotificationContext.Provider>
  );
}

export function useTransactionNotifications() {
  const context = useContext(TransactionNotificationContext);
  if (context === undefined) {
    throw new Error('useTransactionNotifications must be used within a TransactionNotificationProvider');
  }
  return context;
}