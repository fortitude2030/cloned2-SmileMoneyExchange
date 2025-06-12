import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/contexts/timer-context";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId?: number;
}

interface UploadedDocument {
  id: string;
  type: string;
  name: string;
  file?: File;
  uploaded: boolean;
}

export default function DocumentUploadModal({ isOpen, onClose, transactionId }: DocumentUploadModalProps) {
  const { user } = useAuth();
  const { stopTimer } = useTimer();
  const { toast } = useToast();
  
  // Memoize documents based on user role to prevent re-renders
  const initialDocuments = useMemo(() => {
    if ((user as any)?.role === 'merchant') {
      return [{ id: "merchant", type: "vmf_merchant", name: "Merchant Copy", uploaded: false }];
    } else if ((user as any)?.role === 'cashier') {
      return [{ id: "cashbag", type: "vmf_cashbag", name: "Cashier Copy", uploaded: false }];
    }
    // Fallback for other roles
    return [{ id: "merchant", type: "vmf_merchant", name: "Merchant Copy", uploaded: false }];
  }, [(user as any)?.role]);
  
  const [documents, setDocuments] = useState<UploadedDocument[]>(initialDocuments);

  // Reset documents when modal opens or user role changes
  useEffect(() => {
    if (isOpen) {
      setDocuments(initialDocuments);
    }
  }, [isOpen, initialDocuments]);

  // Upload document mutation
  const uploadDocument = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
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
        throw new Error(`${response.status}: ${text}`);
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
      
      setDocuments(prev => {
        const updated = prev.map(doc => 
          doc.type === variables.type 
            ? { ...doc, uploaded: true }
            : doc
        );
        
        // Show completion notice but require manual confirmation
        if (updated.every(doc => doc.uploaded)) {
          console.log("All documents uploaded - manual completion required");
          
          toast({
            title: "Photos Captured",
            description: "All VMF documents uploaded. Please verify photos and click Complete Transaction.",
          });
        }
        
        return updated;
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((documentId: string, file: File | null) => {
    if (!file) return;

    // Validate file type - only images allowed for security
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please capture a photo using your camera.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    // Enhanced validation for fresh camera captures
    const now = Date.now();
    const fileDate = file.lastModified || now;
    const timeDiff = now - fileDate;
    
    // Relaxed validation criteria for better compatibility
    const isFreshPhoto = timeDiff < 300000; // Within last 5 minutes (increased from 1 minute)
    const hasReasonableSize = file.size > 10000 && file.size < 25000000; // 10KB - 25MB (relaxed limits)
    
    if (!isFreshPhoto) {
      console.warn(`Photo timestamp validation failed: ${timeDiff}ms old`);
      toast({
        title: "Fresh Photo Recommended",
        description: "For best results, please capture a new photo using your camera.",
        variant: "destructive",
      });
      // Don't return - allow the upload to continue
    }
    
    if (!hasReasonableSize) {
      toast({
        title: "Invalid Photo Size",
        description: "Photo must be between 10KB and 25MB. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Update document state
    setDocuments(prev => 
      prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, file, uploaded: false }
          : doc
      )
    );

    // Find the document type and upload
    const document = documents.find(doc => doc.id === documentId);
    if (document) {
      uploadDocument.mutate({ file, type: document.type });
    }
  }, [documents, uploadDocument, toast]);

  const handleCameraCapture = useCallback((documentId: string) => {
    const fileInput = document.getElementById(`file-input-${documentId}`) as HTMLInputElement;
    if (fileInput) {
      // Reset the input value before clicking to prevent cache issues
      fileInput.value = '';
      fileInput.click();
    }
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

  const handleClose = () => {
    // Reset state when closing - use memoized initial documents
    setDocuments(initialDocuments);
    onClose();
  };

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
            <div key={document.id}>
              <div className={`upload-zone transition-all ${
                document.uploaded 
                  ? 'border-success bg-success/5' 
                  : uploadDocument.isPending 
                    ? 'border-primary bg-primary/5' 
                    : ''
              }`}>
                {document.uploaded ? (
                  <div className="text-center">
                    <i className="fas fa-check-circle text-3xl text-success mb-2"></i>
                    <p className="text-success text-sm font-medium">{document.name}</p>
                    <p className="text-success text-xs">Successfully uploaded</p>
                  </div>
                ) : uploadDocument.isPending ? (
                  <div className="text-center">
                    <i className="fas fa-spinner fa-spin text-3xl text-primary mb-2"></i>
                    <p className="text-primary text-sm font-medium">Uploading...</p>
                    <p className="text-primary text-xs">Please wait</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <i className="fas fa-file-image text-3xl text-gray-400 mb-2"></i>
                    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{document.name}</p>
                    <p className="text-gray-500 dark:text-gray-500 text-xs mb-3">Take a real-time photo of the document</p>
                    
                    <div className="flex justify-center">
                      <Button
                        onClick={() => handleCameraCapture(document.id)}
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-white"
                      >
                        <i className="fas fa-camera mr-1"></i>
                        Take Photo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Hidden file input for camera capture only */}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                capture="environment"
                id={`file-input-${document.id}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    console.log(`VMF file selected: ${file.name}, size: ${file.size}, type: ${file.type}`);
                    
                    // Simplified validation - focus on file type and basic size check
                    if (!file.type.startsWith('image/')) {
                      toast({
                        title: "Invalid File Type",
                        description: "Please select an image file from your camera.",
                        variant: "destructive",
                      });
                      // Clear the input and return
                      e.target.value = '';
                      return;
                    }
                    
                    if (file.size < 1000) { // Less than 1KB is likely invalid
                      toast({
                        title: "File Too Small",
                        description: "The selected file appears to be invalid. Please try again.",
                        variant: "destructive",
                      });
                      // Clear the input and return
                      e.target.value = '';
                      return;
                    }
                    
                    // Process the file immediately
                    handleFileSelect(document.id, file);
                  }
                  
                  // Always reset the input value to prevent freezing
                  setTimeout(() => {
                    e.target.value = '';
                  }, 100);
                }}
              />
            </div>
          ))}
          
          <div className="flex space-x-3 mt-6">
            <Button 
              onClick={handleClose} 
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteUpload}
              disabled={uploadDocument.isPending || !documents.every(doc => doc.uploaded)}
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
            >
              {uploadDocument.isPending ? (
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
