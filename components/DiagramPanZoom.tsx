/**
 * Pan and Zoom Wrapper for SVG Diagrams
 * Provides mouse wheel zoom and drag pan functionality
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

interface DiagramPanZoomProps {
  children: React.ReactNode;
  className?: string;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
}

interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}

export const DiagramPanZoom: React.FC<DiagramPanZoomProps> = ({
  children,
  className = '',
  minZoom = 0.5,
  maxZoom = 3,
  zoomStep = 0.1
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    translateX: 0,
    translateY: 0
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
    const newScale = Math.min(maxZoom, Math.max(minZoom, transform.scale + delta));
    
    // Zoom towards cursor position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      const scaleDiff = newScale - transform.scale;
      const newTranslateX = transform.translateX - cursorX * scaleDiff / transform.scale;
      const newTranslateY = transform.translateY - cursorY * scaleDiff / transform.scale;
      
      setTransform({
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY
      });
    } else {
      setTransform(prev => ({ ...prev, scale: newScale }));
    }
  }, [transform, minZoom, maxZoom, zoomStep]);

  // Set up wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.translateX, y: e.clientY - transform.translateY });
    }
  };

  // Handle pan move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        translateX: e.clientX - panStart.x,
        translateY: e.clientY - panStart.y
      }));
    }
  };

  // Handle pan end
  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Zoom controls
  const zoomIn = () => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(maxZoom, prev.scale + zoomStep * 2)
    }));
  };

  const zoomOut = () => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(minZoom, prev.scale - zoomStep * 2)
    }));
  };

  const resetView = () => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  };

  const fitToScreen = () => {
    // Reset to fit the container
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1">
        <button
          onClick={zoomIn}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Zoom In (or scroll up)"
        >
          <ZoomIn className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={zoomOut}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Zoom Out (or scroll down)"
        >
          <ZoomOut className="w-4 h-4 text-gray-600" />
        </button>
        <div className="h-px bg-gray-200 my-1" />
        <button
          onClick={resetView}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Zoom Level Indicator */}
      <div className="absolute bottom-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-gray-500 font-mono">
        {Math.round(transform.scale * 100)}%
      </div>

      {/* Pan indicator */}
      {isPanning && (
        <div className="absolute top-2 left-2 z-10 bg-blue-500/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-white flex items-center gap-1">
          <Move className="w-3 h-3" /> Panning...
        </div>
      )}

      {/* Diagram Container */}
      <div
        ref={containerRef}
        className={`overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ touchAction: 'none' }}
      >
        <div
          style={{
            transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

