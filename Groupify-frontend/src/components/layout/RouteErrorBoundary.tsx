import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { logger } from '../../utils/logger';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  className?: string;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('[RouteErrorBoundary] Uncaught render error', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            'flex min-h-[50vh] items-center justify-center p-4',
            this.props.className
          )}
        >
          <Card className="w-full max-w-md border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This screen crashed. Try reloading, or navigate to another page using
                the sidebar.
              </p>
              <Button type="button" onClick={this.handleReload}>
                Reload
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
