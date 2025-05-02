'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

interface DynamicComponentRendererProps {
  componentCode: string;
  showCode?: boolean;
  analyserNode?: AnalyserNode | null;
}

// Detect visualization mode from code
function detectVisualizationMode(code: string): 'canvas' | 'three.js' | 'unknown' {
  const codeStart = code.trim().toLowerCase().slice(0, 200);
  if (codeStart.includes('// mode: canvas')) {
    return 'canvas';
  } else if (codeStart.includes('// mode: three.js') || codeStart.includes('// mode: threejs')) {
    return 'three.js';
  }
  // Default to canvas mode if no mode is specified
  return 'canvas';
}

// Initialize global THREE environment
function initThreeGlobals() {
  // Create global references for THREE objects if they don't exist
  if (!(window as any).scene) {
    (window as any).scene = new THREE.Scene();
  }
  
  if (!(window as any).camera) {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 5;
    (window as any).camera = camera;
  }
  
  // Set global THREE variable
  (window as any).THREE = THREE;
  
  // Initialize objects container if needed
  if (!(window as any).objects) {
    (window as any).objects = {};
  }
  
  return {
    scene: (window as any).scene as THREE.Scene,
    camera: (window as any).camera as THREE.PerspectiveCamera
  };
}

const DynamicComponentRenderer: React.FC<DynamicComponentRendererProps> = ({
  componentCode,
  showCode = false,
  analyserNode = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const timeDataArrayRef = useRef<Uint8Array | null>(null);
  const freqDataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasErrored, setHasErrored] = useState(false);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState<'canvas' | 'three.js' | 'unknown'>('unknown');
  
  // Initialize THREE globals first
  useEffect(() => {
    try {
      // Initialize THREE globals for all modes
      const { scene, camera } = initThreeGlobals();
      sceneRef.current = scene;
      cameraRef.current = camera;
      
      return () => {
        // Clean up global objects
        delete (window as any).scene;
        delete (window as any).camera;
        delete (window as any).THREE;
        delete (window as any).objects;
      };
    } catch (err) {
      console.error('Error initializing THREE globals:', err);
      setError('Failed to initialize 3D rendering environment');
      setHasErrored(true);
    }
  }, []);
  
  // Detect mode from code
  useEffect(() => {
    if (!componentCode) return;
    
    try {
      const mode = detectVisualizationMode(componentCode);
      console.log(`Detected visualization mode: ${mode}`);
      setVisualizationMode(mode);
      setError(null);
      setHasErrored(false);
    } catch (err) {
      console.error('Error detecting visualization mode:', err);
      setError('Failed to determine visualization type');
      setHasErrored(true);
    }
  }, [componentCode]);
  
  // Set up the canvas
  useEffect(() => {
    if (!containerRef.current || hasErrored) return;
    
    // Clean up first
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    
    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    // Create canvas 
    const canvas = document.createElement('canvas');
    canvas.width = containerRef.current.clientWidth || 300;
    canvas.height = containerRef.current.clientHeight || 150;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    // Append canvas to container
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;
    
    // Setup for the selected mode
    if (visualizationMode === 'canvas') {
      // Setup for Canvas visualization
      ctxRef.current = canvas.getContext('2d');
      
      if (!ctxRef.current) {
        setError('Failed to get 2D canvas context');
        setHasErrored(true);
        return;
      }
    } else if (visualizationMode === 'three.js') {
      // Setup for Three.js visualization
      try {
        // Create THREE renderer using the canvas
        const renderer = new THREE.WebGLRenderer({ 
          canvas,
          antialias: true, 
          alpha: true 
        });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;
        
        // Update camera aspect ratio
        if (cameraRef.current) {
          cameraRef.current.aspect = canvas.width / canvas.height;
          cameraRef.current.updateProjectionMatrix();
        }
        
      } catch (err) {
        console.error('Error setting up Three.js renderer:', err);
        setError('Failed to initialize Three.js renderer');
        setHasErrored(true);
        return;
      }
    }
    
    // Set up resize handler
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      
      if (visualizationMode === 'three.js' && rendererRef.current && cameraRef.current) {
        rendererRef.current.setSize(width, height);
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      
      // Clean up Three.js resources
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [visualizationMode, hasErrored]);
  
  // Set up audio data buffers when analyserNode changes
  useEffect(() => {
    if (!analyserNode) {
      setIsAudioActive(false);
      timeDataArrayRef.current = null;
      freqDataArrayRef.current = null;
      return;
    }
    
    // Create new buffers for audio data
    timeDataArrayRef.current = new Uint8Array(analyserNode.fftSize);
    freqDataArrayRef.current = new Uint8Array(analyserNode.frequencyBinCount);
    setIsAudioActive(true);
    
    console.log('Audio analyzer connected with buffer sizes:', {
      time: timeDataArrayRef.current.length,
      freq: freqDataArrayRef.current.length
    });
    
  }, [analyserNode]);
  
  // Run the visualization
  useEffect(() => {
    if (hasErrored || !componentCode?.trim() || !canvasRef.current || 
        (visualizationMode === 'canvas' && !ctxRef.current) || 
        (visualizationMode === 'three.js' && (!rendererRef.current || !sceneRef.current || !cameraRef.current))) {
      return;
    }
    
    try {
      // Raw visualization code
      const visualizationCode = componentCode;
      
      // Run animation loop
      const animate = () => {
        // Update audio data if available
        if (analyserNode && timeDataArrayRef.current && freqDataArrayRef.current) {
          analyserNode.getByteTimeDomainData(timeDataArrayRef.current);
          analyserNode.getByteFrequencyData(freqDataArrayRef.current);
        }
        
        try {
          if (visualizationMode === 'canvas' && ctxRef.current) {
            // Clear canvas for 2D mode
            ctxRef.current.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
            
            // Make globals available in canvas mode too
            const scene = sceneRef.current;
            const camera = cameraRef.current;
            
            // Run the visualization with current data
            const func = new Function(
              'canvas',
              'ctx',
              'audioData',
              'frequencyData',
              'isAudioActive',
              'time',
              'THREE',
              'scene',
              'camera',
              visualizationCode
            );
            
            func(
              canvasRef.current,
              ctxRef.current,
              timeDataArrayRef.current,
              freqDataArrayRef.current,
              isAudioActive,
              performance.now() / 1000, 
              THREE,
              scene,
              camera
            );
          } else if (visualizationMode === 'three.js' && rendererRef.current && sceneRef.current && cameraRef.current) {
            // Make sure globals are set correctly
            (window as any).scene = sceneRef.current;
            (window as any).camera = cameraRef.current;
            
            // Run visualization code
            const func = new Function(
              'canvas',
              'audioData',
              'frequencyData',
              'isAudioActive',
              'time',
              'THREE',
              'scene',
              'camera',
              'renderer',
              visualizationCode
            );
            
            func(
              canvasRef.current,
              timeDataArrayRef.current,
              freqDataArrayRef.current,
              isAudioActive,
              performance.now() / 1000,
              THREE,
              sceneRef.current,
              cameraRef.current,
              rendererRef.current
            );
            
            // Render the Three.js scene
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
          
          // Schedule next frame
          animationFrameIdRef.current = requestAnimationFrame(animate);
        } catch (err) {
          console.error('Error in visualization:', err);
          if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
          }
          setError(err instanceof Error ? err.message : 'Visualization error');
          setHasErrored(true);
        }
      };
      
      // Start animation
      animate();
      
      // Cleanup function
      return () => {
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
      };
    } catch (err) {
      console.error('Error setting up visualization:', err);
      setError(err instanceof Error ? err.message : 'Failed to set up visualization');
      setHasErrored(true);
    }
  }, [componentCode, analyserNode, hasErrored, isAudioActive, visualizationMode]);

  // Handle initial render when error occurs
  if (hasErrored) {
    return (
      <div 
        className="p-4 bg-red-50 border border-red-200 rounded-md w-full h-full flex flex-col items-center justify-center text-center"
      >
        <h3 className="text-lg font-semibold text-red-700 mb-2">Error Rendering Visualization</h3>
        <p className="text-red-600 text-sm">{error || 'The visualization failed to render properly.'}</p>
        {showCode && (
          <div className="mt-4 w-full max-w-lg">
            <h4 className="font-semibold mb-1 text-left">Visualization Code:</h4>
            <pre className="bg-gray-900 text-gray-100 p-3 rounded-md overflow-auto text-xs max-h-60 text-left">
              {componentCode}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative"
      style={{ display: 'block' }}
    >
      {/* Canvas will be appended here by useEffect */}
      {showCode && (
        <div className="absolute inset-0 bg-black/80 p-4 overflow-auto z-10">
          <pre className="text-xs text-green-400 whitespace-pre-wrap">{componentCode}</pre>
        </div>
      )}
    </div>
  );
};

export default DynamicComponentRenderer; 