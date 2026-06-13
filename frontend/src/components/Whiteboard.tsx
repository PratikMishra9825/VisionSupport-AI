"use client";

import { useRef, useState, useEffect, memo } from 'react';
import { useStore, WhiteboardElement } from '@/store/useStore';
import { Socket } from 'socket.io-client';
import { Trash2, Undo, Redo, Square, Circle, Minus, Edit3, Type, HelpCircle, FileDown } from 'lucide-react';

interface WhiteboardProps {
  socket: Socket | null;
  sessionId: string;
}

const Whiteboard = memo(function Whiteboard({ socket, sessionId }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { whiteboardElements, setWhiteboardElements, addWhiteboardElement, role, name } = useStore();
  const [tool, setTool] = useState<'pencil' | 'rectangle' | 'circle' | 'line' | 'text' | 'sticky' | 'laser'>('pencil');
  const [color, setColor] = useState('#8b5cf6');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);

  // Undo/Redo tracking stacks
  const [history, setHistory] = useState<WhiteboardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardElement[][]>([]);

  useEffect(() => {
    redrawCanvas();
  }, [whiteboardElements]);

  // Handle socket strokes updates
  useEffect(() => {
    if (!socket) return;

    socket.on('whiteboard-element-added', ({ element }) => {
      addWhiteboardElement(element);
    });

    socket.on('whiteboard-cleared', () => {
      setWhiteboardElements([]);
    });

    return () => {
      socket.off('whiteboard-element-added');
      socket.off('whiteboard-cleared');
    };
  }, [socket]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    whiteboardElements.forEach((el) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'pencil' && el.points && el.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === 'rectangle' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === 'circle' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
        ctx.beginPath();
        const rx = el.width / 2;
        const ry = el.height / 2;
        ctx.ellipse(el.x + rx, el.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (el.type === 'line' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + el.width, el.y + el.height);
        ctx.stroke();
      } else if (el.type === 'text' && el.x !== undefined && el.y !== undefined && el.text) {
        ctx.font = `${el.lineWidth * 4 + 12}px Orbitron`;
        ctx.fillText(el.text, el.x, el.y);
      }
    });
  };

  // Canvas Mouse actions
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Observers cannot draw
    if (role === 'observer') return;

    const coords = getCoordinates(e);
    setIsDrawing(true);
    const elementId = Date.now().toString();
    setActiveElementId(elementId);

    // Push state to history before modifications for Undo support
    setHistory(prev => [...prev, [...whiteboardElements]]);
    setRedoStack([]); // Clear redo

    if (tool === 'pencil') {
      const newEl: WhiteboardElement = {
        id: elementId,
        type: 'pencil',
        points: [coords],
        color,
        lineWidth,
        createdBy: name || 'Guest',
      };
      addWhiteboardElement(newEl);
    } else if (tool === 'rectangle' || tool === 'circle' || tool === 'line') {
      const newEl: WhiteboardElement = {
        id: elementId,
        type: tool,
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
        color,
        lineWidth,
        createdBy: name || 'Guest',
      };
      addWhiteboardElement(newEl);
    } else if (tool === 'text') {
      const txt = prompt('Enter text:');
      if (txt) {
        const newEl: WhiteboardElement = {
          id: elementId,
          type: 'text',
          x: coords.x,
          y: coords.y,
          color,
          lineWidth,
          text: txt,
          createdBy: name || 'Guest',
        };
        addWhiteboardElement(newEl);
        socket?.emit('whiteboard-draw', { element: newEl });
      }
      setIsDrawing(false);
    } else if (tool === 'sticky') {
      const newEl: WhiteboardElement = {
        id: elementId,
        type: 'sticky',
        x: coords.x,
        y: coords.y,
        width: 150,
        height: 150,
        color: '#fef08a', // Default sticky yellow
        lineWidth: 1,
        text: 'Type note here...',
        createdBy: name || 'Guest',
      };
      addWhiteboardElement(newEl);
      socket?.emit('whiteboard-draw', { element: newEl });
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Cursor movements tracking for multi-user cursors
    const coords = getCoordinates(e);
    socket?.emit('cursor-move', { x: coords.x, y: coords.y });

    if (tool === 'laser') {
      socket?.emit('laser-pointer', { x: coords.x, y: coords.y, isDrawing: false });
    }

    if (!isDrawing || !activeElementId || role === 'observer') return;

    if (tool === 'pencil') {
      const updated = whiteboardElements.map((el) => {
        if (el.id === activeElementId && el.points) {
          return {
            ...el,
            points: [...el.points, coords],
          };
        }
        return el;
      });
      setWhiteboardElements(updated);
    } else if (tool === 'rectangle' || tool === 'circle' || tool === 'line') {
      const updated = whiteboardElements.map((el) => {
        if (el.id === activeElementId && el.x !== undefined && el.y !== undefined) {
          return {
            ...el,
            width: coords.x - el.x,
            height: coords.y - el.y,
          };
        }
        return el;
      });
      setWhiteboardElements(updated);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || role === 'observer') return;
    setIsDrawing(false);

    // Send final element to socket
    const finalized = whiteboardElements.find(el => el.id === activeElementId);
    if (finalized) {
      socket?.emit('whiteboard-draw', { element: finalized });
    }
    setActiveElementId(null);
  };

  // Undo/Redo trigger
  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, prev.length - 1));
    setRedoStack(prev => [...prev, [...whiteboardElements]]);
    setWhiteboardElements(previous);
    socket?.emit('whiteboard-draw-update', { elements: previous }); // Sync
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, prev.length - 1));
    setHistory(prev => [...prev, [...whiteboardElements]]);
    setWhiteboardElements(next);
    socket?.emit('whiteboard-draw-update', { elements: next }); // Sync
  };

  const handleClear = () => {
    setWhiteboardElements([]);
    setHistory([]);
    setRedoStack([]);
    socket?.emit('whiteboard-clear');
  };

  const exportCanvasPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create temporary anchor
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-${sessionId.substring(0,8)}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Draggable Sticky Note updates
  const handleStickyTextChange = (id: string, newText: string) => {
    const updated = whiteboardElements.map(el => el.id === id ? { ...el, text: newText } : el);
    setWhiteboardElements(updated);
    const item = updated.find(el => el.id === id);
    if (item) socket?.emit('whiteboard-draw', { element: item });
  };

  const handleStickyDrag = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (role === 'observer') return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const item = whiteboardElements.find(el => el.id === id);
    if (!item || item.x === undefined || item.y === undefined) return;
    
    const origX = item.x;
    const origY = item.y;

    const handleMouseDrag = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;
      const updated = whiteboardElements.map(el => 
        el.id === id ? { ...el, x: origX + dx, y: origY + dy } : el
      );
      setWhiteboardElements(updated);
    };

    const handleMouseDragEnd = () => {
      window.removeEventListener('mousemove', handleMouseDrag);
      window.removeEventListener('mouseup', handleMouseDragEnd);
      
      const finishedItem = whiteboardElements.find(el => el.id === id);
      if (finishedItem) socket?.emit('whiteboard-draw', { element: finishedItem });
    };

    window.addEventListener('mousemove', handleMouseDrag);
    window.addEventListener('mouseup', handleMouseDragEnd);
  };

  return (
    <div className="flex flex-col h-full bg-black/40 border border-white/10 rounded-2xl overflow-hidden glass-panel">
      {/* Tool bar */}
      <div className="flex justify-between items-center p-3 bg-black/60 border-b border-white/10 select-none">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTool('pencil')}
            className={`p-2 rounded hover:bg-white/10 transition ${tool === 'pencil' ? 'bg-purple-600/35 text-purple-400' : 'text-gray-400'}`}
            title="Pencil Brush"
          >
            <Edit3 size={16} />
          </button>
          <button
            onClick={() => setTool('rectangle')}
            className={`p-2 rounded hover:bg-white/10 transition ${tool === 'rectangle' ? 'bg-purple-600/35 text-purple-400' : 'text-gray-400'}`}
            title="Rectangle"
          >
            <Square size={16} />
          </button>
          <button
            onClick={() => setTool('circle')}
            className={`p-2 rounded hover:bg-white/10 transition ${tool === 'circle' ? 'bg-purple-600/35 text-purple-400' : 'text-gray-400'}`}
            title="Circle"
          >
            <Circle size={16} />
          </button>
          <button
            onClick={() => setTool('line')}
            className={`p-2 rounded hover:bg-white/10 transition ${tool === 'line' ? 'bg-purple-600/35 text-purple-400' : 'text-gray-400'}`}
            title="Line"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setTool('text')}
            className={`p-2 rounded hover:bg-white/10 transition ${tool === 'text' ? 'bg-purple-600/35 text-purple-400' : 'text-gray-400'}`}
            title="Insert Text"
          >
            <Type size={16} />
          </button>
          <button
            onClick={() => setTool('sticky')}
            className={`p-2 rounded hover:bg-white/10 transition ${tool === 'sticky' ? 'bg-purple-600/35 text-purple-400' : 'text-gray-400'}`}
            title="Sticky Note"
          >
            <HelpCircle size={16} />
          </button>
          <button
            onClick={() => setTool('laser')}
            className={`p-2 rounded hover:bg-white/10 transition ${tool === 'laser' ? 'bg-purple-600/35 text-purple-400' : 'text-gray-400'}`}
            title="Laser Pointer"
          >
            <span className="w-3 h-3 bg-red-500 rounded-full inline-block" />
          </button>
        </div>

        {/* Color and size */}
        <div className="flex items-center space-x-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 bg-transparent border-0 cursor-pointer"
            title="Brush Color"
          />
          <input
            type="range"
            min="1"
            max="12"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-16 accent-purple-500"
            title="Brush Size"
          />
        </div>

        {/* Action controllers */}
        <div className="flex items-center space-x-2">
          <button onClick={handleUndo} className="p-2 rounded hover:bg-white/10 text-gray-400" title="Undo">
            <Undo size={16} />
          </button>
          <button onClick={handleRedo} className="p-2 rounded hover:bg-white/10 text-gray-400" title="Redo">
            <Redo size={16} />
          </button>
          <button onClick={exportCanvasPNG} className="p-2 rounded hover:bg-white/10 text-blue-400" title="Export as PNG">
            <FileDown size={16} />
          </button>
          {role !== 'observer' && (
            <button onClick={handleClear} className="p-2 rounded hover:bg-red-950/40 text-red-400" title="Clear Board">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-[#13111c] grid-dots select-none">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="absolute inset-0 w-full h-full cursor-crosshair"
        />

        {/* Layered Sticky Notes */}
        {whiteboardElements
          .filter((el) => el.type === 'sticky' && el.x !== undefined && el.y !== undefined)
          .map((el) => (
            <div
              key={el.id}
              style={{
                position: 'absolute',
                left: `${el.x}px`,
                top: `${el.y}px`,
                width: `${el.width}px`,
                height: `${el.height}px`,
                backgroundColor: el.color,
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              }}
              className="p-2 rounded border border-yellow-600/20 text-black flex flex-col cursor-move"
            >
              <div
                onMouseDown={(e) => handleStickyDrag(e, el.id)}
                className="h-4 bg-yellow-600/10 cursor-move border-b border-black/5 mb-1"
                title="Drag sticky note"
              />
              <textarea
                value={el.text || ''}
                disabled={role === 'observer'}
                onChange={(e) => handleStickyTextChange(el.id, e.target.value)}
                className="flex-1 bg-transparent resize-none focus:outline-none text-xs border-0 outline-none w-full h-full font-sans leading-snug"
              />
            </div>
          ))}
      </div>
    </div>
  );
});

export default Whiteboard;
