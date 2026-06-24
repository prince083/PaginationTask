import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Layers, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Terminal, 
  Database, 
  AlertTriangle, 
  CheckCircle,
  Clock
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  created_at: string;
  updated_at: string;
}

interface PaginationState {
  nextCursor: string | null;
  snapshot: string | null;
  hasMore: boolean;
}

const CATEGORIES = ['All', 'Electronics', 'Books', 'Fashion', 'Home', 'Sports', 'Toys'];
const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  // Product state
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Pagination & Snapshot State
  const [pagination, setPagination] = useState<PaginationState>({
    nextCursor: null,
    snapshot: null,
    hasMore: true,
  });
  const [snapshotLocked, setSnapshotLocked] = useState<boolean>(true);
  
  // UI Loading States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<{
    inserted: number;
    updated: number;
  } | null>(null);
  
  // Real-time developer transaction logs
  const [logs, setLogs] = useState<Array<{ time: string; type: 'info' | 'success' | 'warn' | 'query'; text: string }>>([]);
  
  const loaderRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef<boolean>(true);

  // Helper to append developer logs
  const addLog = useCallback((text: string, type: 'info' | 'success' | 'warn' | 'query' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, type, text }, ...prev].slice(0, 50)); // Keep last 50 logs
  }, []);

  // Reset pagination state when category or snapshot locking toggles
  const resetFeed = useCallback(() => {
    setProducts([]);
    setPagination({
      nextCursor: null,
      snapshot: null,
      hasMore: true,
    });
    isFirstLoad.current = true;
    addLog(`Feed reset: Category = ${selectedCategory}, Snapshot Locked = ${snapshotLocked}`, 'info');
  }, [selectedCategory, snapshotLocked, addLog]);

  // Fetch a page of products from the API
  const fetchProducts = useCallback(async (cursor: string | null, activeSnapshot: string | null) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const limit = 20;
      const categoryParam = selectedCategory !== 'All' ? `&category=${selectedCategory}` : '';
      const cursorParam = cursor ? `&cursor=${cursor}` : '';
      
      const snapshotParam = (snapshotLocked && activeSnapshot) ? `&snapshot=${activeSnapshot}` : '';

      const queryUrl = `${API_BASE}/api/products?limit=${limit}${categoryParam}${cursorParam}${snapshotParam}`;
      
      addLog(`GET /api/products?limit=${limit}${categoryParam ? ' ' + categoryParam : ''}${cursorParam ? ' [cursor]' : ''}${snapshotParam ? ' [snapshot]' : ''}`, 'query');
      
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const payload = await res.json();
      const { data, pagination: serverPagination } = payload;
      
      setProducts((prev) => {
        const existingIds = new Set(prev.map(p => p.id));
        const uniqueNewData = data.filter((p: Product) => !existingIds.has(p.id));
        if (uniqueNewData.length < data.length) {
          addLog(`Client-side duplicate filter removed ${data.length - uniqueNewData.length} items!`, 'warn');
        }
        return [...prev, ...uniqueNewData];
      });

      setPagination({
        nextCursor: serverPagination.nextCursor,
        snapshot: serverPagination.snapshot,
        hasMore: serverPagination.hasMore,
      });

      addLog(
        `Loaded ${data.length} products. Snapshot: ${new Date(serverPagination.snapshot).toLocaleTimeString()} | HasMore: ${serverPagination.hasMore}`,
        'success'
      );

    } catch (error: any) {
      console.error('Error fetching products:', error);
      addLog(`Fetch failed: ${error.message}`, 'warn');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, snapshotLocked, isLoading, addLog]);

  // Trigger initial fetch when feed resets
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      fetchProducts(null, null);
    }
  }, [pagination.snapshot, fetchProducts]);

  // Watch for category / lock changes to trigger a reset
  useEffect(() => {
    resetFeed();
  }, [selectedCategory, snapshotLocked]);

  // Infinite Scroll Intersection Observer setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && pagination.hasMore && !isLoading && !isFirstLoad.current) {
          fetchProducts(pagination.nextCursor, pagination.snapshot);
        }
      },
      { threshold: 0.1 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [pagination.nextCursor, pagination.snapshot, pagination.hasMore, isLoading, fetchProducts]);

  // Simulate 50 concurrent writes (25 insertions, 25 updates)
  const handleSimulateWrites = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationResult(null);
    addLog('Triggering simulation: 25 background inserts & 25 background updates...', 'info');

    try {
      const res = await fetch(`${API_BASE}/api/products/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCount: 25, updateCount: 25 }),
      });
      
      if (!res.ok) throw new Error('Simulation API call failed');
      
      const payload = await res.json();
      const { insertedCount, updatedCount } = payload.details;
      
      setSimulationResult({ inserted: insertedCount, updated: updatedCount });
      addLog(`Background writes complete: +${insertedCount} new products, ~${updatedCount} existing updated.`, 'success');
      
      setTimeout(() => {
        setSimulationResult(null);
      }, 5000);

    } catch (error: any) {
      console.error('Simulation failed:', error);
      addLog(`Simulation failed: ${error.message}`, 'warn');
    } finally {
      setIsSimulating(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100 font-sans pb-12 relative overflow-x-hidden">
      {/* Premium background radial glowing spotlights representing Coffee and Leaf Green */}
      <div className="fixed inset-0 bg-gradient-to-tr from-emerald-950/15 via-stone-950 to-amber-950/20 pointer-events-none -z-10"></div>
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>

      {/* Header */}
      <header className="border-b border-stone-900 bg-stone-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-700/80 rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center border border-emerald-500/20">
              <Layers className="h-6 w-6 text-emerald-100" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight font-outfit text-white flex items-center">
                StratePage
              </h1>
              <p className="text-xs text-stone-400 font-medium">Consistent Keyset Pagination Demo</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSimulateWrites}
              disabled={isSimulating}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 shadow-md ${
                isSimulating 
                  ? 'bg-stone-900 text-stone-600 cursor-not-allowed border border-stone-800'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-stone-50 border border-emerald-500/30 shadow-emerald-950/50 hover:shadow-emerald-900/30 active:scale-[0.98]'
              }`}
            >
              <Database className={`h-4 w-4 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'Writing...' : 'Simulate 50 Writes'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Simulation success toast overlay */}
      {simulationResult && (
        <div className="fixed bottom-6 right-6 z-50 glass-panel max-w-sm rounded-2xl p-4 shadow-2xl animate-bounce border border-emerald-500/30 bg-stone-900/90">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white">Concurrent Writes Simulated!</h4>
              <p className="text-xs text-stone-300 mt-1">
                Added <span className="font-semibold text-emerald-400">+{simulationResult.inserted}</span> new items and updated <span className="font-semibold text-amber-400">~{simulationResult.updated}</span> existing items in Supabase.
              </p>
              <p className="text-[10px] text-stone-400 mt-2">
                {snapshotLocked 
                  ? '🔒 Snapshot active: scrolling remains stable and duplicate-free!' 
                  : '⚠️ Snapshot disabled: scroll to observe duplicates/skips.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex-grow grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Left Column: Controls and Developer logs */}
        <div className="lg:col-span-1 flex flex-col space-y-6">
          
          {/* Isolation Dashboard Panel */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <h2 className="text-lg font-bold font-outfit text-white">
              Pagination Controls
            </h2>
            <p className="text-xs text-stone-400 mt-1">Configure snapshot locking and view status.</p>
            
            <div className="mt-6 space-y-4">
              {/* Snapshot Locking Switch */}
              <div className="p-4 rounded-xl bg-stone-950/45 border border-stone-900/80">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-stone-200">Snapshot Lock</span>
                  <button
                    onClick={() => setSnapshotLocked(!snapshotLocked)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      snapshotLocked ? 'bg-emerald-600' : 'bg-stone-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        snapshotLocked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center mt-3 text-xs">
                  {snapshotLocked ? (
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-900/30">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Snapshot Active (Consistent)</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-amber-500 font-semibold bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-900/30">
                      <Unlock className="h-3.5 w-3.5" />
                      <span>Live Mode (Unprotected)</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-stone-400 mt-2.5 leading-relaxed">
                  {snapshotLocked 
                    ? "Freezes the dataset when you start scrolling. Concurrent writes will NOT cause duplicates or missed products."
                    : "Requests live data directly. Background writes will cause pagination shifts, duplicates, and missing products."}
                </p>
              </div>

              {/* Status Details */}
              <div className="space-y-2 text-xs bg-stone-950/30 p-4 rounded-xl border border-stone-900">
                <div className="flex justify-between py-1 border-b border-stone-900">
                  <span className="text-stone-400">Locked Timestamp:</span>
                  <span className="font-mono text-amber-400 font-medium">
                    {pagination.snapshot ? formatTime(pagination.snapshot) : 'None'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-900">
                  <span className="text-stone-400">Total Loaded:</span>
                  <span className="font-bold text-white">{products.length} products</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-400">Has More Pages:</span>
                  <span className="font-mono text-emerald-400">{pagination.hasMore ? 'TRUE' : 'FALSE'}</span>
                </div>
              </div>

              {/* Refresh Button */}
              <button
                onClick={resetFeed}
                className="w-full flex items-center justify-center space-x-2 bg-stone-900 hover:bg-stone-850 text-stone-200 border border-stone-800 hover:border-stone-750 py-2 px-4 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.99]"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Start New Session</span>
              </button>
            </div>
          </div>

          {/* Dev/Query Transaction Logs Terminal */}
          <div className="glass-panel rounded-2xl p-5 shadow-xl flex-grow flex flex-col min-h-[300px] max-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-stone-900">
              <h3 className="text-sm font-bold font-outfit text-white flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span>Transaction Log</span>
              </h3>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold border border-emerald-900/40">
                API Tracker
              </span>
            </div>
            <p className="text-[10px] text-stone-500 mt-1.5">Observe live cursor and snapshot parameters.</p>
            
            <div className="mt-3 flex-grow overflow-y-auto font-mono text-[11px] space-y-2.5 pr-1">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-stone-600 italic text-center px-4 py-8">
                  Awaiting transactions... Scroll feed or simulate writes to generate queries.
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="border-b border-stone-900 pb-2 last:border-0">
                    <div className="flex items-center space-x-1.5 mb-0.5">
                      <span className="text-[10px] text-stone-550">{log.time}</span>
                      <span className={`text-[9px] uppercase px-1 rounded font-bold ${
                        log.type === 'query' ? 'bg-amber-950/60 text-amber-400 border border-amber-900/30' :
                        log.type === 'success' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30' :
                        log.type === 'warn' ? 'bg-red-950/60 text-red-400 border border-red-900/30' :
                        'bg-stone-900 text-stone-455'
                      }`}>
                        {log.type}
                      </span>
                    </div>
                    <div className="text-stone-300 break-all leading-relaxed whitespace-pre-wrap">
                      {log.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Columns: Category tabs & Product Grid */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
          
          {/* Category Tabs Scrollable */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none shrink-0">
            <div className="flex items-center space-x-1 bg-stone-900/45 p-1.5 rounded-2xl border border-stone-800/60">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Alert explaining how pagination works under concurrent writes */}
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/30 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-300 leading-relaxed">
              <span className="font-bold text-white">How it Works:</span> We sort by <code className="bg-emerald-950/60 px-1 py-0.5 rounded text-emerald-300 font-mono">updated_at DESC, id DESC</code>. Keyset pagination jumps directly to the last item's values ($O(\log N)$ scan). Toggling <span className="font-semibold text-emerald-400">Snapshot Lock</span> filters queries by the session start timestamp, guaranteeing no duplicate products shift into your feed when background writes occur.
            </div>
          </div>

          {/* Product Feed Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((product) => (
              <div key={product.id} className="glass-card rounded-2xl p-5 flex flex-col justify-between h-[180px] relative overflow-hidden group">
                {/* Coffee & Green Leaf Visual Glow Highlights */}
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/3 rounded-full blur-2xl group-hover:bg-emerald-500/12 transition-all duration-500"></div>
                <div className="absolute -left-4 -top-4 w-20 h-20 bg-amber-500/2 rounded-full blur-2xl group-hover:bg-amber-500/8 transition-all duration-500"></div>
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-stone-850 text-stone-300 border border-stone-800">
                      {product.category}
                    </span>
                    <span className="text-xs font-mono text-stone-500 group-hover:text-stone-400 transition-colors">
                      #{product.id.slice(0, 8)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-stone-200 group-hover:text-white transition-colors mt-2.5 line-clamp-2">
                    {product.name}
                  </h3>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-900/80 flex items-center justify-between relative z-10">
                  <div className="flex items-baseline space-x-0.5">
                    <span className="text-xs font-semibold text-emerald-500">$</span>
                    <span className="text-lg font-black text-amber-400 tracking-tight">{product.price.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex flex-col items-end text-[10px] text-stone-500 space-y-0.5">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{formatDate(product.updated_at)} {formatTime(product.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Trigger and Status */}
          <div ref={loaderRef} className="pt-8 pb-4 flex flex-col items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center space-y-2">
                <RefreshCw className="h-6 w-6 text-emerald-500 animate-spin" />
                <span className="text-xs text-stone-500">Loading products...</span>
              </div>
            ) : !pagination.hasMore ? (
              <div className="text-center py-4">
                <p className="text-sm font-bold text-stone-400 font-outfit">End of Feed</p>
                <p className="text-xs text-stone-650 mt-1">All available products in this snapshot have been loaded.</p>
              </div>
            ) : (
              <div className="text-xs text-stone-600">
                Scroll down to load more
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
