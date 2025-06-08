import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parsePaymentQR, validatePaymentQR } from "@/lib/qr-utils";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: any) => void;
  pendingTransactions: any[];
}

export default function QRScanner({ isOpen, onClose, onScanSuccess, pendingTransactions }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const [cameraPermission, setCameraPermission] = useState<string>("prompt");
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    if (isOpen) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async () => {
    try {
      setError("");
      setIsScanning(true);

      // Check camera permissions
      try {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(permission.state);

        if (permission.state === 'denied') {
          setError("Camera access denied. Please enable camera permissions.");
          setIsScanning(false);
          return;
        }
      } catch (err) {
        // Fallback if permissions API not available
        console.log("Permissions API not available, proceeding with camera access");
      }

      // Initialize code reader
      codeReaderRef.current = new BrowserMultiFormatReader();
      
      // Get available video devices
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        setError("No camera devices found.");
        setIsScanning(false);
        return;
      }

      // Use back camera if available, otherwise use first available
      const selectedDevice = videoInputDevices.find((device: any) => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      ) || videoInputDevices[0];

      // Start decoding
      if (codeReaderRef.current && videoRef.current) {
        codeReaderRef.current.decodeFromVideoDevice(
          selectedDevice.deviceId,
          videoRef.current,
          (result: any, error: any) => {
            if (result) {
              handleScanResult(result.getText());
            }
            if (error && !(error instanceof NotFoundException)) {
              console.error("QR Scanner error:", error);
            }
          }
        );
      }

    } catch (err: any) {
      console.error("Failed to start camera:", err);
      setError("Failed to access camera. Please check permissions.");
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (e) {
        console.log("Scanner already stopped");
      }
      codeReaderRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanResult = (scannedData: string) => {
    try {
      // Parse the QR code data
      const paymentData = parsePaymentQR(scannedData);
      
      if (!paymentData || !validatePaymentQR(paymentData)) {
        setError("Invalid QR code format. Please scan a valid payment QR code.");
        return;
      }

      // Match against pending transactions
      const matchingTransaction = pendingTransactions.find((transaction: any) => {
        const amountMatch = Math.abs(parseFloat(transaction.amount) - paymentData.amount) < 0.01;
        const vmfMatch = transaction.vmfNumber === paymentData.vmfNumber;
        
        // Check if transaction is still active (not expired)
        if (transaction.expiresAt) {
          const expiresAt = new Date(transaction.expiresAt);
          const isActive = expiresAt > new Date();
          return amountMatch && vmfMatch && isActive;
        }
        
        return amountMatch && vmfMatch;
      });

      if (matchingTransaction) {
        onScanSuccess({
          transaction: matchingTransaction,
          scannedData: paymentData,
          amount: paymentData.amount.toString(),
          vmfNumber: paymentData.vmfNumber || ""
        });
        onClose();
      } else {
        setError("No matching active transaction found for this QR code.");
      }

    } catch (err) {
      console.error("Error processing QR code:", err);
      setError("Failed to process QR code. Please try again.");
    }
  };

  const handleRetry = () => {
    setError("");
    startScanning();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-center">Scan Payment QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                <i className="fas fa-exclamation-triangle text-red-500 text-xl"></i>
              </div>
              <div>
                <p className="text-red-600 dark:text-red-400 font-medium mb-2">Scan Failed</p>
                <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleRetry} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  <i className="fas fa-redo mr-2"></i>
                  Try Again
                </Button>
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Camera Preview */}
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 bg-black rounded-lg object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                
                {/* Scanning Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white rounded-lg relative">
                    {/* Corner indicators */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-success rounded-tl"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-success rounded-tr"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-success rounded-bl"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-success rounded-br"></div>
                    
                    {/* Scanning line animation */}
                    {isScanning && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-success animate-pulse"></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-center space-y-2">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {isScanning ? "Scanning for QR code..." : "Position QR code within the frame"}
                </p>
                <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 dark:text-gray-500">
                  <i className="fas fa-info-circle"></i>
                  <span>Make sure the QR code is clearly visible</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Button 
                  onClick={onClose} 
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={isScanning ? stopScanning : startScanning}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white"
                >
                  {isScanning ? (
                    <>
                      <i className="fas fa-stop mr-2"></i>
                      Stop
                    </>
                  ) : (
                    <>
                      <i className="fas fa-play mr-2"></i>
                      Start
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}