import { useState } from 'react';
import { useForm } from 'react-hook-form@7.55.0';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { X, Upload, Image as ImageIcon, FileText, Download } from 'lucide-react';
import { Trade, TradeFormData, Account } from '../types/trade';
import { toast } from 'sonner@2.0.3';

interface TradeEntryProps {
  onAddTrade: (trade: Trade) => void;
  accounts: Account[];
  selectedAccountId: string | null;
}

export function TradeEntry({ onAddTrade, accounts, selectedAccountId }: TradeEntryProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string>('');
  const [csvError, setCsvError] = useState<string>('');
  const [csvSuccess, setCsvSuccess] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('manual');
  const [csvDuration, setCsvDuration] = useState<string>('');
  const [csvExitDate, setCsvExitDate] = useState<string>('');
  const [accountId, setAccountId] = useState<string>(selectedAccountId || '');
  
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<TradeFormData>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      assetType: 'futures',
      type: 'buy',
      position: 'long'
    }
  });

  const watchType = watch('type');
  const watchPosition = watch('position');
  const watchAssetType = watch('assetType');
  const watchEntryPrice = watch('entryPrice');
  const watchExitPrice = watch('exitPrice');
  const watchStopLoss = watch('stopLoss');
  const watchTargetPrice = watch('targetPrice');
  const watchQuantity = watch('quantity');

  const getSymbolPlaceholder = () => {
    switch (watchAssetType) {
      case 'futures':
        return 'e.g., NQ, ES, CL';
      case 'stock':
        return 'e.g., AAPL, TSLA';
      case 'options':
        return 'e.g., AAPL 240C';
      case 'crypto':
        return 'e.g., BTC, ETH';
      case 'forex':
        return 'e.g., EUR/USD';
      default:
        return 'e.g., AAPL';
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setUploadError('');
    
    Array.from(files).forEach(file => {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('File size must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setUploadError('Only image files are allowed');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setPhotos(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });

    // Clear the input
    event.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvError('');
    setCsvSuccess('');

    if (!file.name.endsWith('.csv')) {
      setCsvError('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        parseCSV(text);
      } catch (error) {
        setCsvError('Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);

    // Clear the input
    event.target.value = '';
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      setCsvError('CSV file is empty or invalid');
      return;
    }

    // Support both comma and tab delimiters
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    // Normalize headers: lowercase, remove spaces/underscores/dashes
    const headers = lines[0].split(delimiter).map(h => 
      h.trim().toLowerCase().replace(/[\s_-]+/g, '')
    );
    const values = lines[1].split(delimiter).map(v => v.trim());

    const csvData: any = {};
    headers.forEach((header, index) => {
      csvData[header] = values[index];
    });

    console.log('Parsed CSV headers:', headers);
    console.log('Parsed CSV data:', csvData);

    // Helper function to get value from multiple possible keys
    const getValue = (...keys: string[]) => {
      for (const key of keys) {
        if (csvData[key]) return csvData[key];
      }
      return null;
    };

    // Map CSV fields to form fields based on your structure
    // symbol → symbol
    const symbol = getValue('symbol', 'ticker', 'stock', 'instrument');
    if (symbol) setValue('symbol', symbol);
    
    // qty → quantity
    const quantity = getValue('qty', 'quantity', 'size', 'shares', 'contracts');
    if (quantity) setValue('quantity', quantity);
    
    // buyPrice → entryPrice
    const entryPrice = getValue('buyprice', 'buy', 'entry', 'entryprice', 'open', 'openprice');
    if (entryPrice) setValue('entryPrice', entryPrice);
    
    // sellPrice → exitPrice
    const exitPrice = getValue('sellprice', 'sell', 'exit', 'exitprice', 'close', 'closeprice');
    if (exitPrice) setValue('exitPrice', exitPrice);
    
    // boughtTimestamp → date (convert timestamp to date if needed)
    const boughtTimestamp = getValue('boughttimestamp', 'bought', 'entrytime', 'opentime', 'date', 'timestamp');
    if (boughtTimestamp) {
      const timestamp = boughtTimestamp;
      // Try to parse as ISO date or timestamp
      let dateValue;
      if (timestamp.includes('-')) {
        dateValue = timestamp.split('T')[0]; // ISO format
      } else if (!isNaN(timestamp)) {
        // Unix timestamp in milliseconds
        dateValue = new Date(Number(timestamp)).toISOString().split('T')[0];
      } else {
        dateValue = timestamp;
      }
      setValue('date', dateValue);
    }
    
    // Determine position from buyPrice/sellPrice existence or from PnL
    // If we have both buy and sell, it's a closed position
    if (entryPrice && exitPrice) {
      const buyPrice = Number(entryPrice);
      const sellPrice = Number(exitPrice);
      // If sell > buy, it was a long position
      // If buy > sell, it was a short position
      const position = sellPrice > buyPrice ? 'long' : 'short';
      setValue('position', position);
      setValue('type', position === 'long' ? 'buy' : 'sell');
    }
    
    // Store duration and soldTimestamp for display (will be added to trade on submit)
    const duration = getValue('duration', 'holdtime', 'timeheld');
    if (duration) {
      setCsvDuration(duration);
    }
    
    // soldTimestamp → exitDate
    const soldTimestamp = getValue('soldtimestamp', 'sold', 'exittime', 'closetime');
    if (soldTimestamp) {
      const timestamp = soldTimestamp;
      let dateValue;
      if (timestamp.includes('-')) {
        dateValue = timestamp.split('T')[0]; // ISO format
      } else if (!isNaN(timestamp)) {
        dateValue = new Date(Number(timestamp)).toISOString().split('T')[0];
      } else {
        dateValue = timestamp;
      }
      setCsvExitDate(dateValue);
    }
    
    // Also support legacy format fields
    const assetType = getValue('assettype', 'asset', 'type', 'instrument', 'market');
    if (assetType) {
      const normalizedType = assetType.toLowerCase();
      if (['futures', 'stock', 'options', 'crypto', 'forex'].includes(normalizedType)) {
        setValue('assetType', normalizedType as any);
      }
    } else {
      // Default to futures for your trading style
      setValue('assetType', 'futures');
    }
    
    const contractType = getValue('contracttype', 'contract', 'size');
    if (contractType) {
      const normalizedContract = contractType.toLowerCase();
      if (['mini', 'micro'].includes(normalizedContract)) {
        setValue('contractType', normalizedContract as any);
      }
    }
    
    const stopLoss = getValue('stoploss', 'stop', 'sl');
    if (stopLoss) {
      setValue('stopLoss', stopLoss);
    }
    
    const targetPrice = getValue('targetprice', 'target', 'tp', 'takeprofit');
    if (targetPrice) {
      setValue('targetPrice', targetPrice);
    }
    
    const tagsValue = getValue('tags', 'labels', 'categories');
    if (tagsValue) {
      const tagsArray = tagsValue.split(';').map((t: string) => t.trim()).filter((t: string) => t);
      setTags(tagsArray);
    }

    setCsvSuccess('CSV data loaded successfully! Review the data and click "Add Trade" to submit.');
    setActiveTab('manual'); // Switch to manual tab to review
  };

  const downloadCSVTemplate = () => {
    const template = `symbol\t_priceFormat\t_priceFormatType\t_tickSize\tbuyFillId\tsellFillId\tqty\tbuyPrice\tsellPrice\tpnl\tboughtTimestamp\tsoldTimestamp\tduration
NQ\t2\t0\t0.25\t12345\t12346\t2\t18500.00\t18600.00\t200.00\t2024-01-15T09:30:00\t2024-01-15T11:45:00\t2h 15m`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trade_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const calculateRiskRewardRatio = () => {
    const entryPrice = Number(watchEntryPrice);
    const stopLoss = Number(watchStopLoss);
    const targetPrice = Number(watchTargetPrice);

    if (!entryPrice || !stopLoss || !targetPrice) return null;

    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(targetPrice - entryPrice);

    if (risk === 0) return null;
    return (reward / risk);
  };

  const riskRewardRatio = calculateRiskRewardRatio();

  const onSubmit = (data: TradeFormData) => {
    // If "All Accounts" is selected, create trades for all active accounts
    if (accountId === 'all') {
      const activeAccounts = accounts.filter(acc => acc.status === 'active');
      
      activeAccounts.forEach((account, index) => {
        const trade: Trade = {
          id: (Date.now() + index).toString(), // Ensure unique IDs
          accountId: account.id,
          date: data.date,
          symbol: data.symbol.toUpperCase(),
          assetType: data.assetType,
          contractType: data.assetType === 'futures' ? data.contractType : undefined,
          type: data.type,
          position: data.position,
          quantity: Number(data.quantity),
          entryPrice: Number(data.entryPrice),
          exitPrice: data.exitPrice ? Number(data.exitPrice) : undefined,
          exitDate: csvExitDate || undefined,
          duration: csvDuration || undefined,
          stopLoss: data.stopLoss ? Number(data.stopLoss) : undefined,
          targetPrice: data.targetPrice ? Number(data.targetPrice) : undefined,
          riskRewardRatio: riskRewardRatio || undefined,
          status: data.exitPrice ? 'closed' : 'open',
          tags,
          photos: photos.length > 0 ? photos : undefined,
          pnl: data.exitPrice 
            ? (data.position === 'long' 
              ? (Number(data.exitPrice) - Number(data.entryPrice)) * Number(data.quantity)
              : (Number(data.entryPrice) - Number(data.exitPrice)) * Number(data.quantity))
            : undefined
        };
        
        onAddTrade(trade);
      });

      // Show success toast for copy trading
      toast.success(`Trade copied to ${activeAccounts.length} accounts`, {
        description: `${data.symbol.toUpperCase()} ${data.position.toUpperCase()} @ ${data.entryPrice}`,
      });
    } else {
      // Single trade for specific account or no account
      const trade: Trade = {
        id: Date.now().toString(),
        accountId: accountId || undefined,
        date: data.date,
        symbol: data.symbol.toUpperCase(),
        assetType: data.assetType,
        contractType: data.assetType === 'futures' ? data.contractType : undefined,
        type: data.type,
        position: data.position,
        quantity: Number(data.quantity),
        entryPrice: Number(data.entryPrice),
        exitPrice: data.exitPrice ? Number(data.exitPrice) : undefined,
        exitDate: csvExitDate || undefined,
        duration: csvDuration || undefined,
        stopLoss: data.stopLoss ? Number(data.stopLoss) : undefined,
        targetPrice: data.targetPrice ? Number(data.targetPrice) : undefined,
        riskRewardRatio: riskRewardRatio || undefined,
        status: data.exitPrice ? 'closed' : 'open',
        tags,
        photos: photos.length > 0 ? photos : undefined,
        pnl: data.exitPrice 
          ? (data.position === 'long' 
            ? (Number(data.exitPrice) - Number(data.entryPrice)) * Number(data.quantity)
            : (Number(data.entryPrice) - Number(data.exitPrice)) * Number(data.quantity))
          : undefined
      };

      onAddTrade(trade);
    }

    reset();
    setTags([]);
    setPhotos([]);
    setUploadError('');
    setCsvDuration('');
    setCsvExitDate('');
    setAccountId(selectedAccountId || '');
  };

  return (
    <Card className="hover-lift">
      <CardHeader>
        <CardTitle>Add New Trade</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="csv">Upload CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="csv" className="space-y-4">
            {/* Account Selector for CSV */}
            <div className="space-y-2">
              <Label htmlFor="csv-account">Account for CSV Import</Label>
              <Select
                value={accountId || 'none'}
                onValueChange={(value) => setAccountId(value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Account</SelectItem>
                  {accounts.filter(acc => acc.status === 'active').length > 1 && (
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <span>All Accounts</span>
                        <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          Copy Trading
                        </Badge>
                      </div>
                    </SelectItem>
                  )}
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {accountId === 'all' 
                  ? `CSV trade will be copied to all ${accounts.filter(acc => acc.status === 'active').length} active accounts`
                  : 'Link CSV trade to a prop firm account'}
              </p>
            </div>

            <div className="border-2 border-dashed border-input rounded-lg p-8 text-center space-y-4">
              <div className="flex justify-center">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <h3 className="mb-2">Upload Trade Data from CSV</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a CSV file to automatically populate the trade form
                </p>
              </div>
              
              <div className="flex flex-col items-center gap-3">
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="blue"
                  onClick={() => document.getElementById('csv-upload')?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Choose CSV File
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadCSVTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>

              {csvError && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-destructive text-sm">{csvError}</p>
                </div>
              )}

              {csvSuccess && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                  <p className="text-green-600 dark:text-green-500 text-sm">{csvSuccess}</p>
                </div>
              )}

              <div className="mt-6 text-left">
                <p className="text-sm mb-2">CSV Format Requirements:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Tab or comma-separated values</li>
                  <li>Required headers: symbol, qty, buyPrice (or entryPrice)</li>
                  <li>Optional: sellPrice, boughtTimestamp, soldTimestamp, duration, stopLoss, targetPrice</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                {...register('date', { required: 'Date is required' })}
              />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder={getSymbolPlaceholder()}
                {...register('symbol', { required: 'Symbol is required' })}
              />
              {errors.symbol && <p className="text-sm text-destructive">{errors.symbol.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <Select
                value={accountId || 'none'}
                onValueChange={(value) => setAccountId(value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Account</SelectItem>
                  {accounts.filter(acc => acc.status === 'active').length > 1 && (
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <span>All Accounts</span>
                        <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          Copy Trading
                        </Badge>
                      </div>
                    </SelectItem>
                  )}
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {accountId === 'all' 
                  ? `This trade will be copied to all ${accounts.filter(acc => acc.status === 'active').length} active accounts`
                  : 'Link this trade to a prop firm account'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assetType">Asset Type</Label>
              <Select
                value={watchAssetType}
                onValueChange={(value) => setValue('assetType', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="futures">Futures</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="options">Options</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="forex">Forex</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {watchAssetType === 'futures' && (
              <div className="space-y-2">
                <Label htmlFor="contractType">Contract Type</Label>
                <Select
                  value={watch('contractType')}
                  onValueChange={(value) => setValue('contractType', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mini">Mini (NQ $20/pt, ES $50/pt)</SelectItem>
                    <SelectItem value="micro">Micro (MNQ $2/pt, MES $5/pt)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {watchAssetType !== 'futures' && (
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={watchType}
                  onValueChange={(value) => setValue('type', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Select
                value={watchPosition}
                onValueChange={(value) => setValue('position', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="0"
                {...register('quantity', { 
                  required: 'Quantity is required',
                  min: { value: 0.01, message: 'Quantity must be greater than 0' }
                })}
              />
              {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryPrice">Entry Price</Label>
              <Input
                id="entryPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('entryPrice', { 
                  required: 'Entry price is required',
                  min: { value: 0.01, message: 'Entry price must be greater than 0' }
                })}
              />
              {errors.entryPrice && <p className="text-sm text-destructive">{errors.entryPrice.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="exitPrice">Exit Price (Optional)</Label>
              <Input
                id="exitPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('exitPrice')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stopLoss">Stop Loss (Optional)</Label>
              <Input
                id="stopLoss"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('stopLoss')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetPrice">Target Price (Optional)</Label>
              <Input
                id="targetPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('targetPrice')}
              />
            </div>
          </div>

          {riskRewardRatio && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm">
                Risk:Reward Ratio: <span className={
                  riskRewardRatio >= 2 
                    ? 'text-green-600 dark:text-green-500' 
                    : riskRewardRatio >= 1
                    ? 'text-yellow-600 dark:text-yellow-500'
                    : 'text-red-600 dark:text-red-500'
                }>
                  1:{riskRewardRatio.toFixed(2)}
                </span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Trade notes, reasons for entry/exit, etc."
              {...register('notes')}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Tags (Optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button type="button" onClick={addTag} variant="outline">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Photos (Optional)</Label>
            <div className="border-2 border-dashed border-input rounded-lg p-4 text-center">
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('photo-upload')?.click()}
                className="flex items-center gap-2 mx-auto"
              >
                <ImageIcon className="h-4 w-4" />
                Upload Photos
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Max 5MB per photo
              </p>
            </div>
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo}
                      alt={`Trade screenshot ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {watchExitPrice && watchQuantity && watchEntryPrice && (
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm">
                Estimated P&L: <span className={
                  ((watchPosition === 'long' 
                    ? (Number(watchExitPrice) - Number(watchEntryPrice)) 
                    : (Number(watchEntryPrice) - Number(watchExitPrice))) * Number(watchQuantity)) > 0
                    ? 'text-green-600' 
                    : 'text-red-600'
                }>
                  ${((watchPosition === 'long' 
                    ? (Number(watchExitPrice) - Number(watchEntryPrice)) 
                    : (Number(watchEntryPrice) - Number(watchExitPrice))) * Number(watchQuantity)).toFixed(2)}
                </span>
              </p>
            </div>
          )}

          <Button type="submit" variant="blue" className="w-full">
            Add Trade
          </Button>
        </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
