'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/solid';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode | (({ isFullscreen }: { isFullscreen: boolean }) => React.ReactNode);
  className?: string;
}

export function Dialog({
  isOpen,
  onClose,
  children,
  className = '',
}: DialogProps) {
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };
    
    // const handleOutsideClick = (e: React.MouseEvent) => {
    //   if (!document.fullscreenElement) {
    //     onClose();
    //   }
    // };
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    const handleMouseDownOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !document.fullscreenElement) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleMouseDownOutside);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      if (!document.fullscreenElement) {
         document.body.style.overflow = 'hidden';
      }
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleMouseDownOutside);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen && document.fullscreenElement && modalRef.current && document.fullscreenElement === modalRef.current) {
      document.exitFullscreen();
    }
    if (!isOpen && !document.fullscreenElement) {
       document.body.style.overflow = '';
    }
  }, [isOpen]);

  const toggleFullscreen = async () => {
    if (!modalRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await modalRef.current.requestFullscreen();
      } catch (err) {
        console.error("Error attempting to enable full-screen mode:", err);
      }
    } else {
      if (document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch (err) {
           console.error("Error attempting to disable full-screen mode:", err);
        }
      }
    }
  };
  
  if (!mounted) return null;
  
  const handleCloseClick = () => {
    if (document.fullscreenElement && modalRef.current && document.fullscreenElement === modalRef.current) {
       document.exitFullscreen();
    }
    onClose();
  };

  const dialogContent = typeof children === 'function' ? children({ isFullscreen }) : children;

  return createPortal(
    <div
      ref={modalRef}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${!isFullscreen ? 'p-4' : 'p-0'}`}
      onClick={
        isFullscreen
          ? undefined
          : (e: React.MouseEvent<HTMLDivElement>) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }
      }
    >
      <div
        className={`bg-gray-900 border ${isFullscreen ? 'border-0 w-full h-full m-0 rounded-none max-h-none' : `border-gray-800 rounded-xl max-h-[calc(100vh-2rem)] ${className}`} shadow-2xl relative overflow-hidden flex flex-col transition-all duration-300 ease-in-out ${isOpen && !isFullscreen ? 'scale-100 opacity-100' : isFullscreen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={isFullscreen ? undefined : (e) => e.stopPropagation()}
      >
        <div className={`absolute top-0 right-0 p-3 z-10 flex gap-2 ${isFullscreen ? 'bg-black/30 rounded-bl-lg' : ''}`}>
          {typeof children === 'function' && (
            <button
              onClick={toggleFullscreen}
              className="p-1 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="h-5 w-5" />
              ) : (
                <ArrowsPointingOutIcon className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            onClick={handleCloseClick}
            className="p-1 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label="Close dialog"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className={`flex-1 overflow-auto`}>
          {dialogContent}
        </div>
      </div>
    </div>,
    document.body
  );
} 