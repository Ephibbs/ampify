'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface ShaderVisualizerProps {
  fragmentShader: string;
  vertexShader: string;
  analyserNode: AnalyserNode | null;
}

const ShaderVisualizer: React.FC<ShaderVisualizerProps> = ({
  fragmentShader,
  vertexShader,
  analyserNode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const timeDataArrayRef = useRef<Uint8Array | null>(null);
  const freqDataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyserNode) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(window.devicePixelRatio);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    cameraRef.current = camera;
    camera.position.z = 1;

    const scene = new THREE.Scene();

    // Setup audio data buffers
    timeDataArrayRef.current = new Uint8Array(analyserNode.fftSize);
    freqDataArrayRef.current = new Uint8Array(analyserNode.frequencyBinCount);

    // Uniforms
    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2() },
      u_audio_freq: { value: new Float32Array(analyserNode.frequencyBinCount).fill(0) },
      u_audio_time: { value: new Float32Array(analyserNode.fftSize).fill(0) },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
    });

    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    const handleResize = () => {
      if (!canvas || !renderer || !camera) return;
      const parent = canvas.parentElement;
      if (!parent) return;

      const width = parent.clientWidth;
      const height = parent.clientHeight;

      canvas.width = width;
      canvas.height = height;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      uniforms.u_resolution.value.set(width, height);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size setup

    const animate = (time: number) => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      if (analyserNode && timeDataArrayRef.current && freqDataArrayRef.current) {
        analyserNode.getByteFrequencyData(freqDataArrayRef.current);
        analyserNode.getByteTimeDomainData(timeDataArrayRef.current);

        // Normalize and update uniforms
        for (let i = 0; i < analyserNode.frequencyBinCount; i++) {
          uniforms.u_audio_freq.value[i] = (freqDataArrayRef.current[i] / 255.0);
        }
        for (let i = 0; i < analyserNode.fftSize; i++) {
          uniforms.u_audio_time.value[i] = (timeDataArrayRef.current[i] / 128.0) - 1.0; // Normalize to -1 to 1
        }
      }

      uniforms.u_time.value = time * 0.001; // Convert ms to seconds
      renderer.render(scene, camera);
    };

    animate(0);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      renderer.dispose();
    };
  }, [fragmentShader, vertexShader, analyserNode]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full block absolute inset-0" // Ensure canvas fills container and uses absolute positioning
    />
  );
};

export default ShaderVisualizer; 