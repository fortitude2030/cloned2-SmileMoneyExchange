import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Edit, AlertTriangle, Shield, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AmlConfiguration {
  id: number;
  configType: string;
  thresholdAmount: string;
  currency: string;
  isActive: boolean;
  description: string;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function AmlConfigurationDashboard() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AmlConfiguration | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configurations, isLoading } = useQuery({
    queryKey: ["/api/aml/configurations"],
  });

  const createConfigMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/aml/configurations", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aml/configurations"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "AML configuration created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create AML configuration",
        variant: "destructive",
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/aml/configurations/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aml/configurations"] });
      setEditingConfig(null);
      toast({
        title: "Success",
        description: "AML configuration updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update AML configuration",
        variant: "destructive",
      });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/aml/configurations/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aml/configurations"] });
      toast({
        title: "Success",
        description: "AML configuration deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete AML configuration",
        variant: "destructive",
      });
    },
  });

  const handleCreateConfig = (formData: FormData) => {
    const configType = formData.get("configType") as string;
    const thresholdAmount = formData.get("thresholdAmount") as string;
    const description = formData.get("description") as string;

    createConfigMutation.mutate({
      configType,
      thresholdAmount: parseFloat(thresholdAmount),
      description,
    });
  };

  const handleUpdateConfig = (formData: FormData) => {
    if (!editingConfig) return;

    const thresholdAmount = formData.get("thresholdAmount") as string;
    const description = formData.get("description") as string;
    const isActive = formData.get("isActive") === "true";

    updateConfigMutation.mutate({
      id: editingConfig.id,
      thresholdAmount: parseFloat(thresholdAmount),
      description,
      isActive,
    });
  };

  const getConfigTypeIcon = (type: string) => {
    switch (type) {
      case "single_transaction":
        return <AlertTriangle className="w-4 h-4" />;
      case "daily_total":
        return <Shield className="w-4 h-4" />;
      case "weekly_volume":
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getConfigTypeLabel = (type: string) => {
    switch (type) {
      case "single_transaction":
        return "Single Transaction";
      case "daily_total":
        return "Daily Total";
      case "weekly_volume":
        return "Weekly Volume";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AML Configuration</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Configure anti-money laundering thresholds and monitoring rules
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Configuration
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create AML Configuration</DialogTitle>
            </DialogHeader>
            <form action={handleCreateConfig}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="configType">Configuration Type</Label>
                  <Select name="configType" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select configuration type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_transaction">Single Transaction Threshold</SelectItem>
                      <SelectItem value="daily_total">Daily Total Threshold</SelectItem>
                      <SelectItem value="weekly_volume">Weekly Volume Threshold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="thresholdAmount">Threshold Amount (ZMW)</Label>
                  <Input
                    name="thresholdAmount"
                    type="number"
                    step="0.01"
                    placeholder="50000"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    name="description"
                    placeholder="Describe this AML configuration..."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createConfigMutation.isPending}>
                    {createConfigMutation.isPending ? "Creating..." : "Create Configuration"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {configurations?.map((config: AmlConfiguration) => (
          <Card key={config.id} className="border border-gray-200 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    {getConfigTypeIcon(config.configType)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {getConfigTypeLabel(config.configType)}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Threshold: {parseFloat(config.thresholdAmount).toLocaleString()} {config.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={config.isActive ? "default" : "secondary"}>
                    {config.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingConfig(config)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteConfigMutation.mutate(config.id)}
                    disabled={deleteConfigMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {config.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {config.description}
                </p>
              )}
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Created: {new Date(config.createdAt).toLocaleDateString()}
                {config.updatedAt !== config.createdAt && (
                  <span className="ml-2">
                    • Updated: {new Date(config.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {configurations?.length === 0 && (
          <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No AML Configurations
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first AML configuration to start monitoring transactions
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Configuration
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit AML Configuration</DialogTitle>
          </DialogHeader>
          {editingConfig && (
            <form action={handleUpdateConfig}>
              <div className="space-y-4">
                <div>
                  <Label>Configuration Type</Label>
                  <Input
                    value={getConfigTypeLabel(editingConfig.configType)}
                    disabled
                    className="bg-gray-50 dark:bg-gray-800"
                  />
                </div>
                <div>
                  <Label htmlFor="thresholdAmount">Threshold Amount (ZMW)</Label>
                  <Input
                    name="thresholdAmount"
                    type="number"
                    step="0.01"
                    defaultValue={editingConfig.thresholdAmount}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    name="description"
                    defaultValue={editingConfig.description}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="isActive">Status</Label>
                  <Select name="isActive" defaultValue={editingConfig.isActive.toString()}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingConfig(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateConfigMutation.isPending}>
                    {updateConfigMutation.isPending ? "Updating..." : "Update Configuration"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}