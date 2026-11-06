import { App } from './App.jsx';
import { ThemeProvider } from './theme/ThemeProvider.jsx';

// The portable distribution opens local personal data without a hosted account.
export function Site() {
  return <ThemeProvider><App initialMode="personal"/></ThemeProvider>;
}
