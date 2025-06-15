import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onError: (error: string) => void;
  maxSizeKB?: number;
  quality?: number;
  disabled?: boolean;
}

export default function CameraCapture({ 
  onCapture, 
  onError, 
  maxSizeKB = 1024, 
  quality = 0.8,
  disabled = false 
}: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Cleanup function to reset file input
  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Compress image to target size
  const compressImage = useCallback(async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = canvasRef.current;
      
      if (!canvas) {
        reject(new Error('Canvas not available'));
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        try {
          // Calculate dimensions to maintain aspect ratio
          const maxWidth = 1200;
          const maxHeight = 1600;
          let { width, height } = img;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Convert to greyscale and draw
          ctx.filter = 'grayscale(100%) contrast(1.2)';
          ctx.drawImage(img, 0, 0, width, height);

          // Try different quality levels until we hit target size
          let currentQuality = quality;
          let attempts = 0;
          const maxAttempts = 5;

          const tryCompress = () => {
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to create compressed image'));
                return;
              }

              const sizeKB = blob.size / 1024;
              
              if (sizeKB <= maxSizeKB || attempts >= maxAttempts) {
                // Convert blob to File
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                // Reduce quality and try again
                attempts++;
                currentQuality *= 0.8;
                setTimeout(() => tryCompress(), 10);
              }
            }, 'image/jpeg', currentQuality);
          };

          tryCompress();
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  }, [maxSizeKB, quality]);

  // Handle file selection and processing
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      resetFileInput();
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      onError('Please select an image file');
      resetFileInput();
      return;
    }

    // Check minimum size
    if (file.size < 1000) {
      onError('Image file is too small. Please take the photo again.');
      resetFileInput();
      return;
    }

    // Check maximum size (before compression)
    if (file.size > 50 * 1024 * 1024) { // 50MB limit before compression
      onError('Image file is too large. Please try again.');
      resetFileInput();
      return;
    }

    setIsProcessing(true);

    try {
      // Compress the image
      const compressedFile = await compressImage(file);
      
      // Final size check
      const finalSizeKB = compressedFile.size / 1024;
      console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${finalSizeKB.toFixed(0)}KB`);
      
      if (finalSizeKB > maxSizeKB * 1.1) { // Allow 10% tolerance
        onError(`Image is still too large (${finalSizeKB.toFixed(0)}KB). Please try a simpler document.`);
        resetFileInput();
        return;
      }

      // Success - call the callback
      onCapture(compressedFile);
      
      // Show success feedback
      toast({
        title: "Photo Captured",
        description: `Document photo compressed to ${finalSizeKB.toFixed(0)}KB`,
      });

    } catch (error) {
      console.error('Image compression error:', error);
      onError('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
      resetFileInput();
    }
  }, [compressImage, maxSizeKB, onCapture, onError, resetFileInput, toast]);

  // Trigger camera
  const handleCameraClick = useCallback(() => {
    if (disabled || isProcessing) return;
    
    resetFileInput();
    
    // Small delay to ensure input is reset
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  }, [disabled, isProcessing, resetFileInput]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetFileInput();
    };
  }, [resetFileInput]);

  return (
    <div className="camera-capture">
      <Button
        onClick={handleCameraClick}
        disabled={disabled || isProcessing}
        size="sm"
        className="bg-primary hover:bg-primary/90 text-white"
      >
        {isProcessing ? (
          <>
            <i className="fas fa-spinner fa-spin mr-1"></i>
            Processing...
          </>
        ) : (
          <>
            <i className="fas fa-camera mr-1"></i>
            Take Photo
          </>
        )}
      </Button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Hidden canvas for image processing */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />
    </div>
  );
}