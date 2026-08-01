/**
 * login.js — Lógica da página de login
 */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const btnLogin = document.getElementById('btn-login');
    const btnText = btnLogin.querySelector('.btn-text');
    const btnLoader = btnLogin.querySelector('.btn-loader');
    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('username');

    // Toggle de visibilidade da senha
    togglePassword.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';

        const eyeOpen = togglePassword.querySelector('.eye-open');
        const eyeClosed = togglePassword.querySelector('.eye-closed');
        eyeOpen.style.display = isPassword ? 'none' : 'block';
        eyeClosed.style.display = isPassword ? 'block' : 'none';
    });

    // Submissão do formulário com feedback visual
    form.addEventListener('submit', (e) => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            e.preventDefault();
            shakeCard();
            return;
        }

        // Mostra loading
        btnLogin.classList.add('loading');
        btnText.style.display = 'none';
        btnLoader.style.display = 'flex';
    });

    // Animação de shake no card em caso de erro
    function shakeCard() {
        const card = document.getElementById('login-card');
        card.style.animation = 'shake 0.5s ease-in-out';
        card.addEventListener('animationend', () => {
            card.style.animation = '';
        }, { once: true });
    }

    // Adiciona keyframe de shake dinamicamente
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);

    // Auto-dismiss de alertas flash
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            alert.style.transition = 'all 0.4s ease';
            setTimeout(() => alert.remove(), 400);
        }, 5000);
    });

    // Focus automático no campo de usuário
    usernameInput.focus();
});
