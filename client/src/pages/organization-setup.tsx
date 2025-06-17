import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KycDocumentUpload } from "@/components/kyc-document-upload";
import { useToast } from "@/hooks/use-toast";
import { Building2, FileCheck, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function OrganizationSetup() {
  const [step, setStep] = useState(1);
  const [orgData, setOrgData] = useState({
    name: "",
    type: "financial_institution",
    description: "",
  });
  const [orgId, setOrgId] = useState<number | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orgData),
      });

      if (!response.ok) {
        throw new Error("Failed to create organization");
      }

      const organization = await response.json();
      setOrgId(organization.id);
      setStep(2);

      toast({
        title: "Organization created",
        description: "Now upload your KYC documents to complete setup.",
      });
    } catch (error) {
      toast({
        title: "Creation failed",
        description: "Failed to create organization. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentUpload = (documentType: string) => {
    setUploadedDocs(prev => new Set([...Array.from(prev), documentType]));
  };

  const handleFinishSetup = async () => {
    const requiredDocs = ["selfie", "nrc_side1", "nrc_side2", "passport", "pacra", "zra_tpin"];
    const allUploaded = requiredDocs.every(doc => uploadedDocs.has(doc));

    if (!allUploaded) {
      toast({
        title: "Incomplete documents",
        description: "Please upload all required documents before finishing.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Update organization KYC status
      const response = await fetch(`/api/organizations/${orgId}/complete-kyc`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to complete KYC");
      }

      toast({
        title: "KYC submitted successfully",
        description: "Your organization setup is complete. Documents are under review.",
      });

      // Redirect to appropriate dashboard after a delay
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);

    } catch (error) {
      toast({
        title: "Submission failed",
        description: "Failed to complete KYC setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                <Building2 className="h-4 w-4" />
              </div>
              <span className="font-medium">Organization Details</span>
            </div>
            
            <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                <FileCheck className="h-4 w-4" />
              </div>
              <span className="font-medium">KYC Documents</span>
            </div>
            
            <div className={`w-16 h-0.5 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                <User className="h-4 w-4" />
              </div>
              <span className="font-medium">Complete</span>
            </div>
          </div>
        </div>

        {/* Step 1: Organization Details */}
        {step === 1 && (
          <Card className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-2xl text-center text-gray-900 dark:text-white">
                Create Your Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleOrgSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="orgName" className="text-gray-700 dark:text-gray-300">
                    Organization Name *
                  </Label>
                  <Input
                    id="orgName"
                    type="text"
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    placeholder="Enter your organization name"
                    className="dark:bg-gray-800 dark:border-gray-600"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgType" className="text-gray-700 dark:text-gray-300">
                    Organization Type
                  </Label>
                  <Input
                    id="orgType"
                    type="text"
                    value={orgData.type}
                    onChange={(e) => setOrgData({ ...orgData, type: e.target.value })}
                    placeholder="e.g., Financial Institution, Retail Business"
                    className="dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgDescription" className="text-gray-700 dark:text-gray-300">
                    Description
                  </Label>
                  <Textarea
                    id="orgDescription"
                    value={orgData.description}
                    onChange={(e) => setOrgData({ ...orgData, description: e.target.value })}
                    placeholder="Brief description of your organization"
                    className="dark:bg-gray-800 dark:border-gray-600"
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting || !orgData.name.trim()}
                >
                  {isSubmitting ? "Creating..." : "Create Organization"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: KYC Document Upload */}
        {step === 2 && orgId && (
          <Card className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-6">
              <KycDocumentUpload
                organizationId={orgId}
                organizationName={orgData.name}
                userFirstName={user.firstName}
                userLastName={user.lastName}
                onUploadComplete={handleDocumentUpload}
              />
              
              <div className="mt-8 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                
                <Button
                  onClick={handleFinishSetup}
                  disabled={isSubmitting || uploadedDocs.size < 6}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? "Submitting..." : "Complete Setup"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legal Notice */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            By creating an organization, you agree to comply with Bank of Zambia regulations
            and provide accurate KYC documentation.
          </p>
        </div>
      </div>
    </div>
  );
}