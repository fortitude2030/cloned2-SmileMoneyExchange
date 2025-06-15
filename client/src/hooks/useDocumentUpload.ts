import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UseDocumentUploadProps {
  transactionId?: number;
  onSuccess?: (document: any) => void;
  onError?: (error: string) => void;
}

export function useDocumentUpload({ transactionId, onSuccess, onError }: UseDocumentUploadProps = {}) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Cancel current upload
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(null);
  }, []);

  // Upload with progress tracking and retry mechanism
  const uploadDocument = useMutation({
    mutationFn: async ({ file, type, retryCount = 0 }: { 
      file: File; 
      type: string; 
      retryCount?: number;
    }) => {
      const maxRetries = 3;
      
      if (retryCount >= maxRetries) {
        throw new Error('Maximum retry attempts reached');
      }

      // Create new abort controller for this upload
      abortControllerRef.current = new AbortController();
      setIsUploading(true);
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      if (transactionId) {
        formData.append("transactionId", transactionId.toString());
      }

      try {
        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
          credentials: "include",
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          let errorMessage = `Upload failed: ${response.status}`;
          
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.message || errorMessage;
          } catch {
            errorMessage = text || errorMessage;
          }

          // Retry on server errors (5xx) or network issues
          if (response.status >= 500 || response.status === 0) {
            console.warn(`Upload failed (attempt ${retryCount + 1}), retrying...`);
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            return uploadDocument.mutateAsync({ file, type, retryCount: retryCount + 1 });
          }

          throw new Error(errorMessage);
        }

        const result = await response.json();
        setUploadProgress({ loaded: file.size, total: file.size, percentage: 100 });
        
        return result;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error('Upload cancelled');
        }
        
        // Retry on network errors
        if (error.message.includes('fetch') || error.message.includes('network')) {
          console.warn(`Network error (attempt ${retryCount + 1}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          return uploadDocument.mutateAsync({ file, type, retryCount: retryCount + 1 });
        }
        
        throw error;
      } finally {
        setIsUploading(false);
        abortControllerRef.current = null;
      }
    },
    onSuccess: (data, variables) => {
      setUploadProgress(null);
      
      toast({
        title: "Upload Successful",
        description: "Document uploaded successfully",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      onSuccess?.(data);
    },
    onError: (error: any) => {
      setUploadProgress(null);
      setIsUploading(false);
      
      if (error.message === 'Upload cancelled') {
        return; // Don't show error for user cancellation
      }
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      
      console.error("Upload error:", error);
      
      // Extract user-friendly error message
      let errorMessage = "Upload failed. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes("File too large")) {
          errorMessage = "File is too large. Please try a smaller image.";
        } else if (error.message.includes("File too small")) {
          errorMessage = "File is too small. Please capture the document again.";
        } else if (error.message.includes("Only JPEG and PNG")) {
          errorMessage = "Please use your camera to capture a photo.";
        } else if (error.message.includes("No file uploaded")) {
          errorMessage = "No file was selected. Please try again.";
        } else if (error.message.includes("Maximum retry attempts")) {
          errorMessage = "Upload failed after multiple attempts. Please check your connection.";
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      onError?.(errorMessage);
    },
  });

  // Upload a file with automatic retry
  const uploadFile = useCallback((file: File, type: string) => {
    // Cancel any existing upload
    cancelUpload();
    
    // Validate file before upload
    if (!file.type.startsWith('image/')) {
      const error = 'Please select an image file';
      onError?.(error);
      toast({
        title: "Invalid File",
        description: error,
        variant: "destructive",
      });
      return;
    }

    if (file.size < 1000) {
      const error = 'File is too small. Please capture the document again.';
      onError?.(error);
      toast({
        title: "Invalid File",
        description: error,
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      const error = 'File is too large. Please try a smaller image.';
      onError?.(error);
      toast({
        title: "File Too Large",
        description: error,
        variant: "destructive",
      });
      return;
    }

    uploadDocument.mutate({ file, type });
  }, [uploadDocument, cancelUpload, onError, toast]);

  return {
    uploadFile,
    isUploading,
    uploadProgress,
    cancelUpload,
    error: uploadDocument.error,
    isError: uploadDocument.isError,
    isSuccess: uploadDocument.isSuccess,
  };
}