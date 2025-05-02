'use client';

import { useState, useRef, useEffect } from 'react';
import { useAudioProcessor } from '@/hooks/useAudioProcessor';
import AudioControls from '@/components/AudioControls';
import ShaderVisualizer from '@/components/ShaderVisualizer';
import { defaultFragmentShader, defaultVertexShader } from '@/components/DefaultShaders';
import { Dialog } from '@/components/Dialog';
import { generateComponent } from './actions/generateComponent';
import { remixComponent } from './actions/remixComponent';
import DynamicComponentRenderer from '@/components/DynamicComponentRenderer';

interface VersionedComponent {
  prompt: string;
  componentCode: string | null;
  description?: string;
  createdAt: Date;
}

interface Generation {
  id: string;
  versions: VersionedComponent[];
  fragmentShader: string;
  vertexShader: string;
  createdAt: Date;
}

export default function Home() {
  const audioProcessor = useAudioProcessor();
  const [prompt, setPrompt] = useState('');
  const [updatePrompt, setUpdatePrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [activeGeneration, setActiveGeneration] = useState<Generation | null>(null);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [showGenerationDialog, setShowGenerationDialog] = useState(false);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  
  // Handle cursor inactivity in full-screen visualization
  useEffect(() => {
    if (!showGenerationDialog || isSubmitting || isUpdating) return;
    
    const startInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      
      inactivityTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2000); // Hide controls after 2 seconds of inactivity
    };
    
    const handleMouseMove = () => {
      setShowControls(true);
      startInactivityTimer();
    };
    
    // Set up event listeners
    if (dialogRef.current) {
      dialogRef.current.addEventListener('mousemove', handleMouseMove);
      startInactivityTimer();
    }
    
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      
      if (dialogRef.current) {
        dialogRef.current.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [showGenerationDialog, isSubmitting, isUpdating]);
  
  // Reset control visibility when dialog opens/closes
  useEffect(() => {
    setShowControls(true);
  }, [showGenerationDialog]);

  // Handle keyboard navigation between versions
  useEffect(() => {
    if (!showGenerationDialog || !activeGeneration || activeGeneration.versions.length <= 1) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Show controls and reset inactivity timer on navigation
        setShowControls(true);
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
          setShowControls(false);
        }, 2000);
        
        // Navigate versions
        if (e.key === 'ArrowLeft') {
          setActiveVersionIndex(prev => Math.max(0, prev - 1));
        } else {
          setActiveVersionIndex(prev => Math.min(activeGeneration.versions.length - 1, prev + 1));
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Clear timer if dialog closes while timer is active
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
    // Add inactivityTimerRef to dependencies if needed, but likely okay as it's just for clearing/setting timeout ID
  }, [showGenerationDialog, activeGeneration]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    const temporaryId = `temp-${Date.now()}`;
    const currentPrompt = prompt; // Capture prompt before clearing
    
    // Create placeholder generation
    const placeholderGeneration: Generation = {
      id: temporaryId,
      versions: [{
        prompt: currentPrompt,
        componentCode: null, // Mark as loading
        description: undefined,
        createdAt: new Date()
      }],
      fragmentShader: defaultFragmentShader, // Use defaults for placeholder
      vertexShader: defaultVertexShader,
      createdAt: new Date()
    };
    
    // Add placeholder immediately and clear prompt
    setGenerations(prev => [placeholderGeneration, ...prev]);
    setPrompt(''); // Clear prompt input
    
    try {
      // Call the generateComponent server action with the prompt
      const result = await generateComponent(currentPrompt);
      
      // Create the final generation object with the same ID
      const finalGeneration: Generation = {
        ...placeholderGeneration, // Keep ID and createdAt
        versions: [{
          prompt: currentPrompt,
          componentCode: result.componentCode || '', // Use actual code
          description: result.description,
          createdAt: placeholderGeneration.versions[0].createdAt // Keep original version time
        }],
        // Keep default shaders for now, or update if generation returns shaders
      };
      
      // Replace placeholder with final generation data
      setGenerations(prev => 
        prev.map(gen => gen.id === temporaryId ? finalGeneration : gen)
      );
      // No longer setting active generation or opening dialog here
      // setActiveGeneration(finalGeneration);
      // setActiveVersionIndex(0);
      
    } catch (error) {
      console.error('Error generating visualization:', error);
      // Remove placeholder on error
      setGenerations(prev => prev.filter(gen => gen.id !== temporaryId));
      // TODO: Add user feedback for error (e.g., toast notification)
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatePrompt.trim() || isUpdating || !activeGeneration) return;
    
    setIsUpdating(true);
    
    try {
      // Get the original prompt and code
      const originalPrompt = activeGeneration.versions[activeVersionIndex].prompt;
      const originalCode = activeGeneration.versions[activeVersionIndex].componentCode || '';
      
      // Get the full history of prompts
      const promptHistory = activeGeneration.versions.map(version => version.prompt);
      
      // Call the remixComponent server action
      const result = await remixComponent(originalPrompt, updatePrompt, originalCode, promptHistory);
      
      // Create a new version
      const updatedGeneration = { ...activeGeneration };
      updatedGeneration.versions = [
        ...updatedGeneration.versions,
        {
          prompt: updatePrompt,
          componentCode: result.componentCode || '',
          description: result.description,
          createdAt: new Date()
        }
      ];
      
      // Update the generations array
      setGenerations(prev => 
        prev.map(gen => gen.id === activeGeneration.id ? updatedGeneration : gen)
      );
      
      // Update active generation and set to the newest version
      setActiveGeneration(updatedGeneration);
      setActiveVersionIndex(updatedGeneration.versions.length - 1);
      setUpdatePrompt('');
    } catch (error) {
      console.error('Error updating visualization:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectGeneration = (generation: Generation) => {
    setActiveGeneration(generation);
    setActiveVersionIndex(generation.versions.length - 1); // Select the latest version by default
    setShowGenerationDialog(true);
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveVersionIndex(parseInt(e.target.value));
  };

  return (
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-black via-gray-900 to-purple-950">
      {/* Header with title and audio controls */}
      <header className="py-4 px-6 flex justify-between items-center border-b border-gray-800 bg-black/30 backdrop-blur-sm">
        <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          Amp*
        </h1>
        
        <AudioControls
          start={audioProcessor.start}
          stop={audioProcessor.stop}
          isRecording={audioProcessor.isRecording}
          error={audioProcessor.error}
          audioSource={audioProcessor.audioSource}
          audioDevices={audioProcessor.audioDevices}
          refreshDevices={audioProcessor.refreshDevices}
          selectedDeviceId={audioProcessor.selectedDeviceId}
        />
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Prompt Input */}
        <div className="w-full max-w-3xl mx-auto mb-10 mt-10">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Describe your visualization (e.g., neon waves pulsing with the beat...)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-5 py-3 rounded-full bg-gray-800/60 border border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={isSubmitting || !prompt.trim()}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center justify-center gap-2
                ${isSubmitting || !prompt.trim() 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'}`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </button>
          </form>
        </div>
        
        {/* Previous Generations Grid */}
        <div className="mt-6">
          <h2 className="text-lg font-medium text-gray-300 mb-4">Your Visualizations</h2>
          
          {generations.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              No visualizations yet. Create one using the prompt above.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {generations.map(generation => {
                const latestVersion = generation.versions[generation.versions.length - 1];
                const isLoading = latestVersion.componentCode === null;

                let visualizerContent: React.ReactNode;
                if (isLoading) {
                  visualizerContent = (
                    <div className="w-full h-full flex items-center justify-center bg-black/30">
                      <div className="animate-spin h-8 w-8 border-4 border-purple-400 border-t-transparent rounded-full"></div>
                    </div>
                  );
                } else if (latestVersion.componentCode) {
                  // TypeScript should now know componentCode is a string here
                  visualizerContent = (
                    <DynamicComponentRenderer
                      componentCode={latestVersion.componentCode}
                      analyserNode={audioProcessor.analyserNode}
                    />
                  );
                } else {
                  visualizerContent = (
                    <ShaderVisualizer 
                      fragmentShader={generation.fragmentShader}
                      vertexShader={generation.vertexShader}
                      analyserNode={audioProcessor.analyserNode}
                    />
                  );
                }

                return (
                  <div 
                    key={generation.id}
                    onClick={() => !isLoading && handleSelectGeneration(generation)}
                    className={`relative group bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden transition-all h-48 ${
                      isLoading 
                        ? 'cursor-wait animate-pulse opacity-70' 
                        : 'cursor-pointer hover:border-purple-500'
                    }`}
                  >
                    <div className="absolute inset-0 opacity-60 pointer-events-none">
                      {visualizerContent}
                    </div>
                    <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-sm text-white font-medium line-clamp-2">{latestVersion.prompt}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-400">
                          {isLoading ? 'Generating...' : generation.createdAt.toLocaleString()}
                        </p>
                        {generation.versions.length > 1 && !isLoading && (
                          <span className="text-xs bg-purple-600/80 text-white px-2 py-0.5 rounded-full">
                            {generation.versions.length} versions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Generation Dialog */}
      <Dialog
        isOpen={showGenerationDialog}
        onClose={() => setShowGenerationDialog(false)}
        className="w-full max-w-4xl h-[80vh] flex flex-col"
      >
        {activeGeneration ? (
          () => (
            <div className="flex flex-col h-full" ref={dialogRef}>
              <div className="flex-1 relative overflow-hidden bg-black">
                {/* Visualization Renderer */}
                {activeGeneration && activeGeneration.versions[activeVersionIndex] && activeGeneration.versions[activeVersionIndex].componentCode ? (
                  <DynamicComponentRenderer
                    componentCode={String(activeGeneration.versions[activeVersionIndex].componentCode)}
                    analyserNode={audioProcessor.analyserNode}
                  />
                ) : (
                  <ShaderVisualizer 
                    fragmentShader={activeGeneration.fragmentShader}
                    vertexShader={activeGeneration.vertexShader}
                    analyserNode={audioProcessor.analyserNode}
                  />
                )}
                
                {/* No Audio Overlay */}
                {!audioProcessor.isRecording && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="text-center p-6 rounded-xl">
                      <p className="text-gray-400 max-w-xs mx-auto">
                        Connect audio from the header controls to see this visualization
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Small Remixing Indicator (Top Right) */}
                {isUpdating && (
                  <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2 backdrop-blur-sm z-10">
                    <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                    Remixing...
                  </div>
                )}
              </div>
              <div 
                className={`bg-gray-900 border-t border-gray-800 shrink-0 transition-all duration-500 ease-in-out overflow-hidden ${
                  showControls ? 'p-5 opacity-100 h-auto' : 'h-0 opacity-0 p-0 border-none'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-white mb-1">
                      {activeGeneration.versions[activeVersionIndex]?.prompt}
                    </h3>
                    <p className="text-sm text-gray-400">
                      Created on {activeGeneration.versions[activeVersionIndex]?.createdAt.toLocaleString()}
                    </p>
                    {activeGeneration.versions[activeVersionIndex]?.description && activeVersionIndex > 0 && (
                      <div className="mt-2 p-2 bg-gray-800/30 rounded text-xs text-gray-300 max-w-2xl">
                        <p className="text-purple-400 mb-1">Changes from previous version:</p>
                        <p>{activeGeneration.versions[activeVersionIndex].description}</p>
                      </div>
                    )}
                  </div>
                  
                  {activeGeneration.versions.length > 1 && (
                    <div className="ml-4">
                      <select 
                        value={activeVersionIndex}
                        onChange={handleVersionChange}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-1 text-sm"
                      >
                        {activeGeneration.versions.map((version, index) => (
                          <option key={index} value={index}>
                            Version {index + 1}: {version.prompt.substring(0, 20)}...
                          </option>
                        ))}
                      </select>
                      <div className="text-center text-xs text-gray-500 mt-1">
                        Use ← → arrow keys to navigate
                      </div>
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleUpdateGeneration} className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Describe how you'd like to remix this visualization..."
                      value={updatePrompt}
                      onChange={(e) => setUpdatePrompt(e.target.value)}
                      onFocus={() => {
                        setShowControls(true);
                        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
                      }}
                      onBlur={() => {
                        const startInactivityTimer = () => {
                          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
                          inactivityTimerRef.current = setTimeout(() => setShowControls(false), 2000);
                        };
                        startInactivityTimer();
                      }}
                      onInput={() => {
                        setShowControls(true);
                        const startInactivityTimer = () => {
                          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
                          inactivityTimerRef.current = setTimeout(() => setShowControls(false), 2000);
                        };
                        startInactivityTimer();
                      }}
                      className="flex-1 px-4 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={isUpdating || !updatePrompt.trim()}
                      className={`px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap
                        ${isUpdating || !updatePrompt.trim() 
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'}`}
                    >
                      {isUpdating ? 'Remixing...' : 'Remix & Create Version'}
                    </button>
                  </div>
                  
                </form>
              </div>
            </div>
          )
        ) : null}
      </Dialog>

      {/* Prompt History Modal (After Form, within controls container) */}
      {showPromptHistory && activeGeneration && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-white font-medium">Prompt History</h3>
              <button 
                onClick={() => setShowPromptHistory(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-400 text-sm mb-4">Here are all the prompts used for this visualization. Each new version builds upon the previous ones.</p>
              <ul className="space-y-3">
                {activeGeneration.versions.map((version, index) => (
                  <li key={index} className="border border-gray-800 rounded p-3">
                    <div className="flex justify-between">
                      <span className="text-xs text-purple-400 font-medium">Version {index + 1}</span>
                      <span className="text-xs text-gray-500">{version.createdAt.toLocaleString()}</span>
                    </div>
                    <p className="text-white mt-1">{version.prompt}</p>
                    {version.description && index > 0 && (
                      <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs text-gray-300">
                        <p className="font-medium text-gray-400 mb-1">Changes made in this version:</p>
                        <p>{version.description}</p>
                      </div>
                    )}
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setUpdatePrompt(version.prompt);
                          setShowPromptHistory(false);
                        }}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                          <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                        </svg>
                        Use as starting point
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 border-t border-gray-800">
              <button
                onClick={() => setShowPromptHistory(false)} 
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
