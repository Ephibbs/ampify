'use server';

import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface ComponentResponse {
  componentCode: string;
  description: string;
}

export async function generateComponent(formData: FormData | string): Promise<ComponentResponse> {
  try {
    // Extract prompt from FormData if needed
    const prompt = typeof formData === 'string' 
      ? formData 
      : formData.get('prompt') as string;
    
    console.log(`[Server Action] Generating component for prompt: "${prompt}"`);
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are an expert in creative coding and audio visualization. Your task is to create dynamic, audio-reactive visualizations using either HTML5 Canvas or Three.js.

Important Guidelines for Audio-Reactive Visualization Code:
1. Choose the appropriate technology for the visualization:
   - Use HTML5 Canvas (2D) for simpler, flat visualizations 
   - Use Three.js (3D) for more complex, spatial visualizations
2. SPECIFY at the start of your code whether it's for Canvas or Three.js with a comment: "// MODE: CANVAS" or "// MODE: THREE.JS"
3. Your code will be executed for EACH FRAME of animation with these available parameters:
   - canvas: The HTML Canvas element
   - ctx: The 2D rendering context (canvas.getContext('2d')) - for Canvas mode only
   - audioData: Uint8Array of time-domain audio data (waveform) with values 0-255
   - frequencyData: Uint8Array of frequency-domain audio data (spectrum) with values 0-255
   - isAudioActive: Boolean indicating if audio is currently being captured
   - time: Current time in seconds (useful for animations)

FOR CANVAS MODE:
- Pure JavaScript code for HTML5 Canvas with 2D context
- Do not include frame loops - your code runs once per frame
- Canvas is automatically cleared between frames

FOR THREE.JS MODE:
- Include special comments to set up scene, camera, and lighting
- Use the THREE global variable to access Three.js functionality
- You can declare material/geometry variables and reuse them
- Do not create the renderer, scene, or camera - they're already set up
- Focus on updating objects, materials and animations each frame

Audio Visualization Strategies:
- Use frequencyData to visualize the frequency spectrum (bass, mid, treble)
- Each array index represents a frequency band (0=low/bass, higher=treble)
- Map frequency values to visual properties like size, color, position
- Add subtle continuous motion even when audio is quiet using the time parameter

CANVAS Example:
\`\`\`javascript
// MODE: CANVAS
// Always check if audio is active first
if (!isAudioActive || !frequencyData) {
  // Draw a standby visualization when no audio
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Waiting for audio...', canvas.width/2, canvas.height/2);
  return;
}

// Calculate audio reactivity values
const bassValue = frequencyData.slice(0, 5).reduce((sum, val) => sum + val, 0) / (5 * 255);
const midValue = frequencyData.slice(10, 20).reduce((sum, val) => sum + val, 0) / (10 * 255);
const trebleValue = frequencyData.slice(30, 40).reduce((sum, val) => sum + val, 0) / (10 * 255);

// Use these values to drive your visualization
const bassSize = 50 + bassValue * 100;
const midHue = (time * 20 + midValue * 180) % 360;

// Draw circular visualizer
ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
ctx.fillRect(0, 0, canvas.width, canvas.height);

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

// Draw frequency bars in a circle
const barCount = Math.min(frequencyData.length, 64);
for (let i = 0; i < barCount; i++) {
  const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
  const value = frequencyData[i] / 255;
  
  // Calculate bar properties
  const minRadius = Math.min(canvas.width, canvas.height) * 0.2;
  const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;
  const barLength = minRadius + value * (maxRadius - minRadius);
  
  // Calculate bar position
  const x1 = centerX + Math.cos(angle) * minRadius;
  const y1 = centerY + Math.sin(angle) * minRadius;
  const x2 = centerX + Math.cos(angle) * (minRadius + barLength);
  const y2 = centerY + Math.sin(angle) * (minRadius + barLength);
  
  // Draw the bar
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = \`hsl(\${(i / barCount * 360 + time * 30) % 360}, \${50 + value * 50}%, \${40 + value * 60}%)\`;
  ctx.stroke();
}

// Add a pulsing circle based on bass
ctx.beginPath();
ctx.arc(centerX, centerY, bassSize, 0, Math.PI * 2);
ctx.fillStyle = \`hsla(\${midHue}, 80%, 60%, \${bassValue * 0.5 + 0.2})\`;
ctx.fill();
\`\`\`

THREE.JS Example:
\`\`\`javascript
// MODE: THREE.JS
// INIT: Create objects on first run
if (!window.objects) {
  window.objects = {
    bars: [],
    materials: []
  };
  
  // Create a grid of cubes
  const gridSize = 16;
  const spacing = 1.2;
  
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(Math.random(), Math.random(), Math.random()),
        emissive: new THREE.Color(0.2, 0.2, 0.2),
        metalness: 0.3,
        roughness: 0.4
      });
      
      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(
        (x - gridSize/2) * spacing, 
        0, 
        (z - gridSize/2) * spacing
      );
      
      scene.add(cube);
      window.objects.bars.push(cube);
      window.objects.materials.push(material);
    }
  }
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(0x333333);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7);
  scene.add(directionalLight);
  
  // Add a center sphere
  const sphereGeometry = new THREE.SphereGeometry(3, 32, 32);
  const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x222222,
    transparent: true,
    opacity: 0.7
  });
  window.objects.sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  scene.add(window.objects.sphere);
  
  // Position camera
  camera.position.set(0, 15, 25);
  camera.lookAt(0, 0, 0);
}

// Handle no audio case
if (!isAudioActive || !frequencyData) {
  // Subtle animation when no audio
  window.objects.bars.forEach((cube, i) => {
    cube.rotation.y = time * 0.1;
    cube.position.y = Math.sin(time * 0.5 + i * 0.1) * 0.5;
  });
  window.objects.sphere.scale.set(1, 1, 1);
  return;
}

// Calculate audio reactivity values
const bassValue = frequencyData.slice(0, 5).reduce((sum, val) => sum + val, 0) / (5 * 255);
const midValue = frequencyData.slice(10, 20).reduce((sum, val) => sum + val, 0) / (10 * 255);
const trebleValue = frequencyData.slice(30, 40).reduce((sum, val) => sum + val, 0) / (10 * 255);

// Update center sphere
window.objects.sphere.scale.set(
  1 + bassValue * 2,
  1 + bassValue * 2,
  1 + bassValue * 2
);
window.objects.sphere.material.emissiveIntensity = bassValue;
window.objects.sphere.rotation.y = time * 0.2;
window.objects.sphere.rotation.z = time * 0.1;

// Update cubes based on frequency data
window.objects.bars.forEach((cube, i) => {
  const freqIndex = i % frequencyData.length;
  const value = frequencyData[freqIndex] / 255;
  
  // Update height based on frequency
  cube.scale.y = 0.1 + value * 5;
  cube.position.y = cube.scale.y / 2;
  
  // Update rotation
  cube.rotation.x = time * 0.1;
  cube.rotation.y = time * 0.2 + i * 0.01;
  
  // Update color based on frequency band
  const hue = (freqIndex / frequencyData.length) * 360 + time * 10;
  const material = window.objects.materials[i];
  material.color.setHSL(hue / 360, 0.7, 0.5 + value * 0.5);
  material.emissiveIntensity = value * 0.5;
});

// Rotate camera around the scene
camera.position.x = Math.sin(time * 0.1) * (20 + bassValue * 5);
camera.position.z = Math.cos(time * 0.1) * (20 + bassValue * 5);
camera.lookAt(0, 0, 0);
\`\`\`

Choose the technology that best suits the visualization request. Make your visualization visually appealing and highly responsive to audio input.`
        },
        {
          role: "user",
          content: `Create an audio-reactive visualization based on this prompt: "${prompt}".

Return a JSON object with two properties:
- componentCode (string): JavaScript code for a Canvas or Three.js visualization
- description (string): A brief description of the visualization and how it works

Choose the best technology for your visualization:
1. For 2D visualizations: Use Canvas mode with direct 2D drawing
2. For 3D visualizations: Use Three.js mode for more complex spatial effects

Guidelines for your code:
- Begin with "// MODE: CANVAS" or "// MODE: THREE.JS" to specify which mode to use
- Your code runs once per animation frame with these variables:
  - canvas: The HTML canvas element
  - ctx: The 2D rendering context (Canvas mode only)
  - audioData: Uint8Array of time-domain audio data (waveform)
  - frequencyData: Uint8Array of frequency-domain audio data (spectrum)
  - isAudioActive: Boolean indicating if audio is active
  - time: Current time in seconds
- For THREE.JS mode, you'll have access to scene, camera, and THREE global variables

Make your visualization highly responsive to music by using:
- Bass frequencies (indices 0-10 in frequencyData)
- Mid-range frequencies (indices 10-30)
- Treble/high frequencies (indices 30+)
- Continuous animation with the time parameter

Create something visually stunning that reacts dramatically to audio input and looks beautiful even when audio is quiet.`
        }
      ],
    //   temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || '{}';
    console.log(`[Server Action] Received response from OpenAI: ${content.substring(0, 50)}...`, content.substring(0, 50));
    
    const result = JSON.parse(content);
    
    // Create a well-formed response object
    const componentResponse: ComponentResponse = {
      componentCode: result.componentCode || '',
      description: result.description || ''
    };
    
    console.log('[Server Action] Component generated successfully', componentResponse);
    
    return componentResponse;
  } catch (err) {
    console.error('[Server Action] Error generating component:', err);
    // Return a default component response on error
    return {
      componentCode: `
// MODE: CANVAS
// Clear canvas background
ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Create a default visualization when there's an error
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = Math.min(centerX, centerY) * 0.5;

// Draw a pulsing circle
ctx.beginPath();
ctx.arc(centerX, centerY, radius * (0.8 + Math.sin(time) * 0.2), 0, Math.PI * 2);
ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
ctx.fill();

// Add error text
ctx.fillStyle = 'white';
ctx.font = '16px Arial';
ctx.textAlign = 'center';
ctx.fillText('Error generating visualization', centerX, centerY);
      `,
      description: "Error occurred while generating your visualization. This is a fallback component."
    };
  }
} 