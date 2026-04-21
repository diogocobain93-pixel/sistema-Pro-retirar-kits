import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, User as UserIcon, LayoutDashboard, Settings, Ticket, MonitorSpeaker, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-[260px] bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
        <div className="p-8 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-primary-foreground rounded-sm"></div>
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">KitCheck</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <Link to={user.tipo === 'ADMIN' ? '/admin/dashboard' : '/organizador/dashboard'}>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-primary hover:bg-primary/10 font-medium h-10">
              <LayoutDashboard size={18} />
              Dashboard
            </Button>
          </Link>
          
          {user.tipo === 'ADMIN' ? (
            <>
              <Link to="/admin/dashboard">
                <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-primary hover:bg-primary/10 font-medium h-10">
                  <UserIcon size={18} />
                  Organizadores
                </Button>
              </Link>
              <Link to="/admin/eventos">
                <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-primary hover:bg-primary/10 font-medium h-10">
                  <Ticket size={18} />
                  Eventos
                </Button>
              </Link>
            </>
          ) : (
            <Link to="/organizador/eventos">
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-primary hover:bg-primary/10 font-medium h-10">
                <Ticket size={18} />
                Meus Eventos
              </Button>
            </Link>
          )}

          <Link to="/painel-entrega">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-primary hover:bg-primary/10 font-medium h-10">
              <MonitorSpeaker size={18} />
              Painel de Entrega
            </Button>
          </Link>

          <Link to="/organizador/relatorios">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-primary hover:bg-primary/10 font-medium h-10">
              <FileText size={18} />
              Relatórios
            </Button>
          </Link>
        </nav>

        <div className="p-6 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold text-sm overflow-hidden border border-border">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.nome}`} alt="Avatar" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">{user.nome}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-center gap-2 text-muted-foreground border-border hover:bg-secondary hover:text-foreground h-9"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Sair do Sistema
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        <header className="h-[72px] bg-background border-b border-border flex items-center justify-between px-8 sticky top-0 z-10">
           <h1 className="text-xl font-bold text-foreground">
            {user.tipo === 'ADMIN' ? 'Gestão de Organizadores' : 'Painel do Organizador'}
           </h1>
           <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest bg-secondary px-2 py-1 rounded-md">v1.0.0</span>
           </div>
        </header>

        <div className="p-8 transition-all animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
