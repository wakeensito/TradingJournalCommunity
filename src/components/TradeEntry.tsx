import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { toast } from 'sonner';

interface TradeEntryProps {
  onAddTrade: (trade: Trade) => void;
  accounts: Account[];
  selectedAccountId: string | null;
}

export function TradeEntry({ onAddTrade, accounts = [], selectedAccountId }: TradeEntryProps) {
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
  const [parsedTrades, setParsedTrades] = useState<Trade[]>([]);
  
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
      position: 'long',
      strategy: undefined,
      riskAmount: undefined
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

    // Helper function to get value from multiple possible keys
    const getValue = (csvData: any, ...keys: string[]) => {
      for (const key of keys) {
        if (csvData[key]) return csvData[key];
      }
      return null;
    };

    // Contract multipliers for NQ/MNQ
    const getContractMultiplier = (symbol: string, contractType?: string): number => {
      const sym = symbol.toUpperCase();
      if (sym === 'NQ' || sym.includes('NQ')) {
        return contractType === 'micro' ? 2 : 20; // MNQ = $2/pt, NQ = $20/pt
      }
      if (sym === 'ES' || sym.includes('ES')) {
        return contractType === 'micro' ? 5 : 50; // MES = $5/pt, ES = $50/pt
      }
      return 1; // Default multiplier
    };

    // Parse PnL from various formats: $(265.00), (265.00), -265.00, 265.00
    const parsePnL = (pnlStr: string | number): number | undefined => {
      if (typeof pnlStr === 'number') return pnlStr;
      if (!pnlStr) return undefined;
      
      let pnl = pnlStr.toString().replace(/\$|,|\s/g, '');
      // Handle negative in parentheses: (265.00) or $(265.00)
      if (pnl.startsWith('(') && pnl.endsWith(')')) {
        pnl = '-' + pnl.slice(1, -1);
      }
      const num = Number(pnl);
      return isNaN(num) ? undefined : num;
    };

    // Parse timestamp in format "10/31/2025 08:45:25" or "MM/DD/YYYY HH:MM:SS"
    const parseTimestamp = (timestampStr: string): { date: string; time?: string } => {
      if (!timestampStr) return { date: new Date().toISOString().split('T')[0] };
      
      // Handle ISO format
      if (timestampStr.includes('T')) {
        const [date, time] = timestampStr.split('T');
        return { date, time: time?.split('.')[0] };
      }
      
      // Handle MM/DD/YYYY HH:MM:SS format
      const dateTimeMatch = timestampStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
      if (dateTimeMatch) {
        const [, month, day, year, hour, minute, second] = dateTimeMatch;
        const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const time = `${hour.padStart(2, '0')}:${minute}:${second}`;
        return { date, time };
      }
      
      // Handle numeric timestamp
      if (!isNaN(Number(timestampStr))) {
        const d = new Date(Number(timestampStr));
        return { 
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().split(' ')[0]
        };
      }
      
      // Fallback: just date
      return { date: timestampStr.split(' ')[0] };
    };

    // Parse duration in format "4min 30sec", "1min 21sec", "37sec", "2h 15m"
    const parseDuration = (durationStr: string): string => {
      if (!durationStr) return '';
      
      // Already in standard format
      if (durationStr.includes('h') || durationStr.includes('d')) {
        return durationStr;
      }
      
      // Parse "Xmin Ysec" or "Xsec" format
      const minMatch = durationStr.match(/(\d+)\s*min/i);
      const secMatch = durationStr.match(/(\d+)\s*sec/i);
      
      const minutes = minMatch ? parseInt(minMatch[1]) : 0;
      const seconds = secMatch ? parseInt(secMatch[1]) : 0;
      
      if (minutes === 0 && seconds === 0) return durationStr; // Return original if can't parse
      
      const parts: string[] = [];
      if (minutes > 0) parts.push(`${minutes}m`);
      if (seconds > 0) parts.push(`${seconds}s`);
      
      return parts.join(' ') || durationStr;
    };

    // Calculate points gained/lost
    const calculatePoints = (entry: number, exit: number, position: 'long' | 'short'): number => {
      if (!entry || !exit) return 0;
      return position === 'long' ? exit - entry : entry - exit;
    };

    // Calculate R-multiple (PnL / Risk)
    const calculateRMultiple = (pnl: number, riskAmount?: number, entryPrice?: number, stopLoss?: number, position?: 'long' | 'short', contractType?: 'mini' | 'micro', symbol?: string): number | undefined => {
      if (!pnl || pnl === 0) return undefined;
      
      // Use provided risk amount
      if (riskAmount && riskAmount > 0) {
        return pnl / riskAmount;
      }
      
      // Calculate risk from stop loss
      if (entryPrice && stopLoss && position) {
        const pointsAtRisk = position === 'long' 
          ? entryPrice - stopLoss 
          : stopLoss - entryPrice;
        
        if (pointsAtRisk > 0) {
          const multiplier = getContractMultiplier(symbol || '', contractType);
          const calculatedRisk = pointsAtRisk * multiplier;
          if (calculatedRisk > 0) {
            return pnl / calculatedRisk;
          }
        }
      }
      
      return undefined;
    };

    // Detect session from time
    const detectSession = (timeStr?: string): 'pre_market' | 'regular' | 'after_hours' | 'futures_globex' | undefined => {
      if (!timeStr) return 'futures_globex'; // Default for futures
      
      const [hour] = timeStr.split(':').map(Number);
      if (isNaN(hour)) return undefined;
      
      // Futures Globex: 6 PM - 5 PM ET (18:00 - 17:00)
      // Regular hours: 9:30 AM - 4 PM ET (09:30 - 16:00)
      // Pre-market: 4 AM - 9:30 AM ET (04:00 - 09:30)
      // After hours: 4 PM - 8 PM ET (16:00 - 20:00)
      
      if (hour >= 18 || hour < 5) return 'futures_globex';
      if (hour >= 4 && hour < 9) return 'pre_market';
      if (hour >= 9 && hour < 16) return 'regular';
      if (hour >= 16 && hour < 20) return 'after_hours';
      
      return 'futures_globex';
    };

    // Calculate trade efficiency (PnL per minute)
    const calculateEfficiency = (pnl: number, durationStr: string): number | undefined => {
      if (!pnl || !durationStr) return undefined;
      
      // Parse duration to minutes
      const minMatch = durationStr.match(/(\d+)\s*m/i);
      const secMatch = durationStr.match(/(\d+)\s*s/i);
      const hourMatch = durationStr.match(/(\d+)\s*h/i);
      
      const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
      const minutes = minMatch ? parseInt(minMatch[1]) : 0;
      const seconds = secMatch ? parseInt(secMatch[1]) : 0;
      
      const totalMinutes = hours * 60 + minutes + (seconds / 60);
      if (totalMinutes === 0) return undefined;
      
      return pnl / totalMinutes;
    };

    const trades: Trade[] = [];

    // Parse ALL rows (not just first one)
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim());
      if (values.length === 0 || values.every(v => !v)) continue;

      const csvData: any = {};
      headers.forEach((header, index) => {
        csvData[header] = values[index] || '';
      });

      // Extract fields
      const symbol = getValue(csvData, 'symbol', 'ticker', 'stock', 'instrument') || 'UNKNOWN';
      const quantity = Number(getValue(csvData, 'qty', 'quantity', 'size', 'shares', 'contracts')) || 1;
      const buyPrice = getValue(csvData, 'buyprice', 'buy', 'entry', 'entryprice', 'open', 'openprice');
      const sellPrice = getValue(csvData, 'sellprice', 'sell', 'exit', 'exitprice', 'close', 'closeprice');
      const entryPrice = buyPrice ? Number(buyPrice) : undefined;
      const exitPrice = sellPrice ? Number(sellPrice) : undefined;
      
      // Enhanced timestamp parsing
      const boughtTimestamp = getValue(csvData, 'boughttimestamp', 'bought', 'entrytime', 'opentime', 'date', 'timestamp');
      const entryTimestamp = boughtTimestamp ? parseTimestamp(boughtTimestamp) : { date: new Date().toISOString().split('T')[0] };
      const dateValue = entryTimestamp.date;
      const entryTime = entryTimestamp.time;
      
      const soldTimestamp = getValue(csvData, 'soldtimestamp', 'sold', 'exittime', 'closetime');
      const exitTimestamp = soldTimestamp ? parseTimestamp(soldTimestamp) : undefined;
      const exitDateValue = exitTimestamp?.date;
      const exitTime = exitTimestamp?.time;
      
      // Parse duration with enhanced parsing
      const rawDuration = getValue(csvData, 'duration', 'holdtime', 'timeheld');
      const duration = rawDuration ? parseDuration(rawDuration) : undefined;
      const stopLoss = getValue(csvData, 'stoploss', 'stop', 'sl') ? Number(getValue(csvData, 'stoploss', 'stop', 'sl')) : undefined;
      const targetPrice = getValue(csvData, 'targetprice', 'target', 'tp', 'takeprofit') ? Number(getValue(csvData, 'targetprice', 'target', 'tp', 'takeprofit')) : undefined;
      
      // Determine asset type and contract type
      const assetType = (getValue(csvData, 'assettype', 'asset', 'type', 'instrument', 'market')?.toLowerCase() || 'futures') as 'stock' | 'futures' | 'options' | 'crypto' | 'forex';
      
      // Enhanced contract type detection from symbol (NQZ5 = NQ, MNQZ5 = MNQ)
      let contractType: 'mini' | 'micro' | undefined;
      const symUpper = symbol.toUpperCase();
      
      // Check for micro contracts first (MNQ, MES, etc.)
      if (symUpper.startsWith('MNQ') || symUpper.includes('MNQ') || 
          symUpper.startsWith('MES') || symUpper.includes('MES') ||
          (symUpper.startsWith('M') && (symUpper.includes('NQ') || symUpper.includes('ES')))) {
        contractType = 'micro';
      } 
      // Check for mini contracts (NQ, ES without M prefix)
      else if (symUpper.startsWith('NQ') || symUpper.includes('NQ') || 
               symUpper.startsWith('ES') || symUpper.includes('ES')) {
        contractType = 'mini';
      } 
      // Fallback to CSV field
      else {
        const csvContractType = getValue(csvData, 'contracttype', 'contract', 'size');
        if (csvContractType) {
          const normalized = csvContractType.toLowerCase();
          if (['mini', 'micro'].includes(normalized)) {
            contractType = normalized as 'mini' | 'micro';
          }
        }
      }

      // Parse PnL from CSV (prioritize CSV PnL if available)
      let csvPnL = getValue(csvData, 'pnl', 'profit', 'profitloss', 'p&l');
      let pnl: number | undefined = parsePnL(csvPnL);

      // Determine position and calculate PnL if not provided
      let position: 'long' | 'short' = 'long';
      let type: 'buy' | 'sell' = 'buy';

      if (csvPnL && pnl !== undefined) {
        // Use PnL to determine position
        const multiplier = getContractMultiplier(symbol, contractType);
        if (entryPrice && exitPrice) {
          // Calculate expected PnL for both positions
          const longPnL = (exitPrice - entryPrice) * quantity * multiplier;
          const shortPnL = (entryPrice - exitPrice) * quantity * multiplier;
          
          // Choose position that matches CSV PnL (within tolerance)
          const tolerance = Math.abs(pnl) * 0.1; // 10% tolerance
          if (Math.abs(longPnL - pnl) < Math.abs(shortPnL - pnl) && Math.abs(longPnL - pnl) < tolerance) {
            position = 'long';
            type = 'buy';
          } else if (Math.abs(shortPnL - pnl) < tolerance) {
            position = 'short';
            type = 'sell';
          } else {
            // Default: use price comparison
            position = exitPrice > entryPrice ? 'long' : 'short';
            type = position === 'long' ? 'buy' : 'sell';
          }
        }
      } else if (entryPrice && exitPrice) {
        // No CSV PnL, determine from prices
        position = exitPrice > entryPrice ? 'long' : 'short';
        type = position === 'long' ? 'buy' : 'sell';
        
        // Calculate PnL using contract multiplier
        const multiplier = getContractMultiplier(symbol, contractType);
        pnl = position === 'long'
          ? (exitPrice - entryPrice) * quantity * multiplier
          : (entryPrice - exitPrice) * quantity * multiplier;
      }

      // Parse tags
      const tagsValue = getValue(csvData, 'tags', 'labels', 'categories');
      const tagsArray = tagsValue ? tagsValue.split(';').map((t: string) => t.trim()).filter((t: string) => t) : [];

      // Calculate quant metrics (after position is determined)
      const points = entryPrice && exitPrice ? calculatePoints(entryPrice, exitPrice, position) : undefined;
      
      // Calculate risk amount (if stop loss available)
      let riskAmount: number | undefined;
      if (entryPrice && stopLoss && position) {
        const pointsAtRisk = position === 'long' 
          ? entryPrice - stopLoss 
          : stopLoss - entryPrice;
        if (pointsAtRisk > 0) {
          const multiplier = getContractMultiplier(symbol, contractType);
          riskAmount = pointsAtRisk * quantity * multiplier;
        }
      }
      
      // Calculate R-multiple
      const rMultiple = pnl !== undefined ? calculateRMultiple(pnl, riskAmount, entryPrice, stopLoss, position, contractType, symbol) : undefined;
      
      // Calculate trade efficiency
      const efficiency = pnl !== undefined && duration ? calculateEfficiency(pnl, duration) : undefined;
      
      // Detect session from entry time
      const session = detectSession(entryTime);
      
      // Calculate risk/reward ratio
      let riskRewardRatio: number | undefined;
      if (entryPrice && stopLoss && targetPrice) {
        const risk = position === 'long' ? entryPrice - stopLoss : stopLoss - entryPrice;
        const reward = position === 'long' ? targetPrice - entryPrice : entryPrice - targetPrice;
        if (risk > 0) {
          riskRewardRatio = reward / risk;
        }
      }

      // Clean symbol (remove contract month codes like Z5, H6, etc.)
      const cleanSymbol = symbol.toUpperCase().replace(/[A-Z]\d+$/, '').replace(/Z\d+|H\d+|M\d+|U\d+/, '') || symbol.toUpperCase();
      
      const trade: Trade = {
        id: `csv-${Date.now()}-${i}`,
        date: dateValue,
        symbol: cleanSymbol,
        assetType,
        contractType,
        type,
        position,
        quantity,
        entryPrice: entryPrice || 0,
        exitPrice,
        exitDate: exitDateValue,
        entryTime,
        exitTime,
        stopLoss,
        targetPrice,
        riskRewardRatio,
        duration,
        notes: getValue(csvData, 'notes', 'note', 'comment') || undefined,
        status: exitPrice ? 'closed' : 'open',
        pnl,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        accountId: accountId || undefined,
        riskAmount,
        rMultiple,
        session,
        // Add quant-specific notes
        entryReason: points !== undefined ? `${points > 0 ? '+' : ''}${points.toFixed(2)} points` : undefined,
      };

      trades.push(trade);
    }

    if (trades.length === 0) {
      setCsvError('No valid trades found in CSV file');
      return;
    }

    // If only one trade, populate form (backward compatibility)
    if (trades.length === 1) {
      const trade = trades[0];
      setValue('symbol', trade.symbol);
      setValue('quantity', trade.quantity);
      setValue('entryPrice', trade.entryPrice);
      if (trade.exitPrice) setValue('exitPrice', trade.exitPrice);
      setValue('date', trade.date);
      setValue('assetType', trade.assetType);
      if (trade.contractType) setValue('contractType', trade.contractType);
      setValue('position', trade.position);
      setValue('type', trade.type);
      if (trade.stopLoss) setValue('stopLoss', trade.stopLoss);
      if (trade.targetPrice) setValue('targetPrice', trade.targetPrice);
      if (trade.tags) setTags(trade.tags);
      if (trade.duration) setCsvDuration(trade.duration);
      if (trade.exitDate) setCsvExitDate(trade.exitDate);
      
      setCsvSuccess('CSV data loaded successfully! Review the data and click "Add Trade" to submit.');
      setActiveTab('manual');
    } else {
      // Multiple trades - show preview and bulk import option
      setParsedTrades(trades);
      setCsvSuccess(`Found ${trades.length} trades in CSV. Review and click "Add All Trades" to import.`);
      setActiveTab('csv');
    }
  };

  const handleAddAllTrades = () => {
    if (parsedTrades.length === 0) return;
    
    parsedTrades.forEach(trade => {
      onAddTrade(trade);
    });
    
    toast.success(`Imported ${parsedTrades.length} trades successfully!`);
    setParsedTrades([]);
    setCsvSuccess('');
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
    const entryPrice = watchEntryPrice ? Number(watchEntryPrice) : undefined;
    const stopLoss = watchStopLoss ? Number(watchStopLoss) : undefined;
    const targetPrice = watchTargetPrice ? Number(watchTargetPrice) : undefined;

    if (!entryPrice || !stopLoss || !targetPrice) return null;

    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(targetPrice - entryPrice);

    if (risk === 0) return null;
    return (reward / risk);
  };

  const riskRewardRatio = calculateRiskRewardRatio();

  // Get contract multiplier for PnL calculation
  const getContractMultiplier = (symbol: string, contractType?: string): number => {
    const sym = symbol.toUpperCase();
    if (sym === 'NQ' || sym.includes('NQ')) {
      return contractType === 'micro' ? 2 : 20; // MNQ = $2/pt, NQ = $20/pt
    }
    if (sym === 'ES' || sym.includes('ES')) {
      return contractType === 'micro' ? 5 : 50; // MES = $5/pt, ES = $50/pt
    }
    return 1; // Default multiplier
  };

  const calculateRiskAmount = (data: TradeFormData): number | undefined => {
    // If user provided riskAmount, use it
    if (data.riskAmount && data.riskAmount > 0) {
      return data.riskAmount;
    }
    
    // Otherwise, calculate from stop loss
    if (data.stopLoss && data.entryPrice) {
      const entryPrice = Number(data.entryPrice);
      const stopLoss = Number(data.stopLoss);
      const quantity = Number(data.quantity);
      const riskPerUnit = Math.abs(entryPrice - stopLoss);
      
      if (data.assetType === 'futures') {
        const multiplier = getContractMultiplier(data.symbol, data.contractType);
        return riskPerUnit * quantity * multiplier;
      }
      
      return riskPerUnit * quantity;
    }
    
    return undefined;
  };

  const calculateRMultiple = (pnl: number | undefined, riskAmount: number | undefined): number | undefined => {
    if (pnl === undefined || riskAmount === undefined || riskAmount === 0) {
      return undefined;
    }
    return pnl / riskAmount;
  };

  const onSubmit = (data: TradeFormData) => {
    // Calculate PnL
    const calculatedPnL = data.exitPrice 
      ? (() => {
          const multiplier = data.assetType === 'futures' 
            ? getContractMultiplier(data.symbol, data.contractType)
            : 1;
          const priceDiff = data.position === 'long'
            ? (Number(data.exitPrice) - Number(data.entryPrice))
            : (Number(data.entryPrice) - Number(data.exitPrice));
          return priceDiff * Number(data.quantity) * multiplier;
        })()
      : undefined;

    // Calculate risk amount and R-multiple
    const riskAmount = calculateRiskAmount(data);
    const rMultiple = calculateRMultiple(calculatedPnL, riskAmount);

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
          pnl: calculatedPnL,
          strategy: data.strategy || undefined,
          riskAmount: riskAmount,
          rMultiple: rMultiple,
          entryTime: data.entryTime || undefined,
          exitTime: data.exitTime || undefined,
          marketCondition: data.marketCondition || undefined,
          session: data.session || undefined,
          setupType: data.setupType || undefined,
          entryReason: data.entryReason || undefined,
          exitReason: data.exitReason || undefined
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
        pnl: calculatedPnL,
        strategy: data.strategy || undefined,
        riskAmount: riskAmount,
        rMultiple: rMultiple,
        entryTime: data.entryTime || undefined,
        exitTime: data.exitTime || undefined,
        marketCondition: data.marketCondition || undefined,
        session: data.session || undefined,
        setupType: data.setupType || undefined,
        entryReason: data.entryReason || undefined,
        exitReason: data.exitReason || undefined
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

              {/* Parsed Trades Preview */}
              {parsedTrades.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Parsed Trades ({parsedTrades.length})</h4>
                    <Button
                      type="button"
                      variant="blue"
                      onClick={handleAddAllTrades}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Add All Trades
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Symbol</th>
                          <th className="p-2 text-left">Position</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Entry</th>
                          <th className="p-2 text-right">Exit</th>
                          <th className="p-2 text-right">P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedTrades.map((trade, idx) => (
                          <tr key={trade.id} className="border-t">
                            <td className="p-2">{new Date(trade.date).toLocaleDateString()}</td>
                            <td className="p-2 font-medium">{trade.symbol}</td>
                            <td className="p-2">
                              <Badge variant={trade.position === 'long' ? 'default' : 'secondary'}>
                                {trade.position.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-2 text-right">{trade.quantity}</td>
                            <td className="p-2 text-right">{trade.entryPrice.toFixed(2)}</td>
                            <td className="p-2 text-right">{trade.exitPrice?.toFixed(2) || '-'}</td>
                            <td className={`p-2 text-right font-medium ${
                              trade.pnl && trade.pnl > 0 ? 'text-green-600 dark:text-green-500' : 
                              trade.pnl && trade.pnl < 0 ? 'text-red-600 dark:text-red-500' : ''
                            }`}>
                              {trade.pnl !== undefined ? `$${trade.pnl.toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-6 text-left">
                <p className="text-sm mb-2">CSV Format Requirements:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Tab or comma-separated values</li>
                  <li>Required headers: symbol, qty, buyPrice (or entryPrice)</li>
                  <li>Optional: sellPrice, boughtTimestamp, soldTimestamp, duration, stopLoss, targetPrice, pnl</li>
                  <li>NQ/MNQ contracts: PnL automatically calculated using contract multipliers ($20/pt for NQ, $2/pt for MNQ)</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Real-time Calculations Card */}
          {(watchEntryPrice || watchExitPrice || watchStopLoss || watchTargetPrice) && (
            <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {riskRewardRatio && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Risk:Reward</p>
                      <p className={`text-lg font-semibold ${
                        riskRewardRatio >= 2 
                          ? 'text-green-600 dark:text-green-500' 
                          : riskRewardRatio >= 1
                          ? 'text-yellow-600 dark:text-yellow-500'
                          : 'text-red-600 dark:text-red-500'
                      }`}>
                        1:{riskRewardRatio.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {watchExitPrice && watchEntryPrice && watchQuantity && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Est. P&L</p>
                      <p className={`text-lg font-semibold ${
                        ((watchPosition === 'long' 
                          ? (Number(watchExitPrice) - Number(watchEntryPrice)) 
                          : (Number(watchEntryPrice) - Number(watchExitPrice))) * Number(watchQuantity)) > 0
                          ? 'text-green-600 dark:text-green-500' 
                          : 'text-red-600 dark:text-red-500'
                      }`}>
                        ${((watchPosition === 'long' 
                          ? (Number(watchExitPrice) - Number(watchEntryPrice)) 
                          : (Number(watchEntryPrice) - Number(watchExitPrice))) * Number(watchQuantity)).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {watchStopLoss && watchEntryPrice && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Risk per Unit</p>
                      <p className="text-lg font-semibold">
                        ${Math.abs(Number(watchEntryPrice) - Number(watchStopLoss)).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {watchTargetPrice && watchEntryPrice && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Reward per Unit</p>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-500">
                        ${Math.abs(Number(watchTargetPrice) - Number(watchEntryPrice)).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="strategy">Strategy (Optional)</Label>
              <Select
                value={watch('strategy') || undefined}
                onValueChange={(value) => setValue('strategy', value === 'none' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="ORB Breakout">ORB Breakout</SelectItem>
                  <SelectItem value="Demand Zone Retest">Demand Zone Retest</SelectItem>
                  <SelectItem value="Supply Zone Retest">Supply Zone Retest</SelectItem>
                  <SelectItem value="Liquidity Grab">Liquidity Grab</SelectItem>
                  <SelectItem value="Fair Value Gap">Fair Value Gap</SelectItem>
                  <SelectItem value="Bull Flag">Bull Flag</SelectItem>
                  <SelectItem value="Bear Flag">Bear Flag</SelectItem>
                  <SelectItem value="Order Block">Order Block</SelectItem>
                  <SelectItem value="Break of Structure">Break of Structure</SelectItem>
                  <SelectItem value="Trend Following">Trend Following</SelectItem>
                  <SelectItem value="Mean Reversion">Mean Reversion</SelectItem>
                  <SelectItem value="Scalping">Scalping</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

              </div>
            </CardContent>
          </Card>

          {/* Entry & Exit Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Entry & Exit Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entryPrice">Entry Price *</Label>
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
                  <Label htmlFor="entryTime">Entry Time</Label>
                  <Input
                    id="entryTime"
                    type="time"
                    {...register('entryTime')}
                  />
                  <p className="text-xs text-muted-foreground">Precise entry time</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
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
                  <Label htmlFor="exitPrice">Exit Price</Label>
                  <Input
                    id="exitPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register('exitPrice')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exitTime">Exit Time</Label>
                  <Input
                    id="exitTime"
                    type="time"
                    {...register('exitTime')}
                  />
                  <p className="text-xs text-muted-foreground">Precise exit time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Management Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Risk Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stopLoss">Stop Loss</Label>
                  <Input
                    id="stopLoss"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register('stopLoss')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetPrice">Target Price</Label>
                  <Input
                    id="targetPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register('targetPrice')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="riskAmount">Risk Amount $</Label>
                  <Input
                    id="riskAmount"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 50.00"
                    {...register('riskAmount', {
                      valueAsNumber: true,
                      min: { value: 0, message: 'Risk amount must be positive' }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Actual $ risked (auto-calculated from SL if not provided)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strategy & Market Context Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Strategy & Market Context</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="strategy">Strategy</Label>
                  <Select
                    value={watch('strategy') || ''}
                    onValueChange={(value) => setValue('strategy', value === '' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="ORB Breakout">ORB Breakout</SelectItem>
                      <SelectItem value="Demand Zone Retest">Demand Zone Retest</SelectItem>
                      <SelectItem value="Supply Zone Retest">Supply Zone Retest</SelectItem>
                      <SelectItem value="Liquidity Grab">Liquidity Grab</SelectItem>
                      <SelectItem value="Fair Value Gap">Fair Value Gap</SelectItem>
                      <SelectItem value="Bull Flag">Bull Flag</SelectItem>
                      <SelectItem value="Bear Flag">Bear Flag</SelectItem>
                      <SelectItem value="Order Block">Order Block</SelectItem>
                      <SelectItem value="Break of Structure">Break of Structure</SelectItem>
                      <SelectItem value="Trend Following">Trend Following</SelectItem>
                      <SelectItem value="Mean Reversion">Mean Reversion</SelectItem>
                      <SelectItem value="Scalping">Scalping</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setupType">Setup Type</Label>
                  <Input
                    id="setupType"
                    placeholder="e.g., Bull Flag, Demand Zone"
                    {...register('setupType')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marketCondition">Market Condition</Label>
                <Select
                  value={watch('marketCondition') || undefined}
                  onValueChange={(value) => setValue('marketCondition', value === 'none' ? undefined : value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                      <SelectItem value="trending">Trending</SelectItem>
                      <SelectItem value="choppy">Choppy</SelectItem>
                      <SelectItem value="volatile">Volatile</SelectItem>
                      <SelectItem value="low_volatility">Low Volatility</SelectItem>
                      <SelectItem value="ranging">Ranging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session">Trading Session</Label>
                <Select
                  value={watch('session') || undefined}
                  onValueChange={(value) => setValue('session', value === 'none' ? undefined : value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                      <SelectItem value="pre_market">Pre-Market</SelectItem>
                      <SelectItem value="regular">Regular Hours</SelectItem>
                      <SelectItem value="after_hours">After Hours</SelectItem>
                      <SelectItem value="futures_globex">Futures (GLOBEX)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entryReason">Entry Reason</Label>
                  <Textarea
                    id="entryReason"
                    placeholder="Why did you enter this trade?"
                    {...register('entryReason')}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exitReason">Exit Reason</Label>
                  <Textarea
                    id="exitReason"
                    placeholder="Why did you exit this trade?"
                    {...register('exitReason')}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Media Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes & Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Trade Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes, observations, lessons learned..."
                  {...register('notes')}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
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
                <Label>Chart Screenshots</Label>
                <div className="border-2 border-dashed border-input rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
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
                    Upload Chart Screenshots
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Max 5MB per image • Supports multiple files
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
                          className="w-full h-24 object-cover rounded-lg border"
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
            </CardContent>
          </Card>

          <Button type="submit" variant="blue" className="w-full text-lg py-6">
            Add Trade
          </Button>
        </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
