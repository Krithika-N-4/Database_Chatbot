import React from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import Auth from './components/Auth';
import Layout from './components/Layout';

const AppContent = () => {
  const { user } = useAppContext();
  return user ? <Layout /> : <Auth />;
};

function App() {
  return (
    <AppProvider>
      <div className="bg-gray-900 text-white min-h-screen font-nunito">
        <AppContent />
      </div>
    </AppProvider>
  );
}

export default App;