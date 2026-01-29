import VideoFeed from './components/VideoFeed';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-cyan-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold text-white text-center mb-8">
          🧠 NeuralStride
        </h1>
        <p className="text-xl text-gray-300 text-center mb-12">
          Adaptive Cognitive & Ergonomic Workspace
        </p>
        
        <VideoFeed />
      </div>
    </main>
  );
}