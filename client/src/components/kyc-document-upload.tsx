import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Upload, FileText, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface KycDocumentUploadProps {
  organizationId: number;
  organizationName: string;
  userFirstName: string;
  userLastName: string;
  onUploadComplete: (documentType: string) => void;
}

const DOCUMENT_TYPES = [
  { key: "selfie", label: "Selfie", required: true },
  { key: "nrc_side1", label: "NRC Side 1", required: true },
  { key: "nrc_side2", label: "NRC Side 2", required: true },
  { key: "passport", label: "Passport Face Page", required: true },
  { key: "pacra", label: "PACRA Certificate", required: true },
  { key: "zra_tpin", label: "ZRA TPIN Certificate", required: true },
];

export function KycDocumentUpload({
  organizationId,
  organizationName,
  userFirstName,
  userLastName,
  onUploadComplete,
}: KycDocumentUploadProps) {
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [currentDocType, setCurrentDocType] = useState<string>("");
  const { toast } = useToast();

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 1200px width/height)
        let { width, height } = img;
        const maxSize = 1200;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw with compression
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => resolve(blob!),
          "image/jpeg",
          0.7 // 70% quality
        );
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const convertToPDF = async (imageBlob: Blob, fileName: string): Promise<Blob> => {
    const pdf = new jsPDF();
    const img = new Image();
    
    return new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imgData = canvas.toDataURL("image/jpeg", 0.5); // Low quality for smaller PDF
        
        // Calculate dimensions to fit A4
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = img.width;
        const imgHeight = img.height;
        
        let width = pdfWidth;
        let height = (imgHeight * pdfWidth) / imgWidth;
        
        if (height > pdfHeight) {
          height = pdfHeight;
          width = (imgWidth * pdfHeight) / imgHeight;
        }
        
        pdf.addImage(imgData, "JPEG", 0, 0, width, height);
        
        const pdfBlob = pdf.output("blob");
        resolve(pdfBlob);
      };
      
      img.src = URL.createObjectURL(imageBlob);
    });
  };

  const generateFileName = (docType: string): string => {
    const orgName = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const firstName = userFirstName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const lastName = userLastName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `kyc-${orgName}-${firstName}-${lastName}-${docType}.pdf`;
  };

  const handleFileUpload = async (file: File, docType: string) => {
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    setUploading(docType);
    
    try {
      // Compress image
      const compressedImage = await compressImage(file);
      
      // Check size after compression
      if (compressedImage.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "File must be under 2MB after compression.",
          variant: "destructive",
        });
        return;
      }
      
      // Convert to PDF
      const fileName = generateFileName(docType);
      const pdfBlob = await convertToPDF(compressedImage, fileName);
      
      // Create form data
      const formData = new FormData();
      formData.append("file", pdfBlob, fileName);
      formData.append("organizationId", organizationId.toString());
      formData.append("documentType", docType);
      
      // Upload to server
      const response = await fetch("/api/kyc/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      const result = await response.json();
      
      setUploadedDocs(prev => new Set([...Array.from(prev), docType]));
      onUploadComplete(docType);
      
      toast({
        title: "Upload successful",
        description: `${DOCUMENT_TYPES.find(d => d.key === docType)?.label} uploaded successfully.`,
      });
      
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
      setCurrentDocType("");
    }
  };

  const handleCameraCapture = (docType: string) => {
    setCurrentDocType(docType);
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleFileSelect = (docType: string) => {
    setCurrentDocType(docType);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const allRequiredUploaded = DOCUMENT_TYPES.filter(doc => doc.required)
    .every(doc => Array.from(uploadedDocs).includes(doc.key));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          KYC Document Upload
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload required documents for {organizationName}
        </p>
      </div>

      <div className="grid gap-4">
        {DOCUMENT_TYPES.map((docType) => (
          <Card key={docType.key} className="border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {docType.label}
                  {docType.required && <span className="text-red-500">*</span>}
                </span>
                {uploadedDocs.has(docType.key) ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : uploading === docType.key ? (
                  <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCameraCapture(docType.key)}
                  disabled={uploading === docType.key || uploadedDocs.has(docType.key)}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Camera
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFileSelect(docType.key)}
                  disabled={uploading === docType.key || uploadedDocs.has(docType.key)}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              </div>
              {uploadedDocs.has(docType.key) && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  ✓ Document uploaded successfully
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && currentDocType) {
            handleFileUpload(file, currentDocType);
          }
        }}
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && currentDocType) {
            handleFileUpload(file, currentDocType);
          }
        }}
      />

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Upload Progress
        </h3>
        <p className="text-blue-700 dark:text-blue-300 text-sm">
          {uploadedDocs.size} of {DOCUMENT_TYPES.filter(d => d.required).length} required documents uploaded
        </p>
        {allRequiredUploaded && (
          <p className="text-green-600 dark:text-green-400 text-sm font-medium mt-2">
            ✓ All required documents uploaded! Your KYC submission is complete.
          </p>
        )}
      </div>
    </div>
  );
}