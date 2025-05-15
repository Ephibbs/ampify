# Ampify: AI Music Visualizer

A Next.js application that uses AI to generate custom WebGL shaders that visualize music in real-time.

Voted 3rd most creative out of 30 projects at a Sentry All Things Web Hackathon!

![Hackathon Results](https://github.com/ssaanndwich/ampify/blob/main/public/sentryhackathon.jpg)

## Features

- Real-time audio visualization using WebGL shaders
- Generate custom visualizations using natural language prompts
- Support for microphone and screen audio input
- Dynamic animation that responds to audio frequency data
- Secure server-side OpenAI API calls using Next.js server actions and API routes

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key

## Getting Started

1. Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd music_visualizer_ai
npm install
```

2. Set up your environment variables:

Create a `.env.local` file in the root directory with your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## How to Use

1. **Start Audio Input**: Click either "Use Microphone" or "Use Screen Audio" to begin capturing audio.
2. **Create a Prompt**: Enter a description of the visualization you want, or select from the example prompts.
3. **Generate Visualization**: Click "Generate Visualization" to create your custom shader.
4. **Enjoy the Show**: Watch as the visualization responds to your music or audio input!

## Implementation Details

The application uses a dual approach for OpenAI API integration:

1. **Server Actions**: The primary method for calling the OpenAI API securely from the server side
2. **API Routes**: A fallback method if server actions fail or are not supported

Both approaches keep your API key secure by performing the API calls on the server rather than exposing credentials to the client.

## Technologies Used

- Next.js with Server Actions and API Routes
- TypeScript
- Three.js with React Three Fiber
- Web Audio API
- OpenAI API
- TailwindCSS
- dotenv for environment variables

## License

MIT
