import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parsePaymentQR, validatePaymentQR } from "@/lib/qr-utils";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (qrData: any) => void;
  expectedAmount?: string;
}

export default function QRScannerComponent({ isOpen, onClose, onScanSuccess, expectedAmount }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanner, setScanner] = useState<QrScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen || !videoRef.current) return;

    const initializeScanner = async () => {
      try {
        // Check camera permission
        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) {
          setError("No camera found on this device");
          setHasPermission(false);
          return;
        }

        const qrScanner = new QrScanner(
          videoRef.current!,
          (result) => {
            try {
              // Parse and validate QR code data
              const qrData = parsePaymentQR(result.data);
              
              if (!qrData) {
                setError("Invalid QR code format");
                return;
              }

              if (!validatePaymentQR(qrData)) {
                setError("QR code validation failed");
                return;
              }

              // Check amount if expected
              if (expectedAmount && Math.round(qrData.amount) !== Math.round(parseFloat(expectedAmount))) {
                setError(`Amount mismatch: Expected ${expectedAmount}, got ${qrData.amount}`);
                return;
              }

              setIsScanning(false);
              qrScanner.stop();
              onScanSuccess(qrData);
            } catch (err) {
              console.error("QR scan error:", err);
              setError("Failed to process QR code");
            }
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 5,
          }
        );

        setScanner(qrScanner);
        await qrScanner.start();
        setIsScanning(true);
        setHasPermission(true);
        setError("");

      } catch (err: any) {
        console.error("Scanner initialization error:", err);
        if (err.name === 'NotAllowedError') {
          setError("Camera permission denied. Please allow camera access.");
          setHasPermission(false);
        } else {
          setError("Failed to start camera");
          setHasPermission(false);
        }
      }
    };

    initializeScanner();

    return () => {
      if (scanner) {
        scanner.stop();
        scanner.destroy();
      }
    };
  }, [isOpen, expectedAmount]);

  const handleClose = () => {
    if (scanner) {
      scanner.stop();
      scanner.destroy();
      setScanner(null);
    }
    setIsScanning(false);
    setError("");
    setHasPermission(null);
    onClose();
  };

  const requestCameraPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      setHasPermission(true);
      setError("");
      // Reinitialize scanner after permission granted
      if (videoRef.current) {
        const qrScanner = new QrScanner(
          videoRef.current,
          (result) => {
            try {
              const qrData = parsePaymentQR(result.data);
              if (qrData && validatePaymentQR(qrData)) {
                setIsScanning(false);
                qrScanner.stop();
                onScanSuccess(qrData);
              } else {
                setError("Invalid QR code");
              }
            } catch (err) {
              setError("Failed to process QR code");
            }
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 5,
          }
        );
        setScanner(qrScanner);
        qrScanner.start();
        setIsScanning(true);
      }
    } catch (err) {
      setError("Camera permission denied");
      setHasPermission(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-center">Scan QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {hasPermission === false ? (
            <div className="text-center py-8">
              <i className="fas fa-camera-slash text-4xl text-red-500 mb-4"></i>
              <p className="text-red-600 dark:text-red-400 font-medium mb-2">Camera Access Required</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Please allow camera access to scan QR codes
              </p>
              <Button onClick={requestCameraPermission} className="bg-blue-600 hover:bg-blue-700 text-white">
                <i className="fas fa-camera mr-2"></i>
                Enable Camera
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover rounded-lg bg-black"
                  style={{ transform: 'scaleX(-1)' }}
                />
                
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-blue-500 rounded-lg relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center">
                    <i className="fas fa-exclamation-triangle mr-2"></i>
                    {error}
                  </p>
                </div>
              )}

              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Position the QR code within the frame to scan
                </p>
                {expectedAmount && (
                  <p className="text-blue-600 dark:text-blue-400 text-sm font-medium mt-1">
                    Expected amount: ZMW {parseFloat(expectedAmount).toLocaleString()}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex space-x-3">
            <Button 
              onClick={handleClose} 
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            {isScanning && (
              <Button 
                onClick={() => setError("")}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <i className="fas fa-redo mr-2"></i>
                Try Again
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}