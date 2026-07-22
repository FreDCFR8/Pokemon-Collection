import { createRoot } from 'react-dom/client';
import { App } from './App';
import { IdentityProvider } from './features/auth/IdentityProvider';
import './ui/design-system.css';
import './styles.css';

createRoot(document.querySelector('#root') as Element).render(<IdentityProvider><App /></IdentityProvider>);
