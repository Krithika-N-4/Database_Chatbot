import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';

// Helper to format results into a table
const formatResultAsTable = (result, columns) => {
  if (!result || result.length === 0) return null;
  
  const headers = columns.length > 0 ? columns : Object.keys(result[0] || {});

  return (
    <div className="overflow-x-auto">
      <table className="w-full border border-gray-600 rounded-lg">
        <thead>
          <tr className="bg-gray-700">
            {headers.map((header, i) => (
              <th key={i} className="border border-gray-600 px-4 py-2 text-left text-gray-200">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.map((row, i) => (
            <tr key={i} className="hover:bg-gray-800">
              {headers.map((header, j) => (
                <td key={j} className="border border-gray-600 px-4 py-2 text-gray-200">
                  {row[header] !== null && row[header] !== undefined ? String(row[header]) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Chat = () => {
  const { messages, sendMessage, selectedDb } = useAppContext();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedDb) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-4xl p-4 rounded-lg shadow-md ${
              msg.sender === 'user' ? 'bg-blue-600' : 'bg-gray-700'
            }`}>
              {msg.sql && (
                <div className="bg-gray-900 p-3 rounded-md mb-3">
                  <p className="text-xs text-yellow-300 mb-1">Generated SQL:</p>
                  <pre className="text-sm text-yellow-300 whitespace-pre-wrap font-mono">{msg.sql}</pre>
                </div>
              )}
              {msg.isTable ? 
                formatResultAsTable(msg.text, msg.columns) : 
                <p className="whitespace-pre-wrap text-gray-200">{msg.text}</p>
              }
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-gray-800 p-4 border-t border-gray-700">
        <form onSubmit={handleSend} className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedDb ? `Ask about ${selectedDb}...` : 'Please select a database.'}
            disabled={!selectedDb}
            className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-600 text-gray-200 placeholder-gray-400"
          />
          <button 
            type="submit" 
            disabled={!selectedDb || !input.trim()} 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-r-md font-semibold transition text-white"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;