import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Ringparken Forensisk ErrorBoundary] Runtime-fejl fanget i underkomponent:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 bg-[#111827] bg-[var(--surface-overlay,#111827)] border border-[#334155] border-[var(--border-subtle,#334155)] border-l-4 border-l-rose-500 rounded-xl text-slate-100 text-[var(--text-primary,#f1f5f9)] shadow-lg max-w-3xl mx-auto">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 rounded">
                  Runtime Sikkerhedslås · ErrorBoundary
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Bevisintegritet og tilstandsdata er bevaret
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-1.5">
                {this.props.fallbackTitle || 'Der opstod en uventet kørselsfejl i komponenten'}
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Modulet stødte på en runtime-fejl under gengivelsen. De øvrige retsmedicinske data, SHA-256 beviskæder og de 29 bygningsenheder i Ringparken er intakte.
              </p>

              {this.state.error && (
                <div className="mt-3 p-3 rounded-lg bg-slate-900/90 border border-slate-800 font-mono text-[11px] text-red-300 overflow-x-auto">
                  <div className="flex items-center gap-1.5 text-red-400 font-bold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{this.state.error.name}: {this.state.error.message}</span>
                  </div>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="text-[11px] text-slate-400 mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack.trim()}
                    </pre>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Genindlæs komponent
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                >
                  Genindlæs hele applikationen
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
