import os
import sqlite3
import tempfile
import time
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Security, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, auth, storage
from groq import Groq
from dotenv import load_dotenv

# --- Setup ---
load_dotenv()

# Firebase initialization
FIREBASE_CRED_PATH = os.getenv("FIREBASE_CRED_PATH", r"C:\Users\Krithika\Desktop\db_chabot\backend\firebase-service-account-key.json")
FIREBASE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET")

if os.path.exists(FIREBASE_CRED_PATH):
    cred = credentials.Certificate(FIREBASE_CRED_PATH)
    firebase_admin.initialize_app(cred, {'storageBucket': FIREBASE_BUCKET})
else:
    print(f"⚠️ Firebase credentials not found at {FIREBASE_CRED_PATH}. Some features may not work.")

# Groq client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# FastAPI app
app = FastAPI(
    title="Database Chatbot API",
    description="API to chat with your SQLite databases.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class QueryRequest(BaseModel):
    natural_language_query: str
    db_name: str

# --- Authentication ---
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Verify Firebase ID token and return user data."""
    try:
        token = credentials.credentials
        return auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid authentication: {e}")

# --- Utility Functions ---

def get_db_schema(db_path: str) -> str:
    """Extract table structure from SQLite database."""
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            schema = ""
            for (table_name,) in tables:
                schema += f"Table {table_name}: ("
                columns = cursor.execute(f"PRAGMA table_info('{table_name}')").fetchall()
                col_defs = [f"{col[1]} {col[2]}" for col in columns]
                schema += ", ".join(col_defs) + ")\n"
            return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading schema: {e}")

def is_safe_sql(sql_query: str) -> bool:
    """Check if SQL query is read-only (SELECT only)."""
    unsafe_keywords = ["DROP", "DELETE", "UPDATE", "ALTER", "TRUNCATE", "INSERT", "CREATE"]
    return not any(keyword in sql_query.upper() for keyword in unsafe_keywords)

def download_db_from_storage(uid: str, db_name: str) -> str:
    """Download user's database from Firebase Storage to temporary file."""
    try:
        bucket = storage.bucket()
        blob = bucket.blob(f"user_dbs/{uid}/{db_name}")
        
        if not blob.exists():
            raise HTTPException(status_code=404, detail=f"Database '{db_name}' not found")
        
        temp_path = os.path.join(tempfile.gettempdir(), f"{uid}_{db_name}")
        blob.download_to_filename(temp_path)
        return temp_path
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download database: {e}")

def safe_remove_file(file_path: str):
    """Safely remove file with retry on Windows permission errors."""
    for _ in range(5):
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
            return
        except PermissionError:
            time.sleep(0.1)
    print(f"⚠️ Could not remove temporary file {file_path}")

# --- API Endpoints ---

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "🚀 Database Chatbot API is running!"}

@app.get("/health")
async def health_check():
    """API health status."""
    return {"status": "healthy", "message": "API is operational"}

@app.get("/schema")
async def get_schema_endpoint(db_name: str = Query(...), user: dict = Depends(get_current_user)):
    """Get database schema for specified database."""
    local_db_path = None
    try:
        local_db_path = download_db_from_storage(user['uid'], db_name)
        schema = get_db_schema(local_db_path)
        return {"schema": schema, "db_name": db_name}
    finally:
        if local_db_path:
            safe_remove_file(local_db_path)

@app.delete("/delete-db")
async def delete_database(db_name: str = Query(...), user: dict = Depends(get_current_user)):
    """Delete database from Firebase Storage."""
    try:
        bucket = storage.bucket()
        blob = bucket.blob(f"user_dbs/{user['uid']}/{db_name}")
        if not blob.exists():
            raise HTTPException(status_code=404, detail="Database not found")
        blob.delete()
        return {"message": f"Database '{db_name}' deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete error: {e}")

@app.post("/upload")
async def upload_database(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload SQLite database to Firebase Storage."""
    if not file.filename.endswith('.db'):
        raise HTTPException(status_code=400, detail="File must be a .db file")
    
    try:
        bucket = storage.bucket()
        blob = bucket.blob(f"user_dbs/{user['uid']}/{file.filename}")
        
        # Upload file content
        content = await file.read()
        blob.upload_from_string(content)
        
        return {"message": f"Database '{file.filename}' uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {e}")

@app.get("/databases")
async def list_databases(user: dict = Depends(get_current_user)):
    """List all databases for the current user."""
    try:
        bucket = storage.bucket()
        blobs = bucket.list_blobs(prefix=f"user_dbs/{user['uid']}/")
        databases = [blob.name.split('/')[-1] for blob in blobs if blob.name.endswith('.db')]
        return {"databases": databases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing databases: {e}")

@app.post("/query")
async def process_query(request: QueryRequest, user: dict = Depends(get_current_user)):
    """Process natural language query and return SQL results."""
    local_db_path = None
    try:
        # Download database
        local_db_path = download_db_from_storage(user['uid'], request.db_name)
        
        # Get schema
        schema = get_db_schema(local_db_path)
        
        # Generate SQL with AI
        prompt = f"""
        Given the database schema:
        {schema}

        Generate a single-line SQLite query to answer: "{request.natural_language_query}"

        Instructions:
        - Use only tables and columns from the schema
        - Output ONLY the raw SQL query, no explanation or markdown
        """
        
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.0
        )
        
        sql_query = chat_completion.choices[0].message.content.strip().replace('```sql', '').replace('```', '')
        
        if not is_safe_sql(sql_query):
            raise HTTPException(status_code=400, detail="Only SELECT queries are allowed")
        
        # Execute query
        with sqlite3.connect(local_db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(sql_query)
            result = [dict(row) for row in cursor.fetchall()]
            column_names = [desc[0] for desc in cursor.description] if cursor.description else []
        
        return {
            "sql_query": sql_query,
            "result": result,
            "columns": column_names,
        }
        
    except sqlite3.Error as e:
        raise HTTPException(status_code=400, detail=f"SQL Error: {e}. Query: {sql_query}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")
    finally:
        if local_db_path:
            safe_remove_file(local_db_path)