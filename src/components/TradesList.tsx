import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Edit, Trash2, Search, Image as ImageIcon, ChevronDown, ChevronRight, X } from 'lucide-react';
import { PhotoGallery } from './PhotoGallery';
import { PhotoPreview } from './PhotoPreview';
import { Trade, TradeFormData, Account } from '../types/trade';
import { useForm } from 'react-hook-form@7.55.0';

interface TradesListProps {
  trades: Trade[];
  onDeleteTrade: (id: string) => void;
  onEditTrade: (trade: Trade) => void;
  editingTrade: Trade | null;
  onUpdateTrade: (trade: Trade) => void;
  onCancelEdit: () => void;
  accounts: Account[];
}

export function TradesList({ trades, onDeleteTrade, onEditTrade, editingTrade, onUpdateTrade, onCancelEdit, accounts }: TradesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState<'all' | 'stock' | 'futures' | 'options' | 'crypto' | 'forex'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'symbol' | 'pnl'>('date');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<TradeFormData>();

  const watchType = watch('type');
  const watchPosition = watch('position');
  const watchAssetType = watch('assetType');
  const watchEntryPrice = watch('entryPrice');
  const watchExitPrice = watch('exitPrice');
  const watchStopLoss = watch('stopLoss');
  const watchTargetPrice = watch('targetPrice');
  const watchQuantity = watch('quantity');

  // Populate form when editing a trade
  useEffect(() => {
    if (editingTrade) {
      setValue('date', editingTrade.date);
      setValue('symbol', editingTrade.symbol);
      setValue('assetType', editingTrade.assetType || 'stock');
      setValue('type', editingTrade.type);
      setValue('position', editingTrade.position);
      setValue('quantity', editingTrade.quantity);
      setValue('entryPrice', editingTrade.entryPrice);
      setValue('exitPrice', editingTrade.exitPrice || undefined);
      setValue('stopLoss', editingTrade.stopLoss || undefined);
      setValue('targetPrice', editingTrade.targetPrice || undefined);
      setValue('notes', editingTrade.notes || '');
      setValue('contractType', editingTrade.contractType || undefined);
      setTags(editingTrade.tags || []);
      setPhotos(editingTrade.photos || []);
    }
  }, [editingTrade, setValue]);

  const toggleRow = (tradeId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(tradeId)) {
      newExpandedRows.delete(tradeId);
    } else {
      newExpandedRows.add(tradeId);
    }
    setExpandedRows(newExpandedRows);
  };

  const filteredTrades = trades
    .filter(trade => {
      const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           trade.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           trade.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || trade.status === statusFilter;
      const matchesAssetType = assetTypeFilter === 'all' || trade.assetType === assetTypeFilter;
      return matchesSearch && matchesStatus && matchesAssetType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'symbol':
          return a.symbol.localeCompare(b.symbol);
        case 'pnl':
          return (b.pnl || 0) - (a.pnl || 0);
        default:
          return 0;
      }
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

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

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const onSubmit = (data: TradeFormData) => {
    if (!editingTrade) return;

    const trade: Trade = {
      ...editingTrade,
      date: data.date,
      symbol: data.symbol.toUpperCase(),
      assetType: data.assetType,
      contractType: data.assetType === 'futures' ? data.contractType : undefined,
      type: data.type,
      position: data.position,
      quantity: Number(data.quantity),
      entryPrice: Number(data.entryPrice),
      exitPrice: data.exitPrice ? Number(data.exitPrice) : undefined,
      stopLoss: data.stopLoss ? Number(data.stopLoss) : undefined,
      targetPrice: data.targetPrice ? Number(data.targetPrice) : undefined,
      riskRewardRatio: riskRewardRatio || undefined,
      status: data.exitPrice ? 'closed' : 'open',
      tags,
      photos: photos.length > 0 ? photos : undefined,
      notes: data.notes,
      pnl: data.exitPrice 
        ? (data.position === 'long' 
          ? (Number(data.exitPrice) - Number(data.entryPrice)) * Number(data.quantity)
          : (Number(data.entryPrice) - Number(data.exitPrice)) * Number(data.quantity))
        : undefined
    };

    onUpdateTrade(trade);
    reset();
    setTags([]);
    setPhotos([]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getAccountName = (accountId?: string) => {
    if (!accountId) return null;
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : null;
  };

  const openGallery = (photos: string[], symbol: string) => {
    setSelectedPhotos(photos);
    setGalleryTitle(`Trade Photos - ${symbol}`);
    setGalleryOpen(true);
  };

  return (
    <Card className="hover-lift">
      <CardHeader>
        <CardTitle>Trades ({trades.length})</CardTitle>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search trades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={assetTypeFilter} onValueChange={(value) => setAssetTypeFilter(value as any)}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assets</SelectItem>
              <SelectItem value="futures">Futures</SelectItem>
              <SelectItem value="stock">Stock</SelectItem>
              <SelectItem value="options">Options</SelectItem>
              <SelectItem value="crypto">Crypto</SelectItem>
              <SelectItem value="forex">Forex</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="symbol">Symbol</SelectItem>
              <SelectItem value="pnl">P&L</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredTrades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {trades.length === 0 ? 'No trades recorded yet.' : 'No trades match your filters.'}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Stop Loss</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>R:R Ratio</TableHead>
                    <TableHead>P&L</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Photos</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map((trade) => {
                    const isExpanded = expandedRows.has(trade.id);
                    const totalCost = trade.quantity * trade.entryPrice;
                    const totalRevenue = trade.exitPrice ? trade.quantity * trade.exitPrice : 0;
                    
                    return (
                      <>
                        <TableRow key={trade.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleRow(trade.id)}
                                className="h-6 w-6 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              {formatDate(trade.date)}
                            </div>
                          </TableCell>
                          <TableCell className="text-semibold">{trade.symbol}</TableCell>
                          <TableCell>
                            {getAccountName(trade.accountId) ? (
                              <Badge variant="outline" className="text-xs">
                                {getAccountName(trade.accountId)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline">
                                {trade.assetType?.charAt(0).toUpperCase() + trade.assetType?.slice(1) || 'Stock'}
                              </Badge>
                              {trade.assetType === 'futures' && trade.contractType && (
                                <Badge variant="secondary" className="text-xs">
                                  {trade.contractType === 'mini' ? 'Mini' : 'Micro'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={trade.type === 'buy' ? 'buy' : 'sell'}>
                              {trade.type.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={trade.position === 'long' ? 'long' : 'short'}>
                              {trade.position === 'long' ? 'LONG (BUY)' : trade.position === 'short' ? 'SHORT (SELL)' : 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>{trade.quantity}</TableCell>
                          <TableCell>{formatCurrency(trade.entryPrice)}</TableCell>
                          <TableCell>
                            {trade.stopLoss ? formatCurrency(trade.stopLoss) : '-'}
                          </TableCell>
                          <TableCell>
                            {trade.targetPrice ? formatCurrency(trade.targetPrice) : '-'}
                          </TableCell>
                          <TableCell>
                            {trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}
                          </TableCell>
                          <TableCell>
                            {trade.duration ? (
                              <span className="text-blue-600 text-sm">{trade.duration}</span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {trade.riskRewardRatio ? (
                              <span className={
                                trade.riskRewardRatio >= 2 
                                  ? 'text-green-600 dark:text-green-500' 
                                  : trade.riskRewardRatio >= 1
                                  ? 'text-yellow-600 dark:text-yellow-500'
                                  : 'text-red-600 dark:text-red-500'
                              }>
                                1:{trade.riskRewardRatio.toFixed(2)}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {trade.pnl !== undefined ? (
                              <span className={trade.pnl >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}>
                                {formatCurrency(trade.pnl)}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={trade.status === 'open' ? 'open' : 'closed'}>
                              {trade.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {trade.photos && trade.photos.length > 0 ? (
                              <PhotoPreview
                                photos={trade.photos}
                                onViewAll={() => openGallery(trade.photos!, trade.symbol)}
                              />
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => onEditTrade(trade)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => onDeleteTrade(trade.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <TableRow key={`${trade.id}-details`} className="bg-muted/10">
                            <TableCell colSpan={15} className="p-6">
                              <div className="space-y-6">
                                {/* Trade Breakdown */}
                                <div>
                                  <h4 className="mb-3 text-muted-foreground">Trade Breakdown</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-background/50 p-3 rounded-lg">
                                      <div className="text-sm text-muted-foreground mb-1">Total Cost</div>
                                      <div className="tabular-nums">{formatCurrency(totalCost)}</div>
                                    </div>
                                    {trade.exitPrice && (
                                      <>
                                        <div className="bg-background/50 p-3 rounded-lg">
                                          <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
                                          <div className="tabular-nums">{formatCurrency(totalRevenue)}</div>
                                        </div>
                                        <div className="bg-background/50 p-3 rounded-lg">
                                          <div className="text-sm text-muted-foreground mb-1">Net P&L</div>
                                          <div className={`tabular-nums ${trade.pnl && trade.pnl >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                            {formatCurrency(trade.pnl || 0)}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Tags */}
                                {trade.tags && trade.tags.length > 0 && (
                                  <div>
                                    <h4 className="mb-3 text-muted-foreground">Tags</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {trade.tags.map((tag, index) => (
                                        <Badge key={index} variant="outline">{tag}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Notes */}
                                {trade.notes && (
                                  <div>
                                    <h4 className="mb-3 text-muted-foreground">Notes</h4>
                                    <div className="bg-background/50 p-4 rounded-lg max-w-3xl whitespace-pre-wrap">
                                      {trade.notes}
                                    </div>
                                  </div>
                                )}

                                {/* Photos */}
                                {trade.photos && trade.photos.length > 0 && (
                                  <div>
                                    <h4 className="mb-3 text-muted-foreground">Photos ({trade.photos.length})</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                      {trade.photos.map((photo, index) => (
                                        <img
                                          key={index}
                                          src={photo}
                                          alt={`Trade photo ${index + 1}`}
                                          className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200"
                                          onClick={() => openGallery(trade.photos!, trade.symbol)}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredTrades.map((trade) => {
                const isExpanded = expandedRows.has(trade.id);
                const totalCost = trade.quantity * trade.entryPrice;
                const totalRevenue = trade.exitPrice ? trade.quantity * trade.exitPrice : 0;

                return (
                  <div key={trade.id} className="border rounded-lg bg-card transition-all duration-200 hover:shadow-[0_8px_32px_rgba(59,130,246,0.15)] dark:hover:shadow-[0_8px_32px_rgba(96,165,250,0.2)]">
                    {/* Card Header */}
                    <div className="p-4 space-y-3">
                      {/* Top Row: Symbol, Date, Status */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{trade.symbol}</span>
                            <Badge variant="outline" className="text-xs">
                              {trade.assetType?.charAt(0).toUpperCase() + trade.assetType?.slice(1) || 'Stock'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{formatDate(trade.date)}</div>
                        </div>
                        <Badge variant={trade.status === 'open' ? 'open' : 'closed'}>
                          {trade.status.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Contract Type for Futures */}
                      {trade.assetType === 'futures' && trade.contractType && (
                        <Badge variant="secondary" className="text-xs">
                          {trade.contractType === 'mini' ? 'Mini' : 'Micro'}
                        </Badge>
                      )}

                      {/* Position & Type */}
                      <div className="flex gap-2">
                        <Badge variant={trade.position === 'long' ? 'long' : 'short'}>
                          {trade.position === 'long' ? 'LONG' : 'SHORT'}
                        </Badge>
                        <Badge variant={trade.type === 'buy' ? 'buy' : 'sell'}>
                          {trade.type.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Quantity</div>
                          <div className="tabular-nums">{trade.quantity}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Entry</div>
                          <div className="tabular-nums">{formatCurrency(trade.entryPrice)}</div>
                        </div>
                        {trade.exitPrice && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Exit</div>
                            <div className="tabular-nums">{formatCurrency(trade.exitPrice)}</div>
                          </div>
                        )}
                        {trade.duration && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Duration</div>
                            <div className="text-blue-600 dark:text-blue-500 text-sm">{trade.duration}</div>
                          </div>
                        )}
                        {trade.pnl !== undefined && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">P&L</div>
                            <div className={`tabular-nums ${trade.pnl >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                              {formatCurrency(trade.pnl)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Risk:Reward Ratio */}
                      {trade.riskRewardRatio && (
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-xs text-muted-foreground">R:R Ratio:</span>
                          <span className={`tabular-nums text-sm ${
                            trade.riskRewardRatio >= 2 
                              ? 'text-green-600 dark:text-green-500' 
                              : trade.riskRewardRatio >= 1
                              ? 'text-yellow-600 dark:text-yellow-500'
                              : 'text-red-600 dark:text-red-500'
                          }`}>
                            1:{trade.riskRewardRatio.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Photos Preview */}
                      {trade.photos && trade.photos.length > 0 && (
                        <div className="flex items-center gap-2 pt-2">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{trade.photos.length} photo{trade.photos.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleRow(trade.id)}
                          className="flex-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <ChevronRight className="h-4 w-4 mr-1" />
                              View Details
                            </>
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => onEditTrade(trade)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => onDeleteTrade(trade.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t p-4 bg-muted/30 space-y-4">
                        {/* Stop Loss & Target */}
                        {(trade.stopLoss || trade.targetPrice) && (
                          <div>
                            <h4 className="text-sm mb-2 text-muted-foreground">Risk Management</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {trade.stopLoss && (
                                <div className="bg-background border p-3 rounded-lg">
                                  <div className="text-xs text-muted-foreground mb-1">Stop Loss</div>
                                  <div className="tabular-nums">{formatCurrency(trade.stopLoss)}</div>
                                </div>
                              )}
                              {trade.targetPrice && (
                                <div className="bg-background border p-3 rounded-lg">
                                  <div className="text-xs text-muted-foreground mb-1">Target</div>
                                  <div className="tabular-nums">{formatCurrency(trade.targetPrice)}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Trade Breakdown */}
                        <div>
                          <h4 className="text-sm mb-2 text-muted-foreground">Trade Breakdown</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-background border p-3 rounded-lg">
                              <div className="text-xs text-muted-foreground mb-1">Total Cost</div>
                              <div className="tabular-nums">{formatCurrency(totalCost)}</div>
                            </div>
                            {trade.exitPrice && (
                              <>
                                <div className="bg-background border p-3 rounded-lg">
                                  <div className="text-xs text-muted-foreground mb-1">Total Revenue</div>
                                  <div className="tabular-nums">{formatCurrency(totalRevenue)}</div>
                                </div>
                                <div className="bg-background border p-3 rounded-lg col-span-2">
                                  <div className="text-xs text-muted-foreground mb-1">Net P&L</div>
                                  <div className={`tabular-nums ${trade.pnl && trade.pnl >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                    {formatCurrency(trade.pnl || 0)}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Tags */}
                        {trade.tags && trade.tags.length > 0 && (
                          <div>
                            <h4 className="text-sm mb-2 text-muted-foreground">Tags</h4>
                            <div className="flex flex-wrap gap-2">
                              {trade.tags.map((tag, index) => (
                                <Badge key={index} variant="outline">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {trade.notes && (
                          <div>
                            <h4 className="text-sm mb-2 text-muted-foreground">Notes</h4>
                            <div className="bg-background border p-3 rounded-lg text-sm whitespace-pre-wrap">
                              {trade.notes}
                            </div>
                          </div>
                        )}

                        {/* Photos */}
                        {trade.photos && trade.photos.length > 0 && (
                          <div>
                            <h4 className="text-sm mb-2 text-muted-foreground">Photos ({trade.photos.length})</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {trade.photos.map((photo, index) => (
                                <img
                                  key={index}
                                  src={photo}
                                  alt={`Trade photo ${index + 1}`}
                                  className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => openGallery(trade.photos!, trade.symbol)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
      
      <PhotoGallery
        photos={selectedPhotos}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title={galleryTitle}
      />

      {/* Edit Trade Dialog */}
      <Dialog open={!!editingTrade} onOpenChange={(open) => !open && onCancelEdit()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Trade</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  {...register('date', { required: 'Date is required' })}
                />
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-symbol">Symbol</Label>
                <Input
                  id="edit-symbol"
                  placeholder={getSymbolPlaceholder()}
                  {...register('symbol', { required: 'Symbol is required' })}
                />
                {errors.symbol && <p className="text-sm text-destructive">{errors.symbol.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-assetType">Asset Type</Label>
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
                  <Label htmlFor="edit-contractType">Contract Type</Label>
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
                  <Label htmlFor="edit-type">Type</Label>
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
                <Label htmlFor="edit-position">Position</Label>
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
                <Label htmlFor="edit-quantity">Quantity</Label>
                <Input
                  id="edit-quantity"
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
                <Label htmlFor="edit-entryPrice">Entry Price</Label>
                <Input
                  id="edit-entryPrice"
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
                <Label htmlFor="edit-exitPrice">Exit Price (Optional)</Label>
                <Input
                  id="edit-exitPrice"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('exitPrice')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-stopLoss">Stop Loss (Optional)</Label>
                <Input
                  id="edit-stopLoss"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('stopLoss')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-targetPrice">Target Price (Optional)</Label>
                <Input
                  id="edit-targetPrice"
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
              <Label htmlFor="edit-notes">Notes (Optional)</Label>
              <Textarea
                id="edit-notes"
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
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
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
              <Label htmlFor="edit-photos">Chart Screenshots (Optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="cursor-pointer"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('edit-photos')?.click()}
                  className="whitespace-nowrap"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload chart screenshots (max 5MB per image)
              </p>
            </div>

            {photos.length > 0 && (
              <div className="space-y-2">
                <Label>Photos</Label>
                <div className="grid grid-cols-3 gap-2">
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
              </div>
            )}

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

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onCancelEdit}>
                Cancel
              </Button>
              <Button type="submit" variant="blue">
                Update Trade
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}