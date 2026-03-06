import "./index.css";
import "./styles/globals.css";

import HomePageUser from './components/HomePageUser';
import { PanelPositionProvider } from './contexts/PanelPositionContext';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <AuthProvider>
      <PanelPositionProvider>
        <HomePageUser />
        <Toaster position="top-right" richColors />
      </PanelPositionProvider>
    </AuthProvider>
  );
}