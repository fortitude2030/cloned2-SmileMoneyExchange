import { createContext, useContext, useState, ReactNode } from "react";
import SimpleTransactionPopup from "@/components/simple-transaction-popup";

interface NotificationData {
  id: string;
  type: "success" | "failure";
}

interface TransactionNotificationContextType {
  showSuccessNotification: () => void;
  showFailureNotification: () => void;
}

const TransactionNotificationContext = createContext<TransactionNotificationContextType | undefined>(undefined);

export function TransactionNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const showNotification = (notification: Omit<NotificationData, "id">) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification = { ...notification, id };
    
    setNotifications(prev => [...prev, newNotification]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const showSuccessNotification = (transactionId: string, amount: string, message?: string) => {
    showNotification({
      type: "success",
      title: "Transaction Approved",
      message: message || "Payment has been processed successfully",
      transactionId,
      amount,
      autoCloseDelay: 5000
    });
  };

  const showFailureNotification = (reason: string, transactionId?: string, amount?: string) => {
    const reasonMessages: Record<string, string> = {
      "mismatched amount": "Cash amount doesn't match merchant request",
      "mismatched vmf number": "VMF number doesn't match merchant request",
      "manual rejection": "Transaction was manually rejected",
      "expired": "Transaction request has expired",
      "insufficient funds": "Insufficient wallet balance",
      "limit exceeded": "Daily transaction limit exceeded"
    };

    showNotification({
      type: "failure",
      title: "Transaction Rejected",
      message: reasonMessages[reason] || `Transaction failed: ${reason}`,
      transactionId,
      amount,
      autoCloseDelay: 6000
    });
  };

  const showPendingNotification = (transactionId: string, amount: string, message?: string) => {
    showNotification({
      type: "pending",
      title: "Processing Transaction",
      message: message || "Awaiting security cashier approval",
      transactionId,
      amount,
      autoCloseDelay: 4000
    });
  };

  return (
    <TransactionNotificationContext.Provider value={{
      showNotification,
      showSuccessNotification,
      showFailureNotification,
      showPendingNotification
    }}>
      {children}
      
      {/* Render notifications */}
      {notifications.map((notification, index) => (
        <TransactionNotification
          key={notification.id}
          isVisible={true}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          transactionId={notification.transactionId}
          amount={notification.amount}
          autoCloseDelay={notification.autoCloseDelay}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </TransactionNotificationContext.Provider>
  );
}

export function useTransactionNotifications() {
  const context = useContext(TransactionNotificationContext);
  if (!context) {
    throw new Error("useTransactionNotifications must be used within a TransactionNotificationProvider");
  }
  return context;
}