import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateQRCode } from "@/lib/qr-utils";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  vmfNumber: string;
}

export default function QRCodeModal({ isOpen, onClose, amount, vmfNumber }: QRCodeModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [uniqueId] = useState(() => `QR${Date.now()}${Math.random().toString(36).substr(2, 9)}`);

  // Auto-generate QR code when modal opens
  useEffect(() => {
    if (isOpen && amount && vmfNumber) {
      handleGenerateQR();
    }
  }, [isOpen, amount, vmfNumber]);

  const handleGenerateQR = async () => {
    try {
      const paymentData = {
        amount: parseFloat(amount),
        type: "cash_digitization",
        timestamp: Date.now(),
        vmfNumber: vmfNumber,
        uniqueId: uniqueId,
      };
      const qrUrl = await generateQRCode(JSON.stringify(paymentData));
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return `ZMW ${Math.round(parseFloat(amount.toString())).toLocaleString()}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-center">Payment Request QR</DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          {!qrCodeUrl ? (
            <div className="w-48 h-48 mx-auto bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-2"></i>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Generating QR Code...</p>
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
          
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-green-700 dark:text-green-400 font-medium mb-1">Amount</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-200">
                  {formatCurrency(amount || "0")}
                </p>
              </div>
              <div>
                <p className="text-green-700 dark:text-green-400 font-medium mb-1">VMF Number</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-200">
                  {vmfNumber}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
              <p className="text-green-700 dark:text-green-400 font-medium mb-1">QR Code ID</p>
              <p className="text-xs text-green-600 dark:text-green-400 font-mono">
                {uniqueId}
              </p>
            </div>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Show this QR code to the security cashier to complete the transaction
          </p>
          
          <Button onClick={onClose} className="w-full bg-green-600 hover:bg-green-700 text-white">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
