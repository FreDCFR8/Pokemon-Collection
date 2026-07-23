import { createRoot } from 'react-dom/client';
import { App } from './App';
import { IdentityProvider } from './features/auth/IdentityProvider';
import './ui/design-system.css';
import './styles.css';
import './ui/app-foundation.css';
import './ui/app-foundation-compat.css';
import './features/collectionPage/collectionPageV2.css';
import './features/cardDetail/cardDetailPolish.css';
import './features/cardDetail/cardDetailContrastPolish.css';
import './features/cardDetail/cardDetailSwipeLock';

createRoot(document.querySelector('#root') as Element).render(<IdentityProvider><App /></IdentityProvider>);