import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GitFork, ScatterChart } from 'lucide-react';
import { AnalysisResult } from '../types/analysis';
import {
  buildVariableGraphData,
  VariableNode,
  VariableTypeFamily,
} from '../utils/variableGraph';

interface VariableVisualizerProps {
  analysis: AnalysisResult;
  darkMode: boolean;
}

type ChartKind = 'scatter' | 'graph';

const TYPE_FAMILY_META: Record<
  VariableTypeFamily,
  { label: string; lightColor: string; darkColor: string }
> = {
  numeric: {
    label: 'Numeric / Real',
    lightColor: '#0f766e',
    darkColor: '#2dd4bf',
  },
  discrete: {
    label: 'Discrete / Integer / Bool',
    lightColor: '#0284c7',
    darkColor: '#38bdf8',
  },
  text_collection: {
    label: 'String / Schema / Date',
    lightColor: '#d97706',
    darkColor: '#fbbf24',
  },
  constraint_other: {
    label: 'Operator / Symbol',
    lightColor: '#7c3aed',
    darkColor: '#a78bfa',
  },
};

interface SimNode extends d3.SimulationNodeDatum, VariableNode {}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
  contexts: string[];
}

export const VariableVisualizer: React.FC<VariableVisualizerProps> = ({
  analysis,
  darkMode,
}) => {
  const graphData = useMemo(() => buildVariableGraphData(analysis), [analysis]);

  const [chartKind, setChartKind] = useState<ChartKind>(() =>
    graphData.links.length > 0 ? 'graph' : 'scatter'
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    graphData.nodes[0]?.id ?? null
  );
  const [hoveredInfo, setHoveredInfo] = useState<{
    node: VariableNode;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(640);

  useEffect(() => {
    setSelectedNodeId(graphData.nodes[0]?.id ?? null);
    setHoveredInfo(null);
  }, [analysis.id, graphData.nodes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const selectedNode = useMemo(
    () => graphData.nodes.find((n) => n.id === selectedNodeId) ?? graphData.nodes[0] ?? null,
    [graphData.nodes, selectedNodeId]
  );

  // D3 rendering for Scatter Plot & Force-Directed Dependency Graph
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || graphData.nodes.length === 0) return;

    const width = Math.max(340, containerWidth);
    const height = 340;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const gridColor = darkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.09)';
    const axisColor = darkMode ? '#64748b' : '#94a3b8';
    const textColor = darkMode ? '#cbd5e1' : '#334155';
    const mutedTextColor = darkMode ? '#94a3b8' : '#64748b';
    const linkColor = darkMode ? 'rgba(45, 212, 191, 0.35)' : 'rgba(15, 118, 110, 0.28)';
    const issueRingColor = darkMode ? '#f87171' : '#dc2626';

    const getColor = (family: VariableTypeFamily) =>
      darkMode ? TYPE_FAMILY_META[family].darkColor : TYPE_FAMILY_META[family].lightColor;

    if (chartKind === 'scatter') {
      const margin = { top: 24, right: 28, bottom: 48, left: 54 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const maxX = Math.max(4, d3.max(graphData.scatterPoints, (d) => d.x) ?? 4);
      const maxY = Math.max(3, d3.max(graphData.scatterPoints, (d) => d.y) ?? 3);

      const xScale = d3
        .scaleLinear()
        .domain([0, maxX + 1])
        .range([0, innerW])
        .nice();

      const yScale = d3
        .scaleLinear()
        .domain([0, maxY + 1])
        .range([innerH, 0])
        .nice();

      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Grid lines
      g.append('g')
        .attr('class', 'grid-x')
        .attr('transform', `translate(0,${innerH})`)
        .call(
          d3
            .axisBottom(xScale)
            .ticks(Math.min(8, maxX + 1))
            .tickSize(-innerH)
            .tickFormat(() => '')
        )
        .call((sel) => sel.select('.domain').remove())
        .call((sel) =>
          sel
            .selectAll('.tick line')
            .attr('stroke', gridColor)
            .attr('stroke-dasharray', '3,3')
        );

      g.append('g')
        .attr('class', 'grid-y')
        .call(
          d3
            .axisLeft(yScale)
            .ticks(Math.min(6, maxY + 1))
            .tickSize(-innerW)
            .tickFormat(() => '')
        )
        .call((sel) => sel.select('.domain').remove())
        .call((sel) =>
          sel
            .selectAll('.tick line')
            .attr('stroke', gridColor)
            .attr('stroke-dasharray', '3,3')
        );

      // Axes
      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(Math.min(8, maxX + 1)).tickFormat(d3.format('d')))
        .call((sel) => sel.select('.domain').attr('stroke', axisColor))
        .call((sel) => sel.selectAll('.tick line').attr('stroke', axisColor))
        .call((sel) =>
          sel
            .selectAll('.tick text')
            .attr('fill', mutedTextColor)
            .style('font-family', 'JetBrains Mono, monospace')
            .style('font-size', '11px')
        );

      g.append('g')
        .call(d3.axisLeft(yScale).ticks(Math.min(6, maxY + 1)).tickFormat(d3.format('d')))
        .call((sel) => sel.select('.domain').attr('stroke', axisColor))
        .call((sel) => sel.selectAll('.tick line').attr('stroke', axisColor))
        .call((sel) =>
          sel
            .selectAll('.tick text')
            .attr('fill', mutedTextColor)
            .style('font-family', 'JetBrains Mono, monospace')
            .style('font-size', '11px')
        );

      // Axis labels
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 38)
        .attr('text-anchor', 'middle')
        .attr('fill', mutedTextColor)
        .style('font-size', '11px')
        .text(graphData.xAxisLabel);

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -38)
        .attr('text-anchor', 'middle')
        .attr('fill', mutedTextColor)
        .style('font-size', '11px')
        .text(graphData.yAxisLabel);

      // Jitter overlapping coordinates deterministically so co-located variables stay distinct
      const coordBuckets = new Map<string, number>();
      const positionedPoints = graphData.scatterPoints.map((pt) => {
        const key = `${pt.x}_${pt.y}`;
        const seen = coordBuckets.get(key) ?? 0;
        coordBuckets.set(key, seen + 1);
        const angle = seen * 2.1;
        const radius = seen === 0 ? 0 : 10 + Math.floor(seen / 4) * 8;
        return {
          ...pt,
          cx: xScale(pt.x) + Math.cos(angle) * radius,
          cy: yScale(pt.y) + Math.sin(angle) * radius,
        };
      });

      const pointGroups = g
        .selectAll('.scatter-point')
        .data(positionedPoints)
        .enter()
        .append('g')
        .attr('class', 'scatter-point')
        .attr('transform', (d) => `translate(${d.cx},${d.cy})`)
        .style('cursor', 'pointer')
        .on('mouseenter', (_event, d) => {
          const matching = graphData.nodes.find((n) => n.id === d.id);
          if (matching) {
            setHoveredInfo({
              node: matching,
              x: d.cx + margin.left,
              y: d.cy + margin.top,
            });
          }
        })
        .on('mouseleave', () => setHoveredInfo(null))
        .on('click', (_event, d) => {
          setSelectedNodeId(d.id);
        });

      // Issue outer ring if variable is flagged in an error
      pointGroups
        .filter((d) => d.hasIssue)
        .append('circle')
        .attr('r', 12)
        .attr('fill', 'none')
        .attr('stroke', issueRingColor)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,2');

      pointGroups
        .append('circle')
        .attr('r', (d) => (d.id === selectedNodeId ? 8.5 : 6.5))
        .attr('fill', (d) => getColor(d.typeFamily))
        .attr('stroke', darkMode ? '#0e151e' : '#ffffff')
        .attr('stroke-width', 2);

      pointGroups
        .append('text')
        .attr('x', 11)
        .attr('y', 4)
        .attr('fill', textColor)
        .style('font-family', 'Source Serif 4, Georgia, serif')
        .style('font-style', 'italic')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .text((d) => d.symbol);

      return;
    }

    // Force-Directed Variable Dependency Graph
    const nodes: SimNode[] = graphData.nodes.map((n) => ({ ...n }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = graphData.links
      .map((l) => ({
        source: nodeById.get(l.source) ?? l.source,
        target: nodeById.get(l.target) ?? l.target,
        weight: l.weight,
        contexts: l.contexts,
      }))
      .filter((l) => typeof l.source !== 'string' && typeof l.target !== 'string');

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(105)
      )
      .force('charge', d3.forceManyBody().strength(-240))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<SimNode>().radius(34));

    const linkSelection = svg
      .append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', linkColor)
      .attr('stroke-width', (d) => Math.min(4, 1.2 + d.weight * 0.7));

    const nodeGroup = svg
      .append('g')
      .selectAll('.graph-node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'graph-node')
      .style('cursor', 'grab')
      .on('mouseenter', (_event, d) => {
        setHoveredInfo({
          node: d,
          x: d.x ?? width / 2,
          y: d.y ?? height / 2,
        });
      })
      .on('mouseleave', () => setHoveredInfo(null))
      .on('click', (_event, d) => {
        setSelectedNodeId(d.id);
      });

    // Issue halo ring
    nodeGroup
      .filter((d) => d.hasIssue)
      .append('circle')
      .attr('r', 22)
      .attr('fill', 'none')
      .attr('stroke', issueRingColor)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,2');

    nodeGroup
      .append('circle')
      .attr('r', (d) => Math.min(20, 13 + d.mentions))
      .attr('fill', (d) => getColor(d.typeFamily))
      .attr('fill-opacity', (d) => (d.id === selectedNodeId ? 0.95 : 0.82))
      .attr('stroke', (d) =>
        d.id === selectedNodeId ? (darkMode ? '#f8fafc' : '#0f172a') : darkMode ? '#0e151e' : '#ffffff'
      )
      .attr('stroke-width', (d) => (d.id === selectedNodeId ? 2.5 : 1.5));

    nodeGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', darkMode ? '#090e14' : '#ffffff')
      .style('font-family', 'Source Serif 4, Georgia, serif')
      .style('font-style', 'italic')
      .style('font-size', (d) => (d.symbol.length > 5 ? '10px' : '12px'))
      .style('font-weight', '700')
      .style('pointer-events', 'none')
      .text((d) => (d.symbol.length > 9 ? `${d.symbol.slice(0, 8)}…` : d.symbol));

    nodeGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '2.35em')
      .attr('fill', mutedTextColor)
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '10px')
      .style('pointer-events', 'none')
      .text((d) => (d.dataType.length > 16 ? `${d.dataType.slice(0, 15)}…` : d.dataType));

    const dragBehavior = d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = Math.max(28, Math.min(width - 28, event.x));
        d.fy = Math.max(28, Math.min(height - 28, event.y));
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(dragBehavior);

    simulation.on('tick', () => {
      nodes.forEach((d) => {
        d.x = Math.max(30, Math.min(width - 30, d.x ?? width / 2));
        d.y = Math.max(30, Math.min(height - 34, d.y ?? height / 2));
      });

      linkSelection
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [chartKind, containerWidth, darkMode, graphData, selectedNodeId]);

  if (graphData.nodes.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
        No variables or symbols were declared in this inspection result to visualize.
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090e14]/90">
      {/* Visualization Header Bar */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-0.5 bg-white dark:bg-[#111923] border border-slate-200 dark:border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setChartKind('graph')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              chartKind === 'graph'
                ? 'bg-teal-700 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Dependency Graph</span>
          </button>
          <button
            type="button"
            onClick={() => setChartKind('scatter')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              chartKind === 'scatter'
                ? 'bg-teal-700 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ScatterChart className="w-3.5 h-3.5" />
            <span>Scatter Plot</span>
          </button>
        </div>

        {/* Clean Typographic Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
          {(['numeric', 'discrete', 'text_collection', 'constraint_other'] as const).map((fam) => (
            <span key={fam} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{
                  backgroundColor: darkMode
                    ? TYPE_FAMILY_META[fam].darkColor
                    : TYPE_FAMILY_META[fam].lightColor,
                }}
              />
              <span>{TYPE_FAMILY_META[fam].label}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full inline-block border border-dashed border-red-500" />
            <span>Flagged in Issue</span>
          </span>
        </div>
      </div>

      {/* Interactive D3 SVG Canvas */}
      <div ref={containerRef} className="relative w-full h-[340px] select-none overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full block"
          role="img"
          aria-label={
            chartKind === 'graph'
              ? 'D3 force-directed graph of identified variables and their relationships'
              : 'D3 scatter plot of identified variables by references and constraints'
          }
        />

        {hoveredInfo && (
          <div
            className="pointer-events-none absolute z-10 max-w-[240px] p-2.5 rounded-lg bg-white/95 dark:bg-[#111923]/95 border border-slate-200 dark:border-slate-700 shadow-lg text-xs"
            style={{
              left: Math.min(Math.max(12, hoveredInfo.x + 14), Math.max(12, containerWidth - 252)),
              top: Math.min(Math.max(12, hoveredInfo.y - 16), 235),
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-math-serif italic font-semibold text-sm text-teal-700 dark:text-teal-400">
                {hoveredInfo.node.symbol}
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {hoveredInfo.node.dataType}
              </span>
            </div>
            <p className="mt-1 text-slate-700 dark:text-slate-300 line-clamp-2">
              {hoveredInfo.node.role}
            </p>
            <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              <span>{hoveredInfo.node.mentions} refs</span>
              <span aria-hidden="true">·</span>
              <span>{hoveredInfo.node.constraintCount} constraints</span>
              {hoveredInfo.node.hasIssue && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">Issue</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Variable Inspector Strip */}
      {selectedNode && (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0e151e]/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="font-math-serif italic text-sm font-semibold text-teal-700 dark:text-teal-400">
              {selectedNode.symbol}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="font-mono text-slate-800 dark:text-slate-200">
              {selectedNode.dataType}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-slate-600 dark:text-slate-300 truncate max-w-md">
              {selectedNode.role}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0">
            <span>Constraint: {selectedNode.domainConstraint}</span>
          </div>
        </div>
      )}
    </div>
  );
};
