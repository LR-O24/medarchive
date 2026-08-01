"""
init_db.py - Inicializa o banco de dados com dados de demonstração.
Execute: python init_db.py
"""
from database import init_db, get_db
from flask_bcrypt import Bcrypt
from flask import Flask

# Cria app temporário para usar bcrypt
app = Flask(__name__)
bcrypt = Bcrypt(app)


def seed_data():
    """Insere dados de exemplo no banco de dados."""
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Verifica se já existe dados
    existing = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if existing > 0:
        print("Banco de dados já possui dados. Pulando seed.")
        conn.close()
        return

    # Criar usuário administrador (senha: admin123)
    password_hash = bcrypt.generate_password_hash('admin123').decode('utf-8')
    cursor.execute(
        "INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)",
        ('admin', password_hash, 'Administrador')
    )

    # Criar pacientes de exemplo
    patients = [
        ('Maria da Silva Santos', '898 0012 3456 0001', '1985-03-15', 'Ativo',
         'Paciente com acompanhamento regular. Hipertensão controlada.'),
        ('João Pedro Oliveira', '898 0012 3456 0002', '1970-08-22', 'Ativo',
         'Diabético tipo 2. Acompanhamento mensal.'),
        ('Ana Clara Ferreira', '898 0012 3456 0003', '1992-11-30', 'Ativo',
         'Gestante - Pré-natal em andamento.'),
        ('Carlos Eduardo Lima', '898 0012 3456 0004', '1965-01-10', 'Inativo',
         'Paciente transferido para outra unidade.'),
        ('Francisca Aparecida Costa', '898 0012 3456 0005', '1948-06-05', 'Ativo',
         'Idosa, acompanhamento geriátrico. Osteoporose.'),
        ('Lucas Gabriel Souza', '898 0012 3456 0006', '2015-09-18', 'Ativo',
         'Paciente pediátrico. Vacinação em dia.'),
        ('Beatriz Helena Rodrigues', '898 0012 3456 0007', '1988-12-25', 'Ativo',
         'Acompanhamento psicológico. Ansiedade generalizada.'),
    ]

    for name, cns, birth, status, notes in patients:
        cursor.execute(
            "INSERT INTO patients (name, cns, birth_date, status, notes) VALUES (?, ?, ?, ?, ?)",
            (name, cns, birth, status, notes)
        )

    # Criar pastas de exemplo para acompanhar progressão de feridas/tratamentos
    folders = [
        (5, 'Evolução da Úlcera - Perna Direita', 'Acompanhamento semanal do tratamento e curativos da ferida na perna direita.', ['Curativo', 'Tratamento']),
        (3, 'Acompanhamento Gestacional', 'Registros da evolução da gravidez e exames de imagem.', ['Prontuário', 'Exame']),
    ]

    folder_ids = {}
    for patient_id, name, description, class_list in folders:
        cursor.execute(
            "INSERT INTO folders (patient_id, name, description) VALUES (?, ?, ?)",
            (patient_id, name, description)
        )
        fid = cursor.lastrowid
        folder_ids[name] = fid
        for c in class_list:
            cursor.execute(
                "INSERT INTO folder_classifications (folder_id, classification) VALUES (?, ?)",
                (fid, c)
            )

    # Criar documentos de exemplo (com suporte a múltiplas classificações e vínculo a pastas)
    documents = [
        (1, None, 'Prontuário Inicial', ['Prontuário', 'Consulta'], 'demo_prontuario.pdf', 'pdf',
         'Prontuário de abertura do paciente.', 'admin'),
        (1, None, 'Exame de Sangue - Hemograma', ['Exame', 'Consulta'], 'demo_exame_sangue.pdf', 'pdf',
         'Hemograma completo. Resultados normais.', 'admin'),
        (1, None, 'Receita - Losartana 50mg', ['Receitas', 'Tratamento'], 'demo_receita.pdf', 'pdf',
         'Losartana 50mg, 1x ao dia.', 'admin'),
        (1, None, 'Consulta 15/03/2026', ['Consulta', 'Tratamento'], 'demo_consulta.pdf', 'pdf',
         'Consulta de rotina. PA: 130x85.', 'admin'),
        (2, None, 'Prontuário Inicial', ['Prontuário'], 'demo_prontuario2.pdf', 'pdf',
         'Prontuário de abertura.', 'admin'),
        (2, None, 'Exame Glicemia', ['Exame'], 'demo_glicemia.pdf', 'pdf',
         'Glicemia em jejum: 145 mg/dL.', 'admin'),
        (2, None, 'Receita - Metformina', ['Receitas', 'Tratamento'], 'demo_receita2.pdf', 'pdf',
         'Metformina 850mg, 2x ao dia.', 'admin'),
        (3, folder_ids.get('Acompanhamento Gestacional'), 'Prontuário Pré-natal', ['Prontuário', 'Consulta'], 'demo_prenatal.pdf', 'pdf',
         'Início do acompanhamento pré-natal.', 'admin'),
        (3, folder_ids.get('Acompanhamento Gestacional'), 'Ultrassom Obstétrico', ['Exame'], 'demo_ultrassom.pdf', 'pdf',
         'Ultrassom 20 semanas. Desenvolvimento normal.', 'admin'),
        (5, None, 'Atestado de Comparecimento', ['Atestado', 'Consulta'], 'demo_atestado.pdf', 'pdf',
         'Atestado para fins de comprovação.', 'admin'),
        (5, None, 'Tratamento Osteoporose', ['Tratamento'], 'demo_tratamento.pdf', 'pdf',
         'Plano de tratamento para osteoporose.', 'admin'),
        (5, folder_ids.get('Evolução da Úlcera - Perna Direita'), 'Curativo Perna Direita - Estado Inicial', ['Curativo', 'Tratamento'], 'demo_curativo.pdf', 'pdf',
         'Curativo realizado em ferida na perna direita - Fase de cicatrização inicial.', 'admin'),
    ]

    for patient_id, folder_id, title, class_list, file_path, file_type, notes, uploaded_by in documents:
        class_str = ','.join(class_list)
        cursor.execute(
            """INSERT INTO documents 
               (patient_id, folder_id, title, classification, file_path, file_type, notes, uploaded_by) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (patient_id, folder_id, title, class_str, safe_filename if 'safe_filename' in locals() else file_path, file_type, notes, uploaded_by)
        )
        doc_id = cursor.lastrowid
        
        for c in class_list:
            cursor.execute(
                "INSERT INTO document_classifications (document_id, classification) VALUES (?, ?)",
                (doc_id, c)
            )

    conn.commit()
    conn.close()
    print("[OK] Banco de dados inicializado com sucesso!")
    print("  - Usuario: admin")
    print("  - Senha: admin123")
    print(f"  - {len(patients)} pacientes criados")
    print(f"  - {len(folders)} pastas criadas")
    print(f"  - {len(documents)} documentos de exemplo criados")


if __name__ == '__main__':
    seed_data()
