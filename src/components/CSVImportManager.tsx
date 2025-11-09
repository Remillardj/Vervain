import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, FileText, AlertCircle, CheckCircle, XCircle, Users, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  importFromCSV, 
  downloadCSVTemplate, 
  CSVImportResult 
} from '@/utils/csvImport';
import { TrustedContact } from '@/utils/storage';

interface CSVImportManagerProps {
  onContactsImport: (contacts: TrustedContact[]) => void;
  onDomainsImport: (domains: string[]) => void;
  existingContacts: TrustedContact[];
  existingDomains: string[];
}

const CSVImportManager: React.FC<CSVImportManagerProps> = ({
  onContactsImport,
  onDomainsImport,
  existingContacts,
  existingDomains
}) => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'domains'>('contacts');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    try {
      const text = await file.text();
      const result = importFromCSV(text, activeTab);
      setImportResult(result);
      setShowPreview(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to read CSV file',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    if (!importResult) return;

    if (activeTab === 'contacts') {
      // Filter out duplicates
      const newContacts = importResult.contacts.filter(contact => 
        !existingContacts.some(existing => 
          existing.email.toLowerCase() === contact.email.toLowerCase()
        )
      );
      
      if (newContacts.length === 0) {
        toast({
          title: 'No new contacts',
          description: 'All contacts in the CSV already exist',
        });
        return;
      }

      onContactsImport(newContacts);
      toast({
        title: 'Success',
        description: `Imported ${newContacts.length} new contacts`,
      });
    } else {
      // Filter out duplicates
      const newDomains = importResult.domains.filter(domain => 
        !existingDomains.includes(domain)
      );
      
      if (newDomains.length === 0) {
        toast({
          title: 'No new domains',
          description: 'All domains in the CSV already exist',
        });
        return;
      }

      onDomainsImport(newDomains);
      toast({
        title: 'Success',
        description: `Imported ${newDomains.length} new domains`,
      });
    }

    // Reset state
    setImportResult(null);
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    downloadCSVTemplate(activeTab);
  };

  const resetImport = () => {
    setImportResult(null);
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getDuplicateCount = () => {
    if (!importResult) return 0;
    
    if (activeTab === 'contacts') {
      return importResult.contacts.filter(contact => 
        existingContacts.some(existing => 
          existing.email.toLowerCase() === contact.email.toLowerCase()
        )
      ).length;
    } else {
      return importResult.domains.filter(domain => 
        existingDomains.includes(domain)
      ).length;
    }
  };

  const getNewCount = () => {
    if (!importResult) return 0;
    
    if (activeTab === 'contacts') {
      return importResult.contacts.filter(contact => 
        !existingContacts.some(existing => 
          existing.email.toLowerCase() === contact.email.toLowerCase()
        )
      ).length;
    } else {
      return importResult.domains.filter(domain => 
        !existingDomains.includes(domain)
      ).length;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-[#4B2EE3]" />
          CSV Import Manager
        </CardTitle>
        <CardDescription>
          Import contacts and domains from CSV files to quickly set up your protection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'contacts' | 'domains')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="domains" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Domains
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isProcessing ? 'Processing...' : 'Select CSV File'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="text-sm text-muted-foreground">
                <p>CSV format: Name, Email</p>
                <p>Example: John Doe, john.doe@example.com</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="domains" className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isProcessing ? 'Processing...' : 'Select CSV File'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="text-sm text-muted-foreground">
                <p>CSV format: Domain</p>
                <p>Example: example.com</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Import Preview */}
        {showPreview && importResult && (
          <div className="mt-6 space-y-4">
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Import Preview</h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetImport}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={getNewCount() === 0}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Import {getNewCount()} New {activeTab === 'contacts' ? 'Contacts' : 'Domains'}
                  </Button>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-background rounded-md">
                  <div className="text-2xl font-bold text-[#4B2EE3]">{importResult.contacts.length || importResult.domains.length}</div>
                  <div className="text-sm text-muted-foreground">Total in CSV</div>
                </div>
                <div className="text-center p-3 bg-background rounded-md">
                  <div className="text-2xl font-bold text-green-600">{getNewCount()}</div>
                  <div className="text-sm text-muted-foreground">New to Import</div>
                </div>
                <div className="text-center p-3 bg-background rounded-md">
                  <div className="text-2xl font-bold text-amber-600">{getDuplicateCount()}</div>
                  <div className="text-sm text-muted-foreground">Already Exist</div>
                </div>
              </div>

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Validation Errors ({importResult.errors.length})</span>
                  </div>
                  <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="text-amber-700 bg-amber-50 p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Data */}
              <div>
                <h5 className="font-medium mb-2">Preview of {activeTab === 'contacts' ? 'Contacts' : 'Domains'} to Import:</h5>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {activeTab === 'contacts' ? (
                    importResult.contacts.slice(0, 10).map((contact, index) => (
                      <div key={index} className="text-sm p-2 bg-background rounded">
                        {contact.name} ({contact.email})
                      </div>
                    ))
                  ) : (
                    importResult.domains.slice(0, 10).map((domain, index) => (
                      <div key={index} className="text-sm p-2 bg-background rounded">
                        {domain}
                      </div>
                    ))
                  )}
                  {(activeTab === 'contacts' ? importResult.contacts.length : importResult.domains.length) > 10 && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      ... and {(activeTab === 'contacts' ? importResult.contacts.length : importResult.domains.length) - 10} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CSVImportManager;
