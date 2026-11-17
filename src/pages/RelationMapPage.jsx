import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRelationGraph } from '../services/api';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

const EDGE_COLORS = {
  alianca: '#ff6166',
  rivalidade: '#e5484d',
  neutralidade: '#5c6270',
};

const EDGE_LABELS = {
  alianca: 'Aliança',
  rivalidade: 'Rivalidade',
  neutralidade: 'Neutralidade',
};

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export default function RelationMapPage() {
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState('');
  const [nodes, setNodes] = useState([]);
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  useEffect(() => {
    fetchRelationGraph().then(setGraph).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const update = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: Math.max(container.clientWidth, 500),
          height: Math.max(container.clientHeight, 400),
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [graph]);

  useEffect(() => {
    if (!graph) return undefined;

    const simulationNodes = graph.nodes.map((node) => ({
      ...node,
      radius: 30,
    }));

    const simulationLinks = graph.edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    }));

    const simulation = forceSimulation(simulationNodes)
      .force('link', forceLink(simulationLinks).id((node) => node.id).distance(160).strength(0.35))
      .force('charge', forceManyBody().strength(-350))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collide', forceCollide().radius((node) => node.radius + 12));

    simulation.on('tick', () => {
      setNodes([...simulationNodes]);
    });

    return () => simulation.stop();
  }, [graph, dimensions.width, dimensions.height]);

  const edges = graph?.edges || [];

  const positionMap = useMemo(() => {
    const map = new Map();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  if (error) return <div className="notification notification--error">{error}</div>;
  if (!graph) return <div className="loading"><div className="spinner" />Montando grafo...</div>;

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Mapa de Relações</h1>
          <p>Rede vigente entre as famílias — {graph.nodes.length} nó(s), {edges.length} conexão(ões)</p>
        </div>
      </div>

      {graph.nodes.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <h3>Nenhuma família cadastrada</h3>
            <p>Cadastre famílias e registre relações para visualizar a rede investigativa.</p>
            <Link to="/familias/nova" className="button button--primary">Cadastrar família</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="filter-bar" style={{ gap: 16 }}>
            {Object.entries(EDGE_LABELS).map(([key, label]) => (
              <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <span style={{ width: 22, height: 3, borderRadius: 2, background: EDGE_COLORS[key], display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>

          <div className="panel" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={Math.max(520, dimensions.height)}
              style={{ display: 'block', background: 'radial-gradient(ellipse at center, rgba(229,72,77,0.04), transparent 70%)' }}
            >
              {edges.map((edge) => {
                const source = positionMap.get(edge.source);
                const target = positionMap.get(edge.target);
                if (!source || !target) return null;
                const isHighlighted = !hovered || hovered === edge.source || hovered === edge.target;
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                return (
                  <g key={edge.id} opacity={isHighlighted ? 1 : 0.15}>
                    <line
                      x1={source.x} y1={source.y}
                      x2={target.x} y2={target.y}
                      stroke={EDGE_COLORS[edge.type] || '#5c6270'}
                      strokeWidth={edge.type === 'rivalidade' ? 2.5 : 2}
                      strokeDasharray={edge.type === 'neutralidade' ? '6 5' : 'none'}
                    />
                    <text
                      x={midX} y={midY - 6}
                      textAnchor="middle"
                      fill={EDGE_COLORS[edge.type] || '#5c6270'}
                      style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}
                    >
                      {EDGE_LABELS[edge.type]}
                    </text>
                  </g>
                );
              })}

              {nodes.map((node) => {
                const isHighlighted = !hovered || hovered === node.id ||
                  edges.some((edge) =>
                    (edge.source === hovered && edge.target === node.id) ||
                    (edge.target === hovered && edge.source === node.id));
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    opacity={isHighlighted ? 1 : 0.25}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle r={30} fill="#12151c" stroke={node.status === 'ativa' ? '#e5484d' : '#5c6270'} strokeWidth={2} />
                    <text textAnchor="middle" dy="4" fill="#eceef2" style={{ fontSize: 13, fontWeight: 700 }}>
                      {initials(node.name)}
                    </text>
                    <text textAnchor="middle" y={46} fill="#8f95a3" style={{ fontSize: 11.5 }}>
                      {node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panel__title">Legenda de famílias</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {graph.nodes.map((node) => (
                <Link key={node.id} to={`/familias/${node.id}`} className="family-card" style={{ padding: '10px 14px', flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: node.status === 'ativa' ? 'var(--accent)' : 'var(--text-muted)',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{node.name}</span>
                  <span className="mono" style={{ marginLeft: 'auto' }}>{node.member_count}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
