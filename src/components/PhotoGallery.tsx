import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react';

interface PhotoGalleryProps {
  photos: string[];
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function PhotoGallery({ photos, isOpen, onClose, title }: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const downloadPhoto = () => {
    const link = document.createElement('a');
    link.href = photos[currentIndex];
    link.download = `trade-photo-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || photos.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{title || 'Trade Photos'}</DialogTitle>
        </DialogHeader>
        
        <div className="relative flex-1 flex items-center justify-center p-6">
          <div className="relative max-w-full max-h-[70vh]">
            <img
              src={photos[currentIndex]}
              alt={`Photo ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            
            {photos.length > 1 && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  onClick={prevPhoto}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  onClick={nextPhoto}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between p-6 pt-0">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} of {photos.length}
            </span>
            
            {photos.length > 1 && (
              <div className="flex gap-1">
                {photos.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex ? 'bg-primary' : 'bg-muted'
                    }`}
                    onClick={() => setCurrentIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadPhoto}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-1" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}