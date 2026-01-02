import { useState } from 'react';
import { Account } from '../types/trade';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Plus, Building2, TrendingUp, Calendar, Edit, Archive } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

interface AccountManagerProps {
  accounts: Account[];
  onAddAccount: (account: Omit<Account, 'id'>) => void;
  onUpdateAccount: (id: string, account: Partial<Account>) => void;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  getAccountStats: (accountId: string) => { totalPnL: number; tradeCount: number; winRate: number };
}

export function AccountManager({
  accounts,
  onAddAccount,
  onUpdateAccount,
  selectedAccountId,
  onSelectAccount,
  getAccountStats
}: AccountManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    propFirm: 'TakeProfit Trader',
    accountSize: '',
    startDate: new Date().toISOString().split('T')[0],
    status: 'active' as Account['status'],
    notes: ''
  });

  const propFirms = [
    'TakeProfit Trader',
    'TopStep',
    'Apex Trader Funding',
    'FTMO',
    'MyFundedFutures',
    'Earn2Trade',
    'The5ers',
    'TradeDay',
    'Bulenox',
    'Leeloo Trading',
    'Other'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingAccount) {
      onUpdateAccount(editingAccount.id, {
        name: formData.name,
        propFirm: formData.propFirm,
        accountSize: parseFloat(formData.accountSize),
        startDate: formData.startDate,
        status: formData.status,
        notes: formData.notes
      });
    } else {
      onAddAccount({
        name: formData.name,
        propFirm: formData.propFirm,
        accountSize: parseFloat(formData.accountSize),
        startDate: formData.startDate,
        status: formData.status,
        notes: formData.notes
      });
    }
    
    setIsDialogOpen(false);
    setEditingAccount(null);
    setFormData({
      name: '',
      propFirm: '',
      accountSize: '',
      startDate: new Date().toISOString().split('T')[0],
      status: 'active',
      notes: ''
    });
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      propFirm: account.propFirm,
      accountSize: account.accountSize.toString(),
      startDate: account.startDate,
      status: account.status,
      notes: account.notes || ''
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      propFirm: 'TakeProfit Trader',
      accountSize: '',
      startDate: new Date().toISOString().split('T')[0],
      status: 'active',
      notes: ''
    });
    setIsDialogOpen(true);
  };

  const getStatusColor = (status: Account['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
      case 'passed':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'archived':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const activeAccounts = accounts.filter(a => a.status === 'active');
  const otherAccounts = accounts.filter(a => a.status !== 'active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Prop Firm Accounts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your prop firm accounts and track performance separately
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              New Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'Edit Account' : 'Add New Account'}</DialogTitle>
              <DialogDescription>
                {editingAccount ? 'Update account details' : 'Create a new prop firm account to track trades separately'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., TopStep - Nov 2024"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="propFirm">Prop Firm</Label>
                <Select value={formData.propFirm} onValueChange={(value) => setFormData({ ...formData, propFirm: value })} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select prop firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {propFirms.map((firm) => (
                      <SelectItem key={firm} value={firm}>
                        {firm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountSize">Account Size ($)</Label>
                <Input
                  id="accountSize"
                  type="number"
                  placeholder="50000"
                  value={formData.accountSize}
                  onChange={(e) => setFormData({ ...formData, accountSize: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: Account['status']) => setFormData({ ...formData, status: value })} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Account notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="min-h-[80px] resize-y"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingAccount ? 'Update Account' : 'Create Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Account Filter */}
      <div className="flex gap-2 items-center">
        <Label className="shrink-0">Filter by Account:</Label>
        <Select value={selectedAccountId || 'all'} onValueChange={(value) => onSelectAccount(value === 'all' ? null : value)}>
          <SelectTrigger className="w-[300px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* All Accounts Overview */}
      {accounts.length > 0 && (
        <Card className="bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-teal-500/10 border-2 border-blue-500/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl">All Accounts Overview</CardTitle>
                <CardDescription className="mt-1">
                  Aggregated performance across all {accounts.length} prop firm account{accounts.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                Copy Trading
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Account Size</p>
                <p className="text-2xl">
                  {formatCurrency(accounts.reduce((sum, acc) => sum + acc.accountSize, 0))}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Combined P&L</p>
                <p className={`text-2xl ${
                  accounts.reduce((sum, acc) => sum + getAccountStats(acc.id).totalPnL, 0) >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(accounts.reduce((sum, acc) => sum + getAccountStats(acc.id).totalPnL, 0))}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Trades</p>
                <p className="text-2xl">
                  {accounts.reduce((sum, acc) => sum + getAccountStats(acc.id).tradeCount, 0)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Overall Win Rate</p>
                <p className="text-2xl">
                  {(() => {
                    const totalTrades = accounts.reduce((sum, acc) => sum + getAccountStats(acc.id).tradeCount, 0);
                    if (totalTrades === 0) return '0.0%';
                    const totalWinRate = accounts.reduce((sum, acc) => {
                      const stats = getAccountStats(acc.id);
                      return sum + (stats.winRate * stats.tradeCount);
                    }, 0);
                    return (totalWinRate / totalTrades).toFixed(1) + '%';
                  })()}
                </p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t grid gap-4 md:grid-cols-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active Accounts:</span>
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                  {activeAccounts.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Passed Accounts:</span>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {accounts.filter(a => a.status === 'passed').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Failed Accounts:</span>
                <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400">
                  {accounts.filter(a => a.status === 'failed').length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Accounts */}
      {activeAccounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm text-muted-foreground">Active Accounts</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeAccounts.map((account) => {
              const stats = getAccountStats(account.id);
              return (
                <Card key={account.id} className={selectedAccountId === account.id ? 'ring-2 ring-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{account.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Building2 className="w-3 h-3" />
                          {account.propFirm}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={getStatusColor(account.status)}>
                        {account.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Account Size:</span>
                      <span>{formatCurrency(account.accountSize)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total P&L:</span>
                      <span className={stats.totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {formatCurrency(stats.totalPnL)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Trades:</span>
                      <span>{stats.tradeCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Win Rate:</span>
                      <span>{stats.winRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                      <Calendar className="w-3 h-3" />
                      Started {new Date(account.startDate).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditDialog(account)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Archive className="w-3 h-3 mr-1" />
                            Archive
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archive Account?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will mark the account as archived. You can still view trades from this account, but it won't appear in active account lists.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onUpdateAccount(account.id, { status: 'archived' })}>
                              Archive
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Other Accounts */}
      {otherAccounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm text-muted-foreground">Other Accounts</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherAccounts.map((account) => {
              const stats = getAccountStats(account.id);
              return (
                <Card key={account.id} className="opacity-75">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{account.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Building2 className="w-3 h-3" />
                          {account.propFirm}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={getStatusColor(account.status)}>
                        {account.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total P&L:</span>
                      <span className={stats.totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {formatCurrency(stats.totalPnL)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Trades:</span>
                      <span>{stats.tradeCount}</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditDialog(account)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {accounts.length === 0 && (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <Building2 className="w-12 h-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg">No Accounts Yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first prop firm account to start tracking trades
              </p>
            </div>
            <Button onClick={openNewDialog} className="gap-2 mt-2">
              <Plus className="w-4 h-4" />
              Create Account
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
