# MedArchive — Sistema de Arquivamento e Consulta de Documentos Médicos

O **MedArchive** é uma aplicação web desenvolvida em Python (Flask) e JavaScript/HTML5/CSS3 para a documentação, acompanhamento de progressão de ferimentos/machucados em pastas e arquivamento de consultas e exames de pacientes.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Python 3.10+
- Git

### Passo a Passo

1. **Clonar o Repositório**
   ```bash
   git clone https://github.com/SEU-USUARIO/medarchive.git
   cd medarchive
   ```

2. **Instalar Dependências**
   ```bash
   pip install -r requirements.txt
   ```

3. **Inicializar o Banco de Dados com Dados de Demonstração**
   ```bash
   python init_db.py
   ```

4. **Executar a Aplicação**
   ```bash
   python app.py
   ```

5. **Acessar no Navegador**
   Abra [http://127.0.0.1:5000](http://127.0.0.1:5000) no seu navegador.
   - **Usuário padrão:** `admin`
   - **Senha padrão:** `admin123`

---

## 🌐 Como Fazer Deploy Gratuito no Render (com GitHub)

O **Render** oferece hospedagem gratuita para aplicações Python/Flask com deploy automático a cada atualização no GitHub.

### Passo 1: Subir o Código para o GitHub

```bash
git init
git add .
git commit -m "Initial commit - MedArchive"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/medarchive.git
git push -u origin main
```

### Passo 2: Criar o Serviço Web no Render

1. Acesse [Render.com](https://render.com/) e crie uma conta gratuita (ou faça login com sua conta GitHub).
2. No painel, clique em **New +** -> **Web Service**.
3. Conecte sua conta do GitHub e selecione o repositório `medarchive`.
4. O Render detectará automaticamente o arquivo `render.yaml` ou configure manualmente:
   - **Name:** `medarchive`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Instance Type:** `Free`
5. Clique em **Create Web Service**.

Em poucos minutos, sua aplicação estará online com um link público (ex: `https://medarchive.onrender.com`).

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Python 3, Flask, Flask-Bcrypt, Flask-Login, SQLite3, Gunicorn
- **Frontend:** HTML5 Semântico, Vanilla CSS3 (Design System responsivo e modo escuro), Javascript ES6+
- **Segurança:** Senhas criptografadas com Bcrypt, autenticação de sessão via Flask-Login
- **Filtros e Pastas:** Sistema de tags para múltiplas classificações simultâneas por documento/pasta e visualização de timeline para evolução de machucados.
