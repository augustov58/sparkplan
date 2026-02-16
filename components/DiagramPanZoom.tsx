/**
 * Pan and Zoom Wrapper for SVG Diagrams
 * Provides mouse wheel zoom, drag pan, and touch gestures (pinch-to-zoom, single-finger pan, double-tap reset)
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
  const contentRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    translateX: 0,
    translateY: 0
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showHint, setShowHint] = useState(false);

  // Touch state refs (avoid re-renders during gestures)
  const touchStateRef = useRef({
    lastTouchEnd: 0,
    initialPinchDistance: 0,
    initialScale: 1,
    isTouching: false,
    touchStartPos: { x: 0, y: 0 },
  });

  // Show mobile hint on first load
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const hintShown = sessionStorage.getItem('diagram-hint-shown');
    if (isMobile && !hintShown) {
      setShowHint(true);
      sessionStorage.setItem('diagram-hint-shown', '1');
      const timer = setTimeout(() => setShowHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

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

  // --- Touch handlers ---
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const ts = touchStateRef.current;

    if (e.touches.length === 2) {
      // Pinch start
      ts.initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
      ts.initialScale = transform.scale;
    } else if (e.touches.length === 1) {
      // Check for double-tap
      const now = Date.now();
      if (now - ts.lastTouchEnd < 300) {
        // Double-tap → reset view
        e.preventDefault();
        resetView();
        return;
      }

      // Single-finger pan start
      ts.isTouching = true;
      ts.touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setIsPanning(true);
      setPanStart({
        x: e.touches[0].clientX - transform.translateX,
        y: e.touches[0].clientY - transform.translateY
      });
    }
  }, [transform]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const ts = touchStateRef.current;

    if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scaleRatio = currentDistance / ts.initialPinchDistance;
      const newScale = Math.min(maxZoom, Math.max(minZoom, ts.initialScale * scaleRatio));

      // Zoom towards pinch center
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const scaleDiff = newScale - transform.scale;

        setTransform(prev => ({
          scale: newScale,
          translateX: prev.translateX - centerX * scaleDiff / prev.scale,
          translateY: prev.translateY - centerY * scaleDiff / prev.scale
        }));
      } else {
        setTransform(prev => ({ ...prev, scale: newScale }));
      }
    } else if (e.touches.length === 1 && ts.isTouching) {
      // Single-finger pan
      setTransform(prev => ({
        ...prev,
        translateX: e.touches[0].clientX - panStart.x,
        translateY: e.touches[0].clientY - panStart.y
      }));
    }
  }, [transform, panStart, minZoom, maxZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const ts = touchStateRef.current;
    ts.lastTouchEnd = Date.now();
    if (e.touches.length === 0) {
      ts.isTouching = false;
      setIsPanning(false);
    }
  }, []);

  // Handle pan start (mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.translateX, y: e.clientY - transform.translateY });
    }
  };

  // Handle pan move (mouse)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        translateX: e.clientX - panStart.x,
        translateY: e.clientY - panStart.y
      }));
    }
  };

  // Handle pan end (mouse)
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
    if (!containerRef.current || !contentRef.current) {
      resetView();
      return;
    }

    const container = containerRef.current.getBoundingClientRect();
    const content = contentRef.current.getBoundingClientRect();

    // Measure unscaled content size
    const contentWidth = content.width / transform.scale;
    const contentHeight = content.height / transform.scale;

    if (contentWidth === 0 || contentHeight === 0) {
      resetView();
      return;
    }

    const scaleX = container.width / contentWidth;
    const scaleY = container.height / contentHeight;
    const newScale = Math.min(scaleX, scaleY, maxZoom) * 0.95; // 5% padding
    const fitScale = Math.max(minZoom, newScale);

    // Center content
    const newTranslateX = (container.width - contentWidth * fitScale) / 2;
    const newTranslateY = (container.height - contentHeight * fitScale) / 2;

    setTransform({ scale: fitScale, translateX: newTranslateX, translateY: newTranslateY });
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
          onClick={fitToScreen}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Fit to Screen"
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

      {/* Mobile hint overlay */}
      {showHint && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-lg animate-fade-out">
            Pinch to zoom, drag to pan
          </div>
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <div
          ref={contentRef}
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
