import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Building, Plus, MapPin, FileText, Users, Calendar, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";

interface Organization {
  id: number;
  name: string;
  registrationNumber: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  businessType: string;
  status: string;
  kycStatus: string;
  isActive: boolean;
  createdAt: string;
  totalUsers?: number;
  totalTransactions?: number;
  monthlyVolume?: string;
}

export default function AdminOrganizationManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kycFilter, setKycFilter] = useState('all');

  const [newOrg, setNewOrg] = useState({
    name: '',
    registrationNumber: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    businessType: '',
    pacraNumber: '',
    zraTpinNumber: '',
    businessLicenseNumber: '',
    businessLicenseExpiry: '',
    directorName: '',
    directorNrc: '',
    directorPhone: '',
    shareCapitalAmount: ''
  });

  // Fetch organizations
  const { data: organizations = [], isLoading: orgsLoading, error: orgsError } = useQuery({
    queryKey: ['/api/admin/organizations']
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (orgData: typeof newOrg) => {
      const response = await apiRequest('/api/admin/organizations', {
        method: 'POST',
        body: JSON.stringify(orgData),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/organizations'] });
      setIsCreateDialogOpen(false);
      setNewOrg({
        name: '',
        registrationNumber: '',
        address: '',
        contactEmail: '',
        contactPhone: '',
        businessType: '',
        pacraNumber: '',
        zraTpinNumber: '',
        businessLicenseNumber: '',
        businessLicenseExpiry: '',
        directorName: '',
        directorNrc: '',
        directorPhone: '',
        shareCapitalAmount: ''
      });
      toast({
        title: "Success",
        description: "Organization created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create organization",
        variant: "destructive",
      });
    },
  });

  // Status update mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest(`/api/admin/organizations/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/organizations'] });
      toast({
        title: "Success",
        description: "Organization status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update organization status",
        variant: "destructive",
      });
    },
  });

  const updateKycStatusMutation = useMutation({
    mutationFn: async ({ id, kycStatus }: { id: number; kycStatus: string }) => {
      const response = await apiRequest(`/api/admin/organizations/${id}/kyc-status`, {
        method: 'PUT',
        body: JSON.stringify({ kycStatus }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/organizations'] });
      toast({
        title: "Success",
        description: "KYC status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update KYC status",
        variant: "destructive",
      });
    },
  });

  const handleCreateOrganization = () => {
    // Validate required fields
    if (!newOrg.name || !newOrg.registrationNumber || !newOrg.contactEmail || !newOrg.zraTpinNumber) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Name, Registration Number, Contact Email, ZRA TPIN)",
        variant: "destructive",
      });
      return;
    }

    // Validate that at least PACRA Number OR Business License Number is provided
    if (!newOrg.pacraNumber && !newOrg.businessLicenseNumber) {
      toast({
        title: "Error",
        description: "Please provide either PACRA Number or Business License Number",
        variant: "destructive",
      });
      return;
    }

    // Prepare the data for submission
    const orgData = {
      ...newOrg,
      shareCapitalAmount: newOrg.shareCapitalAmount ? parseFloat(newOrg.shareCapitalAmount) : null,
      businessLicenseExpiry: newOrg.businessLicenseExpiry || null
    };

    createOrgMutation.mutate(orgData);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      case 'rejected': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getKycBadgeColor = (kycStatus: string) => {
    switch (kycStatus) {
      case 'verified': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
      case 'in_review': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const filteredOrganizations = Array.isArray(organizations) ? organizations.filter((org: Organization) => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         org.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         org.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    const matchesKyc = kycFilter === 'all' || org.kycStatus === kycFilter;
    return matchesSearch && matchesStatus && matchesKyc;
  }) : [];

  if (orgsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-200 dark:bg-gray-700 h-48 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (orgsError) {
    return (
      <div className="p-6">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
              Failed to Load Organizations
            </h3>
            <p className="text-red-600 dark:text-red-400 mb-4">
              There was an error loading the organization data. Please try refreshing the page.
            </p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/organizations'] })}
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Organization Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage organization registrations, KYC verification, and approvals
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Organization
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Organization Name *</Label>
                <Input
                  id="name"
                  value={newOrg.name}
                  onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  placeholder="Enter organization name"
                />
              </div>
              <div>
                <Label htmlFor="registrationNumber">Registration Number *</Label>
                <Input
                  id="registrationNumber"
                  value={newOrg.registrationNumber}
                  onChange={(e) => setNewOrg({ ...newOrg, registrationNumber: e.target.value })}
                  placeholder="PACRA registration number"
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={newOrg.contactEmail}
                  onChange={(e) => setNewOrg({ ...newOrg, contactEmail: e.target.value })}
                  placeholder="contact@organization.com"
                />
              </div>
              <div>
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={newOrg.contactPhone}
                  onChange={(e) => setNewOrg({ ...newOrg, contactPhone: e.target.value })}
                  placeholder="+260 XXX XXX XXX"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={newOrg.address}
                  onChange={(e) => setNewOrg({ ...newOrg, address: e.target.value })}
                  placeholder="Business address"
                />
              </div>
              <div>
                <Label htmlFor="businessType">Business Type</Label>
                <Select value={newOrg.businessType} onValueChange={(value) => setNewOrg({ ...newOrg, businessType: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="services">Services</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Regulatory Information Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Regulatory Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pacraNumber">PACRA Number *</Label>
                    <Input
                      id="pacraNumber"
                      value={newOrg.pacraNumber}
                      onChange={(e) => setNewOrg({ ...newOrg, pacraNumber: e.target.value })}
                      placeholder="PACRA registration number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zraTpinNumber">ZRA TPIN Number *</Label>
                    <Input
                      id="zraTpinNumber"
                      value={newOrg.zraTpinNumber}
                      onChange={(e) => setNewOrg({ ...newOrg, zraTpinNumber: e.target.value })}
                      placeholder="ZRA TPIN number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessLicenseNumber">Business License Number</Label>
                    <Input
                      id="businessLicenseNumber"
                      value={newOrg.businessLicenseNumber}
                      onChange={(e) => setNewOrg({ ...newOrg, businessLicenseNumber: e.target.value })}
                      placeholder="Alternative to PACRA"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessLicenseExpiry">License Expiry Date</Label>
                    <Input
                      id="businessLicenseExpiry"
                      type="date"
                      value={newOrg.businessLicenseExpiry}
                      onChange={(e) => setNewOrg({ ...newOrg, businessLicenseExpiry: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Director Information Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Director Information (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="directorName">Director Name</Label>
                    <Input
                      id="directorName"
                      value={newOrg.directorName}
                      onChange={(e) => setNewOrg({ ...newOrg, directorName: e.target.value })}
                      placeholder="Full name of director"
                    />
                  </div>
                  <div>
                    <Label htmlFor="directorNrc">Director NRC</Label>
                    <Input
                      id="directorNrc"
                      value={newOrg.directorNrc}
                      onChange={(e) => setNewOrg({ ...newOrg, directorNrc: e.target.value })}
                      placeholder="NRC number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="directorPhone">Director Phone</Label>
                    <Input
                      id="directorPhone"
                      value={newOrg.directorPhone}
                      onChange={(e) => setNewOrg({ ...newOrg, directorPhone: e.target.value })}
                      placeholder="+260 XXX XXX XXX"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shareCapitalAmount">Share Capital (ZMW)</Label>
                    <Input
                      id="shareCapitalAmount"
                      type="number"
                      value={newOrg.shareCapitalAmount}
                      onChange={(e) => setNewOrg({ ...newOrg, shareCapitalAmount: e.target.value })}
                      placeholder="Amount in ZMW"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateOrganization}
                  disabled={createOrgMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search Organizations</Label>
              <Input
                id="search"
                placeholder="Name, email, or registration..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="statusFilter">Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kycFilter">KYC Filter</Label>
              <Select value={kycFilter} onValueChange={setKycFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All KYC Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setKycFilter('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrganizations.map((org: Organization) => (
          <Card key={org.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{org.name}</CardTitle>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getStatusBadgeColor(org.status || 'pending')}>
                  {(org.status || 'pending').replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge className={getKycBadgeColor(org.kycStatus || 'pending')}>
                  KYC: {(org.kycStatus || 'pending').replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <FileText className="h-4 w-4 mr-2" />
                  <span>{org.registrationNumber}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span className="truncate">{org.address || 'No address provided'}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>{new Date(org.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <Select 
                  value={org.status || 'pending'} 
                  onValueChange={(status) => updateStatusMutation.mutate({ id: org.id, status })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={org.kycStatus || 'pending'} 
                  onValueChange={(kycStatus) => updateKycStatusMutation.mutate({ id: org.id, kycStatus })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">KYC Pending</SelectItem>
                    <SelectItem value="in_review">KYC In Review</SelectItem>
                    <SelectItem value="verified">KYC Verified</SelectItem>
                    <SelectItem value="rejected">KYC Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOrganizations.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Organizations Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm || statusFilter !== 'all' || kycFilter !== 'all' 
                ? 'No organizations match your current filters.'
                : 'No organizations have been created yet.'}
            </p>
            {(searchTerm || statusFilter !== 'all' || kycFilter !== 'all') && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setKycFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}