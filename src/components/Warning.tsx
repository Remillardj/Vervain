
import React from 'react';
import { AlertTriangle, Shield, Check, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WarningProps {
  suspiciousDomain: string;
  originalDomain: string;
  onWhitelist: () => void;
  onClose: () => void;
  emailSender: string;
}

const Warning = ({ suspiciousDomain, originalDomain, onWhitelist, onClose, emailSender }: WarningProps) => {
  return (
    <Card className="w-full max-w-md shadow-xl border-2 border-red-500 animate-fadeIn bg-white">
      <CardHeader className="bg-red-50 pb-2 pt-3 px-4 border-b border-red-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <CardTitle className="text-lg font-bold text-red-700">Suspicious Email Domain</CardTitle>
          </div>
          <Badge className="bg-red-600">Warning</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 px-4">
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            The sender's domain appears to be suspicious and might be impersonating your domain:
          </p>
          
          <div className="bg-red-50 p-3 rounded border border-red-100">
            <p className="text-sm font-medium">From: <span className="font-bold">{emailSender}</span></p>
            <p className="text-sm font-medium mt-1">
              Domain: <span className="font-bold text-red-600">{suspiciousDomain}</span>
            </p>
            <p className="text-sm font-medium mt-1">
              Your domain: <span className="font-bold text-green-600">{originalDomain}</span>
            </p>
          </div>
          
          <div className="p-3 bg-yellow-50 rounded border border-yellow-100">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                This could be a phishing attempt. The sender may be trying to impersonate someone from your organization.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t border-gray-100 px-4 pt-3 pb-3 bg-gray-50">
        <Button 
          variant="outline" 
          onClick={onWhitelist}
          className="text-gray-700"
          size="sm"
        >
          <Check className="h-4 w-4 mr-1" />
          It's safe
        </Button>
        
        <Button 
          onClick={onClose}
          className="bg-red-600 hover:bg-red-700 text-white"
          size="sm"
        >
          <Shield className="h-4 w-4 mr-1" />
          Got it
        </Button>
      </CardFooter>
    </Card>
  );
};

export default Warning;
