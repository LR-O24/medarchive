"""
database.py - Inicialização e utilitários do banco de dados SQLite.
"""
import sqlite3
import os

DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'medarchive.db')


def get_db():
    """Retorna uma conexão com o banco de dados SQLite."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Cria as tabelas do banco de dados caso não existam."""
    conn = get_db()
    cursor = conn.cursor()

    # Tabela de usuários do sistema
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Tabela de pacientes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cns TEXT UNIQUE NOT NULL,
            birth_date TEXT,
            status TEXT DEFAULT 'Ativo',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Tabela de pastas (para acompanhamento de progressão)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )
    ''')

    # Tabela de junção para classificações de pastas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS folder_classifications (
            folder_id INTEGER NOT NULL,
            classification TEXT NOT NULL,
            PRIMARY KEY (folder_id, classification),
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
        )
    ''')

    # Tabela de documentos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            folder_id INTEGER,
            title TEXT NOT NULL,
            classification TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            notes TEXT,
            uploaded_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        )
    ''')

    # Garante a existência da coluna folder_id se a tabela já existia sem ela
    cursor.execute("PRAGMA table_info(documents)")
    columns = [row[1] for row in cursor.fetchall()]
    if 'folder_id' not in columns:
        cursor.execute("ALTER TABLE documents ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL")

    # Tabela de junção para múltiplas classificações
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS document_classifications (
            document_id INTEGER NOT NULL,
            classification TEXT NOT NULL,
            PRIMARY KEY (document_id, classification),
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
    ''')

    conn.commit()
    conn.close()


# Classificações válidas de documentos
CLASSIFICATIONS = [
    'Prontuário',
    'Amputação',
    'Atestado',
    'Tratamento',
    'Curativo',
    'Consulta',
    'Exame',
    'Receitas',
]

# Tipos de arquivo permitidos
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'}


def allowed_file(filename):
    """Verifica se a extensão do arquivo é permitida."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
