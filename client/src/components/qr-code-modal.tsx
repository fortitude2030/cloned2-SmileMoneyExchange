import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { generateQRCode } from "@/lib/qr-utils";
import { useTimer } from "@/contexts/timer-context";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  vmfNumber: string;
}

export default function QRCodeModal({ isOpen, onClose, amount, vmfNumber }: QRCodeModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [nextQrCodeUrl, setNextQrCodeUrl] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [uniqueId] = useState(() => `QR${Date.now()}${Math.random().toString(36).substr(2, 9)}`);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Use global timer system
  const { timeLeft, isActive, startTimer, markInteraction, stopTimer } = useTimer();
  const [isQrExpired, setIsQrExpired] = useState(false);
  const isExpired = !isActive && timeLeft === 0;

  // Auto-generate QR code when modal opens (timer controlled by cashier dashboard)
  useEffect(() => {
    if (isOpen && amount && vmfNumber) {
      handleGenerateQR();
      setIsQrExpired(false); // Reset expiration state when opening
      // Don't start timer here - it's controlled by the cashier dashboard
    }
  }, [isOpen, amount, vmfNumber]);

  // Expire QR code immediately when timer expires (30s or 120s)
  useEffect(() => {
    if (!isActive && timeLeft === 0) {
      setIsQrExpired(true);
    }
  }, [isActive, timeLeft]);

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setIsQrExpired(true);
      setQrCodeUrl("");
      setTransactionId("");
    }
  }, [isOpen]);

  const handleGenerateQR = async (isPreload = false) => {
    try {
      // Only create transaction once, store the ID for refreshes
      if (!transactionId) {
        const transactionData = {
          type: 'qr_code_payment',
          amount: Math.floor(parseFloat(amount)).toString(),
          vmfNumber: vmfNumber,
          description: `QR Payment - ${vmfNumber}`,
          currency: 'ZMW'
        };

        const transactionResponse = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(transactionData)
        });

        if (!transactionResponse.ok) {
          const errorData = await transactionResponse.json();
          throw new Error(errorData.message || 'Failed to create transaction');
        }

        const transaction = await transactionResponse.json();
        setTransactionId(transaction.transactionId);
      }

      // Generate QR code client-side with fresh nonce and timestamp
      const { generatePaymentQR } = await import('@/lib/qr-utils');
      const qrDataUrl = await generatePaymentQR(
        transactionId || 'pending',
        Math.floor(parseFloat(amount)).toString(),
        'qr_code_payment'
      );
      
      if (isPreload) {
        setNextQrCodeUrl(qrDataUrl);
      } else {
        setQrCodeUrl(qrDataUrl);
      }
      
    } catch (error) {
      console.error("Error generating QR code:", error);
      if (!isPreload) {
        setQrCodeUrl("");
      }
    }
  };

  // Smooth QR transition function
  const swapQRCodes = () => {
    if (nextQrCodeUrl) {
      setIsUpdating(true);
      setTimeout(() => {
        setQrCodeUrl(nextQrCodeUrl);
        setNextQrCodeUrl("");
        setIsUpdating(false);
      }, 50); // Brief transition
    }
  };

  // Auto-refresh QR code every 2 seconds while modal is open and timer is active
  useEffect(() => {
    if (!isOpen || isQrExpired || !isActive) return;

    const interval = setInterval(() => {
      if (transactionId) {
        // Preload next QR code first
        handleGenerateQR(true).then(() => {
          // Then smoothly swap to it
          swapQRCodes();
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, isQrExpired, isActive, transactionId, amount]);

  const formatCurrency = (amount: string | number) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return 'ZMW 0';
    // Use Math.floor to truncate decimals without rounding
    const truncatedAmount = Math.floor(numericAmount);
    return `ZMW ${truncatedAmount.toLocaleString()}`;
  };

  const progressPercentage = ((60 - timeLeft) / 60) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={() => {
      // Prevent closing QR modal - must remain open for cashier scanning
      console.log("QR modal must remain open for scanning");
    }}>
      <DialogContent className="w-full max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isExpired ? "QR Code Expired" : "Payment Request QR"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isExpired ? "Please generate a new QR code to continue" : "Scan this QR code to complete the payment"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          {/* Countdown Timer */}
          <div className={`p-3 rounded-lg border ${
            timeLeft <= 10 
              ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700' 
              : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${
                timeLeft <= 10 
                  ? 'text-red-700 dark:text-red-300' 
                  : 'text-blue-700 dark:text-blue-300'
              }`}>
                {isExpired ? 'Expired' : 'Time Remaining'}
              </span>
              <span className={`text-lg font-bold ${
                timeLeft <= 10 
                  ? 'text-red-800 dark:text-red-200' 
                  : 'text-blue-800 dark:text-blue-200'
              }`}>
                {isExpired ? '00:00' : `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`}
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className={`h-2 ${timeLeft <= 10 ? 'bg-red-200' : 'bg-blue-200'}`}
            />
          </div>

          {!qrCodeUrl ? (
            <div className="w-48 h-48 mx-auto bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-2"></i>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Generating QR Code...</p>
              </div>
            </div>
          ) : (isExpired || isQrExpired) ? (
            <div className="w-48 h-48 mx-auto bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center border border-red-200 dark:border-red-700">
              <div className="text-center">
                <i className="fas fa-times-circle text-6xl text-red-500 mb-3"></i>
                <p className="text-red-600 dark:text-red-400 font-medium">QR Code Expired</p>
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">Generate a new one</p>
              </div>
            </div>
          ) : (
            <div className="qr-code-container w-48 h-48 mx-auto">
              <img 
                src={qrCodeUrl} 
                alt="Payment QR Code" 
                className={`w-full h-full object-contain transition-opacity duration-100 ${
                  isUpdating ? 'opacity-90' : 'opacity-100'
                }`}
              />
            </div>
          )}
          

          
          {!(isExpired || isQrExpired) ? (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Show this QR code to the security cashier to complete the transaction
            </p>
          ) : (
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
              This QR code has expired. Please generate a new payment request.
            </p>
          )}
          
          <div className="flex gap-2">
            {(isExpired || isQrExpired) && (
              <Button 
                onClick={() => {
                  setIsQrExpired(false);
                  startTimer();
                  markInteraction();
                  handleGenerateQR();
                }} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <i className="fas fa-redo mr-2"></i>
                Generate New QR
              </Button>
            )}
            <Button 
              onClick={() => {
                setIsQrExpired(true); // Expire QR immediately when closing
                onClose();
              }} 
              className={`${(isExpired || isQrExpired) ? 'flex-1' : 'w-full'} ${
                (isExpired || isQrExpired) 
                  ? 'bg-gray-600 hover:bg-gray-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white`}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
