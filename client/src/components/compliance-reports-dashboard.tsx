import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Download, Calendar, TrendingUp, AlertCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ComplianceReport {
  id: number;
  reportType: string;
  reportPeriod: string;
  generatedBy: string;
  reportData: any;
  filePath: string | null;
  status: string;
  submittedAt: string | null;
  createdAt: string;
}

function ComplianceReportsDashboard() {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["/api/compliance/reports"],
  });

  const generateReportMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/compliance/reports/generate", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/reports"] });
      setIsGenerateDialogOpen(false);
      toast({
        title: "Success",
        description: "Compliance report generated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate compliance report",
        variant: "destructive",
      });
    },
  });

  const handleGenerateReport = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const reportType = formData.get("reportType") as string;
    const period = formData.get("period") as string;

    generateReportMutation.mutate({
      reportType,
      period,
    });
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "daily_summary":
        return <Calendar className="w-4 h-4" />;
      case "weekly_compliance":
        return <TrendingUp className="w-4 h-4" />;
      case "monthly_regulatory":
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case "daily_summary":
        return "Daily Summary";
      case "weekly_compliance":
        return "Weekly Compliance";
      case "monthly_regulatory":
        return "Monthly Regulatory";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "generated":
        return { variant: "default" as const, label: "Generated" };
      case "submitted":
        return { variant: "secondary" as const, label: "Submitted" };
      case "acknowledged":
        return { variant: "secondary" as const, label: "Acknowledged" };
      default:
        return { variant: "secondary" as const, label: status };
    }
  };

  const formatReportData = (reportData: any, reportType: string) => {
    if (reportType === "daily_summary") {
      return (
        <div className="text-sm space-y-1">
          <div>Transactions: {reportData.transactions?.count || 0}</div>
          <div>Total Amount: {reportData.transactions?.totalAmount?.toLocaleString() || 0} ZMW</div>
          <div>Alerts Generated: {reportData.alerts?.total || 0}</div>
          <div>High Risk Alerts: {reportData.alerts?.highRisk || 0}</div>
        </div>
      );
    }
    
    if (reportType === "weekly_compliance") {
      return (
        <div className="text-sm space-y-1">
          <div>High Risk Alerts: {reportData.highRiskAlerts || 0}</div>
          <div>Transaction Types: {reportData.transactionBreakdown?.length || 0}</div>
          <div>Suspicious Patterns: {reportData.suspiciousPatterns?.length || 0}</div>
        </div>
      );
    }
    
    if (reportType === "monthly_regulatory") {
      return (
        <div className="text-sm space-y-1">
          <div>Total Transactions: {reportData.transactionVolume?.count || 0}</div>
          <div>Total Volume: {reportData.transactionVolume?.totalAmount?.toLocaleString() || 0} ZMW</div>
          <div>Unique Users: {reportData.transactionVolume?.uniqueUsers || 0}</div>
          <div>AML Alerts: {reportData.amlCompliance?.alertsGenerated || 0}</div>
          <div>Status: {reportData.regulatoryStatus || "Unknown"}</div>
        </div>
      );
    }

    return <div className="text-sm text-gray-500">Report data available</div>;
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance Reports</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Generate and manage regulatory compliance reports for Bank of Zambia
          </p>
        </div>
        <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Compliance Report</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGenerateReport}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="reportType">Report Type</Label>
                  <Select name="reportType" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily_summary">Daily Summary Report</SelectItem>
                      <SelectItem value="weekly_compliance">Weekly Compliance Report</SelectItem>
                      <SelectItem value="monthly_regulatory">Monthly Regulatory Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="period">Report Period</Label>
                  <Input
                    name="period"
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    For monthly reports, select any date in the target month
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsGenerateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={generateReportMutation.isPending}>
                    {generateReportMutation.isPending ? "Generating..." : "Generate Report"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card className="border border-blue-200 dark:border-blue-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-600">Daily Reports</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {(reports as ComplianceReport[]).filter(r => r.reportType === "daily_summary").length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total generated</div>
          </CardContent>
        </Card>

        <Card className="border border-green-200 dark:border-green-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-600">Weekly Reports</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {(reports as ComplianceReport[]).filter(r => r.reportType === "weekly_compliance").length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total generated</div>
          </CardContent>
        </Card>

        <Card className="border border-purple-200 dark:border-purple-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-600">Regulatory Reports</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {(reports as ComplianceReport[]).filter(r => r.reportType === "monthly_regulatory").length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total generated</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {(reports as ComplianceReport[]).map((report) => (
          <Card key={report.id} className="border border-gray-200 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    {getReportTypeIcon(report.reportType)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {getReportTypeLabel(report.reportType)}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Period: {report.reportPeriod}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusBadge(report.status).variant}>
                    {getStatusBadge(report.status).label}
                  </Badge>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Report Summary</h4>
                  {formatReportData(report.reportData, report.reportType)}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Report Details</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>Generated: {new Date(report.createdAt).toLocaleString()}</div>
                    <div>Generated by: {report.generatedBy}</div>
                    {report.submittedAt && (
                      <div>Submitted: {new Date(report.submittedAt).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(reports as ComplianceReport[]).length === 0 && (
          <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Compliance Reports
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Generate your first compliance report for regulatory submissions
              </p>
              <Button onClick={() => setIsGenerateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default ComplianceReportsDashboard;