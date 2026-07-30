import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.js';
import { RequireAuth } from './auth/RequireAuth.js';
import { Layout } from './components/Layout.js';
import { ChildDetailPage } from './pages/ChildDetailPage.js';
import { ChildNewPage } from './pages/ChildNewPage.js';
import { ChildrenListPage } from './pages/ChildrenListPage.js';
import { ConversationDetailPage } from './pages/ConversationDetailPage.js';
import { ConversationHistoryPage } from './pages/ConversationHistoryPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { MemoryPage } from './pages/MemoryPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { SafetyPage } from './pages/SafetyPage.js';
import './styles.css';

export function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Navigate to="/children" replace />} />
            <Route path="/children" element={<ChildrenListPage />} />
            <Route path="/children/new" element={<ChildNewPage />} />
            <Route path="/children/:childId" element={<ChildDetailPage />} />
            <Route path="/children/:childId/history" element={<ConversationHistoryPage />} />
            <Route
              path="/children/:childId/history/:conversationId"
              element={<ConversationDetailPage />}
            />
            <Route path="/children/:childId/memory" element={<MemoryPage />} />
            <Route path="/children/:childId/privacy" element={<PrivacyPage />} />
            <Route path="/children/:childId/safety" element={<SafetyPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/children" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
