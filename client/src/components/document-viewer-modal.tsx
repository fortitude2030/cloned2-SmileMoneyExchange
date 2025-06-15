import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Download, Eye, X } from "lucide-react";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: number;
  transactionNumber: string;
}

interface DocumentWithUrl {
  id: number;
  filename: string;
  originalName: string;
  type: string;
  size: number;
  mimeType: string;
  createdAt: string;
  viewUrl: string;
  thumbnailUrl: string;
}

export default function DocumentViewerModal({ 
  isOpen, 
  onClose, 
  transactionId, 
  transactionNumber 
}: DocumentViewerModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch documents for the transaction
  const { data: documents, isLoading, error } = useQuery({
    queryKey: ["/api/documents/transaction", transactionId],
    enabled: isOpen && !!transactionId,
  });

  // Reset selected image when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
    }
  }, [isOpen]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'vmf_merchant':
        return 'Merchant Copy';
      case 'vmf_cashbag':
        return 'Cashier Copy';
      default:
        return 'Document';
    }
  };

  const handleDownload = async (document: DocumentWithUrl) => {
    try {
      const response = await fetch(document.viewUrl, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.originalName || document.filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (selectedImage) {
    return (
      <Dialog open={isOpen} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 z-10"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={selectedImage}
              alt="Document preview"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-center">VMF Documents</DialogTitle>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            {transactionNumber}
          </p>
        </DialogHeader>
        
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm">Loading documents...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 text-sm">Failed to load documents</p>
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No documents found</p>
            </div>
          ) : (
            documents.map((document: DocumentWithUrl) => (
              <div key={document.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">
                      {getDocumentTypeLabel(document.type)}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(document.size)} • {new Date(document.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {/* Thumbnail preview */}
                <div className="relative">
                  <img
                    src={document.viewUrl}
                    alt={`${getDocumentTypeLabel(document.type)} preview`}
                    className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setSelectedImage(document.viewUrl)}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 transition-all cursor-pointer rounded">
                    <Eye className="h-6 w-6 text-white opacity-0 hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelectedImage(document.viewUrl)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDownload(document)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            ))
          )}
          
          <div className="flex justify-center mt-4">
            <Button onClick={onClose} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}