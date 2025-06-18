import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building, FileText, Upload, CheckCircle, XCircle, Clock, Shield, DollarSign } from "lucide-react";

interface OrganizationOnboardingFlowProps {
  organizationId: number;
  onComplete?: () => void;
}

export default function OrganizationOnboardingFlow({ organizationId, onComplete }: OrganizationOnboardingFlowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(1);
  const [isLimitsDialogOpen, setIsLimitsDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'suspend' | 'reject'>('approve');

  // Fetch organization details
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: [`/api/admin/organizations/${organizationId}`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/organizations/${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch organization');
      return response.json();
    }
  });

  // Fetch KYC documents
  const { data: kycDocuments = [], isLoading: docsLoading } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/kyc-documents`],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/kyc-documents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch KYC documents');
      return response.json();
    }
  });

  // Update organization limits
  const updateLimitsMutation = useMutation({
    mutationFn: async (limits: {
      dailyTransactionLimit: string;
      monthlyTransactionLimit: string;
      singleTransactionLimit: string;
      amlRiskRating: string;
    }) => {
      const response = await fetch(`/api/admin/organizations/${organizationId}/limits`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(limits)
      });
      if (!response.ok) throw new Error('Failed to update limits');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organization limits updated successfully",
      });
      setIsLimitsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/organizations/${organizationId}`] });
    }
  });

  // Approve/suspend organization
  const approvalMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: string; reason?: string }) => {
      const response = await fetch(`/api/admin/organizations/${organizationId}/approval`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, reason })
      });
      if (!response.ok) throw new Error('Failed to update organization status');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organization status updated successfully",
      });
      setIsApprovalDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/organizations/${organizationId}`] });
      onComplete?.();
    }
  });

  if (orgLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading organization details...</p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Organization not found</p>
      </div>
    );
  }

  const requiredDocuments = [
    { type: 'pacra', name: 'PACRA Certificate', uploaded: false },
    { type: 'zra_tpin', name: 'ZRA TPIN Certificate', uploaded: false },
    { type: 'nrc_side1', name: 'NRC Front Side', uploaded: false },
    { type: 'nrc_side2', name: 'NRC Back Side', uploaded: false },
    { type: 'selfie', name: 'Director Selfie', uploaded: false },
  ];

  // Check which documents are uploaded
  requiredDocuments.forEach(doc => {
    doc.uploaded = kycDocuments.some((kyc: any) => kyc.documentType === doc.type && kyc.status === 'approved');
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending': 
      case 'in_review': return <Clock className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_review': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const onboardingSteps = [
    {
      id: 1,
      title: "Organization Details",
      description: "Basic organization information",
      completed: !!(organization.name && organization.contactEmail && organization.businessType)
    },
    {
      id: 2,
      title: "KYC Documentation",
      description: "Required regulatory documents",
      completed: requiredDocuments.every(doc => doc.uploaded)
    },
    {
      id: 3,
      title: "Limits & Settings",
      description: "Transaction limits and AML configuration",
      completed: organization.status === 'approved'
    },
    {
      id: 4,
      title: "Final Approval",
      description: "Admin review and approval",
      completed: organization.status === 'approved' && organization.isActive
    }
  ];

  return (
    <div className="space-y-6">
      {/* Organization Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Building className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle>{organization.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getStatusColor(organization.status)}>
                    {organization.status?.toUpperCase()}
                  </Badge>
                  <Badge className={getStatusColor(organization.kycStatus)}>
                    KYC: {organization.kycStatus?.toUpperCase()}
                  </Badge>
                  {organization.isActive && (
                    <Badge variant="default">ACTIVE</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsLimitsDialogOpen(true)}
                disabled={organization.status !== 'approved'}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Manage Limits
              </Button>
              <Button
                variant={organization.status === 'approved' ? 'destructive' : 'default'}
                onClick={() => {
                  setApprovalAction(organization.status === 'approved' ? 'suspend' : 'approve');
                  setIsApprovalDialogOpen(true);
                }}
              >
                <Shield className="h-4 w-4 mr-2" />
                {organization.status === 'approved' ? 'Suspend' : 'Approve'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Onboarding Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {onboardingSteps.map((step, index) => (
              <div
                key={step.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  activeStep === step.id
                    ? 'border-primary bg-primary/5'
                    : step.completed
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
                onClick={() => setActiveStep(step.id)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                    step.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step.completed ? '✓' : step.id}
                  </span>
                  <h3 className="font-medium">{step.title}</h3>
                </div>
                <p className="text-sm text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {activeStep === 1 && (
        <OrganizationDetailsStep organization={organization} organizationId={organizationId} />
      )}
      
      {activeStep === 2 && (
        <KYCDocumentationStep 
          organizationId={organizationId} 
          documents={kycDocuments}
          requiredDocuments={requiredDocuments}
        />
      )}
      
      {activeStep === 3 && (
        <LimitsSettingsStep organization={organization} organizationId={organizationId} />
      )}
      
      {activeStep === 4 && (
        <FinalApprovalStep organization={organization} organizationId={organizationId} />
      )}

      {/* Limits Management Dialog */}
      <LimitsManagementDialog
        open={isLimitsDialogOpen}
        onClose={() => setIsLimitsDialogOpen(false)}
        organization={organization}
        onSave={(limits) => updateLimitsMutation.mutate(limits)}
        isLoading={updateLimitsMutation.isPending}
      />

      {/* Approval Dialog */}
      <ApprovalDialog
        open={isApprovalDialogOpen}
        onClose={() => setIsApprovalDialogOpen(false)}
        action={approvalAction}
        organizationName={organization.name}
        onConfirm={(reason) => approvalMutation.mutate({ action: approvalAction, reason })}
        isLoading={approvalMutation.isPending}
      />
    </div>
  );
}

// Sub-components for each step
function OrganizationDetailsStep({ organization, organizationId }: { organization: any; organizationId: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Organization Name</Label>
            <p className="font-medium">{organization.name}</p>
          </div>
          <div>
            <Label>Business Type</Label>
            <p className="font-medium">{organization.businessType || 'Not specified'}</p>
          </div>
          <div>
            <Label>Registration Number</Label>
            <p className="font-medium">{organization.registrationNumber || 'Not provided'}</p>
          </div>
          <div>
            <Label>Contact Email</Label>
            <p className="font-medium">{organization.contactEmail || 'Not provided'}</p>
          </div>
        </div>
        <div>
          <Label>Address</Label>
          <p className="font-medium">{organization.address || 'Not provided'}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function KYCDocumentationStep({ 
  organizationId, 
  documents, 
  requiredDocuments 
}: { 
  organizationId: number; 
  documents: any[]; 
  requiredDocuments: any[] 
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>KYC Documentation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requiredDocuments.map((doc) => {
            const uploadedDoc = documents.find(d => d.documentType === doc.type);
            return (
              <div key={doc.type} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <div>
                    <h4 className="font-medium">{doc.name}</h4>
                    <p className="text-sm text-gray-600">Required for compliance</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {uploadedDoc ? (
                    <>
                      <Badge className={getStatusColor(uploadedDoc.status)}>
                        {uploadedDoc.status?.toUpperCase()}
                      </Badge>
                      <Button variant="outline" size="sm">View</Button>
                    </>
                  ) : (
                    <Badge variant="secondary">Not Uploaded</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function LimitsSettingsStep({ organization, organizationId }: { organization: any; organizationId: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Limits & AML Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Daily Limit</h4>
            <p className="text-2xl font-bold text-green-600">
              {organization.dailyTransactionLimit ? `ZMW ${parseFloat(organization.dailyTransactionLimit).toLocaleString()}` : 'Not set'}
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Monthly Limit</h4>
            <p className="text-2xl font-bold text-blue-600">
              {organization.monthlyTransactionLimit ? `ZMW ${parseFloat(organization.monthlyTransactionLimit).toLocaleString()}` : 'Not set'}
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Single Transaction</h4>
            <p className="text-2xl font-bold text-purple-600">
              {organization.singleTransactionLimit ? `ZMW ${parseFloat(organization.singleTransactionLimit).toLocaleString()}` : 'Not set'}
            </p>
          </div>
        </div>
        
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-2">AML Risk Rating</h4>
          <Badge className={
            organization.amlRiskRating === 'low' ? 'bg-green-100 text-green-800' :
            organization.amlRiskRating === 'high' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }>
            {organization.amlRiskRating?.toUpperCase() || 'MEDIUM'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function FinalApprovalStep({ organization, organizationId }: { organization: any; organizationId: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Final Approval Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-6 border rounded-lg text-center">
            {organization.status === 'approved' && organization.isActive ? (
              <div className="space-y-3">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                <h3 className="text-lg font-semibold text-green-800">Organization Approved & Active</h3>
                <p className="text-gray-600">This organization is fully onboarded and operational.</p>
                {organization.approvedAt && (
                  <p className="text-sm text-gray-500">
                    Approved on {new Date(organization.approvedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Clock className="h-12 w-12 text-yellow-600 mx-auto" />
                <h3 className="text-lg font-semibold text-yellow-800">Pending Final Approval</h3>
                <p className="text-gray-600">Organization is ready for final admin approval.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper components
function LimitsManagementDialog({ 
  open, 
  onClose, 
  organization, 
  onSave, 
  isLoading 
}: { 
  open: boolean; 
  onClose: () => void; 
  organization: any; 
  onSave: (limits: any) => void; 
  isLoading: boolean; 
}) {
  const [limits, setLimits] = useState({
    dailyTransactionLimit: organization.dailyTransactionLimit || '5000000',
    monthlyTransactionLimit: organization.monthlyTransactionLimit || '50000000',
    singleTransactionLimit: organization.singleTransactionLimit || '500000',
    amlRiskRating: organization.amlRiskRating || 'medium'
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Organization Limits</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Daily Transaction Limit (ZMW)</Label>
            <Input
              type="number"
              value={limits.dailyTransactionLimit}
              onChange={(e) => setLimits({...limits, dailyTransactionLimit: e.target.value})}
            />
          </div>
          <div>
            <Label>Monthly Transaction Limit (ZMW)</Label>
            <Input
              type="number"
              value={limits.monthlyTransactionLimit}
              onChange={(e) => setLimits({...limits, monthlyTransactionLimit: e.target.value})}
            />
          </div>
          <div>
            <Label>Single Transaction Limit (ZMW)</Label>
            <Input
              type="number"
              value={limits.singleTransactionLimit}
              onChange={(e) => setLimits({...limits, singleTransactionLimit: e.target.value})}
            />
          </div>
          <div>
            <Label>AML Risk Rating</Label>
            <Select value={limits.amlRiskRating} onValueChange={(value) => setLimits({...limits, amlRiskRating: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button 
              onClick={() => onSave(limits)} 
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalDialog({ 
  open, 
  onClose, 
  action, 
  organizationName, 
  onConfirm, 
  isLoading 
}: { 
  open: boolean; 
  onClose: () => void; 
  action: string; 
  organizationName: string; 
  onConfirm: (reason?: string) => void; 
  isLoading: boolean; 
}) {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === 'approve' ? 'Approve' : action === 'suspend' ? 'Suspend' : 'Reject'} Organization
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>
            Are you sure you want to {action} <strong>{organizationName}</strong>?
          </p>
          {(action === 'suspend' || action === 'reject') && (
            <div>
              <Label>Reason (required)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide a reason for this action..."
                required
              />
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button 
              onClick={() => onConfirm(reason)} 
              disabled={isLoading || ((action === 'suspend' || action === 'reject') && !reason.trim())}
              variant={action === 'approve' ? 'default' : 'destructive'}
              className="flex-1"
            >
              {isLoading ? 'Processing...' : `${action === 'approve' ? 'Approve' : action === 'suspend' ? 'Suspend' : 'Reject'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800';
    case 'verified': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'suspended': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'in_review': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}