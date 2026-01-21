import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Calendar, ChevronDown, ChevronUp, Trash2, BookOpen } from 'lucide-react';
import { JournalEntry } from '../types/journal';
import { loadJournalEntries, deleteJournalEntry } from '../services/journalStorage';
import { toast } from 'sonner';

export function SavedEntries() {
  const [savedEntries, setSavedEntries] = useState<JournalEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load saved entries on mount
  useEffect(() => {
    const loadEntries = async () => {
      try {
        setIsLoading(true);
        const entries = await loadJournalEntries();
        console.log(`Loaded ${entries.length} journal entries from storage`);
        setSavedEntries(entries);
      } catch (error) {
        console.error('Failed to load journal entries:', error);
        toast.error('Failed to load journal entries');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEntries();
  }, []);

  const toggleExpand = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      // Delete from Firebase/localStorage
      await deleteJournalEntry(id);
      
      // Update local state
      const updated = savedEntries.filter(e => e.id !== id);
      setSavedEntries(updated);
      
      // Remove from expanded if it was expanded
      const newExpanded = new Set(expandedEntries);
      newExpanded.delete(id);
      setExpandedEntries(newExpanded);
      
      toast.success('Journal entry deleted');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading entries...</p>
        </div>
      </div>
    );
  }

  if (savedEntries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Saved Entries</h3>
            <p className="text-sm text-muted-foreground">
              Your journal entries will appear here once you save them.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saved Journal Entries</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {savedEntries.length} {savedEntries.length === 1 ? 'entry' : 'entries'} saved
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {savedEntries.length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-3">
              {savedEntries
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((entry) => {
                  const isExpanded = expandedEntries.has(entry.id);
                  
                  return (
                    <Card key={entry.id} className="border hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium">
                                  {new Date(entry.date).toLocaleDateString('en-US', { 
                                    weekday: 'long',
                                    month: 'long', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </span>
                                {entry.processScore !== undefined && (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs shrink-0 ${
                                      entry.processScore >= 70 ? 'border-green-500 text-green-600' :
                                      entry.processScore >= 50 ? 'border-yellow-500 text-yellow-600' :
                                      'border-red-500 text-red-600'
                                    }`}
                                  >
                                    {Math.round(entry.processScore)}/100
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Preview */}
                              {!isExpanded && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {entry.content.substring(0, 200)}...
                                </p>
                              )}
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => toggleExpand(entry.id)}
                                title={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteEntry(entry.id)}
                                title="Delete entry"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase">Full Entry</span>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <pre className="whitespace-pre-wrap font-mono text-sm bg-muted/50 p-4 rounded-lg border overflow-x-auto">
                                    {entry.content}
                                  </pre>
                                </div>
                                {entry.processScore !== undefined && (
                                  <div className="mt-3 pt-3 border-t border-border">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-muted-foreground">Process Score:</span>
                                      <Badge 
                                        variant="outline" 
                                        className={`${
                                          entry.processScore >= 70 ? 'border-green-500 text-green-600' :
                                          entry.processScore >= 50 ? 'border-yellow-500 text-yellow-600' :
                                          'border-red-500 text-red-600'
                                        }`}
                                      >
                                        {Math.round(entry.processScore)}/100
                                      </Badge>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}




