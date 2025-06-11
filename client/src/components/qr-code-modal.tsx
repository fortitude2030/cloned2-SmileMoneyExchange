import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [uniqueId] = useState(() => `QR${Date.now()}${Math.random().toString(36).substr(2, 9)}`);
  
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

  // Expire QR code immediately when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setIsQrExpired(true);
    }
  }, [isOpen]);

  const handleGenerateQR = async () => {
    try {
      // Create a new QR transaction first, then generate QR code
      const transactionData = {
        type: 'qr_code_payment',
        amount: amount,
        vmfNumber: vmfNumber,
        description: `QR Payment - ${vmfNumber}`,
        currency: 'ZMW'
      };

      // Create the transaction
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

      // Generate secure QR code for the new transaction
      const qrResponse = await fetch('/api/qr-codes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          transactionId: transaction.id
        })
      });

      if (!qrResponse.ok) {
        const errorData = await qrResponse.json();
        throw new Error(errorData.message || 'Failed to generate QR code');
      }

      const qrData = await qrResponse.json();
      setQrCodeUrl(qrData.qrImageUrl);
      
    } catch (error) {
      console.error("Error generating QR code:", error);
      setQrCodeUrl("");
    }
  };

  const formatCurrency = (amount: string | number) => {
    return `ZMW ${Math.round(parseFloat(amount.toString())).toLocaleString()}`;
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
                className="w-full h-full object-contain"
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
