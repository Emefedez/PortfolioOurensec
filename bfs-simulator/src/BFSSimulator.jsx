import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, RotateCcw, MousePointer2, Trash2, Info, ArrowRight, Activity, Zap, Eraser, Move, HardDrive, Save, Download } from 'lucide-react';

const BFSSimulator = () => {
	// --- Estados del Grafo ---
	const [nodes, setNodes] = useState([
		{ id: 0, x: 250, y: 100, label: 'A' },
		{ id: 1, x: 100, y: 200, label: 'B' },
		{ id: 2, x: 350, y: 200, label: 'C' },
		{ id: 3, x: 100, y: 300, label: 'D' },
		{ id: 4, x: 200, y: 300, label: 'E' },
		{ id: 5, x: 400, y: 300, label: 'F' },
	]);

	const [edges, setEdges] = useState([
		[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [4, 5]
	]);

	// --- Estados del Algoritmo ---
	const [algorithm, setAlgorithm] = useState('BFS'); // 'BFS' | 'DFS'
	const [queue, setQueue] = useState([]);
	const [visited, setVisited] = useState(new Set());
	const [processedOrder, setProcessedOrder] = useState([]);
	const [currentNode, setCurrentNode] = useState(null);
	const [isRunning, setIsRunning] = useState(false);
	const [isFinished, setIsFinished] = useState(false);
	const [log, setLog] = useState(["Bienvenido al simulador."]);

	// --- Estados de la Memoria ---
	const [memoryBanks, setMemoryBanks] = useState([null, null, null]);

	useEffect(() => {
		const saved = localStorage.getItem('bfs_sim_banks');
		if (saved) {
			try {
				setMemoryBanks(JSON.parse(saved));
			} catch (e) {
				console.error("Error loading memory banks", e);
			}
		}
	}, []);

	const saveToBank = (slot) => {
		const newBanks = [...memoryBanks];
		newBanks[slot] = {
			nodes: [...nodes],
			edges: [...edges],
			date: new Date().toLocaleTimeString()
		};
		setMemoryBanks(newBanks);
		localStorage.setItem('bfs_sim_banks', JSON.stringify(newBanks));
		setLog(prev => [`Grafo guardado en Banco ${slot + 1}.`, ...prev]);
	};

	const loadFromBank = (slot) => {
		const bank = memoryBanks[slot];
		if (!bank) return;
		resetAlgorithm();
		setNodes(bank.nodes);
		setEdges(bank.edges);
		setLog(prev => [`Grafo cargado desde Banco ${slot + 1}.`, ...prev]);
	};

	const deleteBank = (slot) => {
		const newBanks = [...memoryBanks];
		newBanks[slot] = null;
		setMemoryBanks(newBanks);
		localStorage.setItem('bfs_sim_banks', JSON.stringify(newBanks));
		setLog(prev => [`Banco ${slot + 1} borrado.`, ...prev]);
	};

	// --- Estados de la UI / Edición ---
	const [mode, setMode] = useState('run'); // 'edit' | 'run'
	const [editTool, setEditTool] = useState('move'); // 'move' | 'connect' | 'erase'
	const [selectedNode, setSelectedNode] = useState(null); // Para crear aristas
	const [draggingNode, setDraggingNode] = useState(null); // ID del nodo siendo arrastrado
	const [startNodeId, setStartNodeId] = useState(0);
	const speed = 1000; // ms por paso en auto-play

	const timerRef = useRef(null);
	const svgRef = useRef(null);

	// --- Lógica del Grafo ---

	const addNode = (x, y) => {
		const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 0;
		const label = String.fromCharCode(65 + (newId % 26)) + (newId >= 26 ? Math.floor(newId / 26) : '');
		setNodes([...nodes, { id: newId, x, y, label }]);
		setLog(prev => [`Nodo ${label} añadido.`, ...prev]);
	};

	const deleteNode = (id) => {
		setNodes(nodes.filter(n => n.id !== id));
		setEdges(edges.filter(e => e[0] !== id && e[1] !== id));
		if (startNodeId === id) setStartNodeId(nodes.find(n => n.id !== id)?.id || 0);
		setLog(prev => [`Nodo eliminado.`, ...prev]);
	};

	const toggleEdge = (sourceId, targetId) => {
		if (sourceId === targetId) return;

		const exists = edges.some(e =>
			(e[0] === sourceId && e[1] === targetId) || (e[0] === targetId && e[1] === sourceId)
		);

		if (exists) {
			setEdges(edges.filter(e => !((e[0] === sourceId && e[1] === targetId) || (e[0] === targetId && e[1] === sourceId))));
			setLog(prev => [`Conexión eliminada.`, ...prev]);
		} else {
			setEdges([...edges, [sourceId, targetId]]);
			setLog(prev => [`Conexión creada entre nodos.`, ...prev]);
		}
	};

	const getNeighbors = (id) => {
		const neighbors = [];
		edges.forEach(e => {
			if (e[0] === id) neighbors.push(e[1]);
			if (e[1] === id) neighbors.push(e[0]);
		});
		return neighbors.sort((a, b) => a - b);
	};

	const resetAlgorithm = () => {
		setQueue([]);
		setVisited(new Set());
		setProcessedOrder([]);
		setCurrentNode(null);
		setIsFinished(false);
		setIsRunning(false);
		if (timerRef.current) clearInterval(timerRef.current);
		setLog(prev => ["Algoritmo reiniciado.", ...prev]);
	};

	const clearGraph = () => {
		resetAlgorithm();
		setNodes([]);
		setEdges([]);
		setLog(prev => ["Grafo limpiado.", ...prev]);
	};

	// --- Paso del Algoritmo BFS ---

	const step = () => {
		if (isFinished) return;

		if (currentNode === null && queue.length === 0 && processedOrder.length === 0) {
			const start = startNodeId;
			if (!nodes.find(n => n.id === start)) {
				setLog(prev => ["Error: Nodo de inicio no existe.", ...prev]);
				return;
			}
			setQueue([start]);
			setVisited(new Set([start]));
			setLog(prev => [`Inicio: Agregamos nodo ${getNodeLabel(start)} a la cola y lo marcamos como visitado.`, ...prev]);
			return;
		}

		if (queue.length > 0) {
			const [current, ...restQueue] = queue;

			setCurrentNode(current);
			setQueue(restQueue);
			setProcessedOrder(prev => [...prev, current]);

			const neighbors = getNeighbors(current);
			const unvisitedNeighbors = neighbors.filter(n => !visited.has(n));

			if (unvisitedNeighbors.length > 0) {
				const newVisited = new Set(visited);
				unvisitedNeighbors.forEach(n => newVisited.add(n));
				setVisited(newVisited);
				// Lógica de Encolado (BFS vs DFS)
				if (algorithm === 'BFS') {
					// BFS: FIFO - Añadir al final
					setQueue([...restQueue, ...unvisitedNeighbors]);
					const labels = unvisitedNeighbors.map(id => getNodeLabel(id)).join(", ");
					setLog(prev => [`Explorando ${getNodeLabel(current)}: Vecinos (${labels}) -> A la cola.`, ...prev]);
				} else {
					// DFS: LIFO - Añadir al principio (Stack)
					// Invertimos unvisitedNeighbors para que el primero (menor ID) sea el primero en ser procesado si se sacan del principio
					// Si restQueue es [TOP ... BOTTOM]
					// Queremos poner los vecinos al TOP.
					// Si tenemos A -> B, C. Stack: [B, C]. Pop B. Stack: [C].
					// Queremos visitar B antes que C.
					// Con shift() extraemos el primer elemento.
					// Entonces el array debe ser [TOP, ..., BOTTOM].
					setQueue([...unvisitedNeighbors, ...restQueue]);
					const labels = unvisitedNeighbors.map(id => getNodeLabel(id)).join(", ");
					setLog(prev => [`Explorando ${getNodeLabel(current)}: Vecinos (${labels}) -> A la pila.`, ...prev]);
				}
			} else {
				setLog(prev => [`Explorando ${getNodeLabel(current)}: Sin vecinos nuevos.`, ...prev]);
			}
		} else {
			setIsFinished(true);
			setCurrentNode(null);
			setIsRunning(false);
			setLog(prev => ["Cola vacía. Búsqueda completada.", ...prev]);
			if (timerRef.current) clearInterval(timerRef.current);
		}
	};

	useEffect(() => {
		if (isRunning && !isFinished) {
			timerRef.current = setInterval(step, speed);
		} else {
			clearInterval(timerRef.current);
		}
		return () => clearInterval(timerRef.current);
	}, [isRunning, isFinished, queue, visited, currentNode, processedOrder]);

	const getNodeLabel = (id) => nodes.find(n => n.id === id)?.label || '?';

	// --- Manejo de Eventos del Canvas ---

	const handleCanvasMouseDown = (e) => {
		if (mode !== 'edit') return;
		if (e.target.tagName !== 'svg') return; // Solo si clic en fondo

		if (editTool === 'move') {
			// Añadir nodo solo si no estamos arrastrando (lógica simplificada: clic simple añade)
			const rect = e.target.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			addNode(x, y);
		}
	};

	const handleNodeMouseDown = (e, id) => {
		e.stopPropagation();
		if (mode === 'edit') {
			if (editTool === 'erase') {
				deleteNode(id);
			} else if (editTool === 'connect') {
				if (selectedNode === null) {
					setSelectedNode(id);
				} else {
					toggleEdge(selectedNode, id);
					setSelectedNode(null);
				}
			} else if (editTool === 'move') {
				setDraggingNode(id);
			}
		} else {
			// En modo RUN, clic cambia el nodo de inicio
			if (processedOrder.length === 0 && queue.length === 0) {
				setStartNodeId(id);
				setLog(prev => [`Punto de inicio cambiado a ${getNodeLabel(id)}.`, ...prev]);
			}
		}
	};

	const handleMouseMove = (e) => {
		if (draggingNode !== null && mode === 'edit') {
			const rect = svgRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			setNodes(nodes.map(n => n.id === draggingNode ? { ...n, x, y } : n));
		}
	};

	const handleMouseUp = () => {
		setDraggingNode(null);
	};

	return (
		<div
			className="flex flex-col h-screen text-slate-900 font-sans bg-slate-50"
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
		>
			{/* Header */}
			<header className="bg-white px-6 py-4 flex justify-between items-center shadow-sm z-30 relative">
				<div className="flex items-center gap-4">
					<div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
						<Activity className="w-6 h-6" />
					</div>
					<div>
						<h1 className="text-xl font-medium text-slate-900">Simulador {algorithm}</h1>
						<p className="text-sm text-slate-500">Visualizador de Grafos</p>
					</div>
				</div>

				{/* Algorithm Switcher */}
				<div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mx-4">
					<button
						onClick={() => { setAlgorithm('BFS'); resetAlgorithm(); }}
						className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${algorithm === 'BFS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
						disabled={isRunning || queue.length > 0 || processedOrder.length > 0}
					>
						BFS
					</button>
					<button
						onClick={() => { setAlgorithm('DFS'); resetAlgorithm(); }}
						className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${algorithm === 'DFS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
						disabled={isRunning || queue.length > 0 || processedOrder.length > 0}
					>
						DFS
					</button>
				</div>

				{/* Mode Switcher */}
				<div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
					<button
						onClick={() => { setMode('run'); setSelectedNode(null); setDraggingNode(null); }}
						className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${mode === 'run' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
					>
						<Play className="w-4 h-4" /> Ejecutar
					</button>
					<button
						onClick={() => { setMode('edit'); resetAlgorithm(); }}
						className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${mode === 'edit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
					>
						<MousePointer2 className="w-4 h-4" /> Editar
					</button>
				</div>
			</header>

			{/* Main Content */}
			<div className="flex flex-1 overflow-hidden relative">

				{/* Left: Canvas */}
				<div className="flex-1 relative overflow-hidden bg-slate-50">
					{/* Grid Background */}
					<div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

					{/* Legend */}
					<div className="absolute top-6 left-6 bg-white/90 p-4 rounded-2xl shadow-md border border-slate-100 backdrop-blur-sm z-10 pointer-events-none">
						<h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Leyenda</h3>
						<div className="space-y-2.5">
							<div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-slate-200 border-2 border-slate-400"></div><span className="text-xs text-slate-600 font-medium">No visitado</span></div>
							<div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-amber-100 border-2 border-amber-500"></div><span className="text-xs text-slate-600 font-medium">En Cola</span></div>
							<div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-indigo-600"></div><span className="text-xs text-indigo-700 font-bold">Actual</span></div>
							<div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-emerald-100 border-2 border-emerald-500"></div><span className="text-xs text-slate-600 font-medium">Procesado</span></div>
						</div>
					</div>

					{/* Edit Toolbar (Floating) */}
					{mode === 'edit' && (
						<div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white px-2 py-2 rounded-full shadow-xl border border-slate-200 z-10 flex items-center gap-1 animate-in fade-in slide-in-from-bottom-4">
							<button
								onClick={() => setEditTool('move')}
								className={`p-3 rounded-full transition-colors ${editTool === 'move' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
								title="Mover / Crear"
							>
								<Move className="w-5 h-5" />
							</button>
							<button
								onClick={() => setEditTool('connect')}
								className={`p-3 rounded-full transition-colors ${editTool === 'connect' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
								title="Conectar"
							>
								<Activity className="w-5 h-5" />
							</button>
							<button
								onClick={() => setEditTool('erase')}
								className={`p-3 rounded-full transition-colors ${editTool === 'erase' ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:bg-slate-50'}`}
								title="Borrar"
							>
								<Eraser className="w-5 h-5" />
							</button>
							<div className="w-px h-6 bg-slate-200 mx-1"></div>
							<div className="px-3 text-xs text-slate-500 font-medium">
								{editTool === 'move' && "Arrastra para mover. Clic en fondo para crear."}
								{editTool === 'connect' && "Clic en dos nodos para conectar."}
								{editTool === 'erase' && "Clic en un nodo para borrar."}
							</div>
						</div>
					)}

					<svg
						ref={svgRef}
						className="w-full h-full cursor-crosshair touch-none"
						onMouseDown={handleCanvasMouseDown}
					>
						{/* Edges */}
						{edges.map(([source, target], i) => {
							const sNode = nodes.find(n => n.id === source);
							const tNode = nodes.find(n => n.id === target);
							if (!sNode || !tNode) return null;
							return (
								<line
									key={i}
									x1={sNode.x} y1={sNode.y}
									x2={tNode.x} y2={tNode.y}
									stroke="#94a3b8"
									strokeWidth="2"
									className="transition-all duration-300 pointer-events-none"
								/>
							);
						})}

						{/* Nodes */}
						{nodes.map((node) => {
							const isStart = node.id === startNodeId;
							const isCurrent = node.id === currentNode;
							const isInQueue = queue.includes(node.id);
							const isProcessed = processedOrder.includes(node.id) && node.id !== currentNode;
							const isSelected = selectedNode === node.id;

							let fill = "#f1f5f9"; // slate-100
							let stroke = "#64748b"; // slate-500
							let strokeWidth = "2";
							let textColor = "#475569"; // slate-600
							let shadow = "";

							if (isProcessed) {
								fill = "#dcfce7"; // emerald-100
								stroke = "#22c55e"; // emerald-500
								textColor = "#15803d"; // emerald-700
							} else if (isCurrent) {
								fill = "#4f46e5"; // indigo-600
								stroke = "#4338ca"; // indigo-700
								textColor = "#ffffff";
								shadow = "drop-shadow(0 4px 6px rgba(79, 70, 229, 0.4))";
							} else if (isInQueue) {
								fill = "#fef3c7"; // amber-100
								stroke = "#eab308"; // amber-500
								textColor = "#b45309"; // amber-700
							}

							if (isSelected) {
								stroke = "#ec4899"; // pink-500
								strokeWidth = "3";
								shadow = "drop-shadow(0 0 8px rgba(236, 72, 153, 0.4))";
							}

							return (
								<g
									key={node.id}
									onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
									className={`transition-all duration-300 ease-out ${mode === 'edit' && editTool === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
									style={{ transformOrigin: `${node.x}px ${node.y}px` }}
								>
									<circle
										cx={node.x} cy={node.y} r="24"
										fill={fill}
										stroke={stroke}
										strokeWidth={strokeWidth}
										className="transition-all duration-300"
										style={{ filter: shadow }}
									/>
									<text
										x={node.x} y={node.y} dy=".35em"
										textAnchor="middle"
										fill={textColor}
										className="font-bold text-sm select-none pointer-events-none"
									>
										{node.label}
									</text>
									{isStart && mode === 'run' && !processedOrder.includes(node.id) && !queue.includes(node.id) && (
										<g transform={`translate(${node.x}, ${node.y - 38})`}>
											<rect x="-26" y="-14" width="52" height="20" rx="10" fill="#2563eb" className="shadow-sm" />
											<text x="0" y="-1" textAnchor="middle" fill="white" className="text-[10px] font-bold tracking-wide">INICIO</text>
											<path d="M-4 6 L0 10 L4 6" fill="#2563eb" />
										</g>
									)}
								</g>
							);
						})}
					</svg>
				</div>

				{/* Right: Controls & Data - Material Card */}
				<div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">

					{/* Controls */}
					<div className="p-6 border-b border-slate-100 bg-slate-50/50">
						<h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
							<Zap className="w-4 h-4" /> Controles
						</h2>
						<div className="flex justify-center gap-3 mb-4">
							<button
								onClick={() => setIsRunning(!isRunning)}
								disabled={isFinished || mode === 'edit'}
								className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-all duration-200 shadow-sm ${isFinished
									? 'bg-slate-100 text-slate-400 cursor-not-allowed'
									: isRunning
										? 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200'
										: 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
									}`}
							>
								{isRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
								{isRunning ? "PAUSAR" : "AUTO PLAY"}
							</button>

							<button
								onClick={step}
								disabled={isRunning || isFinished || mode === 'edit'}
								className="flex-1 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
							>
								<SkipForward size={18} /> Paso
							</button>
						</div>

						<div className="flex gap-3">
							<button
								onClick={resetAlgorithm}
								className="flex-1 text-xs py-2.5 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-colors"
							>
								<RotateCcw size={14} /> Reiniciar
							</button>
							<button
								onClick={clearGraph}
								className="flex-1 text-xs py-2.5 border border-red-100 bg-red-50 rounded-lg text-red-600 hover:bg-red-100 hover:border-red-200 flex items-center justify-center gap-1.5 transition-colors"
							>
								<Trash2 size={14} /> Limpiar
							</button>
						</div>
					</div>

					{/* Memory Banks */}
					<div className="px-6 py-4 border-b border-slate-100 bg-white">
						<h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
							<HardDrive className="w-4 h-4" /> Bancos de Memoria
						</h2>
						<div className="grid grid-cols-1 gap-2">
							{memoryBanks.map((bank, i) => (
								<div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-lg group hover:border-indigo-200 transition-colors">
									<div className="flex items-center gap-2 overflow-hidden">
										<div className={`w-2 h-2 rounded-full shrink-0 ${bank ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
										<span className="text-xs font-medium text-slate-600 truncate">
											{bank ? `Banco ${i + 1} (${bank.date})` : `Banco ${i + 1} (Vacío)`}
										</span>
									</div>
									<div className="flex gap-1 shrink-0">
										<button
											onClick={() => saveToBank(i)}
											className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
											title="Guardar"
										>
											<Save size={14} />
										</button>
										{bank && (
											<>
												<button
													onClick={() => loadFromBank(i)}
													className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
													title="Cargar"
												>
													<Download size={14} />
												</button>
												<button
													onClick={() => deleteBank(i)}
													className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
													title="Borrar"
												>
													<Trash2 size={14} />
												</button>
											</>
										)}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Data Visualization */}
					<div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-white">

						{/* Queue Visualization */}
						<div className="animate-in fade-in slide-in-from-right-4 duration-500">
							<div className="flex justify-between items-center mb-3">
								<h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
									<div className="w-2 h-2 rounded-full bg-amber-400"></div> {algorithm === 'BFS' ? 'Cola (Queue)' : 'Pila (Stack)'}
								</h3>
								<span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
									{algorithm === 'BFS' ? 'FIFO' : 'LIFO'}
								</span>
							</div>
							<div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-[70px] flex items-center gap-3 overflow-x-auto shadow-inner">
								{queue.length === 0 ? (
									<span className="text-slate-400 text-sm italic w-full text-center">{algorithm === 'BFS' ? 'Cola vacía...' : 'Pila vacía...'}</span>
								) : (
									<>
										<span className="text-[10px] font-bold text-slate-400 mr-1 tracking-tighter">{algorithm === 'BFS' ? 'SALIDA' : 'TOP'}</span>
										{queue.map((id, idx) => (
											<div key={`${id}-${idx}`} className="w-10 h-10 flex-shrink-0 bg-white border border-amber-200 rounded-lg flex items-center justify-center font-bold text-amber-600 shadow-sm animate-in zoom-in duration-300">
												{getNodeLabel(id)}
											</div>
										))}
										<span className="text-[10px] font-bold text-slate-400 ml-1 tracking-tighter">{algorithm === 'BFS' ? 'ENTRADA' : 'BOTTOM'}</span>
									</>
								)}
							</div>
						</div>

						{/* Current Node */}
						<div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
							<h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
								<div className="w-2 h-2 rounded-full bg-indigo-500"></div> Nodo Actual
							</h3>
							<div className="p-4 border border-indigo-100 bg-indigo-50/50 rounded-2xl flex items-center justify-center min-h-[70px] relative overflow-hidden group">
								{currentNode !== null ? (
									<span className="text-4xl font-black text-indigo-600 drop-shadow-sm scale-110 transition-transform duration-300">{getNodeLabel(currentNode)}</span>
								) : (
									<span className="text-slate-400 text-sm italic">-</span>
								)}
							</div>
						</div>

						{/* Visited Order */}
						<div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-200">
							<h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
								<div className="w-2 h-2 rounded-full bg-emerald-500"></div> Orden de Proceso
							</h3>
							<div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
								{processedOrder.map((id, idx) => (
									<div key={id} className="flex items-center animate-in fade-in slide-in-from-left-2 duration-300">
										<span className="w-8 h-8 rounded-lg bg-white border border-emerald-200 text-emerald-600 font-bold flex items-center justify-center text-sm shadow-sm">
											{getNodeLabel(id)}
										</span>
										{idx < processedOrder.length - 1 && <ArrowRight size={12} className="text-slate-400 mx-1" />}
									</div>
								))}
								{processedOrder.length === 0 && <span className="text-slate-400 text-sm italic w-full text-center py-2">Esperando inicio...</span>}
							</div>
						</div>

						{/* Log */}
						<div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-300 flex-1 flex flex-col min-h-0">
							<h3 className="font-bold text-slate-400 mb-2 text-[10px] uppercase tracking-widest flex justify-between items-center">
								<span>Historial</span>
								<span className="w-16 h-[1px] bg-slate-200"></span>
							</h3>
							<div className="bg-slate-50 text-slate-600 p-3 rounded-xl text-xs font-mono h-40 overflow-y-auto shadow-inner border border-slate-200 custom-scrollbar">
								{log.map((entry, i) => (
									<div key={i} className="mb-1.5 border-b border-slate-200 pb-1.5 last:border-0 last:pb-0 flex gap-2">
										<span className="text-slate-400 shrink-0">[{String(log.length - i).padStart(2, '0')}]</span>
										<span className={entry.includes("Error") ? "text-red-500 font-bold" : entry.includes("Inicio") ? "text-indigo-600 font-bold" : "text-slate-600"}>
											{entry}
										</span>
									</div>
								))}
							</div>
						</div>

					</div>
				</div>
			</div>
		</div>
	);
};

export default BFSSimulator;
