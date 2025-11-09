
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from 'lucide-react';
import { generateVariations } from '@/utils/dnstwist';
import { savePrimaryDomain } from '@/utils/storage';
import { useToast } from '@/hooks/use-toast';

const SetupPage = () => {
  const [domain, setDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!domain) {
      toast({
        title: "Error",
        description: "Please enter your primary domain",
        variant: "destructive"
      });
      return;
    }
    
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      toast({
        title: "Invalid Domain",
        description: "Please enter a valid domain (e.g. example.com)",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Generate potential phishing variations
      const variations = generateVariations(domain);
      
      // Save to storage
      await savePrimaryDomain(domain, variations);
      
      toast({
        title: "Setup Complete!",
        description: `Vervain will now protect emails from ${variations.length} possible domain variations.`,
      });
      
      // Reload to show dashboard
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      toast({
        title: "Setup Failed",
        description: "There was an error setting up Vervain",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-purple-50 to-white">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <img src="/vervain.png" alt="Vervain Logo" className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-bold text-[#4B2EE3]">Welcome to Vervain</CardTitle>
          <CardDescription className="text-gray-600">
            Protect your inbox from phishing attacks by telling us your primary domain
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                  What is your organization's primary email domain?
                </label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  For example, if your email is john@example.com, enter "example.com"
                </p>
              </div>
            </div>
          </CardContent>
          
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full bg-[#4B2EE3] hover:bg-[#3B1ED3] text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Setting up protection...
                </span>
              ) : (
                <span className="flex items-center">
                  <ShieldCheck className="mr-2 h-5 w-5" />
                  Set Up Protection
                </span>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <p className="mt-8 text-sm text-gray-500 max-w-md text-center">
        Vervain will scan your emails for domain spoofing and homograph attacks to keep you safe from phishing attempts.
      </p>
    </div>
  );
};

export default SetupPage;
