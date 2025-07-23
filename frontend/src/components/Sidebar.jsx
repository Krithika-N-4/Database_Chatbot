import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';


const Sidebar = () => {
  const {
    availableDbs,
    selectedDb,
    selectDb,
    deleteDb,
    schema,
    showSchema,
    getSchema,
    uploadDb,
    error,
  } = useAppContext();
  
  const [dbFile, setDbFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.db')) {
      setDbFile(file);
    } else {
      setDbFile(null);
    }
  };

  const handleFileUpload = async () => {
    if (!dbFile) return;
    setIsUploading(true);
    const success = await uploadDb(dbFile);
    if (success) {
      setDbFile(null);
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
    }
    setIsUploading(false);
  };

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col p-4 overflow-y-auto">
      <div className="space-y-3 mb-6">
        <h3 className="font-semibold text-lg text-white">Your Databases</h3>
        {availableDbs.length > 0 ? (
          availableDbs.map((db) => (
            <div key={db} className="flex items-center space-x-2">
              <button
                onClick={() => selectDb(db)}
                className={`flex-1 px-3 py-2 rounded-md text-md font-medium transition text-left ${
                  selectedDb === db 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                {db}
              </button>
              <button 
                onClick={() => deleteDb(db)} 
                className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors" 
                title="Delete"
                aria-label={`Delete ${db}`}
              >
                🗑️
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">No databases found.</p>
        )}
      </div>

      {selectedDb && (
        <div className="space-y-3 mb-6">
          <button 
            onClick={getSchema} 
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold transition text-white"
          >
            {showSchema ? 'Hide Schema' : 'Show Schema'}
          </button>
          {showSchema && schema && (
            <div className="bg-gray-900 p-3 rounded-md max-h-64 overflow-y-auto">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{schema}</pre>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-gray-700 pt-4 mt-auto">
        <h4 className="font-medium mb-3 text-white">Upload New Database</h4>
        <input
          type="file"
          onChange={handleFileChange}
          accept=".db"
          className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-3"
        />
        <button 
          onClick={handleFileUpload} 
          disabled={!dbFile || isUploading} 
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-md font-semibold transition text-white cursor-pointer"
        >
          {isUploading ? 'Uploading...' : 'Upload DB'}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </div>
  );
};

export default Sidebar;