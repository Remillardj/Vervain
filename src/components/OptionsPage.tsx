import React, { useEffect, useState } from 'react';
import { getData, saveData, setDomainDetectionEnabled, setContactDetectionEnabled, addAdditionalDomain, removeAdditionalDomain } from '@/utils/storage';
import { generateVariations } from '@/utils/dnstwist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Info, Plus, Trash2, Globe, AlertTriangle, User, Brain, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TrustedContactsManager from './TrustedContactsManager';
import DomainsCSVImport from './DomainsCSVImport';

const AI_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  anthropic: [
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-5.2', label: 'GPT-5.2' },
  ],
};

const OptionsPage = () => {
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [additionalDomains, setAdditionalDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [domainDetectionEnabled, setDomainDetectionEnabledState] = useState(true);
  const [contactDetectionEnabled, setContactDetectionEnabledState] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const { toast } = useToast();
  const [autoAddDomains, setAutoAddDomains] = useState(false); // New state for auto-add domains
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('claude-sonnet-4-5-20250929');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getData();
      setPrimaryDomain(data.primaryDomain || '');
      setAdditionalDomains(data.additionalDomains || []);

      // Migration: if old detectionEnabled exists but new ones don't, use it for both
      if (data.domainDetectionEnabled === undefined && data.detectionEnabled !== undefined) {
        setDomainDetectionEnabledState(data.detectionEnabled);
        setContactDetectionEnabledState(data.detectionEnabled);
      } else {
        setDomainDetectionEnabledState(data.domainDetectionEnabled !== false);
        setContactDetectionEnabledState(data.contactDetectionEnabled !== false);
      }

      setAutoAddDomains(data.autoAddDomains || false); // Load auto-add domains setting
      setAiEnabled(data.aiEnabled || false);
      setAiProvider(data.aiProvider || 'anthropic');
      setAiApiKey(data.aiApiKey || '');
      setAiModel(data.aiModel || 'claude-sonnet-4-5-20250929');
    } catch (error) {
      showToast('Failed to load settings', 'error');
    }
  };

  const showToast = (title: string, type: 'success' | 'error') => {
    toast({
      title,
      variant: type === 'error' ? 'destructive' : 'default',
    });
  };

  const handleSavePrimaryDomain = async () => {
    if (!primaryDomain) {
      showToast('Please enter a domain', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      // Generate variations
      const variations = generateVariations(primaryDomain);
      
      // Save to storage
      await saveData({
        primaryDomain,
        variations,
        setupComplete: true
      });
      
      showToast('Primary domain updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update primary domain', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain) {
      showToast('Please enter a domain', 'error');
      return;
    }

    if (additionalDomains.includes(newDomain)) {
      showToast('This domain is already in your list', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      await addAdditionalDomain(newDomain);
      setAdditionalDomains([...additionalDomains, newDomain]);
      setNewDomain('');
      showToast('Domain added successfully', 'success');
    } catch (error) {
      showToast('Failed to add domain', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    try {
      setIsProcessing(true);
      await removeAdditionalDomain(domain);
      setAdditionalDomains(additionalDomains.filter(d => d !== domain));
      showToast('Domain removed successfully', 'success');
    } catch (error) {
      showToast('Failed to remove domain', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleDomainSelection = (domain: string) => {
    const newSelection = new Set(selectedDomains);
    if (newSelection.has(domain)) {
      newSelection.delete(domain);
    } else {
      newSelection.add(domain);
    }
    setSelectedDomains(newSelection);
  };

  const handleSelectAllDomains = (checked: boolean) => {
    if (checked) {
      setSelectedDomains(new Set(additionalDomains));
    } else {
      setSelectedDomains(new Set());
    }
  };

  const handleDeleteSelectedDomains = async () => {
    if (selectedDomains.size === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedDomains.size} domain(s)?`)) {
      return;
    }

    try {
      setIsProcessing(true);
      const remainingDomains = additionalDomains.filter(d => !selectedDomains.has(d));
      await saveData({ additionalDomains: remainingDomains });
      setAdditionalDomains(remainingDomains);
      setSelectedDomains(new Set());
      showToast(`${selectedDomains.size} domain(s) removed successfully`, 'success');
    } catch (error) {
      showToast('Failed to remove domains', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDomainsImport = async (newDomains: string[], replaceAll: boolean = false) => {
    try {
      setIsProcessing(true);
      if (replaceAll) {
        // Replace all domains
        await saveData({ additionalDomains: newDomains });
        setAdditionalDomains(newDomains);
        setSelectedDomains(new Set()); // Clear selection
        showToast(`Replaced all domains with ${newDomains.length} from CSV`, 'success');
      } else {
        // Append new domains
        for (const domain of newDomains) {
          await addAdditionalDomain(domain);
        }
        setAdditionalDomains([...additionalDomains, ...newDomains]);
        showToast(`${newDomains.length} domains imported successfully`, 'success');
      }
    } catch (error) {
      showToast('Failed to import domains', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleDomainDetection = async () => {
    try {
      const newState = !domainDetectionEnabled;
      await setDomainDetectionEnabled(newState);
      setDomainDetectionEnabledState(newState);

      showToast(
        newState ? 'Domain monitoring enabled' : 'Domain monitoring disabled',
        'success'
      );
    } catch (error) {
      showToast('Failed to update domain detection settings', 'error');
    }
  };

  const handleToggleContactDetection = async () => {
    try {
      const newState = !contactDetectionEnabled;
      await setContactDetectionEnabled(newState);
      setContactDetectionEnabledState(newState);

      showToast(
        newState ? 'Contact monitoring enabled' : 'Contact monitoring disabled',
        'success'
      );
    } catch (error) {
      showToast('Failed to update contact detection settings', 'error');
    }
  };

  const saveAutoAddDomainsSetting = async (value: boolean) => {
    try {
      await saveData({ autoAddDomains: value });
      setAutoAddDomains(value);
      showToast('Auto-add domains setting updated', 'success');
    } catch (error) {
      showToast('Failed to update auto-add domains setting', 'error');
    }
  };

  const handleToggleAiEnabled = async () => {
    try {
      const newState = !aiEnabled;
      await saveData({ aiEnabled: newState });
      setAiEnabled(newState);
      showToast(newState ? 'AI analysis enabled' : 'AI analysis disabled', 'success');
    } catch (error) {
      showToast('Failed to update AI setting', 'error');
    }
  };

  const handleChangeAiProvider = async (value: 'anthropic' | 'openai') => {
    try {
      const defaultModel = AI_MODELS[value][0].value;
      await saveData({ aiProvider: value, aiModel: defaultModel });
      setAiProvider(value);
      setAiModel(defaultModel);
      showToast('AI provider updated', 'success');
    } catch (error) {
      showToast('Failed to update AI provider', 'error');
    }
  };

  const handleChangeAiModel = async (value: string) => {
    try {
      await saveData({ aiModel: value });
      setAiModel(value);
      showToast('AI model updated', 'success');
    } catch (error) {
      showToast('Failed to update AI model', 'error');
    }
  };

  const handleSaveAiApiKey = async () => {
    try {
      await saveData({ aiApiKey: aiApiKey });
      showToast('API key saved', 'success');
    } catch (error) {
      showToast('Failed to save API key', 'error');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <header className="mb-8 text-center">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="flex items-center space-x-2">
            <img src="/vervain.png" alt="Vervain Logo" className="h-8 w-8" />
            <h1 className="text-3xl font-bold tracking-tight text-[#4B2EE3]">Vervain Settings</h1>
          </div>
          <p className="text-[#4B2EE3] max-w-lg mx-auto font-medium">
            Configure your protection settings to defend against phishing attempts that target your domains.
          </p>
        </div>
      </header>

      <Tabs 
        defaultValue="general" 
        className="w-full" 
        value={activeTab} 
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>General</span>
          </TabsTrigger>
          <TabsTrigger value="domains" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span>Domains</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span>AI Analysis</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <img src="/vervain.png" alt="Vervain Logo" className="h-5 w-5" />
                Primary Domain Protection
              </CardTitle>
              <CardDescription>
                Set your primary domain that Vervain will protect from spoofing attempts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  type="text"
                  value={primaryDomain}
                  onChange={(e) => setPrimaryDomain(e.target.value)}
                  placeholder="example.com"
                  className="flex-1"
                />
                <Button 
                  onClick={handleSavePrimaryDomain}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Saving...' : 'Save Domain'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#4B2EE3]" />
                Detection Settings
              </CardTitle>
              <CardDescription>
                Configure how Vervain monitors for suspicious activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h4 className="font-medium">Domain Monitoring</h4>
                  <p className="text-sm text-muted-foreground">
                    Detect typosquatting, homograph attacks, and domain spoofing
                  </p>
                </div>
                <Switch
                  checked={domainDetectionEnabled}
                  onCheckedChange={handleToggleDomainDetection}
                  aria-label="Toggle domain detection"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h4 className="font-medium">Contact Impersonation</h4>
                  <p className="text-sm text-muted-foreground">
                    Alert when someone uses a trusted contact's name with a different email
                  </p>
                </div>
                <Switch
                  checked={contactDetectionEnabled}
                  onCheckedChange={handleToggleContactDetection}
                  aria-label="Toggle contact detection"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-[#4B2EE3]" />
                Auto-Add Domains
              </CardTitle>
              <CardDescription>
                Automatically add domains from emails to your monitored list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Switch 
                checked={autoAddDomains}
                onCheckedChange={saveAutoAddDomainsSetting}
                aria-label="Toggle auto-add domains"
              />
              <p className="text-sm text-muted-foreground mt-2">
                When enabled, Vervain will automatically add domains found in emails to your monitored list.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="domains" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-[#4B2EE3]" />
                Additional Domains
              </CardTitle>
              <CardDescription>
                Add other domains you want to monitor for phishing attempts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="Enter domain to monitor"
                  className="flex-1"
                />
                <Button 
                  onClick={handleAddDomain}
                  disabled={isProcessing}
                >
                  Add Domain
                </Button>
              </div>
              
              <div className="mt-6 space-y-2">
                <h4 className="font-medium mb-2">Monitored Domains</h4>
                {additionalDomains.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="mx-auto h-8 w-8 opacity-50 mb-2" />
                    <p>No additional domains added yet</p>
                    <p className="text-sm">Add domains above to monitor them for phishing attempts</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md mb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedDomains.size === additionalDomains.length && additionalDomains.length > 0}
                          onCheckedChange={handleSelectAllDomains}
                        />
                        <span className="text-sm font-medium">
                          Select All ({selectedDomains.size} of {additionalDomains.length})
                        </span>
                      </div>
                      {selectedDomains.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteSelectedDomains}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Selected ({selectedDomains.size})
                        </Button>
                      )}
                    </div>
                    {additionalDomains.map((domain) => (
                      <div
                        key={domain}
                        className="flex justify-between items-center p-3 bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedDomains.has(domain)}
                            onCheckedChange={() => handleToggleDomainSelection(domain)}
                          />
                          <span className="font-medium">{domain}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDomain(domain)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Important Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <p>
                  For each additional domain you add, Vervain will monitor for:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Look-alike domains that may be used in phishing attempts</li>
                  <li>Typosquatting variations of the domain name</li>
                  <li>Domains that use homoglyphs or special characters to mimic your domain</li>
                </ul>
                <p className="mt-4">
                  Adding too many domains may affect performance. Focus on your most important domains.
                </p>
                <p className="mt-4">
                  <strong>Pro Tip:</strong> Use the CSV Import Manager below to quickly add multiple domains from a spreadsheet.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* CSV Import Manager for Domains */}
          <DomainsCSVImport
            onDomainsImport={handleDomainsImport}
            existingDomains={additionalDomains}
          />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <TrustedContactsManager />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                About Trusted Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <p>
                  Adding trusted contacts helps Vervain protect you from impersonation attacks:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Vervain will flag emails where someone uses a trusted contact's name but with a different email address</li>
                  <li>This helps you detect when attackers try to impersonate people you know and trust</li>
                  <li>The system compares both the display name and email address to detect spoofing attempts</li>
                </ul>
                <p>
                  Add contacts that frequently email you and who might be targets for impersonation, such as colleagues, managers, or service providers.
                </p>
                <p className="mt-4">
                  <strong>Pro Tip:</strong> Use the CSV Import Manager below to quickly add multiple contacts from a spreadsheet.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-[#4B2EE3]" />
                AI Phishing Analysis
              </CardTitle>
              <CardDescription>
                Use AI to analyze emails for phishing indicators using the PUSHED and VERIFY frameworks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h4 className="font-medium">Enable AI Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Show "Analyze with AI" button on emails in Gmail
                  </p>
                </div>
                <Switch
                  checked={aiEnabled}
                  onCheckedChange={handleToggleAiEnabled}
                  aria-label="Toggle AI analysis"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-provider">Provider</Label>
                <Select value={aiProvider} onValueChange={handleChangeAiProvider}>
                  <SelectTrigger id="ai-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    <SelectItem value="openai">OpenAI GPT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-model">Model</Label>
                <Select value={aiModel} onValueChange={handleChangeAiModel}>
                  <SelectTrigger id="ai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS[aiProvider].map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-api-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="ai-api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder={aiProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button onClick={handleSaveAiApiKey} disabled={isProcessing}>
                    Save Key
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your API key is stored locally and never sent anywhere except the provider's API.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-[#4B2EE3]" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <p>
                  When you click "Analyze with AI" on an email in Gmail, Vervain sends the email content to your configured AI provider for analysis using two frameworks:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>PUSHED</strong> — Detects emotional manipulation: Pressure, Urgency, Surprise, High-stakes, Excitement, Desperation</li>
                  <li><strong>VERIFY</strong> — Checks technical indicators: sender legitimacy, link safety, attachment risks, and sensitive data requests</li>
                </ul>
                <p className="mt-2">
                  You'll receive a confidence score (0-100) and detailed breakdown of any suspicious indicators found.
                </p>
                <p className="mt-2 text-muted-foreground">
                  Note: You provide your own API key. Standard API usage charges from your provider apply.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>
          Vervain &copy; {new Date().getFullYear()} — Protecting your domains from phishing attempts
        </p>
      </footer>
    </div>
  );
};

export default OptionsPage;
