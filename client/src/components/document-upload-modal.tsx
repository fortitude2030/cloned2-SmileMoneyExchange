import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";

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
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Show only relevant VMF copy based on user role
  const getDocumentsByRole = () => {
    if ((user as any)?.role === 'merchant') {
      return [{ id: "merchant", type: "vmf_merchant", name: "Merchant Copy", uploaded: false }];
    } else if ((user as any)?.role === 'cashier') {
      return [{ id: "cashbag", type: "vmf_cashbag", name: "Cashier Copy", uploaded: false }];
    }
    // Fallback for other roles
    return [{ id: "merchant", type: "vmf_merchant", name: "Merchant Copy", uploaded: false }];
  };
  
  const [documents, setDocuments] = useState<UploadedDocument[]>(getDocumentsByRole());
  
  const fileRef = useRef<HTMLInputElement>(null);

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
      
      setDocuments(prev => 
        prev.map(doc => 
          doc.type === variables.type 
            ? { ...doc, uploaded: true }
            : doc
        )
      );
      
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

  const handleFileSelect = (documentId: string, file: File | null) => {
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
  };

  const handleCameraCapture = (documentId: string) => {
    // For mobile devices, this will open the camera
    if (fileRef.current) {
      fileRef.current.accept = "image/*";
      fileRef.current.capture = "environment" as any; // Use back camera
      fileRef.current.click();
    }
  };



  const handleCompleteUpload = () => {
    const allUploaded = documents.every(doc => doc.uploaded);
    
    if (!allUploaded) {
      toast({
        title: "Upload Incomplete",
        description: "Please upload all required documents before proceeding.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "All VMF documents uploaded successfully",
    });
    
    onClose();
  };

  const handleClose = () => {
    // Reset state when closing - use role-based documents
    setDocuments(getDocumentsByRole());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-center">Upload VMF Documents</DialogTitle>
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
              
              {/* Hidden file input */}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileSelect(document.id, e.target.files?.[0] || null)}
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
