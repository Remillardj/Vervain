import React, { useEffect, useState } from 'react';
import { getData, saveData, setDomainDetectionEnabled, setContactDetectionEnabled, addAdditionalDomain, removeAdditionalDomain } from '@/utils/storage';
import { generateVariations } from '@/utils/dnstwist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Info, Plus, Trash2, Globe, AlertTriangle, User, Brain, Eye, EyeOff, Shield, Lock, RefreshCw, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TrustedContactsManager from './TrustedContactsManager';
import DomainsCSVImport from './DomainsCSVImport';

const InfoTip = ({ children }: { children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="text-muted-foreground hover:text-foreground inline-flex">
        <HelpCircle className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="max-w-xs text-sm">
      {children}
    </TooltipContent>
  </Tooltip>
);

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
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('claude-sonnet-4-5-20250929');
  const [showApiKey, setShowApiKey] = useState(false);
  const [autoTI, setAutoTI] = useState(false);
  const [autoAI, setAutoAI] = useState(false);
  const [virusTotalApiKey, setVirusTotalApiKey] = useState('');
  const [showVTApiKey, setShowVTApiKey] = useState(false);
  const [enabledThreatFeeds, setEnabledThreatFeeds] = useState<string[]>(['phishtank', 'urlhaus', 'threatfox', 'openphish']);
  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set());

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

      setAiEnabled(data.aiEnabled || false);
      setAiProvider(data.aiProvider || 'anthropic');
      setAiApiKey(data.aiApiKey || '');
      setAiModel(data.aiModel || 'claude-sonnet-4-5-20250929');
      setAutoTI(data.autoTI || false);
      setAutoAI(data.autoAI || false);
      setVirusTotalApiKey(data.virusTotalApiKey || '');
      setEnabledThreatFeeds(data.enabledThreatFeeds || ['phishtank', 'urlhaus', 'threatfox', 'openphish']);

      // Check managed storage for locked keys
      if (typeof chrome !== 'undefined' && chrome.storage?.managed) {
        try {
          chrome.storage.managed.get(null, (managed) => {
            if (chrome.runtime.lastError || !managed) return;
            const locked = new Set<string>();
            for (const key of Object.keys(managed)) {
              locked.add(key);
            }
            setLockedKeys(locked);
          });
        } catch {
          // Managed storage not available
        }
      }
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

  const handleToggleAutoTI = async () => {
    try {
      const newState = !autoTI;
      await saveData({ autoTI: newState });
      setAutoTI(newState);
      showToast(newState ? 'Auto known-threats check enabled' : 'Auto known-threats check disabled', 'success');
    } catch (error) {
      showToast('Failed to update setting', 'error');
    }
  };

  const handleToggleAutoAI = async () => {
    try {
      const newState = !autoAI;
      await saveData({ autoAI: newState });
      setAutoAI(newState);
      showToast(newState ? 'Auto AI Analysis enabled' : 'Auto AI Analysis disabled', 'success');
    } catch (error) {
      showToast('Failed to update setting', 'error');
    }
  };

  const handleSaveVTApiKey = async () => {
    try {
      await saveData({ virusTotalApiKey });
      showToast('VirusTotal API key saved', 'success');
    } catch (error) {
      showToast('Failed to save API key', 'error');
    }
  };

  const handleToggleFeed = async (feedId: string) => {
    const updated = enabledThreatFeeds.includes(feedId)
      ? enabledThreatFeeds.filter(f => f !== feedId)
      : [...enabledThreatFeeds, feedId];
    try {
      await saveData({ enabledThreatFeeds: updated });
      setEnabledThreatFeeds(updated);
      showToast('Threat feed settings updated', 'success');
    } catch (error) {
      showToast('Failed to update feed settings', 'error');
    }
  };

  const isLocked = (key: string) => lockedKeys.has(key);

  return (
    <TooltipProvider delayDuration={200}>
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
        <TabsList className="grid w-full grid-cols-5 mb-8">
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
          <TabsTrigger value="threatintel" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Known Threats</span>
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
                <div className="flex items-center gap-2">
                  {isLocked('domainDetectionEnabled') && (
                    <Lock className="h-4 w-4 text-muted-foreground" title="Controlled by your organization" />
                  )}
                  <Switch
                    checked={domainDetectionEnabled}
                    onCheckedChange={handleToggleDomainDetection}
                    disabled={isLocked('domainDetectionEnabled')}
                    aria-label="Toggle domain detection"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h4 className="font-medium">Contact Impersonation</h4>
                  <p className="text-sm text-muted-foreground">
                    Alert when someone uses a trusted contact's name with a different email
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isLocked('contactDetectionEnabled') && (
                    <Lock className="h-4 w-4 text-muted-foreground" title="Controlled by your organization" />
                  )}
                  <Switch
                    checked={contactDetectionEnabled}
                    onCheckedChange={handleToggleContactDetection}
                    disabled={isLocked('contactDetectionEnabled')}
                    aria-label="Toggle contact detection"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h4 className="font-medium">Auto AI Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically run AI analysis on every email
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isLocked('aiAutoScan') && (
                    <Lock className="h-4 w-4 text-muted-foreground" title="Controlled by your organization" />
                  )}
                  <Switch
                    checked={autoAI}
                    onCheckedChange={handleToggleAutoAI}
                    disabled={isLocked('aiAutoScan')}
                    aria-label="Toggle auto AI analysis"
                  />
                </div>
              </div>
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
              <CardDescription className="flex items-center gap-1.5">
                Add other domains you want to monitor for phishing attempts
                <InfoTip>
                  <p>For each domain, Vervain monitors for look-alike domains, typosquatting, and homoglyph attacks.</p>
                  <p className="mt-1">Use CSV Import below to add multiple domains from a spreadsheet.</p>
                </InfoTip>
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
                          <Badge variant="outline" className="text-xs">Local</Badge>
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
          
          {/* CSV Import Manager for Domains */}
          <DomainsCSVImport
            onDomainsImport={handleDomainsImport}
            existingDomains={additionalDomains}
          />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <TrustedContactsManager />
        </TabsContent>

        <TabsContent value="threatintel" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#4B2EE3]" />
                Known Threats
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                Vervain automatically checks every sender against known phishing and malware databases
                <InfoTip>
                  <p className="font-medium mb-1">How it works</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Quick check</strong> — Fast lookup against known threat databases (milliseconds)</li>
                    <li><strong>Confirmation</strong> — If a match is found, Vervain double-checks with the original source</li>
                  </ul>
                  <p className="mt-1.5">Databases refresh automatically. All data stays on your device.</p>
                </InfoTip>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#4B2EE3]" />
                VirusTotal
              </CardTitle>
              <CardDescription>
                Additional domain reputation checking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vt-api-key">VirusTotal API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="vt-api-key"
                      type={showVTApiKey ? 'text' : 'password'}
                      value={virusTotalApiKey}
                      onChange={(e) => setVirusTotalApiKey(e.target.value)}
                      placeholder="Enter your VirusTotal API key"
                      disabled={isLocked('virusTotalApiKey')}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowVTApiKey(!showVTApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showVTApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button onClick={handleSaveVTApiKey} disabled={isProcessing || isLocked('virusTotalApiKey')}>
                    Save Key
                  </Button>
                </div>
                {isLocked('virusTotalApiKey') && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Managed by your organization
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-[#4B2EE3]" />
                VERIFY My Suspicious
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                Use AI to check if a suspicious email is a phishing attempt
                <InfoTip>
                  <p className="font-medium mb-1">How it works</p>
                  <p>When you click "VERIFY" on an email in Gmail, Vervain sends it to your AI provider which checks for:</p>
                  <ul className="list-disc pl-4 space-y-1 mt-1">
                    <li><strong>PUSHED</strong> — Emotional manipulation (pressure, urgency, high-stakes threats)</li>
                    <li><strong>VERIFY</strong> — Technical red flags (fake domains, suspicious links, unusual requests)</li>
                  </ul>
                  <p className="mt-1.5">You get a risk score (0-100) and a breakdown of what was found. Your API key is stored locally.</p>
                </InfoTip>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h4 className="font-medium">Enable VERIFY</h4>
                  <p className="text-sm text-muted-foreground">
                    Show "VERIFY" button on emails in Gmail
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

        </TabsContent>
      </Tabs>
      
      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>
          Vervain &copy; {new Date().getFullYear()} — Protecting your domains from phishing attempts
        </p>
      </footer>
    </div>
    </TooltipProvider>
  );
};

export default OptionsPage;
