import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import MobileHeader from "@/components/mobile-header";
import { AmlAlertManagement } from "@/components/aml-alert-management";
import { ComplianceReportsDashboard } from "@/components/compliance-reports-dashboard";
import { TrendingUp, AlertTriangle, FileText, Shield, Users, CreditCard } from "lucide-react";

export default function FinanceOfficerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: pendingAlerts = [] } = useQuery({
    queryKey: ["/api/aml/alerts/pending"],
  });

  const { data: settlementRequests = [] } = useQuery({
    queryKey: ["/api/settlements/requests"],
  });

  const { data: complianceReports = [] } = useQuery({
    queryKey: ["/api/compliance/reports"],
  });

  // Calculate metrics for overview
  const pendingAlertsCount = pendingAlerts.length;
  const pendingSettlementsCount = settlementRequests.filter((r: any) => r.status === 'pending').length;
  const todaysReports = complianceReports.filter((r: any) => {
    const today = new Date().toDateString();
    return new Date(r.createdAt).toDateString() === today;
  }).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MobileHeader
        title="Finance Officer Portal"
        subtitle={`${user?.firstName} ${user?.lastName}`}
        icon="fas fa-chart-line"
        color="blue-600"
      />

      <div className="p-4 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-yellow-200 dark:border-yellow-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {pendingAlertsCount}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Pending AML Alerts
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-blue-200 dark:border-blue-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {pendingSettlementsCount}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Pending Settlements
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-green-200 dark:border-green-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {todaysReports}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Reports Today
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="aml-alerts">AML Alerts</TabsTrigger>
            <TabsTrigger value="settlements">Settlements</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Compliance Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        AML Compliance Status
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={pendingAlertsCount === 0 ? "secondary" : "destructive"}>
                          {pendingAlertsCount === 0 ? "Compliant" : `${pendingAlertsCount} Issues`}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Settlement Processing
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={pendingSettlementsCount === 0 ? "secondary" : "default"}>
                          {pendingSettlementsCount === 0 ? "Up to Date" : `${pendingSettlementsCount} Pending`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingAlerts.slice(0, 3).map((alert: any) => (
                      <div key={alert.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">AML Alert #{alert.id}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {alert.description}
                            </div>
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            Risk: {alert.riskScore}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {pendingAlerts.length === 0 && (
                      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                        No pending alerts - system is compliant
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="aml-alerts" className="mt-6">
            <AmlAlertManagement />
          </TabsContent>

          <TabsContent value="settlements" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Settlement Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {settlementRequests.map((request: any) => (
                    <div key={request.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {request.amount} ZMW - {request.bankName}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Account: {request.accountNumber}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            request.status === 'approved' ? 'secondary' :
                            request.status === 'pending' ? 'default' :
                            'destructive'
                          }>
                            {request.status}
                          </Badge>
                          <Badge variant={
                            request.priority === 'high' ? 'destructive' :
                            request.priority === 'medium' ? 'default' :
                            'secondary'
                          }>
                            {request.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  {settlementRequests.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No settlement requests found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <ComplianceReportsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}