
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, ExternalLink } from 'lucide-react';
import IconGenerator from '@/components/IconGenerator';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <IconGenerator />
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center text-center mb-12">
          <div className="bg-blue-600 rounded-full p-3 mb-4">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-blue-800 mb-3">Vervain Protector</h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            A Chrome extension that protects your inbox from phishing attacks by identifying spoofed domains.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-700">How It Works</CardTitle>
              <CardDescription>
                Vervain uses advanced algorithms to protect you from email phishing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-3">
                <div className="flex-shrink-0 bg-blue-100 rounded-full h-8 w-8 flex items-center justify-center">
                  <span className="font-bold text-blue-600">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Set Your Domain</h3>
                  <p className="text-gray-600">
                    Tell Vervain your primary email domain (like "yourcompany.com")
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <div className="flex-shrink-0 bg-blue-100 rounded-full h-8 w-8 flex items-center justify-center">
                  <span className="font-bold text-blue-600">2</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Domain Analysis</h3>
                  <p className="text-gray-600">
                    The extension creates a database of possible spoofed domains using DNSTwist-like algorithms
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <div className="flex-shrink-0 bg-blue-100 rounded-full h-8 w-8 flex items-center justify-center">
                  <span className="font-bold text-blue-600">3</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Email Monitoring</h3>
                  <p className="text-gray-600">
                    Vervain scans emails in Gmail for suspicious domains that could be phishing attempts
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <div className="flex-shrink-0 bg-blue-100 rounded-full h-8 w-8 flex items-center justify-center">
                  <span className="font-bold text-blue-600">4</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Instant Alerts</h3>
                  <p className="text-gray-600">
                    Get real-time warnings when potentially malicious emails are detected
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-700">Protection Features</CardTitle>
              <CardDescription>
                Comprehensive protection against various domain spoofing techniques
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-800 mb-1">Typosquatting</h3>
                  <p className="text-sm text-green-700">
                    Detects keyboard proximity typos (e.g., "exarnple" instead of "example")
                  </p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-800 mb-1">Homographs</h3>
                  <p className="text-sm text-green-700">
                    Identifies similar-looking characters (e.g., using "ɑ" instead of "a")
                  </p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-800 mb-1">Bitsquatting</h3>
                  <p className="text-sm text-green-700">
                    Detects domains that exploit bit-level errors
                  </p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-800 mb-1">Hyphenation</h3>
                  <p className="text-sm text-green-700">
                    Catches inserted hyphens (e.g., "examp-le.com")
                  </p>
                </div>
              </div>
              
              <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-yellow-800 mb-1">Why You Need This</h3>
                    <p className="text-sm text-yellow-700">
                      Phishing attacks are becoming increasingly sophisticated. Vervain helps you identify emails that appear to come from your domain but are actually from malicious lookalikes.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-blue-800 mb-6">Ready to secure your inbox?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Shield className="mr-2 h-5 w-5" />
              Get Vervain Extension
            </Button>
            <Button variant="outline">
              <ExternalLink className="mr-2 h-5 w-5" />
              Learn More
            </Button>
          </div>
          <p className="mt-6 text-gray-500 text-sm">
            Works with Google Chrome and other Chromium-based browsers
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
