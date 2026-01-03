import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Skeleton } from '../../ui/skeleton';
import { Button } from '../../ui/button';
import { useTasteGravity, TimeRange } from '../../../hooks/useTasteGravity';
import type { TasteGravityNode, TasteGravityLink } from '../../../types/analytics';
import TasteGravityLegend from './TasteGravityLegend';

// Vibrant Magenta + Electric Cyan color palette (unique to Taste Gravity)
const palette = {
  nodeMagenta: '#E879F9', // Bright magenta for nodes
  nodeMagentaRgba: 'rgba(232, 121, 249, 0.3)',
  linkCyan: 'rgba(6, 182, 212, 0.4)', // Much brighter cyan for links (was 0.14)
  linkCyanHover: 'rgba(6, 182, 212, 0.7)', // Brighter on hover
  linkCyanStrong: 'rgba(6, 182, 212, 0.8)', // Very bright for strong connections
  selectedPink: '#F472B6', // Keep pink for selection
  selectedPinkRgba: 'rgba(244, 114, 182, 0.5)',
  hoverCyan: 'rgba(6, 182, 212, 0.9)', // Bright cyan on hover
  text: '#E5E7EB',
  textMuted: 'rgba(229, 231, 235, 0.7)',
  nodeRing: 'rgba(232, 121, 249, 0.7)', // Brighter magenta ring
};

interface TasteGravityProps {
  groupId: string;
  timeRange: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
}

export default function TasteGravity({ groupId, timeRange, onTimeRangeChange }: TasteGravityProps) {
  const { data, isLoading, error } = useTasteGravity(groupId, timeRange);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null);
  const nodesRef = useRef<d3.Selection<SVGGElement, TasteGravityNode, SVGGElement, unknown> | null>(null);
  const linksRef = useRef<d3.Selection<SVGLineElement, TasteGravityLink, SVGGElement, unknown> | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Initialize D3 simulation
  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const svgElement = svgRef.current;
    
    // Get dimensions from parent container or use defaults
    const parentContainer = svgElement.parentElement;
    const width = parentContainer?.clientWidth || svgElement.clientWidth || 800;
    const height = parentContainer?.clientHeight || svgElement.clientHeight || 600;
    
    // Add padding to viewBox to ensure edges are visible
    const viewBoxPadding = 50;
    const viewBoxWidth = width + viewBoxPadding * 2;
    const viewBoxHeight = height + viewBoxPadding * 2;

    // Set explicit width/height and viewBox for proper scaling
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `${-viewBoxPadding} ${-viewBoxPadding} ${viewBoxWidth} ${viewBoxHeight}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Clear previous simulation
    svg.selectAll('*').remove();

    // Initialize node positions within bounds (with padding)
    // Account for viewBox padding in positioning
    const padding = 50;
    const nodes = data.nodes.map((node: any) => ({
      ...node,
      x: width / 2 + (Math.random() - 0.5) * (width - padding * 2),
      y: height / 2 + (Math.random() - 0.5) * (height - padding * 2),
      vx: 0,
      vy: 0
    }));

    // Create force simulation
    const simulation = d3
      .forceSimulation<TasteGravityNode>(nodes as any)
      .force(
        'link',
        d3
          .forceLink<TasteGravityNode, TasteGravityLink>(data.links)
          .id((d: any) => d.id)
          .distance((d: any) => 150 * (1 - d.gravity))
          .strength((d: any) => d.gravity)
      )
      .force(
        'charge',
        d3.forceManyBody<TasteGravityNode>().strength((d: any) => -200 * (d.mass || 0.5))
      )
      .force(
        'collision',
        d3.forceCollide<TasteGravityNode>().radius((d: any) => 12 + (d.mass || 0.5) * 8)
      )
      .force('center', d3.forceCenter(width / 2, height / 2));

    simulationRef.current = simulation;

    // Store nodes array for boundary constraint
    const nodesData = nodes;

    // Create container for links and nodes
    const container = svg.append('g');

    // Add filters for nodes
    const defs = svg.append('defs');
    
    // Subtle shadow filter for default nodes
    const defaultShadowFilter = defs
      .append('filter')
      .attr('id', 'defaultShadow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    defaultShadowFilter
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'shadow');
    
    defaultShadowFilter
      .append('feOffset')
      .attr('in', 'shadow')
      .attr('dx', '0')
      .attr('dy', '0')
      .attr('result', 'offset');
    
    defaultShadowFilter
      .append('feFlood')
      .attr('flood-color', 'rgba(0,0,0,0.6)')
      .attr('flood-opacity', '1')
      .attr('result', 'flood');
    
    defaultShadowFilter
      .append('feComposite')
      .attr('in', 'flood')
      .attr('in2', 'offset')
      .attr('operator', 'in')
      .attr('result', 'shadowColor');
    
    const defaultFeMerge = defaultShadowFilter.append('feMerge');
    defaultFeMerge.append('feMergeNode').attr('in', 'shadowColor');
    defaultFeMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Strong electric cyan glow for selected nodes
    const selectedGlowFilter = defs
      .append('filter')
      .attr('id', 'selectedGlow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    selectedGlowFilter
      .append('feGaussianBlur')
      .attr('stdDeviation', '8')
      .attr('result', 'coloredBlur');
    
    selectedGlowFilter
      .append('feFlood')
      .attr('flood-color', 'rgba(56,189,248,0.45)')
      .attr('flood-opacity', '1')
      .attr('result', 'flood');
    
    selectedGlowFilter
      .append('feComposite')
      .attr('in', 'flood')
      .attr('in2', 'coloredBlur')
      .attr('operator', 'in')
      .attr('result', 'coloredShadow');
    
    const selectedFeMerge = selectedGlowFilter.append('feMerge');
    selectedFeMerge.append('feMergeNode').attr('in', 'coloredShadow');
    selectedFeMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Cyan glow for hover
    const hoverGlowFilter = defs
      .append('filter')
      .attr('id', 'hoverGlow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    hoverGlowFilter
      .append('feGaussianBlur')
      .attr('stdDeviation', '5')
      .attr('result', 'coloredBlur');
    
    hoverGlowFilter
      .append('feFlood')
      .attr('flood-color', 'rgba(34,211,238,0.30)')
      .attr('flood-opacity', '1')
      .attr('result', 'flood');
    
    hoverGlowFilter
      .append('feComposite')
      .attr('in', 'flood')
      .attr('in2', 'coloredBlur')
      .attr('operator', 'in')
      .attr('result', 'coloredShadow');
    
    const hoverFeMerge = hoverGlowFilter.append('feMerge');
    hoverFeMerge.append('feMergeNode').attr('in', 'coloredShadow');
    hoverFeMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Draw links (gravity lines)
    const links = container
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', (d) => {
        // For very strong links (gravity > 0.7), blend toward violet
        if (d.gravity > 0.7) {
          return 'rgba(167,139,250,0.55)';
        }
        // Base electric cyan for links - more visible
        return 'rgba(56,189,248,0.35)';
      })
      .attr('stroke-width', (d) => {
        // Encode gravity using thickness: 1.5 + gravity * 2.5
        return 1.5 + d.gravity * 2.5;
      })
      .attr('opacity', (d) => {
        if (focusedNodeId) {
          const isConnected =
            d.source === focusedNodeId || d.target === focusedNodeId;
          if (isConnected) {
            // Connected links: base opacity + 0.15 boost
            return (0.25 + d.gravity * 0.35) + 0.15;
          }
          // Non-connected links: very dim
          return 0.08;
        }
        // Default opacity: encode gravity using opacity: 0.25 + gravity * 0.35
        return 0.25 + d.gravity * 0.35;
      });

    // Draw nodes
    const nodeElements = container
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodesData)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(
        d3
          .drag<SVGGElement, TasteGravityNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x ?? width / 2;
            d.fy = d.y ?? height / 2;
          })
          .on('drag', (event, d) => {
            // Constrain drag within bounds
            // event.x and event.y are already relative to the SVG
            const radius = 12 + (d.mass || 0.5) * 8;
            const boundaryPadding = 30;
            const newX = Math.max(boundaryPadding + radius, Math.min(width - boundaryPadding - radius, event.x));
            const newY = Math.max(boundaryPadding + radius, Math.min(height - boundaryPadding - radius, event.y));
            d.fx = newX;
            d.fy = newY;
            simulation.alpha(0.3).restart();
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setFocusedNodeId(focusedNodeId === d.id ? null : d.id);
      })
      .on('mouseenter', (event, d) => {
        setHoveredNodeId(d.id);
        // Convert SVG coordinates to screen coordinates
        if (d.x !== undefined && d.y !== undefined && svgRef.current) {
          const svgRect = svgRef.current.getBoundingClientRect();
          const viewBox = svgRef.current.viewBox.baseVal;
          const scaleX = svgRect.width / viewBox.width;
          const scaleY = svgRect.height / viewBox.height;
          const x = svgRect.left + (d.x - viewBox.x) * scaleX;
          const y = svgRect.top + (d.y - viewBox.y) * scaleY;
          setTooltipPosition({ x, y });
        }
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);
        setTooltipPosition(null);
      })
      .on('mousemove', (event, d) => {
        // Update tooltip position as mouse moves
        if (d.x !== undefined && d.y !== undefined && svgRef.current) {
          const svgRect = svgRef.current.getBoundingClientRect();
          const viewBox = svgRef.current.viewBox.baseVal;
          const scaleX = svgRect.width / viewBox.width;
          const scaleY = svgRect.height / viewBox.height;
          const x = svgRect.left + (d.x - viewBox.x) * scaleX;
          const y = svgRect.top + (d.y - viewBox.y) * scaleY;
          setTooltipPosition({ x, y });
        }
      });

    // Add background circles for nodes (transparent fill, just for clipping/outline)
    // These will be behind avatars and only show outline rings
    const nodeCircles = nodeElements
      .append('circle')
      .attr('r', (d) => 10 + d.mass * 6)
      .attr('fill', 'transparent') // No colored fill - avatar-centric
      .attr('filter', (d) => {
        // Subtle shadow for default nodes
        if (!focusedNodeId && d.id !== hoveredNodeId) {
          return 'url(#defaultShadow)';
        }
        return 'none';
      });

    // Add clip paths for profile images
    data.nodes.forEach((node) => {
      if (node.img) {
        const clipPath = defs
          .append('clipPath')
          .attr('id', `clip-${node.id}`);
        const radius = 10 + node.mass * 6;
        clipPath
          .append('circle')
          .attr('r', radius)
          .attr('cx', 0)
          .attr('cy', 0);
      }
    });

    // Add profile images for nodes with images
    const imageNodes = nodeElements.filter((d) => d.img);
    imageNodes
      .append('image')
      .attr('href', (d) => d.img || '')
      .attr('x', (d) => {
        const radius = 10 + d.mass * 6;
        return -radius;
      })
      .attr('y', (d) => {
        const radius = 10 + d.mass * 6;
        return -radius;
      })
      .attr('width', (d) => {
        const radius = 10 + d.mass * 6;
        return radius * 2;
      })
      .attr('height', (d) => {
        const radius = 10 + d.mass * 6;
        return radius * 2;
      })
      .attr('clip-path', (d) => `url(#clip-${d.id})`)
      .attr('opacity', (d) => {
        if (focusedNodeId) {
          const isFocused = d.id === focusedNodeId;
          const isNeighbor = data.links.some(
            (link) =>
              (link.source === d.id && link.target === focusedNodeId) ||
              (link.target === d.id && link.source === focusedNodeId)
          );
          return isFocused ? 1 : isNeighbor ? 0.9 : 0.55; // Selected: 1, Connected: 0.9, Others: 0.55
        }
        return hoveredNodeId === d.id ? 1 : 1; // Full opacity when nothing selected
      });
    
    // Add outline rings for all nodes (rendered after images/letters so they appear on top)
    // Default: subtle neutral outline
    // Selected: thick pink ring with glow
    // Hover: cyan ring with glow
    const nodeRings = nodeElements
      .append('circle')
      .attr('r', (d) => 10 + d.mass * 6)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        if (d.id === focusedNodeId) {
          return '#38BDF8'; // Electric cyan for selected
        }
        if (d.id === hoveredNodeId && !focusedNodeId) {
          return 'rgba(34,211,238,0.85)'; // Cyan for hover (only when nothing selected)
        }
        return 'rgba(255,255,255,0.14)'; // Subtle neutral for default
      })
      .attr('stroke-width', (d) => {
        if (d.id === focusedNodeId) {
          return 3; // Thick for selected
        }
        if (d.id === hoveredNodeId && !focusedNodeId) {
          return 2; // Medium for hover
        }
        return 1; // Thin for default
      })
          .attr('filter', (d) => {
            if (d.id === focusedNodeId) {
              return 'url(#selectedGlow)'; // Strong electric cyan glow
            }
            if (d.id === hoveredNodeId && !focusedNodeId) {
              return 'url(#hoverGlow)'; // Cyan glow
            }
            return 'none'; // No glow for default
          })
      .attr('opacity', (d) => {
        if (focusedNodeId) {
          const isFocused = d.id === focusedNodeId;
          const isNeighbor = data.links.some(
            (link) =>
              (link.source === d.id && link.target === focusedNodeId) ||
              (link.target === d.id && link.source === focusedNodeId)
          );
          return isFocused || isNeighbor ? 1 : 0.55; // Dim non-selected
        }
        return 1; // Full opacity when nothing selected
      });

    // Add inner ring for selected nodes (polish detail)
    // This renders after the outer ring, so it appears on top
    const selectedInnerRings = nodeElements
      .filter((d) => d.id === focusedNodeId)
      .append('circle')
      .attr('r', (d) => 10 + d.mass * 6 - 2)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.25)')
      .attr('stroke-width', 1)
      .attr('opacity', 1);

    // Ensure selected node groups render above all other nodes and links
    nodeElements
      .filter((d) => d.id === focusedNodeId)
      .raise();

    // Add letter avatars for nodes without profile images
    const letterNodes = nodeElements.filter((d) => !d.img);
    letterNodes
      .append('text')
      .text((d) => d.name.charAt(0).toUpperCase())
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', palette.text)
      .attr('font-size', (d) => {
        const radius = 10 + d.mass * 6;
        return Math.max(12, radius * 0.8) + 'px';
      })
      .attr('font-weight', '600')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .attr('opacity', (d) => {
        if (focusedNodeId) {
          const isFocused = d.id === focusedNodeId;
          const isNeighbor = data.links.some(
            (link) =>
              (link.source === d.id && link.target === focusedNodeId) ||
              (link.target === d.id && link.source === focusedNodeId)
          );
          return isFocused ? 1 : isNeighbor ? 0.9 : 0.55; // Selected: 1, Connected: 0.9, Others: 0.55
        }
        return hoveredNodeId === d.id ? 1 : 1; // Full opacity when nothing selected
      });

    // Add labels with near-white text and subtle shadow
    nodeElements
      .append('text')
      .text((d) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => 20 + d.mass * 6)
      .attr('fill', palette.text)
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('style', 'text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);')
      .attr('opacity', (d) => {
        if (focusedNodeId) {
          const isFocused = d.id === focusedNodeId;
          const isNeighbor = data.links.some(
            (link) =>
              (link.source === d.id && link.target === focusedNodeId) ||
              (link.target === d.id && link.source === focusedNodeId)
          );
          return isFocused || isNeighbor ? 1 : 0.3;
        }
        return hoveredNodeId === d.id ? 1 : 0.85;
      });

    // Update positions on simulation tick with boundary constraints
    const boundaryPadding = 30;
    simulation.on('tick', () => {
      // Apply boundary constraints
      nodesData.forEach((node: any) => {
        const radius = 12 + (node.mass || 0.5) * 8;
        node.x = Math.max(boundaryPadding + radius, Math.min(width - boundaryPadding - radius, node.x || width / 2));
        node.y = Math.max(boundaryPadding + radius, Math.min(height - boundaryPadding - radius, node.y || height / 2));
      });

      // Update visual elements
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeElements.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      
      // Update tooltip position if hovering
      if (hoveredNodeId && svgRef.current) {
        const hoveredNode = nodesData.find((n: any) => n.id === hoveredNodeId);
        if (hoveredNode && hoveredNode.x !== undefined && hoveredNode.y !== undefined) {
          const svgRect = svgRef.current.getBoundingClientRect();
          const viewBox = svgRef.current.viewBox.baseVal;
          const scaleX = svgRect.width / viewBox.width;
          const scaleY = svgRect.height / viewBox.height;
          const x = svgRect.left + (hoveredNode.x - viewBox.x) * scaleX;
          const y = svgRect.top + (hoveredNode.y - viewBox.y) * scaleY;
          setTooltipPosition({ x, y });
        }
      }
    });

    // Store references for dynamic updates
    nodesRef.current = nodeElements;
    linksRef.current = links;

    // Cleanup function
    return () => {
      simulation.stop();
      svg.selectAll('*').remove();
      nodesRef.current = null;
      linksRef.current = null;
    };
  }, [data]); // Only recreate simulation when data changes, not on focus/hover

  // Update styles dynamically when hover/focus changes (without recreating SVG)
  useEffect(() => {
    if (!nodesRef.current || !linksRef.current || !data) return;

    const nodes = nodesRef.current;
    const links = linksRef.current;

    // Update link styles
    links
      .attr('stroke', (d) => {
        // For very strong links (gravity > 0.7), blend toward violet
        if (d.gravity > 0.7) {
          return 'rgba(167,139,250,0.55)';
        }
        // Base electric cyan for links - more visible
        return 'rgba(56,189,248,0.35)';
      })
      .attr('stroke-width', (d) => {
        // Encode gravity using thickness: 1.5 + gravity * 2.5
        return 1.5 + d.gravity * 2.5;
      })
      .attr('opacity', (d) => {
        if (focusedNodeId) {
          const isConnected =
            d.source === focusedNodeId || d.target === focusedNodeId;
          if (isConnected) {
            // Connected links: base opacity + 0.15 boost
            return (0.25 + d.gravity * 0.35) + 0.15;
          }
          // Non-connected links: very dim
          return 0.08;
        }
        // Default opacity: encode gravity using opacity: 0.25 + gravity * 0.35
        return 0.25 + d.gravity * 0.35;
      });

    // Update node ring styles (not fill - avatar-centric)
    nodes.each(function(d: any) {
      const nodeGroup = d3.select(this);
      const nodeId = d.id;
      
      // Find the outline ring (should be the last circle)
      const rings = nodeGroup.selectAll('circle');
      const ringCount = rings.size();
      
      // The outline ring is typically the last one
      if (ringCount > 0) {
        const outlineRing = rings.nodes()[ringCount - 1];
        const ringSelection = d3.select(outlineRing);
        
        ringSelection
          .attr('stroke', () => {
            if (nodeId === focusedNodeId) {
              return '#38BDF8'; // Electric cyan for selected
            }
            if (nodeId === hoveredNodeId && !focusedNodeId) {
              return 'rgba(34,211,238,0.85)'; // Cyan for hover (only when nothing selected)
            }
            return 'rgba(255,255,255,0.14)'; // Subtle neutral for default
          })
          .attr('stroke-width', () => {
            if (nodeId === focusedNodeId) {
              return 3; // Thick for selected
            }
            if (nodeId === hoveredNodeId && !focusedNodeId) {
              return 2; // Medium for hover
            }
            return 1; // Thin for default
          })
          .attr('filter', () => {
            if (nodeId === focusedNodeId) {
              return 'url(#selectedGlow)'; // Strong electric cyan glow
            }
            if (nodeId === hoveredNodeId && !focusedNodeId) {
              return 'url(#hoverGlow)'; // Cyan glow
            }
            return 'none'; // No glow for default
          })
          .attr('opacity', () => {
            if (focusedNodeId) {
              const isFocused = nodeId === focusedNodeId;
              const isNeighbor = data.links.some(
                (link) =>
                  (link.source === nodeId && link.target === focusedNodeId) ||
                  (link.target === nodeId && link.source === focusedNodeId)
              );
              return isFocused || isNeighbor ? 1 : 0.55; // Dim non-selected
            }
            return 1; // Full opacity when nothing selected
          });
      }
    });

    // Ensure selected node groups render above all other nodes and links
    nodes
      .filter((d: any) => d.id === focusedNodeId)
      .raise();

    // Update image opacity
    nodes.selectAll('image').attr('opacity', (d: any) => {
      if (focusedNodeId) {
        const isFocused = d.id === focusedNodeId;
        const isNeighbor = data.links.some(
          (link) =>
            (link.source === d.id && link.target === focusedNodeId) ||
            (link.target === d.id && link.source === focusedNodeId)
        );
        return isFocused ? 1 : isNeighbor ? 0.9 : 0.55; // Selected: 1, Connected: 0.9, Others: 0.55
      }
      return hoveredNodeId === d.id ? 1 : 1; // Full opacity when nothing selected
    });

    // Update letter avatar opacity (text elements with dominant-baseline="middle" are avatars)
    nodes.each(function(d: any) {
      const nodeGroup = d3.select(this);
      const avatarText = nodeGroup.select('text[dominant-baseline="middle"]');
      if (!avatarText.empty()) {
        const opacity = (() => {
          if (focusedNodeId) {
            const isFocused = d.id === focusedNodeId;
            const isNeighbor = data.links.some(
              (link) =>
                (link.source === d.id && link.target === focusedNodeId) ||
                (link.target === d.id && link.source === focusedNodeId)
            );
            return isFocused ? 1 : isNeighbor ? 0.9 : 0.55; // Selected: 1, Connected: 0.9, Others: 0.55
          }
          return hoveredNodeId === d.id ? 1 : 1; // Full opacity when nothing selected
        })();
        avatarText.attr('opacity', opacity);
      }
    });


    // Update label opacity (only name labels, not letter avatars)
    nodes.each(function(d: any) {
      const nodeGroup = d3.select(this);
      const nodeId = d.id;
      
      // Update name labels (text elements without dominant-baseline="middle")
      const nameLabels = nodeGroup.selectAll('text').filter(function() {
        return d3.select(this).attr('dominant-baseline') !== 'middle';
      });
      
      nameLabels.attr('opacity', () => {
        if (focusedNodeId) {
          const isFocused = nodeId === focusedNodeId;
          const isNeighbor = data.links.some(
            (link) =>
              (link.source === nodeId && link.target === focusedNodeId) ||
              (link.target === nodeId && link.source === focusedNodeId)
          );
          return isFocused ? 1 : isNeighbor ? 0.9 : 0.55; // Selected: 1, Connected: 0.9, Others: 0.55
        }
        return hoveredNodeId === nodeId ? 1 : 1; // Full opacity when nothing selected
      });
    });
  }, [hoveredNodeId, focusedNodeId, data]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (simulationRef.current && svgRef.current) {
        const svgElement = svgRef.current;
        const parentContainer = svgElement.parentElement;
        const width = parentContainer?.clientWidth || svgElement.clientWidth || 800;
        const height = parentContainer?.clientHeight || svgElement.clientHeight || 600;
        
        // Update SVG dimensions and viewBox with padding
        const viewBoxPadding = 50;
        const viewBoxWidth = width + viewBoxPadding * 2;
        const viewBoxHeight = height + viewBoxPadding * 2;
        d3.select(svgElement)
          .attr('width', width)
          .attr('height', height)
          .attr('viewBox', `${-viewBoxPadding} ${-viewBoxPadding} ${viewBoxWidth} ${viewBoxHeight}`);
        
        // Update force center
        simulationRef.current.force('center', d3.forceCenter(width / 2, height / 2));
        simulationRef.current.alpha(0.3).restart();
      }
    };

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (svgRef.current?.parentElement) {
      resizeObserver.observe(svgRef.current.parentElement);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // Get hovered node data for tooltip
  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId || !data) return null;
    return data.nodes.find((n) => n.id === hoveredNodeId);
  }, [hoveredNodeId, data]);

  // Get focused node links for tooltip
  const focusedNodeLinks = useMemo(() => {
    if (!focusedNodeId || !data) return [];
    return data.links.filter(
      (link) => link.source === focusedNodeId || link.target === focusedNodeId
    );
  }, [focusedNodeId, data]);

  if (isLoading) {
    return (
      <Card className="bg-black/40 border-white/5">
        <CardHeader>
          <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Taste Gravity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Skeleton className="h-[500px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-black/40 border-white/5 border-destructive">
        <CardContent className="p-6">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Card className="bg-black/40 border-white/5">
        <CardHeader>
          <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Taste Gravity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">
            No data available. Share and listen to tracks to see taste connections.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/40 border-white/5 overflow-hidden relative group">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Taste Gravity
          </CardTitle>
          {focusedNodeId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFocusedNodeId(null)}
              className="text-xs"
            >
              Reset Focus
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 relative z-10">
        <div className="relative w-full h-[500px] overflow-visible">
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              className="cursor-move"
              style={{ display: 'block', minHeight: '500px', overflow: 'visible' }}
              onClick={() => setFocusedNodeId(null)}
            >
              {/* SVG content is rendered by D3 */}
            </svg>
            <TasteGravityLegend />
            {hoveredNode && tooltipPosition && (
              <div
                className="absolute z-50 bg-popover text-popover-foreground rounded-md border border-border px-3 py-2 shadow-md max-w-xs pointer-events-none"
                style={{
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y - 10}px`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                  <div className="space-y-1">
                  <p className="font-semibold text-sm">{hoveredNode.name}</p>
                    {hoveredNode.topArtists.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Top Artists: {hoveredNode.topArtists.join(', ')}
                      </p>
                    )}
                    {focusedNodeLinks.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium">Connections:</p>
                        {focusedNodeLinks.slice(0, 3).map((link, idx) => {
                          const otherNodeId =
                            link.source === hoveredNode.id ? link.target : link.source;
                          const otherNode = data.nodes.find((n) => n.id === otherNodeId);
                          return (
                            <div key={idx} className="text-xs">
                              <span className="text-primary">
                                {otherNode?.name || 'Unknown'}
                              </span>
                              {link.reasons.length > 0 && (
                                <span className="text-muted-foreground ml-1">
                                  - {link.reasons[0]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
              </div>
            )}
          </div>
        {data.insights && data.insights.length > 0 && (
          <div className="p-4 border-t border-white/5">
            <div className="space-y-1">
              {data.insights.map((insight, idx) => (
                <p key={idx} className="text-xs text-muted-foreground">
                  {insight}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

