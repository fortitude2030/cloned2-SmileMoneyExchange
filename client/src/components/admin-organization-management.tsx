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
import { Building, Plus, MapPin, FileText, Users, Calendar, ToggleLeft, ToggleRight } from "lucide-react";
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
    businessType: ''
  });

  // Fetch organizations
  const { data: organizations = [], isLoading: orgsLoading } = useQuery({
    queryKey: ['/api/admin/organizations'],
    queryFn: async () => {
      const token = localStorage.getItem('firebaseToken');
      const response = await fetch('/api/admin/organizations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch organizations');
      return response.json();
    }
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (orgData: typeof newOrg) => {
      const token = localStorage.getItem('firebaseToken');
      const response = await fetch('/api/admin/organizations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orgData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create organization');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Organization Created",
        description: `${data.organization.name} has been created successfully`,
      });
      setIsCreateDialogOpen(false);
      setNewOrg({
        name: '',
        registrationNumber: '',
        address: '',
        contactEmail: '',
        contactPhone: '',
        businessType: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/organizations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Toggle organization status mutation
  const toggleOrgMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const token = localStorage.getItem('firebaseToken');
      const response = await fetch(`/api/admin/organizations/${orgId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to toggle organization status');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organization status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/organizations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update KYC status mutation
  const updateKycMutation = useMutation({
    mutationFn: async ({ orgId, kycStatus }: { orgId: number; kycStatus: string }) => {
      const token = localStorage.getItem('firebaseToken');
      const response = await fetch(`/api/admin/organizations/${orgId}/kyc`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ kycStatus })
      });
      if (!response.ok) throw new Error('Failed to update KYC status');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "KYC status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/organizations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Filter organizations
  const filteredOrganizations = organizations.filter((org: Organization) => {
    const matchesSearch = 
      (org.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (org.registrationNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (org.contactEmail || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && org.isActive) ||
      (statusFilter === 'inactive' && !org.isActive);
    
    const matchesKyc = kycFilter === 'all' || org.kycStatus === kycFilter;
    
    return matchesSearch && matchesStatus && matchesKyc;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      case 'under_review': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getKycBadgeColor = (kycStatus: string) => {
    switch (kycStatus) {
      case 'verified': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      case 'incomplete': return 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organization Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <Input
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kycFilter} onValueChange={setKycFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by KYC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All KYC Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add New Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Organization</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({...newOrg, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    value={newOrg.registrationNumber}
                    onChange={(e) => setNewOrg({...newOrg, registrationNumber: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select value={newOrg.businessType} onValueChange={(value) => setNewOrg({...newOrg, businessType: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="wholesale">Wholesale</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="agriculture">Agriculture</SelectItem>
                      <SelectItem value="mining">Mining</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="hospitality">Hospitality</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={newOrg.address}
                    onChange={(e) => setNewOrg({...newOrg, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={newOrg.contactEmail}
                      onChange={(e) => setNewOrg({...newOrg, contactEmail: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={newOrg.contactPhone}
                      onChange={(e) => setNewOrg({...newOrg, contactPhone: e.target.value})}
                    />
                  </div>
                </div>
                <Button 
                  onClick={() => createOrgMutation.mutate(newOrg)}
                  disabled={createOrgMutation.isPending}
                  className="w-full"
                >
                  {createOrgMutation.isPending ? 'Creating...' : 'Create Organization'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Organizations List */}
      <Card>
        <CardContent className="p-0">
          {orgsLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading organizations...</p>
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="p-8 text-center">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No organizations found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrganizations.map((org: Organization) => (
                <div key={org.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                          <Building className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                            {org.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <FileText className="h-3 w-3" />
                            Reg: {org.registrationNumber}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge className={getStatusBadgeColor(org.status)}>
                          {org.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        
                        <Badge className={getKycBadgeColor(org.kycStatus)}>
                          KYC: {org.kycStatus.replace('_', ' ').toUpperCase()}
                        </Badge>
                        
                        <Badge variant="outline" className="text-xs">
                          {org.businessType.toUpperCase()}
                        </Badge>
                        
                        <Badge variant={org.isActive ? "default" : "secondary"}>
                          {org.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {org.address}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created: {new Date(org.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {org.totalUsers || 0}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
                            <Users className="h-3 w-3" />
                            Users
                          </div>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {org.totalTransactions || 0}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Transactions
                          </div>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {org.monthlyVolume || '0'}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Monthly ZMW
                          </div>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <Select 
                            value={org.kycStatus} 
                            onValueChange={(value) => updateKycMutation.mutate({ orgId: org.id, kycStatus: value })}
                            disabled={updateKycMutation.isPending}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="incomplete">Incomplete</SelectItem>
                              <SelectItem value="verified">Verified</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleOrgMutation.mutate(org.id)}
                      disabled={toggleOrgMutation.isPending}
                      className="ml-4"
                    >
                      {org.isActive ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}