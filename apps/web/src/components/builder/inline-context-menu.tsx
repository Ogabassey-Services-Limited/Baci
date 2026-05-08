'use client';

import 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  GripVertical,
  MoreHorizontal,
  Settings,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InlineContextMenuProps {
  componentId: string;
  componentType: string;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  position?: 'top' | 'bottom';
}

export function InlineContextMenu({
  // componentId,
  componentType,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  position = 'top',
}: InlineContextMenuProps) {
  // const [isVisible, setIsVisible] = useState(true);

  const handleAction = (action?: () => void) => {
    if (action) {
      action();
    }
  };

  return (
    <div
      className={cn(
        'absolute left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-200',
        position === 'top' ? '-top-14' : '-bottom-14'
      )}
      style={{
        pointerEvents: 'auto',
        zIndex: 9999,
      }}
    >
      <TooltipProvider delayDuration={300}>
        <div
          className="flex items-center gap-1 bg-white border-2 rounded-lg shadow-lg px-2 py-1.5 backdrop-blur-xs bg-white/95"
          style={{ borderColor: '#2a2c6e20' }}
        >
          {/* Drag Handle */}
          <div
            className="flex items-center cursor-grab active:cursor-grabbing px-1"
            style={{ color: '#2a2c6e80' }}
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div
            className="w-px h-5 mx-1"
            style={{ backgroundColor: '#2a2c6e20' }}
          />

          {/* Component Type Label */}
          <span
            className="text-xs font-semibold px-2"
            style={{ color: '#2a2c6e' }}
          >
            {componentType}
          </span>

          <div
            className="w-px h-5 mx-1"
            style={{ backgroundColor: '#2a2c6e20' }}
          />

          {/* Edit Properties */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Edit Properties"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-opacity-10 transition-all"
                style={{ color: '#2a2c6e' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2a2c6e10';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => handleAction(onEdit)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit Properties</p>
            </TooltipContent>
          </Tooltip>

          {/* Duplicate */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Duplicate"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 transition-all"
                style={{ color: '#2a2c6e' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2a2c6e10';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => handleAction(onDuplicate)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Duplicate</p>
            </TooltipContent>
          </Tooltip>

          {/* Move Up */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Move Up"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 transition-all disabled:opacity-30"
                style={{ color: '#2a2c6e' }}
                onMouseEnter={(e) => {
                  if (canMoveUp) {
                    e.currentTarget.style.backgroundColor = '#2a2c6e10';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => handleAction(onMoveUp)}
                disabled={!canMoveUp}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Move Up</p>
            </TooltipContent>
          </Tooltip>

          {/* Move Down */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Move Down"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 transition-all disabled:opacity-30"
                style={{ color: '#2a2c6e' }}
                onMouseEnter={(e) => {
                  if (canMoveDown) {
                    e.currentTarget.style.backgroundColor = '#2a2c6e10';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => handleAction(onMoveDown)}
                disabled={!canMoveDown}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Move Down</p>
            </TooltipContent>
          </Tooltip>

          <div
            className="w-px h-5 mx-1"
            style={{ backgroundColor: '#2a2c6e20' }}
          />

          {/* Delete */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Delete"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 transition-all"
                style={{ color: '#dc2626' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc262610';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => handleAction(onDelete)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete</p>
            </TooltipContent>
          </Tooltip>

          {/* More Options */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="More Options"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 transition-all"
                    style={{ color: '#2a2c6e' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#2a2c6e10';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>More Options</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleAction(onEdit)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Properties
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction(onDuplicate)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleAction(onDelete)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TooltipProvider>
    </div>
  );
}
