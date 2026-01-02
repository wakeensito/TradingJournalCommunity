import { Button } from './ui/button';
import { ImageIcon } from 'lucide-react';

interface PhotoPreviewProps {
  photos: string[];
  onViewAll: () => void;
  maxThumbnails?: number;
}

export function PhotoPreview({ photos, onViewAll, maxThumbnails = 3 }: PhotoPreviewProps) {
  const visiblePhotos = photos.slice(0, maxThumbnails);
  const remainingCount = photos.length - maxThumbnails;

  return (
    <div className="flex items-center gap-1">
      {/* Photo thumbnails */}
      <div className="flex -space-x-1">
        {visiblePhotos.map((photo, index) => (
          <div
            key={index}
            className="relative w-8 h-8 rounded-full border-2 border-background overflow-hidden cursor-pointer hover:z-10 hover:scale-110 transition-transform"
            onClick={onViewAll}
          >
            <img
              src={photo}
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        
        {remainingCount > 0 && (
          <div
            className="relative w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center cursor-pointer hover:z-10 hover:scale-110 transition-transform text-xs"
            onClick={onViewAll}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      {/* View all button */}
      <Button 
        size="sm" 
        variant="ghost" 
        className="h-6 px-2 text-xs"
        onClick={onViewAll}
      >
        <ImageIcon className="h-3 w-3 mr-1" />
        {photos.length}
      </Button>
    </div>
  );
}