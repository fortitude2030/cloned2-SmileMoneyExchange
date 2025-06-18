import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Eye, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AmlAlert {
  id: number;
  userId: string;
  transactionId: number | null;
  alertType: string;
  riskScore: number;
  triggerAmount: string | null;
  thresholdAmount: string | null;
  description: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  flaggedAt: string;
  createdAt: string;
}

export function AmlAlertManagement() {
  const [reviewingAlert, setReviewingAlert] = useState<AmlAlert | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allAlerts, isLoading: allAlertsLoading } = useQuery({
    queryKey: ["/api/aml/alerts"],
  });

  const { data: pendingAlerts, isLoading: pendingAlertsLoading } = useQuery({
    queryKey: ["/api/aml/alerts/pending"],
  });

  const reviewAlertMutation = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: number; status: string; reviewNotes: string }) =>
      apiRequest(`/api/aml/alerts/${id}/review`, "PATCH", { status, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aml/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/aml/alerts/pending"] });
      setReviewingAlert(null);
      toast({
        title: "Success",
        description: "AML alert reviewed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to review AML alert",
        variant: "destructive",
      });
    },
  });

  const handleReviewAlert = (formData: FormData) => {
    if (!reviewingAlert) return;

    const status = formData.get("status") as string;
    const reviewNotes = formData.get("reviewNotes") as string;

    reviewAlertMutation.mutate({
      id: reviewingAlert.id,
      status,
      reviewNotes,
    });
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 70) return "text-red-600 dark:text-red-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getRiskScoreBadge = (score: number) => {
    if (score >= 70) return { variant: "destructive" as const, label: "High Risk" };
    if (score >= 40) return { variant: "default" as const, label: "Medium Risk" };
    return { variant: "secondary" as const, label: "Low Risk" };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "cleared":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "escalated":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "under_review":
        return <Eye className="w-4 h-4 text-blue-600" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return { variant: "default" as const, label: "Pending" };
      case "cleared":
        return { variant: "secondary" as const, label: "Cleared" };
      case "escalated":
        return { variant: "destructive" as const, label: "Escalated" };
      case "under_review":
        return { variant: "default" as const, label: "Under Review" };
      default:
        return { variant: "secondary" as const, label: status };
    }
  };

  const filteredAlerts = allAlerts?.filter((alert: AmlAlert) => 
    filterStatus === "all" || alert.status === filterStatus
  ) || [];

  const AlertCard = ({ alert }: { alert: AmlAlert }) => {
    const riskBadge = getRiskScoreBadge(alert.riskScore);
    const statusBadge = getStatusBadge(alert.status);
    
    return (
      <Card className="border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Alert #{alert.id}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {alert.alertType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={riskBadge.variant}>
                {riskBadge.label} ({alert.riskScore})
              </Badge>
              <Badge variant={statusBadge.variant}>
                {getStatusIcon(alert.status)}
                <span className="ml-1">{statusBadge.label}</span>
              </Badge>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-gray-800 dark:text-gray-200">
              {alert.description}
            </p>
            {alert.triggerAmount && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Trigger Amount:</span> {parseFloat(alert.triggerAmount).toLocaleString()} ZMW
              </div>
            )}
            {alert.thresholdAmount && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Threshold:</span> {parseFloat(alert.thresholdAmount).toLocaleString()} ZMW
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Flagged: {new Date(alert.flaggedAt).toLocaleString()}
              {alert.reviewedAt && (
                <span className="ml-2">
                  • Reviewed: {new Date(alert.reviewedAt).toLocaleString()}
                </span>
              )}
            </div>
            {alert.status === "pending" && (
              <Button
                size="sm"
                onClick={() => setReviewingAlert(alert)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Review
              </Button>
            )}
          </div>

          {alert.reviewNotes && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Review Notes:</span> {alert.reviewNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (allAlertsLoading || pendingAlertsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AML Alert Management</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and review suspicious transaction activities
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {pendingAlerts?.length || 0}
            </div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400">Pending</div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {allAlerts?.filter((a: AmlAlert) => a.riskScore >= 70).length || 0}
            </div>
            <div className="text-sm text-red-600 dark:text-red-400">High Risk</div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {allAlerts?.length || 0}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">Total Alerts</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="all">All Alerts</TabsTrigger>
          <TabsTrigger value="high-risk">High Risk</TabsTrigger>
          <TabsTrigger value="escalated">Escalated</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <div className="space-y-4">
            {pendingAlerts?.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No Pending Alerts
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    All alerts have been reviewed. Great job maintaining compliance!
                  </p>
                </CardContent>
              </Card>
            ) : (
              pendingAlerts?.map((alert: AmlAlert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <div className="mb-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4">
            {filteredAlerts.map((alert: AmlAlert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="high-risk" className="mt-6">
          <div className="space-y-4">
            {allAlerts?.filter((alert: AmlAlert) => alert.riskScore >= 70).map((alert: AmlAlert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="escalated" className="mt-6">
          <div className="space-y-4">
            {allAlerts?.filter((alert: AmlAlert) => alert.status === "escalated").map((alert: AmlAlert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!reviewingAlert} onOpenChange={() => setReviewingAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review AML Alert #{reviewingAlert?.id}</DialogTitle>
          </DialogHeader>
          {reviewingAlert && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Alert Details</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Type:</span> {reviewingAlert.alertType.replace('_', ' ')}</div>
                  <div><span className="font-medium">Risk Score:</span> {reviewingAlert.riskScore}/100</div>
                  <div><span className="font-medium">Description:</span> {reviewingAlert.description}</div>
                  {reviewingAlert.triggerAmount && (
                    <div><span className="font-medium">Trigger Amount:</span> {parseFloat(reviewingAlert.triggerAmount).toLocaleString()} ZMW</div>
                  )}
                  {reviewingAlert.thresholdAmount && (
                    <div><span className="font-medium">Threshold:</span> {parseFloat(reviewingAlert.thresholdAmount).toLocaleString()} ZMW</div>
                  )}
                  <div><span className="font-medium">User ID:</span> {reviewingAlert.userId}</div>
                  {reviewingAlert.transactionId && (
                    <div><span className="font-medium">Transaction ID:</span> {reviewingAlert.transactionId}</div>
                  )}
                </div>
              </div>

              <form action={handleReviewAlert}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="status">Review Decision</Label>
                    <Select name="status" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select review decision" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cleared">Clear Alert - No Action Required</SelectItem>
                        <SelectItem value="under_review">Under Review - Needs Investigation</SelectItem>
                        <SelectItem value="escalated">Escalate - Requires Senior Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="reviewNotes">Review Notes</Label>
                    <Textarea
                      name="reviewNotes"
                      placeholder="Add notes about your review decision..."
                      rows={4}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReviewingAlert(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={reviewAlertMutation.isPending}>
                      {reviewAlertMutation.isPending ? "Submitting..." : "Submit Review"}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AmlAlertManagement;