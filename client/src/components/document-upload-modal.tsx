import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/contexts/timer-context";
import CameraCapture from "@/components/camera-capture";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId?: number;
}

interface DocumentType {
  id: string;
  type: string;
  name: string;
  uploaded: boolean;
}

export default function DocumentUploadModal({ isOpen, onClose, transactionId }: DocumentUploadModalProps) {
  const { user } = useAuth();
  const { stopTimer } = useTimer();
  const { toast } = useToast();
  
  // Determine required documents based on user role
  const requiredDocuments = useMemo(() => {
    if ((user as any)?.role === 'merchant') {
      return [{ id: "merchant", type: "vmf_merchant", name: "Merchant Copy", uploaded: false }];
    } else if ((user as any)?.role === 'cashier') {
      return [{ id: "cashbag", type: "vmf_cashbag", name: "Cashier Copy", uploaded: false }];
    }
    return [{ id: "merchant", type: "vmf_merchant", name: "Merchant Copy", uploaded: false }];
  }, [(user as any)?.role]);
  
  const [documents, setDocuments] = useState<DocumentType[]>(requiredDocuments);

  // Initialize upload handler with robust error handling
  const { uploadFile, isUploading } = useDocumentUpload({
    transactionId,
    onSuccess: (uploadedDoc) => {
      // Find which document was uploaded and mark it as complete
      setDocuments(prev => {
        const updated = prev.map(doc => 
          doc.type === uploadedDoc.type 
            ? { ...doc, uploaded: true }
            : doc
        );
        
        // Check if all documents are uploaded
        if (updated.every(doc => doc.uploaded)) {
          setTimeout(() => {
            toast({
              title: "All Photos Captured",
              description: "Please verify photos and click Complete Transaction.",
            });
          }, 100);
        }
        
        return updated;
      });
    },
    onError: (error) => {
      console.error("Document upload failed:", error);
    }
  });

  // Reset documents when modal opens
  useEffect(() => {
    if (isOpen) {
      setDocuments(requiredDocuments);
    }
  }, [isOpen, requiredDocuments]);

  // Handle successful photo capture
  const handlePhotoCapture = useCallback((documentId: string, file: File) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document) {
      uploadFile(file, document.type);
    }
  }, [documents, uploadFile]);

  // Handle upload errors
  const handleUploadError = useCallback((documentId: string, error: string) => {
    console.error(`Upload error for document ${documentId}:`, error);
  }, []);



  const handleCompleteUpload = async () => {
    const allUploaded = documents.every(doc => doc.uploaded);
    
    if (!allUploaded) {
      toast({
        title: "Upload Incomplete",
        description: "Please upload all required documents before proceeding.",
        variant: "destructive",
      });
      return;
    }

    // Mark transaction as completed in the database
    if (transactionId) {
      try {
        await apiRequest("PATCH", `/api/transactions/${transactionId}/status`, {
          status: "completed"
        });
        
        // Invalidate queries to refresh transaction lists
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
        
        toast({
          title: "Transaction Completed",
          description: "All VMF documents uploaded and transaction completed successfully",
        });
      } catch (error) {
        console.error("Failed to complete transaction:", error);
        toast({
          title: "Error",
          description: "Failed to complete transaction. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    // Stop the timer since transaction is complete
    stopTimer();
    
    onClose();
  };

  const handleClose = useCallback(() => {
    // Reset state when closing
    setDocuments(requiredDocuments);
    onClose();
  }, [requiredDocuments, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-center">Upload VMF Documents</DialogTitle>
          <DialogDescription className="text-center text-sm text-gray-600 dark:text-gray-400">
            Capture photos of your VMF documents to complete the transaction
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {documents.map((document) => (
            <div key={document.id} className={`upload-zone transition-all p-4 border rounded-lg ${
              document.uploaded 
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                : isUploading 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-300 dark:border-gray-600'
            }`}>
              {document.uploaded ? (
                <div className="text-center">
                  <i className="fas fa-check-circle text-2xl text-green-600 mb-2"></i>
                  <p className="text-green-600 text-sm font-medium">{document.name}</p>
                  <p className="text-green-600 text-xs">Successfully uploaded</p>
                </div>
              ) : isUploading ? (
                <div className="text-center">
                  <i className="fas fa-spinner fa-spin text-2xl text-blue-600 mb-2"></i>
                  <p className="text-blue-600 text-sm font-medium">Uploading...</p>
                  <p className="text-blue-600 text-xs">Please wait</p>
                </div>
              ) : (
                <div className="text-center">
                  <i className="fas fa-file-image text-3xl text-gray-400 mb-2"></i>
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{document.name}</p>
                  <p className="text-gray-500 dark:text-gray-500 text-xs mb-3">Take a real-time photo of the document</p>
                  
                  <CameraCapture
                    onCapture={(file) => handlePhotoCapture(document.id, file)}
                    onError={(error) => handleUploadError(document.id, error)}
                    maxSizeKB={1024}
                    quality={0.8}
                    disabled={isUploading}
                  />
                </div>
              )}
            </div>
          ))}
          
          <div className="flex space-x-3 mt-6">
            <Button 
              onClick={handleClose} 
              variant="outline"
              className="flex-1"
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteUpload}
              disabled={isUploading || !documents.every(doc => doc.uploaded)}
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
            >
              {isUploading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Uploading...
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-2"></i>
                  Complete
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
