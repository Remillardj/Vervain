
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, AlertTriangle, Settings, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { getData, setDetectionEnabled } from '@/utils/storage';
import { useToast } from '@/hooks/use-toast';

interface DomainData {
  primaryDomain: string;
  variations: {
    type: string;
    domain: string;
  }[];
  setupComplete: boolean;
  detectionEnabled: boolean;
  alertsCount: number;
  lastUpdated: number;
}

const Dashboard = () => {
  const [data, setData] = useState<DomainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getData();
      setData({
        primaryDomain: result.primaryDomain,
        variations: result.variations,
        setupComplete: result.setupComplete,
        detectionEnabled: result.detectionEnabled,
        alertsCount: result.alertsCount,
        lastUpdated: result.lastUpdated
      });
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load your protection data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshVariations = async () => {
    if (!data?.primaryDomain) return;
    
    setRefreshing(true);
    try {
      // In a real extension, this would re-generate the variations
      // For now we'll just simulate a refresh
      setTimeout(() => {
        toast({
          title: "Protection Updated",
          description: "Your domain protection has been refreshed",
        });
        setRefreshing(false);
      }, 1500);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh protection data",
        variant: "destructive"
      });
      setRefreshing(false);
    }
  };

  const toggleDetection = async () => {
    if (!data) return;
    
    try {
      const newState = !data.detectionEnabled;
      await setDetectionEnabled(newState);
      
      setData({
        ...data,
        detectionEnabled: newState
      });
      
      toast({
        title: newState ? "Protection Enabled" : "Protection Disabled",
        description: newState 
          ? "Vervain will now protect your inbox" 
          : "Vervain protection is now paused",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update protection status",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4B2EE3]"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Error loading data. Please try again.</p>
        <Button 
          variant="outline" 
          onClick={loadData} 
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <img src="/vervain.png" alt="Vervain Logo" className="h-6 w-6 mr-2" />
          <h1 className="text-xl font-bold text-[#4B2EE3]">Vervain</h1>
        </div>
        <Badge 
          variant={data.detectionEnabled ? "default" : "outline"}
          className={data.detectionEnabled ? "bg-green-600" : "text-gray-500"}
        >
          {data.detectionEnabled ? "Protecting" : "Disabled"}
        </Badge>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-md font-medium">Domain Protection</CardTitle>
          <CardDescription>Protecting emails for your domain</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-[#4B2EE3]">
                {data.primaryDomain}
              </p>
              <p className="text-sm text-gray-500">
                {data.variations.length} variations monitored
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={refreshVariations}
              disabled={refreshing}
            >
              {refreshing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm">
              <span className="font-medium">Last updated:</span>{' '}
              {data.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString() : 'Never'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDetection}
              className={data.detectionEnabled ? "text-red-500 hover:text-red-600" : "text-green-600 hover:text-green-700"}
            >
              {data.detectionEnabled ? (
                <span className="flex items-center">
                  <EyeOff className="h-4 w-4 mr-1" />
                  Pause
                </span>
              ) : (
                <span className="flex items-center">
                  <Eye className="h-4 w-4 mr-1" />
                  Enable
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-md font-medium">Protection Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Alerts</p>
              <p className="text-2xl font-bold text-blue-800">{data.alertsCount}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-sm font-medium text-green-700">
                {data.detectionEnabled ? "Active" : "Inactive"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="options">
        <TabsList className="w-full">
          <TabsTrigger value="options" className="flex-1">Options</TabsTrigger>
          <TabsTrigger value="help" className="flex-1">Help</TabsTrigger>
        </TabsList>
        
        <TabsContent value="options">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-md font-medium">Protection Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
                      chrome.runtime.openOptionsPage();
                    }
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Advanced Settings
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    window.open("https://mail.google.com", "_blank");
                  }}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Open Gmail
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="help">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-md font-medium">Help & Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>About Vervain</strong></p>
                <p>Vervain protects you from domain spoofing, homographs, and typosquatting attacks in your emails.</p>
                <p className="mt-2"><strong>How it works:</strong></p>
                <p>We monitor emails for suspicious domains that look similar to your primary domain.</p>
                <p className="mt-2"><strong>Need help?</strong></p>
                <p>If you find a false positive or need assistance, click "Advanced Settings" for more options.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
