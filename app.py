"""
app.py - Aplicação Flask principal do Sistema de Documentação Médica.
"""
import os
from datetime import datetime
from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, jsonify, send_from_directory
)
from flask_bcrypt import Bcrypt
from flask_login import (
    LoginManager, UserMixin, login_user, logout_user,
    login_required, current_user
)
from werkzeug.utils import secure_filename
from database import get_db, init_db, CLASSIFICATIONS, allowed_file

# ─── Configuração da Aplicação ───────────────────────────────────────────────
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-medarchive-7e82bf91')
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB máximo

bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Por favor, faça login para acessar o sistema.'

# Garante que a pasta de uploads existe
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Inicializa o banco de dados
init_db()


# ─── Modelo de Usuário ───────────────────────────────────────────────────────
class User(UserMixin):
    def __init__(self, id, username, name):
        self.id = id
        self.username = username
        self.name = name


@login_manager.user_loader
def load_user(user_id):
    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        return None
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id_int,)).fetchone()
    conn.close()
    if user:
        return User(user['id'], user['username'], user['name'])
    return None


# ─── Rotas de Autenticação ───────────────────────────────────────────────────
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username or not password:
            flash('Preencha todos os campos.', 'error')
            return render_template('login.html')

        conn = get_db()
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        conn.close()

        if user and bcrypt.check_password_hash(user['password_hash'], password):
            login_user(User(user['id'], user['username'], user['name']))
            flash('Login realizado com sucesso!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Usuário ou senha incorretos.', 'error')

    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Sessão encerrada.', 'info')
    return redirect(url_for('login'))


# ─── Dashboard ───────────────────────────────────────────────────────────────
@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html',
                           user_name=current_user.name,
                           classifications=CLASSIFICATIONS)


# ─── API de Pacientes ────────────────────────────────────────────────────────
@app.route('/api/patients', methods=['GET'])
@login_required
def get_patients():
    search = request.args.get('search', '').strip()
    conn = get_db()

    if search:
        patients = conn.execute(
            """SELECT * FROM patients 
               WHERE name LIKE ? OR cns LIKE ? 
               ORDER BY name""",
            (f'%{search}%', f'%{search}%')
        ).fetchall()
    else:
        patients = conn.execute(
            "SELECT * FROM patients ORDER BY name"
        ).fetchall()

    conn.close()

    return jsonify([{
        'id': p['id'],
        'name': p['name'],
        'cns': p['cns'],
        'birth_date': p['birth_date'],
        'status': p['status'],
        'notes': p['notes'],
        'created_at': p['created_at'],
        'updated_at': p['updated_at'],
    } for p in patients])


@app.route('/api/patients/<int:patient_id>', methods=['GET'])
@login_required
def get_patient(patient_id):
    conn = get_db()
    patient = conn.execute(
        "SELECT * FROM patients WHERE id = ?", (patient_id,)
    ).fetchone()

    if not patient:
        conn.close()
        return jsonify({'error': 'Paciente não encontrado'}), 404

    # Conta documentos e pastas por classificação usando as tabelas de junção
    doc_counts = conn.execute(
        """SELECT classification, COUNT(DISTINCT item_id) as count FROM (
               SELECT dc.classification, d.id as item_id
               FROM document_classifications dc
               JOIN documents d ON dc.document_id = d.id
               WHERE d.patient_id = ?
               UNION ALL
               SELECT fc.classification, f.id + 1000000 as item_id
               FROM folder_classifications fc
               JOIN folders f ON fc.folder_id = f.id
               WHERE f.patient_id = ?
           ) GROUP BY classification""",
        (patient_id, patient_id)
    ).fetchall()
    conn.close()

    return jsonify({
        'id': patient['id'],
        'name': patient['name'],
        'cns': patient['cns'],
        'birth_date': patient['birth_date'],
        'status': patient['status'],
        'notes': patient['notes'],
        'created_at': patient['created_at'],
        'updated_at': patient['updated_at'],
        'doc_counts': {d['classification']: d['count'] for d in doc_counts},
    })


@app.route('/api/patients', methods=['POST'])
@login_required
def create_patient():
    data = request.get_json()

    name = data.get('name', '').strip()
    cns = data.get('cns', '').strip()
    birth_date = data.get('birth_date', '').strip()
    notes = data.get('notes', '').strip()

    if not name or not cns:
        return jsonify({'error': 'Nome e CNS são obrigatórios.'}), 400

    conn = get_db()

    # Verifica se CNS já existe
    existing = conn.execute(
        "SELECT id FROM patients WHERE cns = ?", (cns,)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'CNS já cadastrado no sistema.'}), 409

    cursor = conn.execute(
        """INSERT INTO patients (name, cns, birth_date, notes) 
           VALUES (?, ?, ?, ?)""",
        (name, cns, birth_date or None, notes or None)
    )
    patient_id = cursor.lastrowid
    conn.commit()

    patient = conn.execute(
        "SELECT * FROM patients WHERE id = ?", (patient_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        'id': patient['id'],
        'name': patient['name'],
        'cns': patient['cns'],
        'birth_date': patient['birth_date'],
        'status': patient['status'],
        'notes': patient['notes'],
        'created_at': patient['created_at'],
        'updated_at': patient['updated_at'],
    }), 201


@app.route('/api/patients/<int:patient_id>', methods=['PUT'])
@login_required
def update_patient(patient_id):
    data = request.get_json()
    conn = get_db()

    patient = conn.execute(
        "SELECT * FROM patients WHERE id = ?", (patient_id,)
    ).fetchone()
    if not patient:
        conn.close()
        return jsonify({'error': 'Paciente não encontrado'}), 404

    name = data.get('name', patient['name']).strip()
    cns = data.get('cns', patient['cns']).strip()
    birth_date = data.get('birth_date', patient['birth_date'])
    status = data.get('status', patient['status'])
    notes = data.get('notes', patient['notes'])

    conn.execute(
        """UPDATE patients 
           SET name=?, cns=?, birth_date=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?""",
        (name, cns, birth_date, status, notes, patient_id)
    )
    conn.commit()

    updated = conn.execute(
        "SELECT * FROM patients WHERE id = ?", (patient_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        'id': updated['id'],
        'name': updated['name'],
        'cns': updated['cns'],
        'birth_date': updated['birth_date'],
        'status': updated['status'],
        'notes': updated['notes'],
        'updated_at': updated['updated_at'],
    })


# ─── API de Pastas ─────────────────────────────────────────────────────────
@app.route('/api/patients/<int:patient_id>/folders', methods=['GET'])
@login_required
def get_folders(patient_id):
    classifications = request.args.getlist('classification')
    if len(classifications) == 1 and ',' in classifications[0]:
        classifications = [c.strip() for c in classifications[0].split(',') if c.strip()]

    search = request.args.get('search', '').strip()
    conn = get_db()

    query = """
        SELECT f.*, GROUP_CONCAT(fc.classification, ',') as classifications,
               COUNT(DISTINCT d.id) as doc_count,
               MAX(d.created_at) as latest_doc_date
        FROM folders f
        LEFT JOIN folder_classifications fc ON f.id = fc.folder_id
        LEFT JOIN documents d ON f.id = d.folder_id
        WHERE f.patient_id = ?
    """
    params = [patient_id]

    if classifications:
        placeholders = ','.join(['?'] * len(classifications))
        query += f"""
            AND f.id IN (
                SELECT folder_id FROM folder_classifications 
                WHERE classification IN ({placeholders})
                GROUP BY folder_id
                HAVING COUNT(DISTINCT classification) = {len(classifications)}
            )
        """
        params.extend(classifications)

    if search:
        query += " AND (f.name LIKE ? OR f.description LIKE ?)"
        params.extend([f'%{search}%', f'%{search}%'])

    query += " GROUP BY f.id ORDER BY COALESCE(MAX(d.created_at), f.created_at) DESC"

    folders = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([{
        'id': f['id'],
        'patient_id': f['patient_id'],
        'name': f['name'],
        'description': f['description'],
        'classifications': f['classifications'].split(',') if f['classifications'] else [],
        'doc_count': f['doc_count'],
        'latest_doc_date': f['latest_doc_date'] or f['created_at'],
        'created_at': f['created_at'],
        'updated_at': f['updated_at'],
    } for f in folders])


@app.route('/api/patients/<int:patient_id>/folders', methods=['POST'])
@login_required
def create_folder(patient_id):
    data = request.get_json() or {}
    if not data:
        data = request.form

    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    classifications = data.get('classifications', [])
    if isinstance(classifications, str):
        classifications = [c.strip() for c in classifications.split(',') if c.strip()]

    if not name or not classifications:
        return jsonify({'error': 'Nome e pelo menos uma classificação são obrigatórios.'}), 400

    for c in classifications:
        if c not in CLASSIFICATIONS:
            return jsonify({'error': f'Classificação inválida: {c}'}), 400

    conn = get_db()
    patient = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
    if not patient:
        conn.close()
        return jsonify({'error': 'Paciente não encontrado'}), 404

    cursor = conn.execute(
        "INSERT INTO folders (patient_id, name, description) VALUES (?, ?, ?)",
        (patient_id, name, description or None)
    )
    folder_id = cursor.lastrowid

    for c in classifications:
        conn.execute(
            "INSERT INTO folder_classifications (folder_id, classification) VALUES (?, ?)",
            (folder_id, c)
        )

    conn.execute("UPDATE patients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (patient_id,))
    conn.commit()

    folder = conn.execute(
        """SELECT f.*, GROUP_CONCAT(fc.classification, ',') as classifications
           FROM folders f
           LEFT JOIN folder_classifications fc ON f.id = fc.folder_id
           WHERE f.id = ?
           GROUP BY f.id""",
        (folder_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        'id': folder['id'],
        'patient_id': folder['patient_id'],
        'name': folder['name'],
        'description': folder['description'],
        'classifications': folder['classifications'].split(',') if folder['classifications'] else [],
        'doc_count': 0,
        'created_at': folder['created_at'],
        'updated_at': folder['updated_at'],
    }), 201


@app.route('/api/folders/<int:folder_id>', methods=['GET'])
@login_required
def get_folder_details(folder_id):
    conn = get_db()
    folder = conn.execute(
        """SELECT f.*, GROUP_CONCAT(fc.classification, ',') as classifications
           FROM folders f
           LEFT JOIN folder_classifications fc ON f.id = fc.folder_id
           WHERE f.id = ?
           GROUP BY f.id""",
        (folder_id,)
    ).fetchone()

    if not folder:
        conn.close()
        return jsonify({'error': 'Pasta não encontrada'}), 404

    # Busca documentos da pasta em ordem cronológica decrescente (mais recente primeiro)
    documents = conn.execute(
        """SELECT d.*, GROUP_CONCAT(dc.classification, ',') as classifications
           FROM documents d
           LEFT JOIN document_classifications dc ON d.id = dc.document_id
           WHERE d.folder_id = ?
           GROUP BY d.id
           ORDER BY d.created_at DESC""",
        (folder_id,)
    ).fetchall()
    conn.close()

    return jsonify({
        'id': folder['id'],
        'patient_id': folder['patient_id'],
        'name': folder['name'],
        'description': folder['description'],
        'classifications': folder['classifications'].split(',') if folder['classifications'] else [],
        'created_at': folder['created_at'],
        'updated_at': folder['updated_at'],
        'documents': [{
            'id': d['id'],
            'patient_id': d['patient_id'],
            'folder_id': d['folder_id'],
            'title': d['title'],
            'classification': d['classifications'] if d['classifications'] else d['classification'],
            'classifications': d['classifications'].split(',') if d['classifications'] else [d['classification']],
            'file_path': d['file_path'],
            'file_type': d['file_type'],
            'notes': d['notes'],
            'uploaded_by': d['uploaded_by'],
            'created_at': d['created_at'],
        } for d in documents]
    })


@app.route('/api/folders/<int:folder_id>', methods=['DELETE'])
@login_required
def delete_folder(folder_id):
    conn = get_db()
    folder = conn.execute("SELECT * FROM folders WHERE id = ?", (folder_id,)).fetchone()
    if not folder:
        conn.close()
        return jsonify({'error': 'Pasta não encontrada'}), 404

    conn.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Pasta excluída com sucesso.'})


# ─── API de Documentos ──────────────────────────────────────────────────────
@app.route('/api/patients/<int:patient_id>/documents', methods=['GET'])
@login_required
def get_documents(patient_id):
    classifications = request.args.getlist('classification')
    if len(classifications) == 1 and ',' in classifications[0]:
        classifications = [c.strip() for c in classifications[0].split(',') if c.strip()]

    search = request.args.get('search', '').strip()
    folder_id_param = request.args.get('folder_id')
    unfoldered_only = request.args.get('unfoldered', '').lower() in ('true', '1')

    conn = get_db()

    query = """
        SELECT d.*, GROUP_CONCAT(dc.classification, ',') as classifications
        FROM documents d
        LEFT JOIN document_classifications dc ON d.id = dc.document_id
        WHERE d.patient_id = ?
    """
    params = [patient_id]

    if folder_id_param:
        query += " AND d.folder_id = ?"
        params.append(int(folder_id_param))
    elif unfoldered_only:
        query += " AND d.folder_id IS NULL"

    if classifications:
        placeholders = ','.join(['?'] * len(classifications))
        query += f"""
            AND d.id IN (
                SELECT document_id FROM document_classifications 
                WHERE classification IN ({placeholders})
                GROUP BY document_id
                HAVING COUNT(DISTINCT classification) = {len(classifications)}
            )
        """
        params.extend(classifications)

    if search:
        query += " AND (d.title LIKE ? OR d.notes LIKE ?)"
        params.extend([f'%{search}%', f'%{search}%'])

    query += " GROUP BY d.id ORDER BY d.created_at DESC"

    documents = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([{
        'id': d['id'],
        'patient_id': d['patient_id'],
        'folder_id': d['folder_id'],
        'title': d['title'],
        'classification': d['classifications'] if d['classifications'] else d['classification'],
        'classifications': d['classifications'].split(',') if d['classifications'] else [d['classification']],
        'file_path': d['file_path'],
        'file_type': d['file_type'],
        'notes': d['notes'],
        'uploaded_by': d['uploaded_by'],
        'created_at': d['created_at'],
    } for d in documents])


@app.route('/api/patients/<int:patient_id>/documents', methods=['POST'])
@login_required
def upload_document(patient_id):
    conn = get_db()

    # Verifica se o paciente existe
    patient = conn.execute(
        "SELECT id FROM patients WHERE id = ?", (patient_id,)
    ).fetchone()
    if not patient:
        conn.close()
        return jsonify({'error': 'Paciente não encontrado'}), 404

    # Valida campos obrigatórios
    title = request.form.get('title', '').strip()
    folder_id_val = request.form.get('folder_id')
    folder_id = int(folder_id_val) if folder_id_val and folder_id_val.isdigit() else None

    # Aceita uma ou mais classificações
    classifications = request.form.getlist('classifications')
    if not classifications:
        classifications = request.form.getlist('classifications[]')
    
    if not classifications:
        single_class = request.form.get('classification', '').strip()
        if single_class:
            classifications = [single_class]

    notes = request.form.get('notes', '').strip()

    if not title or not classifications:
        conn.close()
        return jsonify({'error': 'Título e pelo menos uma classificação são obrigatórios.'}), 400

    for c in classifications:
        if c not in CLASSIFICATIONS:
            conn.close()
            return jsonify({'error': f'Classificação inválida: {c}'}), 400

    # Valida arquivo
    if 'file' not in request.files:
        conn.close()
        return jsonify({'error': 'Nenhum arquivo enviado.'}), 400

    file = request.files['file']
    if file.filename == '':
        conn.close()
        return jsonify({'error': 'Nenhum arquivo selecionado.'}), 400

    if not allowed_file(file.filename):
        conn.close()
        return jsonify({'error': 'Tipo de arquivo não permitido. Use: PDF, JPG, PNG, GIF ou WEBP.'}), 400

    # Salva o arquivo
    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_filename = f"{patient_id}_{timestamp}_{filename}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_filename)
    file.save(file_path)

    file_type = filename.rsplit('.', 1)[1].lower()

    # Salva no banco de dados
    class_str = ','.join(classifications)
    cursor = conn.execute(
        """INSERT INTO documents 
           (patient_id, folder_id, title, classification, file_path, file_type, notes, uploaded_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (patient_id, folder_id, title, class_str, safe_filename, file_type,
         notes or None, current_user.username)
    )
    doc_id = cursor.lastrowid

    # Salva cada classificação na tabela de junção
    for c in classifications:
        conn.execute(
            "INSERT INTO document_classifications (document_id, classification) VALUES (?, ?)",
            (doc_id, c)
        )

    # Atualiza data de modificação do paciente e da pasta se houver
    conn.execute(
        "UPDATE patients SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (patient_id,)
    )
    if folder_id:
        conn.execute(
            "UPDATE folders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (folder_id,)
        )

    conn.commit()

    # Recupera o registro completo com as classificações associadas
    doc = conn.execute(
        """SELECT d.*, GROUP_CONCAT(dc.classification, ',') as classifications
           FROM documents d
           LEFT JOIN document_classifications dc ON d.id = dc.document_id
           WHERE d.id = ?
           GROUP BY d.id""", 
        (doc_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        'id': doc['id'],
        'patient_id': doc['patient_id'],
        'folder_id': doc['folder_id'],
        'title': doc['title'],
        'classification': doc['classifications'] if doc['classifications'] else doc['classification'],
        'classifications': doc['classifications'].split(',') if doc['classifications'] else [doc['classification']],
        'file_path': doc['file_path'],
        'file_type': doc['file_type'],
        'notes': doc['notes'],
        'uploaded_by': doc['uploaded_by'],
        'created_at': doc['created_at'],
    }), 201


@app.route('/api/documents/<int:doc_id>/download')
@login_required
def download_document(doc_id):
    conn = get_db()
    doc = conn.execute(
        "SELECT * FROM documents WHERE id = ?", (doc_id,)
    ).fetchone()
    conn.close()

    if not doc:
        return jsonify({'error': 'Documento não encontrado'}), 404

    return send_from_directory(
        app.config['UPLOAD_FOLDER'],
        doc['file_path'],
        as_attachment=True,
        download_name=f"{doc['title']}.{doc['file_type']}"
    )


@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id):
    conn = get_db()
    doc = conn.execute(
        "SELECT * FROM documents WHERE id = ?", (doc_id,)
    ).fetchone()

    if not doc:
        conn.close()
        return jsonify({'error': 'Documento não encontrado'}), 404

    # Remove o arquivo físico
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], doc['file_path'])
    if os.path.exists(file_path):
        os.remove(file_path)

    # Remove do banco de dados
    conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Documento excluído com sucesso.'})


@app.route('/api/classifications', methods=['GET'])
@login_required
def get_classifications():
    return jsonify(CLASSIFICATIONS)


# ─── Inicialização ───────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', debug=debug, port=port)
