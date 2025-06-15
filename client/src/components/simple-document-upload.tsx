import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/contexts/timer-context";

interface SimpleDocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId?: number;
}

interface DocumentState {
  id: string;
  type: string;
  name: string;
  uploaded: boolean;
  uploading: boolean;
}

export default function SimpleDocumentUpload({ isOpen, onClose, transactionId }: SimpleDocumentUploadProps) {
  const { user } = useAuth();
  const { stopTimer } = useTimer();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<DocumentState[]>(() => {
    if ((user as any)?.role === 'merchant') {
      return [{ id: "merchant", type: "vmf_merchant", name: "Merchant Copy", uploaded: false, uploading: false }];
    } else if ((user as any)?.role === 'cashier') {
      return [{ id: "cashbag", type: "vmf_cashbag", name: "Cashier Copy", uploaded: false, uploading: false }];
    }
    return [{ id: "merchant", type: "vmf_merchant", name: "Merchant Copy", uploaded: false, uploading: false }];
  });

  const compressImage = useCallback(async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      img.onload = () => {
        // Calculate dimensions
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

        // Convert to greyscale for text documents
        ctx.filter = 'grayscale(100%) contrast(1.2)';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });

          resolve(compressedFile);
        }, 'image/jpeg', 0.8);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const uploadFile = useCallback(async (file: File, documentType: string) => {
    try {
      // Compress image first
      const compressedFile = await compressImage(file);
      const sizeKB = compressedFile.size / 1024;
      
      console.log(`Uploading ${documentType}: ${sizeKB.toFixed(0)}KB`);

      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("type", documentType);
      if (transactionId) {
        formData.append("transactionId", transactionId.toString());
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} ${text}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }, [compressImage, transactionId]);

  const handleFileSelect = useCallback(async (documentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    // Reset input immediately
    event.target.value = '';
    
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "File Too Large",
        description: "Please select a smaller image",
        variant: "destructive",
      });
      return;
    }

    // Find document
    const document = documents.find(doc => doc.id === documentId);
    if (!document) return;

    // Set uploading state
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId 
        ? { ...doc, uploading: true, uploaded: false }
        : doc
    ));

    try {
      await uploadFile(file, document.type);
      
      // Mark as uploaded
      setDocuments(prev => {
        const updated = prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, uploading: false, uploaded: true }
            : doc
        );

        // Check if all uploaded
        if (updated.every(doc => doc.uploaded)) {
          setTimeout(() => {
            toast({
              title: "All Photos Captured",
              description: "Please click Complete to finish the transaction",
            });
          }, 500);
        }

        return updated;
      });

      toast({
        title: "Upload Successful",
        description: "Document uploaded successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    } catch (error) {
      // Reset uploading state on error
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, uploading: false, uploaded: false }
          : doc
      ));

      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  }, [documents, uploadFile, toast]);

  const handleCompleteUpload = async () => {
    const allUploaded = documents.every(doc => doc.uploaded);
    
    if (!allUploaded) {
      toast({
        title: "Upload Incomplete",
        description: "Please upload all required documents",
        variant: "destructive",
      });
      return;
    }

    if (transactionId) {
      try {
        await apiRequest("PATCH", `/api/transactions/${transactionId}/status`, {
          status: "completed"
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
        
        toast({
          title: "Transaction Completed",
          description: "All documents uploaded successfully",
        });

        stopTimer();
        onClose();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to complete transaction",
          variant: "destructive",
        });
      }
    } else {
      onClose();
    }
  };

  const handleClose = () => {
    // Reset state
    setDocuments(prev => prev.map(doc => ({ 
      ...doc, 
      uploaded: false, 
      uploading: false 
    })));
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-center">Upload VMF Documents</DialogTitle>
          <DialogDescription className="text-center text-sm text-gray-600 dark:text-gray-400">
            Capture photos of your VMF documents
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {documents.map((document) => (
            <div key={document.id} className={`p-4 border rounded-lg transition-all ${
              document.uploaded 
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                : document.uploading
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-300 dark:border-gray-600'
            }`}>
              <div className="text-center">
                {document.uploaded ? (
                  <>
                    <i className="fas fa-check-circle text-2xl text-green-600 mb-2"></i>
                    <p className="text-green-600 text-sm font-medium">{document.name}</p>
                    <p className="text-green-600 text-xs">Successfully uploaded</p>
                  </>
                ) : document.uploading ? (
                  <>
                    <i className="fas fa-spinner fa-spin text-2xl text-blue-600 mb-2"></i>
                    <p className="text-blue-600 text-sm font-medium">Uploading...</p>
                    <p className="text-blue-600 text-xs">Please wait</p>
                  </>
                ) : (
                  <>
                    <i className="fas fa-camera text-3xl text-gray-400 mb-2"></i>
                    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{document.name}</p>
                    <p className="text-gray-500 dark:text-gray-500 text-xs mb-3">Take a photo of the document</p>
                    
                    <label htmlFor={`file-${document.id}`}>
                      <Button
                        asChild
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                        disabled={document.uploading}
                      >
                        <span>
                          <i className="fas fa-camera mr-1"></i>
                          Take Photo
                        </span>
                      </Button>
                    </label>
                    
                    <input
                      id={`file-${document.id}`}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileSelect(document.id, e)}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
          
          <div className="flex space-x-3 mt-6">
            <Button 
              onClick={handleClose} 
              variant="outline"
              className="flex-1"
              disabled={documents.some(doc => doc.uploading)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteUpload}
              disabled={documents.some(doc => doc.uploading) || !documents.every(doc => doc.uploaded)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {documents.some(doc => doc.uploading) ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Uploading...
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-2"></i>
                  Complete Transaction
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}