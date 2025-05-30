import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateQRCode } from "@/lib/qr-utils";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  onAmountChange: (amount: string) => void;
}

export default function QRCodeModal({ isOpen, onClose, amount, onAmountChange }: QRCodeModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  const handleGenerateQR = async () => {
    try {
      const paymentData = {
        amount: parseFloat(amount),
        type: "cash_digitization",
        timestamp: Date.now(),
      };
      const qrUrl = await generateQRCode(JSON.stringify(paymentData));
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return `KSH ${parseFloat(amount.toString()).toLocaleString()}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-center">Payment Request QR</DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Request</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="Enter amount"
            />
          </div>

          {!qrCodeUrl ? (
            <div className="w-48 h-48 mx-auto bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <i className="fas fa-qrcode text-6xl text-gray-400 mb-2"></i>
                <p className="text-gray-600 dark:text-gray-400 text-sm">QR Code</p>
                <Button 
                  onClick={handleGenerateQR}
                  className="mt-2 text-xs"
                  size="sm"
                >
                  Generate QR
                </Button>
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
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Amount Requested</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {formatCurrency(amount || "0")}
            </p>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Show this QR code to the security cashier to complete the transaction
          </p>
          
          <Button onClick={onClose} className="w-full bg-primary text-white">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
