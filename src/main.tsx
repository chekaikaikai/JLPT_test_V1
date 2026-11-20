import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { BankProvider } from './contexts/BankContext';
import { PrefsProvider } from './contexts/PrefsContext';
import { UserDataProvider } from './contexts/UserDataContext';
import './styles/index.css';

// HashRouter：GitHub Pages 是純靜態託管，重新整理任何頁面都不會 404。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <PrefsProvider>
          <BankProvider>
            <UserDataProvider>
              <App />
            </UserDataProvider>
          </BankProvider>
        </PrefsProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
