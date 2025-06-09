import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TransactionNotificationProps {
  isVisible: boolean;
  type: "success" | "failure" | "pending";
  title: string;
  message: string;
  transactionId?: string;
  amount?: string;
  onClose: () => void;
  autoCloseDelay?: number;
}

export default function TransactionNotification({
  isVisible,
  type,
  title,
  message,
  transactionId,
  amount,
  onClose,
  autoCloseDelay = 4000
}: TransactionNotificationProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      onClose();
    }, autoCloseDelay);

    // Progress bar animation
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - (100 / (autoCloseDelay / 100));
        return newProgress <= 0 ? 0 : newProgress;
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      setProgress(100);
    };
  }, [isVisible, autoCloseDelay, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return "fas fa-check-circle";
      case "failure":
        return "fas fa-times-circle";
      case "pending":
        return "fas fa-clock";
      default:
        return "fas fa-info-circle";
    }
  };

  const getColors = () => {
    switch (type) {
      case "success":
        return {
          bg: "bg-green-500",
          border: "border-green-500",
          text: "text-green-600",
          icon: "text-green-500",
          progress: "bg-green-400"
        };
      case "failure":
        return {
          bg: "bg-red-500",
          border: "border-red-500",
          text: "text-red-600",
          icon: "text-red-500",
          progress: "bg-red-400"
        };
      case "pending":
        return {
          bg: "bg-orange-500",
          border: "border-orange-500",
          text: "text-orange-600",
          icon: "text-orange-500",
          progress: "bg-orange-400"
        };
      default:
        return {
          bg: "bg-blue-500",
          border: "border-blue-500",
          text: "text-blue-600",
          icon: "text-blue-500",
          progress: "bg-blue-400"
        };
    }
  };

  const colors = getColors();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
              type: "spring",
              damping: 20,
              stiffness: 300
            }
          }}
          exit={{ 
            opacity: 0, 
            y: -100, 
            scale: 0.8,
            transition: {
              duration: 0.3
            }
          }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm mx-4"
        >
          <div className={`bg-white dark:bg-gray-800 border-l-4 ${colors.border} rounded-lg shadow-2xl overflow-hidden`}>
            {/* Progress bar */}
            <div className="h-1 bg-gray-200 dark:bg-gray-700">
              <motion.div
                className={`h-full ${colors.progress}`}
                initial={{ width: "100%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </div>

            <div className="p-4">
              <div className="flex items-start">
                {/* Icon with pulse animation */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ 
                    scale: 1,
                    transition: {
                      delay: 0.2,
                      type: "spring",
                      damping: 15,
                      stiffness: 300
                    }
                  }}
                  className="flex-shrink-0"
                >
                  <div className={`w-10 h-10 rounded-full ${colors.bg} bg-opacity-20 flex items-center justify-center`}>
                    <motion.i
                      className={`${getIcon()} ${colors.icon} text-lg`}
                      animate={type === "pending" ? { rotate: 360 } : {}}
                      transition={type === "pending" ? { 
                        repeat: Infinity, 
                        duration: 2, 
                        ease: "linear" 
                      } : {}}
                    />
                  </div>
                </motion.div>

                <div className="ml-3 flex-1">
                  <motion.h3
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ 
                      opacity: 1, 
                      x: 0,
                      transition: { delay: 0.3 }
                    }}
                    className={`text-sm font-semibold ${colors.text} dark:text-gray-200`}
                  >
                    {title}
                  </motion.h3>
                  
                  <motion.p
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ 
                      opacity: 1, 
                      x: 0,
                      transition: { delay: 0.4 }
                    }}
                    className="text-sm text-gray-600 dark:text-gray-400 mt-1"
                  >
                    {message}
                  </motion.p>

                  {/* Transaction details */}
                  {(transactionId || amount) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        transition: { delay: 0.5 }
                      }}
                      className="mt-2 space-y-1"
                    >
                      {amount && (
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-300">
                          Amount: ZMW {parseFloat(amount).toLocaleString()}
                        </p>
                      )}
                      {transactionId && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {transactionId}
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Close button */}
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                    transition: { delay: 0.6 }
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <i className="fas fa-times text-sm"></i>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}