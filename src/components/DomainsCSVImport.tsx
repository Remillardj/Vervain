import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileText, AlertCircle, CheckCircle, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  importFromCSV, 
  downloadCSVTemplate, 
  CSVImportResult 
} from '@/utils/csvImport';

interface DomainsCSVImportProps {
  onDomainsImport: (domains: string[], replaceAll?: boolean) => void;
  existingDomains: string[];
}

const DomainsCSVImport: React.FC<DomainsCSVImportProps> = ({
  onDomainsImport,
  existingDomains
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
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
      const result = importFromCSV(text, 'domains');
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

    if (replaceExisting) {
      // Replace all existing domains
      onDomainsImport(importResult.domains, true);
      toast({
        title: 'Success',
        description: `Replaced all domains with ${importResult.domains.length} from CSV`,
      });
    } else {
      // Filter out duplicates and append
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

      onDomainsImport(newDomains, false);
      toast({
        title: 'Success',
        description: `Imported ${newDomains.length} new domains`,
      });
    }

    // Reset state
    setImportResult(null);
    setShowPreview(false);
    setReplaceExisting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    downloadCSVTemplate('domains');
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
    
    return importResult.domains.filter(domain => 
      existingDomains.includes(domain)
    ).length;
  };

  const getNewCount = () => {
    if (!importResult) return 0;
    
    return importResult.domains.filter(domain => 
      !existingDomains.includes(domain)
    ).length;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-[#4B2EE3]" />
          Import Domains from CSV
        </CardTitle>
        <CardDescription>
          Bulk import domains to monitor for phishing attempts
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                    disabled={!replaceExisting && getNewCount() === 0}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {replaceExisting
                      ? `Replace All with ${importResult.domains.length} Domains`
                      : `Import ${getNewCount()} New Domains`}
                  </Button>
                </div>
              </div>

              {/* Replace existing checkbox */}
              <div className="flex items-center space-x-2 mb-4 p-3 bg-background rounded-md border-2 border-amber-500/20">
                <Checkbox
                  id="replace-existing"
                  checked={replaceExisting}
                  onCheckedChange={(checked) => setReplaceExisting(checked as boolean)}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="replace-existing"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Replace all existing domains
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {replaceExisting
                      ? `⚠️ This will delete all ${existingDomains.length} existing domains and replace them with ${importResult.domains.length} from the CSV`
                      : 'Add new domains to your existing list'}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-background rounded-md">
                  <div className="text-2xl font-bold text-[#4B2EE3]">{importResult.domains.length}</div>
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
                <h5 className="font-medium mb-2">Preview of Domains to Import:</h5>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.domains.slice(0, 10).map((domain, index) => (
                    <div key={index} className="text-sm p-2 bg-background rounded">
                      {domain}
                    </div>
                  ))}
                  {importResult.domains.length > 10 && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      ... and {importResult.domains.length - 10} more
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

export default DomainsCSVImport;
