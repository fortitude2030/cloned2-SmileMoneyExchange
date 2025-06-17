import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { KycDocumentUpload } from "@/components/kyc-document-upload";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface Organization {
  id: number;
  name: string;
  type: string;
  description: string;
  kycStatus: string;
  kycCompletedAt?: string;
  kycReviewedBy?: string;
  kycRejectReason?: string;
  createdAt: string;
}

interface KycDocument {
  id: number;
  documentType: string;
  fileName: string;
  status: string;
  uploadedBy: string;
  createdAt: string;
}

export function AdminOrganizationManagement() {
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showKycUpload, setShowKycUpload] = useState(false);
  const [showKycDocuments, setShowKycDocuments] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "financial_institution",
    description: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch all organizations
  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["/api/admin/organizations"],
    queryFn: async () => {
      const response = await fetch("/api/admin/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
  });

  // Fetch KYC documents for selected organization
  const { data: kycDocuments = [] } = useQuery({
    queryKey: ["/api/organizations", showKycDocuments, "kyc-documents"],
    queryFn: async () => {
      if (!showKycDocuments) return [];
      const response = await fetch(`/api/organizations/${showKycDocuments}/kyc-documents`);
      if (!response.ok) throw new Error("Failed to fetch KYC documents");
      return response.json();
    },
    enabled: !!showKycDocuments,
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (orgData: typeof formData) => {
      const response = await fetch("/api/admin/organizations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create organization");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      setSelectedOrg(data.organization);
      setShowCreateOrg(false);
      setShowKycUpload(true);
      setFormData({ name: "", type: "financial_institution", description: "" });
      toast({
        title: "Organization created",
        description: "Now upload KYC documents to complete setup.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create organization",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update KYC status mutation
  const updateKycMutation = useMutation({
    mutationFn: async ({ orgId, status, reason }: { orgId: number; status: string; reason?: string }) => {
      const response = await fetch(`/api/admin/organizations/${orgId}/kyc-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectReason: reason }),
      });
      if (!response.ok) throw new Error("Failed to update KYC status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "KYC status updated",
        description: "Organization KYC status has been changed.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Organization name required",
        description: "Please enter an organization name.",
        variant: "destructive",
      });
      return;
    }
    createOrgMutation.mutate(formData);
  };

  const handleKycUploadComplete = () => {
    setShowKycUpload(false);
    setSelectedOrg(null);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "in_review":
        return <Badge variant="outline" className="text-blue-600"><Eye className="h-3 w-3 mr-1" />In Review</Badge>;
      case "approved":
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="text-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels = {
      selfie: "Selfie",
      nrc_side1: "NRC Side 1",
      nrc_side2: "NRC Side 2", 
      passport: "Passport",
      pacra: "PACRA Certificate",
      zra_tpin: "ZRA TPIN Certificate"
    };
    return labels[type as keyof typeof labels] || type;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading organizations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Organization Management</h2>
        </div>
        <Button
          onClick={() => setShowCreateOrg(!showCreateOrg)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Organization
        </Button>
      </div>

      {showCreateOrg && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name *</Label>
                  <Input
                    id="orgName"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ABC Financial Services"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgType">Organization Type</Label>
                  <Input
                    id="orgType"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="Financial Institution"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orgDescription">Description</Label>
                <Textarea
                  id="orgDescription"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the organization"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={createOrgMutation.isPending}
                  className="flex-1"
                >
                  {createOrgMutation.isPending ? "Creating..." : "Create & Upload KYC"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateOrg(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showKycUpload && selectedOrg && user && (
        <Card>
          <CardHeader>
            <CardTitle>Upload KYC Documents for {selectedOrg.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <KycDocumentUpload
              organizationId={selectedOrg.id}
              organizationName={selectedOrg.name}
              userFirstName={user.firstName}
              userLastName={user.lastName}
              onUploadComplete={handleKycUploadComplete}
            />
          </CardContent>
        </Card>
      )}

      {/* Organizations List */}
      <div className="grid gap-4">
        {organizations.map((org: Organization) => (
          <Card key={org.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{org.name}</h3>
                    {getStatusBadge(org.kycStatus)}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{org.type}</p>
                  {org.description && (
                    <p className="text-sm text-gray-500 mb-2">{org.description}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    Created: {new Date(org.createdAt).toLocaleDateString()}
                  </p>
                  {org.kycCompletedAt && (
                    <p className="text-xs text-gray-400">
                      KYC Completed: {new Date(org.kycCompletedAt).toLocaleDateString()}
                    </p>
                  )}
                  {org.kycRejectReason && (
                    <p className="text-xs text-red-600 mt-1">
                      Rejection Reason: {org.kycRejectReason}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowKycDocuments(
                      showKycDocuments === org.id ? null : org.id
                    )}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View KYC
                  </Button>

                  {org.kycStatus === "in_review" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateKycMutation.mutate({
                          orgId: org.id,
                          status: "approved"
                        })}
                        disabled={updateKycMutation.isPending}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const reason = prompt("Enter rejection reason:");
                          if (reason) {
                            updateKycMutation.mutate({
                              orgId: org.id,
                              status: "rejected",
                              reason
                            });
                          }
                        }}
                        disabled={updateKycMutation.isPending}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* KYC Documents Display */}
              {showKycDocuments === org.id && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium mb-3">KYC Documents</h4>
                  {kycDocuments.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {kycDocuments.map((doc: KycDocument) => (
                        <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{getDocumentTypeLabel(doc.documentType)}</span>
                          <Badge 
                            variant={doc.status === "approved" ? "default" : "outline"}
                            className={doc.status === "approved" ? "bg-green-100 text-green-800" : ""}
                          >
                            {doc.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No KYC documents uploaded yet.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {organizations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No organizations found. Create your first organization.
          </div>
        )}
      </div>
    </div>
  );
}