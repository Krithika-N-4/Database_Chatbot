import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, listAll, uploadBytes, deleteObject } from 'firebase/storage';
import { auth, storage } from '../firebase/config';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [availableDbs, setAvailableDbs] = useState([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [schema, setSchema] = useState('');
  const [showSchema, setShowSchema] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      if (currentUser) {
        setMessages([{
          text: `Welcome, ${currentUser.email}! Please select a database or upload a new one to begin.`,
          sender: 'bot'
        }]);
        loadAvailableDatabases(currentUser);
      } else {
        setMessages([]);
        setAvailableDbs([]);
        setSelectedDb('');
        setSchema('');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleApiRequest = async (url, options) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'An API error occurred.');
      }
      return response.json();
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  };

  const loadAvailableDatabases = async (currentUser) => {
    try {
      const userDbsRef = ref(storage, `user_dbs/${currentUser.uid}/`);
      const result = await listAll(userDbsRef);
      const dbList = result.items.map(item => item.name);
      setAvailableDbs(dbList);
      if (dbList.length > 0 && !selectedDb) {
        setSelectedDb(dbList[dbList.length - 1]);
      }
    } catch (err) {
      console.error('Error loading databases:', err);
      setError('Failed to load databases.');
    }
  };

  const selectDb = (dbName) => {
    setSelectedDb(dbName);
    setShowSchema(false);
    setMessages(prev => [...prev, {
      text: `Selected database: ${dbName}.`,
      sender: 'bot'
    }]);
  };

  const deleteDb = async (dbName) => {
  if (!window.confirm(`Are you sure you want to delete ${dbName}?`)) return;
  try {
    const storageRef = ref(storage, `user_dbs/${user.uid}/${dbName}`);
    await deleteObject(storageRef);

    setAvailableDbs(prev => prev.filter(name => name !== dbName));
    if (selectedDb === dbName) {
      const remainingDbs = availableDbs.filter(name => name !== dbName);
      setSelectedDb(remainingDbs.length > 0 ? remainingDbs[0] : '');
    }
    setMessages(prev => [...prev, { text: `${dbName} deleted.`, sender: 'bot' }]);
  } catch (err) {
    console.error('Error deleting database:', err);
    setError(`Error deleting database: ${err.message}`);
  }
};
  
  const uploadDb = async (file) => {
    if (!file || !user) return false;
    const storageRef = ref(storage, `user_dbs/${user.uid}/${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      setMessages(prev => [...prev, { text: `Uploaded ${file.name}.`, sender: 'bot' }]);
      await loadAvailableDatabases(user);
      setSelectedDb(file.name); 
      return true; 
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload failed: ${err.message}`);
      return false; 
    }
  };

  const getSchema = async () => {
    if (showSchema) {
      setShowSchema(false);
      return;
    }
    try {
      const data = await handleApiRequest(`http://localhost:8000/schema?db_name=${selectedDb}`, { 
        method: 'GET' 
      });
      setSchema(data.schema);
      setShowSchema(true);
    } catch (err) {
      console.error('Error fetching schema:', err);
      setError(`Error fetching schema: ${err.message}`);
    }
  };
  
  const sendMessage = async (input) => {
    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);

    try {
      const data = await handleApiRequest('http://localhost:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          natural_language_query: input,
          db_name: selectedDb 
        }),
      });
      
      const botMessage = {
        sender: 'bot',
        text: data.result || "I couldn't find an answer to that.",
        sql: data.sql_query,
        columns: data.columns || [],
        isTable: Array.isArray(data.result) && data.result.length > 0,
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => [...prev, { 
        text: `Error: ${err.message}`, 
        sender: 'bot' 
      }]);
    }
  };

  const authActions = {
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signup: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
  };

  const value = {
    user,
    messages,
    availableDbs,
    selectedDb,
    schema,
    showSchema,
    error,
    isLoading,
    setError,
    authActions,
    selectDb,
    deleteDb,
    uploadDb,
    getSchema,
    sendMessage,
  };

  return <AppContext.Provider value={value}>{!isLoading && children}</AppContext.Provider>;
};