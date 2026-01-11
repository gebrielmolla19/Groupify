import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Skeleton } from '../../ui/skeleton';
import { Button } from '../../ui/button';
import { useTasteGravity, TimeRange } from '../../../hooks/useTasteGravity';
import type { TasteGravityNode, TasteGravityLink } from '../../../types/analytics';

/**
 * UI Polish Refinements Applied (2024):
 * 
 * 1. Cluster Scale Increase (applyClusterTransform, ~line 547-552):
 *    - Increased scale by 12% (multiply by 1.12) to reduce empty space
 *    - Clamped scale between 0.9 and 1.8 to prevent extreme scaling
 *    - Target: cluster occupies ~65-75% of canvas (up from ~60-70%)
 * 
 * 2. Stronger Node Separation (node separation effect, ~line 666-710):
 *    - Increased offset distance from 10px to 16px for better visual separation
 *    - Added zero-distance fallback using golden angle distribution (137.5°)
 *    - Prevents NaN values in transform calculations
 * 
 * 3. Gravity Settle Animation (node separation effect, ~line 680-684, 652-659):
 *    - Increased transition duration from 150ms to 200ms
 *    - Applied cubic-bezier easing (d3.easeCubicOut) for smooth settle effect
 *    - Applied to both selection (offset in) and deselection (offset out)
 * 
 * 4. Improved Focus Card Copy (focus card rendering, ~line 1203-1235):
 *    - Changed title from "Strongest Pull" to "Closest Taste Match"
 *    - Limited shared artists display to first 3, with "+N more" if applicable
 *    - Changed "Average gravity:" to "Avg gravity:" for brevity
 *    - Collects shared artists from all connected links (not just strongest)
 * 
 * Note: All changes are front-end presentation only. No modifications to:
 * - Gravity calculations, mass calculations, force simulation logic
 * - Backend API responses or data structures
 * - Node/link rendering core logic
 */

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
  const simulationRef = useRef<d3.Simulation<TasteGravityNode, undefined> | null>(null);
  const nodesRef = useRef<d3.Selection<SVGGElement, TasteGravityNode, SVGGElement, unknown> | null>(null);
  const linksRef = useRef<d3.Selection<SVGLineElement, TasteGravityLink, SVGGElement, unknown> | null>(null);
  const containerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
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

    // Add padding to viewBox, but keep it within container bounds
    // Account for node labels which extend below nodes (approximately 30px)
    const viewBoxPadding = 50;
    const viewBoxWidth = width + viewBoxPadding * 2;
    const viewBoxHeight = height + viewBoxPadding * 2;

    // Set explicit width/height and viewBox for proper scaling
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `${-viewBoxPadding} ${-viewBoxPadding} ${viewBoxWidth} ${viewBoxHeight}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('overflow', 'hidden'); // Clip SVG content to viewBox

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
    containerRef.current = container;

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
        // For very strong links (gravity > 0.7), blend toward violet with higher opacity
        if (d.gravity > 0.7) {
          return 'rgba(167,139,250,0.75)';
        }
        // Base electric cyan for links - increased opacity for better visibility
        return 'rgba(56,189,248,0.55)';
      })
      .attr('stroke-width', (d) => {
        // Encode gravity using thickness: increased base (1.0) + gravity * 2.5 for more visibility
        return 1.0 + d.gravity * 2.5;
      })
      .attr('opacity', (d) => {
        if (focusedNodeId) {
          const isConnected =
            d.source === focusedNodeId || d.target === focusedNodeId;
          if (isConnected) {
            // Connected links: higher base opacity for better visibility
            return (0.4 + d.gravity * 0.4) + 0.2;
          }
          // Non-connected links: still visible but dimmed
          return 0.08;
        }
        if (hoveredNodeId) {
          const isConnected = d.source === hoveredNodeId || d.target === hoveredNodeId;
          return isConnected ? (0.4 + d.gravity * 0.4) + 0.2 : 0.12;
        }
        // Default opacity: increased base opacity for better visibility
        return 0.3 + d.gravity * 0.35;
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
            // Larger radius for larger nodes
            const radius = 20 + (d.mass || 0.5) * 15;
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
      .attr('r', (d) => 20 + d.mass * 15) // Increased base radius
      .attr('fill', (d) => {
        // If no image, fill with primary/10 to match AvatarFallback
        return !d.img ? 'rgba(56, 189, 248, 0.1)' : 'transparent';
      })
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
        const radius = 20 + node.mass * 15;
        clipPath
          .append('circle')
          .attr('r', radius)
          .attr('cx', 0)
          .attr('cy', 0);
      }
    });

    // Add profile images for nodes with images
    const imageNodes = nodeElements.filter((d) => !!d.img);
    imageNodes
      .append('image')
      .attr('href', (d) => d.img || '')
      .attr('x', (d) => {
        const radius = 20 + d.mass * 15;
        return -radius;
      })
      .attr('y', (d) => {
        const radius = 20 + d.mass * 15;
        return -radius;
      })
      .attr('width', (d) => {
        const radius = 20 + d.mass * 15;
        return radius * 2;
      })
      .attr('height', (d) => {
        const radius = 20 + d.mass * 15;
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
          return isFocused ? 1 : isNeighbor ? 0.9 : 0.2; // Dim non-selected more
        }
        if (hoveredNodeId && hoveredNodeId !== d.id) {
          return 0.3; // Dim others on hover
        }
        return 1; // Full opacity when nothing selected
      });

    // Add outline rings for all nodes
    const nodeRings = nodeElements
      .append('circle')
      .attr('r', (d) => 20 + d.mass * 15)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        if (d.id === focusedNodeId) {
          return '#38BDF8'; // Electric cyan for selected
        }
        if (d.id === hoveredNodeId && !focusedNodeId) {
          return 'rgba(34,211,238,0.85)'; // Cyan for hover
        }
        // If no image (fallback), add a subtle border
        if (!d.img) return 'rgba(56, 189, 248, 0.3)';

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
          return isFocused || isNeighbor ? 1 : 0.2; // Dim non-selected
        }
        if (hoveredNodeId && hoveredNodeId !== d.id) {
          return 0.3;
        }
        return 1; // Full opacity when nothing selected
      });

    // Add inner ring for selected nodes (polish detail)
    const selectedInnerRings = nodeElements
      .filter((d) => d.id === focusedNodeId)
      .append('circle')
      .attr('r', (d) => 20 + d.mass * 15 - 2)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.25)')
      .attr('stroke-width', 1)
      .attr('opacity', 1);

    // Ensure selected node groups render above all other nodes and links
    nodeElements
      .filter((d) => d.id === focusedNodeId)
      .raise();

    // Add letter avatars for nodes without profile images (Fallback style)
    const letterNodes = nodeElements.filter((d) => !d.img);
    letterNodes
      .append('text')
      .text((d) => {
        // Get initials
        return d.name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#38BDF8') // Primary color (Electric Cyan/Blue)
      .attr('font-size', (d) => {
        const radius = 20 + d.mass * 15;
        return Math.max(14, radius * 0.6) + 'px';
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
          return isFocused ? 1 : isNeighbor ? 0.9 : 0.2;
        }
        if (hoveredNodeId && hoveredNodeId !== d.id) {
          return 0.3;
        }
        return 1;
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

    // Helper function to compute cluster transform (centering and scaling)
    const applyClusterTransform = () => {
      if (!container || nodesData.length === 0) return;

      // Compute bounding box of all nodes
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      nodesData.forEach((node: any) => {
        if (node.x !== undefined && node.y !== undefined) {
          const radius = 20 + (node.mass || 0.5) * 15;
          minX = Math.min(minX, node.x - radius);
          maxX = Math.max(maxX, node.x + radius);
          minY = Math.min(minY, node.y - radius);
          maxY = Math.max(maxY, node.y + radius);
        }
      });

      if (minX === Infinity) return; // No valid positions yet

      // Calculate cluster center
      const clusterCenterX = (minX + maxX) / 2;
      const clusterCenterY = (minY + maxY) / 2;

      // Calculate cluster dimensions
      const clusterWidth = maxX - minX;
      const clusterHeight = maxY - minY;

      // Calculate scale to occupy ~65-75% of available space (increased by 12%)
      const targetWidth = width * 0.65;
      const targetHeight = height * 0.65;
      const scaleX = clusterWidth > 0 ? targetWidth / clusterWidth : 1.3;
      const scaleY = clusterHeight > 0 ? targetHeight / clusterHeight : 1.3;
      const baseScale = Math.min(scaleX, scaleY);
      // Increase scale by 12% and clamp between 0.9 and 1.8
      const scale = Math.min(Math.max(baseScale * 1.12, 0.9), 1.8);

      // Calculate translation to center cluster in SVG
      const svgCenterX = width / 2;
      const svgCenterY = height / 2;
      const translateX = svgCenterX - clusterCenterX * scale;
      const translateY = svgCenterY - clusterCenterY * scale;

      // Apply transform with smooth animation
      container
        .transition()
        .duration(250)
        .attr('transform', `translate(${translateX},${translateY}) scale(${scale})`);
    };


    // Update positions on simulation tick with boundary constraints
    // Account for labels that extend below nodes (approximately 30px)
    const boundaryPadding = 30;
    const labelHeight = 30;
    let tickCount = 0;
    simulation.on('tick', () => {
      tickCount++;
      
      // Apply boundary constraints - keep nodes and their labels within bounds
      nodesData.forEach((node: any) => {
        const radius = 20 + (node.mass || 0.5) * 15;
        // Top constraint: account for radius
        const minY = boundaryPadding + radius;
        // Bottom constraint: account for radius + label height
        const maxY = height - boundaryPadding - radius - labelHeight;
        // Left/right constraints: account for radius
        const minX = boundaryPadding + radius;
        const maxX = width - boundaryPadding - radius;
        
        node.x = Math.max(minX, Math.min(maxX, node.x || width / 2));
        node.y = Math.max(minY, Math.min(maxY, node.y || height / 2));
      });

      // Update visual elements
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      // Apply base transform (node separation is handled in separate effect)
      nodeElements.attr('transform', (d: any) => `translate(${d.x},${d.y})`);

      // Apply cluster transform after initial settling (around tick 50)
      if (tickCount === 50) {
        applyClusterTransform();
      }

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

    // Apply cluster transform when simulation ends
    simulation.on('end', () => {
      applyClusterTransform();
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
      containerRef.current = null;
    };
  }, [data]); // Only recreate simulation when data changes, not on focus/hover

  // Apply node separation when selection changes
  useEffect(() => {
    if (!nodesRef.current || !data || !simulationRef.current) return;

    const nodeElements = nodesRef.current;
    const nodesData = Array.from(nodeElements.data() as TasteGravityNode[]);

    // Wait a tick to ensure positions are updated
    const timer = setTimeout(() => {
      if (!focusedNodeId) {
        // Remove separation when no selection
        nodeElements
          .transition()
          .duration(200)
          .ease(d3.easeCubicOut)
          .attr('transform', (d: any) => {
            if (d.x !== undefined && d.y !== undefined) {
              return `translate(${d.x},${d.y})`;
            }
            return 'translate(0,0)';
          });
        return;
      }

      const selectedNode = nodesData.find((n: any) => n.id === focusedNodeId);
      if (!selectedNode || selectedNode.x === undefined || selectedNode.y === undefined) return;

      const offsetDistance = 16; // Increased from 10px to 16px for stronger separation
      const connectedNodeIds = new Set<string>();
      
      // Find all nodes connected to the selected node
      data.links.forEach((link) => {
        const getLinkId = (linkEnd: string | any): string => {
          if (typeof linkEnd === 'string') return linkEnd;
          if (linkEnd && typeof linkEnd === 'object' && linkEnd.id) return linkEnd.id;
          return String(linkEnd);
        };
        const sourceId = getLinkId(link.source);
        const targetId = getLinkId(link.target);
        if (sourceId === focusedNodeId) {
          connectedNodeIds.add(targetId);
        } else if (targetId === focusedNodeId) {
          connectedNodeIds.add(sourceId);
        }
      });

      // Apply offset transform to connected nodes with animation
      nodeElements
        .transition()
        .duration(200)
        .ease(d3.easeCubicOut)
        .attr('transform', (d: any) => {
          if (d.x === undefined || d.y === undefined) {
            return 'translate(0,0)';
          }

          const baseTransform = `translate(${d.x},${d.y})`;
          
          if (d.id === focusedNodeId) {
            return baseTransform;
          }

          if (connectedNodeIds.has(d.id)) {
            const dx = d.x - selectedNode.x;
            const dy = d.y - selectedNode.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            let normalizedDx: number;
            let normalizedDy: number;
            
            if (length > 0 && isFinite(length)) {
              normalizedDx = dx / length;
              normalizedDy = dy / length;
            } else {
              // Fallback for zero-distance case: use golden angle distribution
              const nodeIndex = nodesData.findIndex((n: any) => n.id === d.id);
              const angle = ((nodeIndex * 137.5 * Math.PI) / 180) % (2 * Math.PI);
              normalizedDx = Math.cos(angle);
              normalizedDy = Math.sin(angle);
            }
            
            const offsetX = normalizedDx * offsetDistance;
            const offsetY = normalizedDy * offsetDistance;
            return `${baseTransform} translate(${offsetX},${offsetY})`;
          }
          
          return baseTransform;
        });
    }, 10);

    return () => clearTimeout(timer);
  }, [focusedNodeId, data]);

  // Update styles dynamically when hover/focus changes (without recreating SVG)
  useEffect(() => {
    if (!nodesRef.current || !linksRef.current || !data) return;

    const nodes = nodesRef.current;
    const links = linksRef.current;

    // Update link styles
    links
      .attr('stroke', (d) => {
        // For very strong links (gravity > 0.7), blend toward violet with higher opacity
        if (d.gravity > 0.7) {
          return 'rgba(167,139,250,0.75)';
        }
        // Base electric cyan for links - increased opacity for better visibility
        return 'rgba(56,189,248,0.55)';
      })
      .attr('stroke-width', (d) => {
        // Encode gravity using thickness: increased base (1.0) + gravity * 2.5 for more visibility
        return 1.0 + d.gravity * 2.5;
      })
      .attr('opacity', (d) => {
        if (focusedNodeId) {
          const isConnected =
            d.source === focusedNodeId || d.target === focusedNodeId;
          if (isConnected) {
            // Connected links: higher base opacity for better visibility
            return (0.4 + d.gravity * 0.4) + 0.2;
          }
          // Non-connected links: still visible but dimmed
          return 0.08;
        }
        if (hoveredNodeId) {
          const isConnected = d.source === hoveredNodeId || d.target === hoveredNodeId;
          return isConnected ? (0.4 + d.gravity * 0.4) + 0.2 : 0.12;
        }
        // Default opacity: increased base opacity for better visibility
        return 0.3 + d.gravity * 0.35;
      });

    // Update node ring styles (not fill - avatar-centric)
    nodes.each(function (d: any) {
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
            // If no image (fallback), add a subtle border
            if (!d.img) return 'rgba(56, 189, 248, 0.3)';

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
              return isFocused || isNeighbor ? 1 : 0.2; // Dim non-selected
            }
            if (hoveredNodeId && hoveredNodeId !== nodeId) {
              return 0.3;
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
        return isFocused ? 1 : isNeighbor ? 0.9 : 0.2; // Selected: 1, Connected: 0.9, Others: 0.2
      }
      return hoveredNodeId === d.id ? 1 : 0.3; // Full opacity when nothing selected
    });

    // Update letter avatar opacity (text elements with dominant-baseline="middle" are avatars)
    nodes.each(function (d: any) {
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
            return isFocused ? 1 : isNeighbor ? 0.9 : 0.2; // Selected: 1, Connected: 0.9, Others: 0.2
          }
          if (hoveredNodeId && hoveredNodeId !== d.id) {
            return 0.3;
          }
          return 1; // Full opacity when nothing selected
        })();
        avatarText.attr('opacity', opacity);
      }
    });


    // Update label opacity (only name labels, not letter avatars)
    nodes.each(function (d: any) {
      const nodeGroup = d3.select(this);
      const nodeId = d.id;

      // Update name labels (text elements without dominant-baseline="middle")
      const nameLabels = nodeGroup.selectAll('text').filter(function () {
        return d3.select(this).attr('dominant-baseline') !== 'middle';
      });

      // Calculate offset based on new radius logic
      const radius = 20 + (d.mass || 0.5) * 15;

      nameLabels
        .attr('dy', 20 + radius) // Update vertical position based on new radius
        .attr('opacity', () => {
          if (focusedNodeId) {
            const isFocused = nodeId === focusedNodeId;
            const isNeighbor = data.links.some(
              (link) =>
                (link.source === nodeId && link.target === focusedNodeId) ||
                (link.target === nodeId && link.source === focusedNodeId)
            );
            return isFocused ? 1 : isNeighbor ? 0.9 : 0.2; // Dim non-selected
          }
          if (hoveredNodeId && hoveredNodeId !== nodeId) {
            return 0.3;
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
        
        // Reapply cluster transform after resize
        setTimeout(() => {
          if (containerRef.current && nodesRef.current) {
            const nodesData = Array.from(nodesRef.current.data() as TasteGravityNode[]);
            if (nodesData.length > 0) {
              let minX = Infinity, maxX = -Infinity;
              let minY = Infinity, maxY = -Infinity;

              nodesData.forEach((node: any) => {
                if (node.x !== undefined && node.y !== undefined) {
                  const radius = 20 + (node.mass || 0.5) * 15;
                  minX = Math.min(minX, node.x - radius);
                  maxX = Math.max(maxX, node.x + radius);
                  minY = Math.min(minY, node.y - radius);
                  maxY = Math.max(maxY, node.y + radius);
                }
              });

              if (minX !== Infinity) {
                const clusterCenterX = (minX + maxX) / 2;
                const clusterCenterY = (minY + maxY) / 2;
                const clusterWidth = maxX - minX;
                const clusterHeight = maxY - minY;
                const targetWidth = width * 0.65;
                const targetHeight = height * 0.65;
                const scaleX = clusterWidth > 0 ? targetWidth / clusterWidth : 1.3;
                const scaleY = clusterHeight > 0 ? targetHeight / clusterHeight : 1.3;
                const baseScale = Math.min(scaleX, scaleY);
                // Increase scale by 12% and clamp between 0.9 and 1.8
                const scale = Math.min(Math.max(baseScale * 1.12, 0.9), 1.8);
                const svgCenterX = width / 2;
                const svgCenterY = height / 2;
                const translateX = svgCenterX - clusterCenterX * scale;
                const translateY = svgCenterY - clusterCenterY * scale;

                containerRef.current
                  .transition()
                  .duration(250)
                  .attr('transform', `translate(${translateX},${translateY}) scale(${scale})`);
              }
            }
          }
        }, 100);
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

  // Compute focus card data for selected member
  const focusCardData = useMemo(() => {
    if (!focusedNodeId || !data) return null;

    const selectedNode = data.nodes.find((n) => n.id === focusedNodeId);
    if (!selectedNode) return null;

    // Helper to get link ID (handle both string and object cases)
    const getLinkId = (linkEnd: string | any): string => {
      if (typeof linkEnd === 'string') return linkEnd;
      if (linkEnd && typeof linkEnd === 'object' && linkEnd.id) return linkEnd.id;
      return String(linkEnd);
    };

    // Find all links connected to the selected node
    const connectedLinks = data.links.filter((link) => {
      const sourceId = getLinkId(link.source);
      const targetId = getLinkId(link.target);
      return sourceId === focusedNodeId || targetId === focusedNodeId;
    });

    if (connectedLinks.length === 0) {
      // Still show card even if no connections, just with limited info
      return {
        selectedMember: selectedNode.name,
        connectedMember: null,
        sharedArtists: [],
        averageGravity: 0,
        hasConnections: false,
      };
    }

    // Find strongest connection (highest gravity)
    const strongestLink = connectedLinks.reduce((prev, curr) =>
      curr.gravity > prev.gravity ? curr : prev
    );

    // Get the connected member
    const strongestSourceId = getLinkId(strongestLink.source);
    const strongestTargetId = getLinkId(strongestLink.target);
    const connectedMemberId =
      strongestSourceId === focusedNodeId
        ? strongestTargetId
        : strongestSourceId;
    const connectedMember = data.nodes.find((n) => n.id === connectedMemberId);

    // Extract shared artists from all connected links (not just strongest)
    // Collect all unique shared artists across all connections
    const allSharedArtists = new Set<string>();
    
    connectedLinks.forEach((link) => {
      if (link.reasons && link.reasons.length > 0) {
        const reasonText = link.reasons[0];
        const match = reasonText.match(/Shared Artists?:\s*(.+)/i);
        if (match) {
          match[1]
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean)
            .forEach((artist) => allSharedArtists.add(artist));
        } else {
          // Try other patterns like "Tamrat Desta · DJ LUNA · Hupa"
          const artistPattern = /([A-Za-z0-9\s]+(?:\s·\s[A-Za-z0-9\s]+)*)/;
          const artistMatch = reasonText.match(artistPattern);
          if (artistMatch) {
            artistMatch[1]
              .split(' · ')
              .map((a) => a.trim())
              .filter(Boolean)
              .forEach((artist) => allSharedArtists.add(artist));
          }
        }
      }
    });
    
    // Fallback: compute intersection of top artists if no reasons found
    if (allSharedArtists.size === 0) {
      const selectedArtists = new Set(selectedNode.topArtists || []);
      const connectedArtists = connectedMember?.topArtists || [];
      connectedArtists
        .filter((a) => selectedArtists.has(a))
        .forEach((artist) => allSharedArtists.add(artist));
    }
    
    const sharedArtists = Array.from(allSharedArtists);

    // Calculate average gravity
    const averageGravity =
      connectedLinks.reduce((sum, link) => sum + link.gravity, 0) /
      connectedLinks.length;

    return {
      selectedMember: selectedNode.name,
      connectedMember: connectedMember?.name || 'Unknown',
      sharedArtists: sharedArtists, // All shared artists (will be limited in display)
      totalSharedArtists: sharedArtists.length, // Total count for "+N more" display
      averageGravity: Math.round(averageGravity * 100), // Convert to percentage
      hasConnections: true,
    };
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
    <Card className="bg-black/40 border-white/5 relative group">
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
        {/* SVG container with overflow to prevent bleeding */}
        <div className="relative w-full h-[500px] overflow-hidden">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="cursor-move"
            style={{ display: 'block', minHeight: '500px' }}
            onClick={() => setFocusedNodeId(null)}
          >
            {/* SVG content is rendered by D3 */}
          </svg>
          {/* Tooltip positioned absolutely within SVG container */}
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
        {/* Focus Card below SVG */}
        {focusedNodeId && focusCardData && (
          <div className="p-4 border-t border-white/5">
            <Card className="bg-black/95 backdrop-blur-md border border-white/20 shadow-2xl">
              <CardContent className="p-3.5">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🔗</span>
                    <h4 className="text-xs font-semibold text-foreground">
                      Closest Taste Match
                    </h4>
                  </div>
                  {focusCardData.hasConnections && focusCardData.connectedMember ? (
                    <>
                      <div className="text-xs text-foreground">
                        <span className="font-medium">{focusCardData.selectedMember}</span>
                        <span className="mx-1.5 text-muted-foreground">↔</span>
                        <span className="font-medium">{focusCardData.connectedMember}</span>
                      </div>
                      {focusCardData.sharedArtists.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Shared artists:</span>{' '}
                          {focusCardData.sharedArtists.slice(0, 3).join(' · ')}
                          {focusCardData.totalSharedArtists > 3 && (
                            <span> +{focusCardData.totalSharedArtists - 3} more</span>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Avg gravity:</span>{' '}
                        {focusCardData.averageGravity}%
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">{focusCardData.selectedMember}</span>
                      <span className="ml-2">No connections yet</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

