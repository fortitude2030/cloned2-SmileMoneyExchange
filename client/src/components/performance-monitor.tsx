import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { queryClient } from '@/lib/queryClient';

interface QueryMetrics {
  totalQueries: number;
  activeQueries: number;
  staleQueries: number;
  errorQueries: number;
  cacheSize: number;
  memoryEstimate: number;
}

interface QueryInfo {
  queryKey: string;
  status: string;
  fetchStatus: string;
  dataUpdatedAt: number;
  isStale: boolean;
  observerCount: number;
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<QueryMetrics | null>(null);
  const [queries, setQueries] = useState<QueryInfo[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const updateMetrics = () => {
    const cache = queryClient.getQueryCache();
    const allQueries = cache.getAll();
    
    const queryMetrics: QueryMetrics = {
      totalQueries: allQueries.length,
      activeQueries: allQueries.filter(q => q.state.fetchStatus === 'fetching').length,
      staleQueries: allQueries.filter(q => q.isStale()).length,
      errorQueries: allQueries.filter(q => q.state.status === 'error').length,
      cacheSize: allQueries.length,
      memoryEstimate: allQueries.reduce((total, query) => {
        return total + JSON.stringify(query.state.data || {}).length;
      }, 0)
    };

    const queryInfo: QueryInfo[] = allQueries.map(query => ({
      queryKey: JSON.stringify(query.queryKey),
      status: query.state.status,
      fetchStatus: query.state.fetchStatus,
      dataUpdatedAt: query.state.dataUpdatedAt,
      isStale: query.isStale(),
      observerCount: query.getObserversCount()
    }));

    setMetrics(queryMetrics);
    setQueries(queryInfo);
  };

  useEffect(() => {
    if (isVisible) {
      updateMetrics();
      const interval = setInterval(updateMetrics, 2000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsVisible(!isVisible);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  const clearCache = () => {
    queryClient.clear();
    updateMetrics();
  };

  const clearStaleQueries = () => {
    const cache = queryClient.getQueryCache();
    cache.getAll().forEach(query => {
      if (query.isStale()) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
    updateMetrics();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999]">
        <Button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg border-2 border-white"
          title="Performance Monitor"
        >
          <i className="fas fa-chart-line text-lg"></i>
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Performance Monitor
          </h2>
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
          >
            <i className="fas fa-times"></i>
          </Button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {metrics && (
            <>
              {/* Metrics Overview */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics.totalQueries}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Total Queries
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.activeQueries}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Active Queries
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-yellow-600">
                      {metrics.staleQueries}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Stale Queries
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-600">
                      {metrics.errorQueries}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Error Queries
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatBytes(metrics.memoryEstimate)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Memory Usage
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-gray-600">
                      {metrics.cacheSize}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Cache Entries
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 mb-6">
                <Button onClick={updateMetrics} variant="outline" size="sm">
                  <i className="fas fa-refresh mr-2"></i>
                  Refresh
                </Button>
                <Button onClick={clearStaleQueries} variant="outline" size="sm">
                  <i className="fas fa-broom mr-2"></i>
                  Clear Stale
                </Button>
                <Button onClick={clearCache} variant="destructive" size="sm">
                  <i className="fas fa-trash mr-2"></i>
                  Clear Cache
                </Button>
              </div>

              {/* Query Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Query Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {queries.map((query, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {query.queryKey}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Updated: {new Date(query.dataUpdatedAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(query.status)}>
                            {query.status}
                          </Badge>
                          {query.isStale && (
                            <Badge variant="secondary">Stale</Badge>
                          )}
                          {query.observerCount > 0 && (
                            <Badge variant="outline">
                              {query.observerCount} obs
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}