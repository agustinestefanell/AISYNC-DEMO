import { AppProvider, useApp } from './context';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { PageA } from './pages/PageA';
import { PageB } from './pages/PageB';
import { PageC } from './pages/PageC';
import { PageD } from './pages/PageD';

function AppInner() {
  const { state } = useApp();

  return (
    <div className="app-page-shell flex h-screen min-h-0 min-w-0 flex-col overflow-hidden">
      <TopBar />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {state.currentPage === 'A' && <PageA />}
        {state.currentPage === 'B' && <PageB />}
        {state.currentPage === 'C' && <PageC />}
        {state.currentPage === 'D' && <PageD />}
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
