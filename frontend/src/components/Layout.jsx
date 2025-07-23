import React from 'react';
import { useAppContext } from '../context/AppContext';
import Sidebar from './Sidebar';
import Chat from './Chat';

const Layout = () => {
  const { user, authActions } = useAppContext();

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center flex-shrink-0">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">Database Chatbot</h1>
        <div className="flex items-center space-x-4">
          <p className="text-md hidden md:block">Logged in as {user.email}</p>
          <button onClick={authActions.logout} className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded-md font-semibold transition">
            Logout
          </button>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <Sidebar />
        <Chat />
      </main>
    </div>
  );
};

export default Layout;