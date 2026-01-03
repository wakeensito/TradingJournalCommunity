import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { MarketIntelligenceAssistant } from './MarketIntelligenceAssistant';

interface FloatingMIAProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FloatingMIA({ isOpen, onClose }: FloatingMIAProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  // Header height is approximately 64px (py-4 = 16px top + 16px bottom + content height ~32px)
  const HEADER_HEIGHT = 64;
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 100 });
  const [size, setSize] = useState({ width: 400, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const windowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Constrain position to viewport, but keep above header
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.x));
        const newY = Math.max(HEADER_HEIGHT, Math.min(window.innerHeight - 50, e.clientY - dragStart.y));
        setPosition({
          x: newX,
          y: newY,
        });
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = position.x;
        let newY = position.y;

        // Handle resize based on direction
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(350, Math.min(800, resizeStart.width + deltaX));
        }
        if (resizeDirection.includes('w')) {
          newWidth = Math.max(350, Math.min(800, resizeStart.width - deltaX));
          newX = resizeStart.left + deltaX;
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(400, Math.min(window.innerHeight - 100, resizeStart.height + deltaY));
        }
        if (resizeDirection.includes('n')) {
          const minY = HEADER_HEIGHT;
          const proposedY = resizeStart.top + deltaY;
          if (proposedY < minY) {
            // Can't resize above header, adjust height accordingly
            newHeight = resizeStart.height + (resizeStart.top - minY);
            newY = minY;
          } else {
            newHeight = Math.max(400, Math.min(window.innerHeight - 100, resizeStart.height - deltaY));
            newY = proposedY;
          }
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, resizeDirection, position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if clicking on header but not on buttons
    const target = e.target as HTMLElement;
    if (headerRef.current?.contains(target) && !target.closest('button')) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      left: position.x,
      top: position.y,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      className="fixed z-[9999] bg-background border border-border rounded-lg shadow-2xl flex flex-col pointer-events-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? '350px' : `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
        maxWidth: '90vw',
        maxHeight: '90vh',
      }}
    >
      {/* Header - Draggable */}
      <div
        ref={headerRef}
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-4 py-3 border-b bg-card cursor-move select-none"
      >
        <div className="flex items-center gap-2 flex-1">
          {/* Gemini Logo */}
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              />
            </svg>
          </div>
          <span className="font-semibold text-sm">Market Intelligence Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="flex-1 overflow-hidden min-h-0">
          <MarketIntelligenceAssistant inDialog={true} />
        </div>
      )}

      {/* Resize Handles - All Edges and Corners with Visual Indicators */}
      {!isMinimized && (
        <>
          {/* Corner Handles - Only visible on hover, no background */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
            className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize z-20 group"
            style={{ cursor: 'nwse-resize' }}
          >
            <div className="absolute top-0 left-0 w-6 h-6 rounded-br-lg border-r-2 border-b-2 border-transparent group-hover:border-primary/60 transition-colors">
              <div className="absolute bottom-1.5 left-1.5 w-2.5 h-[1.5px] bg-transparent group-hover:bg-primary/60 rotate-45 origin-left transition-colors"></div>
              <div className="absolute bottom-1.5 left-2.5 w-2.5 h-[1.5px] bg-transparent group-hover:bg-primary/60 rotate-45 origin-left transition-colors"></div>
            </div>
          </div>
          <div
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
            className="absolute top-0 right-0 w-6 h-6 cursor-nesw-resize z-20 group"
            style={{ cursor: 'nesw-resize' }}
          >
            <div className="absolute top-0 right-0 w-6 h-6 rounded-bl-lg border-l-2 border-b-2 border-transparent group-hover:border-primary/60 transition-colors">
              <div className="absolute bottom-1.5 right-1.5 w-2.5 h-[1.5px] bg-transparent group-hover:bg-primary/60 -rotate-45 origin-right transition-colors"></div>
              <div className="absolute bottom-1.5 right-2.5 w-2.5 h-[1.5px] bg-transparent group-hover:bg-primary/60 -rotate-45 origin-right transition-colors"></div>
            </div>
          </div>
          <div
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
            className="absolute bottom-0 left-0 w-6 h-6 cursor-nesw-resize z-20 group"
            style={{ cursor: 'nesw-resize' }}
          >
            <div className="absolute bottom-0 left-0 w-6 h-6 rounded-tr-lg border-r-2 border-t-2 border-transparent group-hover:border-primary/60 transition-colors">
              <div className="absolute top-1.5 left-1.5 w-2.5 h-[1.5px] bg-transparent group-hover:bg-primary/60 -rotate-45 origin-left transition-colors"></div>
              <div className="absolute top-1.5 left-2.5 w-2.5 h-[1.5px] bg-transparent group-hover:bg-primary/60 -rotate-45 origin-left transition-colors"></div>
            </div>
          </div>
          <div
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-20 group"
            style={{ cursor: 'nwse-resize' }}
          >
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-tl-lg border-l-2 border-t-2 border-transparent group-hover:border-primary/60 transition-colors">
              <div className="absolute top-1.5 right-1.5 w-2.5 h-[1.5px] bg-transparent group-hover:bg-primary/60 rotate-45 origin-right transition-colors"></div>
              <div className="absolute top-1.5 right-2.5 w-2.5 h-[1.5px] bg-transparent group-hover:bg-primary/60 rotate-45 origin-right transition-colors"></div>
            </div>
          </div>
          
          {/* Edge Handles - More visible with hover effects */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'n')}
            className="absolute top-0 left-6 right-6 h-3 cursor-ns-resize z-20 hover:bg-primary/10 transition-colors"
            style={{ cursor: 'ns-resize' }}
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, 's')}
            className="absolute bottom-0 left-6 right-6 h-3 cursor-ns-resize z-20 hover:bg-primary/10 transition-colors"
            style={{ cursor: 'ns-resize' }}
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, 'w')}
            className="absolute left-0 top-6 bottom-6 w-3 cursor-ew-resize z-20 hover:bg-primary/10 transition-colors"
            style={{ cursor: 'ew-resize' }}
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, 'e')}
            className="absolute right-0 top-6 bottom-6 w-3 cursor-ew-resize z-20 hover:bg-primary/10 transition-colors"
            style={{ cursor: 'ew-resize' }}
          />
        </>
      )}
    </div>
  );
}

