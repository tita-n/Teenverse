import { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface PageStateProps {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center space-y-4">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-tx-secondary">{message}</p>
      </div>
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, action }: PageStateProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-tx-primary">{title}</h2>
        {message && <p className="text-tx-secondary">{message}</p>}
        {action}
      </div>
    </div>
  );
}

export function AuthRequiredState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center space-y-6 p-8">
        <div className="w-20 h-20 mx-auto bg-brand-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-tx-primary">Welcome to TeenVerse</h2>
        <p className="text-tx-secondary max-w-sm">
          Sign in to access your dashboard, connect with friends, and explore all the features.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a href="/" className="btn-primary">Log In</a>
          <a href="/register" className="btn-secondary">Sign Up</a>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, message, icon, action }: PageStateProps) {
  return (
    <div className="text-center py-12 px-4">
      {icon && (
        <div className="w-16 h-16 mx-auto mb-4 bg-surface-muted rounded-full flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-tx-primary mb-1">{title}</h3>
      {message && <p className="text-tx-secondary mb-4">{message}</p>}
      {action}
    </div>
  );
}
