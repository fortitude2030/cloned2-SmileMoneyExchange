import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TransactionNotificationProvider } from "@/hooks/use-transaction-notifications";
import { TimerProvider } from "@/contexts/timer-context";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import MerchantDashboard from "@/pages/merchant-dashboard";
import CashierDashboard from "@/pages/cashier-dashboard";
import FinancePortal from "@/pages/finance-portal";
import AdminDashboard from "@/pages/admin-dashboard";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <i className="fas fa-mobile-alt text-white text-2xl"></i>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={() => {
            // Route based on user role
            const userRole = (user as any)?.role;
            switch (userRole) {
              case 'merchant':
                return <MerchantDashboard />;
              case 'cashier':
                return <CashierDashboard />;
              case 'finance':
                return <FinancePortal />;
              case 'admin':
                return <AdminDashboard />;
              default:
                return <Landing />;
            }
          }} />
          <Route path="/merchant-dashboard" component={MerchantDashboard} />
          <Route path="/merchant" component={MerchantDashboard} />
          <Route path="/cashier-dashboard" component={CashierDashboard} />
          <Route path="/cashier" component={CashierDashboard} />
          <Route path="/finance-portal" component={FinancePortal} />
          <Route path="/finance" component={FinancePortal} />
          <Route path="/admin-dashboard" component={AdminDashboard} />
          <Route path="/admin" component={AdminDashboard} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TimerProvider>
          <TransactionNotificationProvider>
            <Toaster />
            <Router />
          </TransactionNotificationProvider>
        </TimerProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
