'use client';

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';

interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  name: string;
  value: string;
  priority?: number;
  ttl?: number;
}

interface EmailForward {
  prefix: string;
  forwardto: string;
}

interface DomainInfo {
  status?: string;
  expiryDate?: string;
}

interface Nameservers {
  ns1?: string;
  ns2?: string;
}

// Module-scope loaders: try/finally inside the component body bails React
// Compiler out of memoizing the whole page.
async function loadDnsRecords(
  domain: string,
  setDnsRecords: Dispatch<SetStateAction<DNSRecord[]>>,
  setLoadingDns: Dispatch<SetStateAction<boolean>>
) {
  try {
    setLoadingDns(true);
    const res = await fetch(`/api/domains/${domain}/dns`);
    const data = await res.json();
    if (res.ok) setDnsRecords(data.records || []);
  } catch (e) {
    console.error(e);
  } finally {
    setLoadingDns(false);
  }
}

async function loadEmailForwards(
  domain: string,
  setForwards: Dispatch<SetStateAction<EmailForward[]>>
) {
  try {
    const res = await fetch(`/api/domains/${domain}/email-forwarding`);
    const data = await res.json();
    if (res.ok) setForwards(data.forwards || []);
  } catch (e) {
    console.error(e);
  }
}

async function loadIdProtection(
  domain: string,
  setIdProtection: Dispatch<SetStateAction<boolean>>
) {
  try {
    const res = await fetch(`/api/domains/${domain}/id-protection`);
    const data = await res.json();
    if (res.ok) setIdProtection(data.enabled);
  } catch (e) {
    console.error(e);
  }
}

interface DomainDetailsContext {
  domain: string;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setDomainInfo: Dispatch<SetStateAction<DomainInfo | null>>;
  setNameservers: Dispatch<SetStateAction<Nameservers | null>>;
  setLockStatus: Dispatch<SetStateAction<boolean>>;
  setDnsRecords: Dispatch<SetStateAction<DNSRecord[]>>;
  setLoadingDns: Dispatch<SetStateAction<boolean>>;
  setForwards: Dispatch<SetStateAction<EmailForward[]>>;
  setIdProtection: Dispatch<SetStateAction<boolean>>;
}

async function loadDomainDetails(context: DomainDetailsContext) {
  const { domain, setLoading, setLoadError, setDomainInfo, setNameservers } =
    context;
  // The tab data only depends on the domain param, so fire those requests
  // concurrently with the main details fetch instead of waterfalling them
  // behind it. Each loader owns its own error handling.
  loadDnsRecords(domain, context.setDnsRecords, context.setLoadingDns);
  loadEmailForwards(domain, context.setForwards);
  loadIdProtection(domain, context.setIdProtection);
  try {
    setLoading(true);
    setLoadError(null);
    const response = await fetch(`/api/domains/${domain}`);
    const data = await response.json();

    if (response.ok) {
      setDomainInfo(data.info);
      setNameservers(data.nameservers);
      context.setLockStatus(data.lock?.status === 'active');
    } else {
      setLoadError(data.error || 'Failed to load domain details');
    }
  } catch (error) {
    console.error('Error:', error);
    setLoadError('Failed to load domain details. Please try again.');
  } finally {
    setLoading(false);
  }
}

export default function DomainDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const domain = params.domain as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [domainInfo, setDomainInfo] = useState<DomainInfo | null>(null);
  const [nameservers, setNameservers] = useState<Nameservers | null>(null);
  const [lockStatus, setLockStatus] = useState<boolean>(false);

  // DNS State
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [loadingDns, setLoadingDns] = useState(false);
  const [newRecord, setNewRecord] = useState<DNSRecord>({
    type: 'A',
    name: '',
    value: '',
  });
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);

  // Email Forwarding State
  const [forwards, setForwards] = useState<EmailForward[]>([]);
  const [newForward, setNewForward] = useState<EmailForward>({
    prefix: '',
    forwardto: '',
  });

  // ID Protection State
  const [idProtection, setIdProtection] = useState<boolean>(false);

  const fetchDomainDetails = () =>
    loadDomainDetails({
      domain,
      setLoading,
      setLoadError,
      setDomainInfo,
      setNameservers,
      setLockStatus,
      setDnsRecords,
      setLoadingDns,
      setForwards,
      setIdProtection,
    });

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
  useEffect(() => {
    fetchDomainDetails();
  }, [domain]);

  // --- Actions ---

  const handleAddDnsRecord = async () => {
    const updatedRecords = [...dnsRecords, newRecord];
    let succeeded = false;
    try {
      const res = await fetchWithCsrf(`/api/domains/${domain}/dns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: updatedRecords }),
      });
      succeeded = res.ok;
    } catch (_) {
      succeeded = false;
    }

    if (succeeded) {
      setDnsRecords(updatedRecords);
      setIsAddRecordOpen(false);
      setNewRecord({ type: 'A', name: '', value: '' });
      toast({
        title: 'Success',
        description: 'DNS record added successfully',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to add DNS record',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDnsRecord = async (index: number) => {
    try {
      const updatedRecords = dnsRecords.filter((_, i) => i !== index);
      const res = await fetchWithCsrf(`/api/domains/${domain}/dns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: updatedRecords }),
      });

      if (res.ok) {
        setDnsRecords(updatedRecords);
        toast({ title: 'Success', description: 'DNS record deleted' });
      }
    } catch (_) {
      toast({
        title: 'Error',
        description: 'Failed to delete record',
        variant: 'destructive',
      });
    }
  };

  const handleAddForward = async () => {
    try {
      const updatedForwards = [...forwards, newForward];
      const res = await fetchWithCsrf(
        `/api/domains/${domain}/email-forwarding`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forwards: updatedForwards }),
        }
      );

      if (res.ok) {
        setForwards(updatedForwards);
        setNewForward({ prefix: '', forwardto: '' });
        toast({ title: 'Success', description: 'Email forward added' });
      }
    } catch (_) {
      toast({
        title: 'Error',
        description: 'Failed to add email forward',
        variant: 'destructive',
      });
    }
  };

  const handleToggleIdProtection = async (checked: boolean) => {
    try {
      const res = await fetchWithCsrf(`/api/domains/${domain}/id-protection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: checked }),
      });

      if (res.ok) {
        setIdProtection(checked);
        toast({
          title: 'Success',
          description: `ID Protection ${checked ? 'enabled' : 'disabled'}`,
        });
      }
    } catch (_) {
      toast({
        title: 'Error',
        description: 'Failed to update ID Protection',
        variant: 'destructive',
      });
    }
  };

  const handleToggleLock = async (checked: boolean) => {
    try {
      const res = await fetch(`/api/domains/${domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lock',
          data: { lock: checked },
        }),
      });

      if (res.ok) {
        setLockStatus(checked);
        toast({
          title: 'Success',
          description: `Registrar Lock ${checked ? 'enabled' : 'disabled'}`,
        });
      }
    } catch (_) {
      toast({
        title: 'Error',
        description: 'Failed to update Registrar Lock',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading domain details…</div>;
  }

  if (loadError) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{domain}</h1>
            <p className="text-muted-foreground">
              Manage domain settings and configuration
            </p>
          </div>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {loadError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchDomainDetails}
            >
              <RefreshCw className="size-4 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{domain}</h1>
          <p className="text-muted-foreground">
            Manage domain settings and configuration
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={fetchDomainDetails}>
            <RefreshCw className="size-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-500" />
              <span className="text-2xl font-bold capitalize">
                {domainInfo?.status || 'Active'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Expiry Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expires On
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {domainInfo?.expiryDate
                  ? new Date(domainInfo.expiryDate).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Auto Renew Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registrar Lock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock
                  className={`size-5 ${lockStatus ? 'text-green-500' : 'text-yellow-500'}`}
                />
                <span className="font-medium">
                  {lockStatus ? 'Locked' : 'Unlocked'}
                </span>
              </div>
              <Switch checked={lockStatus} onCheckedChange={handleToggleLock} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dns">
            <Globe className="size-4 mr-2" />
            DNS Records
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="size-4 mr-2" />
            Email Forwarding
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Shield className="size-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* DNS Tab */}
        <TabsContent value="dns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>DNS Management</CardTitle>
                <CardDescription>
                  Manage your domain's DNS records (A, CNAME, MX, etc.)
                </CardDescription>
              </div>
              <Dialog open={isAddRecordOpen} onOpenChange={setIsAddRecordOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4 mr-2" />
                    Add Record
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add DNS Record</DialogTitle>
                    <DialogDescription>
                      Add a new DNS record for {domain}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Type</Label>
                      <Select
                        value={newRecord.type}
                        onValueChange={(v: string) =>
                          setNewRecord({
                            ...newRecord,
                            type: v as DNSRecord['type'],
                          })
                        }
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A (Address)</SelectItem>
                          <SelectItem value="CNAME">CNAME (Alias)</SelectItem>
                          <SelectItem value="MX">MX (Mail)</SelectItem>
                          <SelectItem value="TXT">TXT (Text)</SelectItem>
                          <SelectItem value="NS">NS (Nameserver)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Name</Label>
                      <Input
                        value={newRecord.name}
                        onChange={(e) =>
                          setNewRecord({ ...newRecord, name: e.target.value })
                        }
                        placeholder="@ or subdomain"
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Value</Label>
                      <Input
                        value={newRecord.value}
                        onChange={(e) =>
                          setNewRecord({ ...newRecord, value: e.target.value })
                        }
                        placeholder="IP address or hostname"
                        className="col-span-3"
                      />
                    </div>
                    {newRecord.type === 'MX' && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Priority</Label>
                        <Input
                          type="number"
                          value={newRecord.priority || ''}
                          onChange={(e) =>
                            setNewRecord({
                              ...newRecord,
                              priority: Number.parseInt(e.target.value, 10),
                            })
                          }
                          placeholder="10"
                          className="col-span-3"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddDnsRecord}>Save Record</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingDns ? (
                <div className="text-center py-8">Loading DNS records…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dnsRecords.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No DNS records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      dnsRecords.map((record, index) => (
                        <TableRow
                          key={`${record.type}-${record.name}-${record.value}`}
                        >
                          <TableCell>
                            <Badge variant="outline">{record.type}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {record.name}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {record.value}
                          </TableCell>
                          <TableCell>{record.priority || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteDnsRecord(index)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Forwarding Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email Forwarding</CardTitle>
              <CardDescription>
                Forward emails from your domain to another address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4 items-end border-b pb-6">
                <div className="flex-1 space-y-2">
                  <Label>Prefix</Label>
                  <div className="flex items-center">
                    <Input
                      placeholder="info"
                      value={newForward.prefix}
                      onChange={(e) =>
                        setNewForward({ ...newForward, prefix: e.target.value })
                      }
                    />
                    <span className="ml-2 text-muted-foreground">
                      @{domain}
                    </span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Forward To</Label>
                  <Input
                    placeholder="you@gmail.com"
                    value={newForward.forwardto}
                    onChange={(e) =>
                      setNewForward({
                        ...newForward,
                        forwardto: e.target.value,
                      })
                    }
                  />
                </div>
                <Button onClick={handleAddForward}>Add Forward</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forwards.map((forward) => (
                    <TableRow key={`${forward.prefix}-${forward.forwardto}`}>
                      <TableCell>
                        {forward.prefix}@{domain}
                      </TableCell>
                      <TableCell>{forward.forwardto}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>ID Protection (WHOIS Privacy)</CardTitle>
                <CardDescription>
                  Hide your personal contact information from the public WHOIS
                  database
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium">Enable ID Protection</div>
                  <div className="text-sm text-muted-foreground">
                    Prevents spam and protects your identity
                  </div>
                </div>
                <Switch
                  checked={idProtection}
                  onCheckedChange={handleToggleIdProtection}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Nameservers</CardTitle>
                <CardDescription>
                  Manage the nameservers for your domain
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Nameserver 1</Label>
                    <Input
                      defaultValue={nameservers?.ns1}
                      placeholder="ns1.whogohost.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Nameserver 2</Label>
                    <Input
                      defaultValue={nameservers?.ns2}
                      placeholder="ns2.whogohost.com"
                    />
                  </div>
                  <Button className="w-full sm:w-auto">Save Nameservers</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
