import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Send, Bot, User, AlertCircle, Loader2 } from 'lucide-react';
import { sendMIAMessage, isMIAAvailable, MIAMessage } from '../services/miaService';
import { toast } from 'sonner';

interface MarketIntelligenceAssistantProps {
  inDialog?: boolean;
}

export function MarketIntelligenceAssistant({ inDialog = false }: MarketIntelligenceAssistantProps = {}) {
  const [messages, setMessages] = useState<MIAMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Market Intelligence Assistant (MIA). I provide factual market data without trading advice. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const available = isMIAAvailable();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !available) return;

    const userMessage: MIAMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendMIAMessage(userMessage.content, messages);
      
      const assistantMessage: MIAMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to get response from MIA');
      
      const errorMessage: MIAMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Market Intelligence Assistant (MIA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Gemini API key required
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                Add <code className="bg-yellow-500/20 px-1 rounded">VITE_GEMINI_API_KEY</code> to your <code className="bg-yellow-500/20 px-1 rounded">.env</code> file to use MIA.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chatContent = (
    <>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
                      <path
                        fill="currentColor"
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                      />
                    </svg>
                  </div>
                )}
              
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
                    <path
                      fill="currentColor"
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                    />
                  </svg>
                </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about economic calendar, earnings, VIX, session stats..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Try: "What's on the economic calendar today?" or "When is AAPL earnings?"
        </p>
      </div>
    </>
  );

  if (inDialog) {
    return (
      <div className="flex flex-col h-full">
        {chatContent}
      </div>
    );
  }

  return (
    <Card className="flex flex-col h-[calc(100vh-250px)] min-h-[600px] max-h-[800px]">
      <CardHeader className="flex-shrink-0 border-b">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Market Intelligence Assistant (MIA)
          <Badge variant="outline" className="ml-2">Beta</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Factual market data only. No trading advice or interpretations.
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {chatContent}
      </CardContent>
    </Card>
  );
}

