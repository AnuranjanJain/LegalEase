import { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { api } from '../services/api';

interface EntityGraphProps {
  documentText?: string;
}

export function EntityGraph({ documentText }: EntityGraphProps) {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const fetchGraph = async () => {
      if (!documentText) return;
      setIsLoading(true);
      try {
        const response = await api.post('/api/legal/extract-entities', { text: documentText }) as { nodes: any[]; links: any[] };
        setGraphData(response);
      } catch (error) {
        console.error('Failed to extract entities for graph', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGraph();
  }, [documentText]);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: 400
      });
    }
  }, [containerRef]);

  const getNodeColor = useCallback((node: any) => {
    switch (node.type) {
      case 'party': return '#3b82f6'; // blue
      case 'jurisdiction': return '#f59e0b'; // amber
      case 'date': return '#10b981'; // emerald
      case 'obligation': return '#8b5cf6'; // violet
      default: return '#9ca3af'; // gray
    }
  }, []);

  if (!documentText) return null;

  return (
    <div className="pt-6 border-t border-gray-150 dark:border-gray-850 space-y-4">
      <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
        Knowledge Graph
      </h4>
      <div 
        ref={containerRef} 
        className="w-full h-[400px] bg-gray-50 dark:bg-gray-950/50 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 relative"
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : graphData.nodes.length > 0 ? (
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel="label"
            nodeColor={getNodeColor}
            nodeRelSize={6}
            linkColor={() => '#9ca3af'}
            linkWidth={1}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.4}
            cooldownTicks={100}
            backgroundColor="transparent"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            No entities detected in this document section.
          </div>
        )}
      </div>
    </div>
  );
}
