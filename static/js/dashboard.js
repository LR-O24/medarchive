/**
 * dashboard.js — Lógica do painel de pacientes e documentos
 */
document.addEventListener('DOMContentLoaded', () => {
    // ─── Estado da aplicação ────────────────────────────────────
    const state = {
        patients: [],
        selectedPatientId: null,
        documents: [],
        folders: [],
        selectedFolderId: null,
        currentFilters: [], // Array de filtros ativos (múltiplas classificações)
        currentSearch: '',
    };

    // ─── Referências DOM ────────────────────────────────────────
    const patientList = document.getElementById('patient-list');
    const patientSearch = document.getElementById('patient-search');
    const patientCount = document.getElementById('patient-count');
    const emptyState = document.getElementById('empty-state');
    const patientView = document.getElementById('patient-view');
    const docList = document.getElementById('doc-list');
    const docSearch = document.getElementById('doc-search');
    const docStats = document.getElementById('doc-stats');
    const toastContainer = document.getElementById('toast-container');

    // Modais
    const modalNewPatient = document.getElementById('modal-new-patient');
    const modalUploadDoc = document.getElementById('modal-upload-doc');
    const modalViewer = document.getElementById('modal-viewer');
    const modalNewFolder = document.getElementById('modal-new-folder');
    const modalFolderView = document.getElementById('modal-folder-view');
    const folderViewTitle = document.getElementById('folder-view-title');
    const folderViewDesc = document.getElementById('folder-view-desc');
    const folderTimeline = document.getElementById('folder-timeline');
    const docFolderSelect = document.getElementById('doc-folder');
    const viewerTitle = document.getElementById('viewer-title');
    const viewerContent = document.getElementById('viewer-content');

    // ─── Inicialização ──────────────────────────────────────────
    loadPatients();
    initFilterChipListeners();
    initFormCheckboxChipListeners();

    function initFormCheckboxChipListeners() {
        document.querySelectorAll('.class-checkbox-chip input').forEach(input => {
            input.addEventListener('change', () => {
                input.closest('.class-checkbox-chip').classList.toggle('active', input.checked);
            });
        });
    }

    // ─── Inicializa escuta dos chips de filtro da barra ────────
    function initFilterChipListeners() {
        document.querySelectorAll('.filter-chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.value;
                toggleFilter(val);
            });
        });
    }

    // ─── Busca de pacientes ─────────────────────────────────────
    let searchTimeout;
    patientSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadPatients(patientSearch.value), 300);
    });

    // ─── Carregar pacientes ─────────────────────────────────────
    async function loadPatients(search = '') {
        try {
            const url = search
                ? `/api/patients?search=${encodeURIComponent(search)}`
                : '/api/patients';
            const res = await fetch(url);
            state.patients = await res.json();
            renderPatientList();
        } catch (err) {
            showToast('Erro ao carregar pacientes.', 'error');
        }
    }

    function renderPatientList() {
        if (state.patients.length === 0) {
            patientList.innerHTML = `
                <div style="padding: 30px 16px; text-align: center; opacity: 0.5;">
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Nenhum paciente encontrado</p>
                </div>
            `;
        } else {
            patientList.innerHTML = state.patients.map(p => `
                <div class="patient-card ${state.selectedPatientId === p.id ? 'active' : ''}" 
                     data-id="${p.id}" onclick="selectPatient(${p.id})">
                    <div class="patient-avatar">${getInitials(p.name)}</div>
                    <div class="patient-card-info">
                        <div class="patient-card-name">${escapeHtml(p.name)}</div>
                        <div class="patient-card-cns">CNS: ${escapeHtml(p.cns)}</div>
                    </div>
                    <div class="patient-card-status ${p.status === 'Ativo' ? 'active' : 'inactive'}" 
                         title="${escapeHtml(p.status)}"></div>
                </div>
            `).join('');
        }

        patientCount.innerHTML = `<span>${state.patients.length}</span> paciente${state.patients.length !== 1 ? 's' : ''}`;
    }

    // ─── Selecionar paciente ────────────────────────────────────
    window.selectPatient = async function(patientId) {
        state.selectedPatientId = patientId;
        // Limpa filtros ao trocar de paciente
        state.currentFilters = [];
        syncFilterUI();

        // Atualiza sidebar
        document.querySelectorAll('.patient-card').forEach(card => {
            card.classList.toggle('active', parseInt(card.dataset.id) === patientId);
        });

        // Mostra view do paciente
        emptyState.style.display = 'none';
        patientView.style.display = 'block';

        // Reaplica animação
        patientView.style.animation = 'none';
        patientView.offsetHeight; // force reflow
        patientView.style.animation = '';

        try {
            const res = await fetch(`/api/patients/${patientId}`);
            const patient = await res.json();
            renderPatientDetails(patient);
            loadDocuments();
        } catch (err) {
            showToast('Erro ao carregar dados do paciente.', 'error');
        }
    };

    function renderPatientDetails(patient) {
        document.getElementById('patient-avatar-lg').textContent = getInitials(patient.name);
        document.getElementById('patient-name-display').textContent = patient.name;
        document.getElementById('patient-cns-display').innerHTML = `
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M1 5H13" stroke="currentColor" stroke-width="1.2"/></svg>
            CNS: ${escapeHtml(patient.cns)}
        `;
        document.getElementById('patient-birth-display').innerHTML = `
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2" width="11" height="10.5" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 1V3M9.5 1V3M1.5 5.5H12.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            Nasc: ${patient.birth_date ? formatDate(patient.birth_date) : '—'}
        `;

        const statusDisplay = document.getElementById('patient-status-display');
        const isActive = patient.status === 'Ativo';
        statusDisplay.innerHTML = `
            <span class="status-dot ${isActive ? 'active' : 'inactive'}"></span>
            ${escapeHtml(patient.status)}
        `;
        statusDisplay.style.color = isActive ? 'var(--accent)' : 'var(--text-muted)';

        document.getElementById('patient-updated-display').textContent =
            `Atualizado: ${patient.updated_at ? formatDateTime(patient.updated_at) : '—'}`;

        const notesText = document.getElementById('patient-notes-display');
        notesText.textContent = patient.notes || 'Sem observações registradas.';

        // Chips de classificação e contagens da barra
        renderDocStats(patient.doc_counts || {});
        updateFilterChipCounts(patient.doc_counts || {});
    }

    function updateFilterChipCounts(docCounts) {
        const allClassifications = window.CLASSIFICATIONS || [];
        allClassifications.forEach(c => {
            const countEl = document.getElementById(`filter-count-${c}`);
            if (countEl) {
                countEl.textContent = docCounts[c] || 0;
            }
        });
    }

    function renderDocStats(docCounts) {
        const allClassifications = window.CLASSIFICATIONS || [];
        let html = '';

        allClassifications.forEach(c => {
            const count = docCounts[c] || 0;
            if (count > 0) {
                const isActive = state.currentFilters.includes(c);
                html += `
                    <div class="doc-stat-chip ${isActive ? 'active' : ''}" data-classification="${escapeHtml(c)}" onclick="toggleFilter('${escapeHtml(c)}')">
                        ${escapeHtml(c)}
                        <span class="doc-stat-count">${count}</span>
                    </div>
                `;
            }
        });

        docStats.innerHTML = html || '<span style="font-size:0.8rem;color:var(--text-muted);">Nenhum documento cadastrado</span>';
    }

    // ─── Carregar documentos e pastas ───────────────────────────
    async function loadDocuments() {
        if (!state.selectedPatientId) return;

        const params = new URLSearchParams();
        if (state.currentFilters.length > 0) {
            state.currentFilters.forEach(f => params.append('classification', f));
        }
        if (state.currentSearch) params.set('search', state.currentSearch);

        try {
            const [foldersRes, docsRes] = await Promise.all([
                fetch(`/api/patients/${state.selectedPatientId}/folders?${params.toString()}`),
                fetch(`/api/patients/${state.selectedPatientId}/documents?${params.toString()}`)
            ]);

            state.folders = await foldersRes.json();
            state.documents = await docsRes.json();

            updateFolderSelectDropdown();
            renderDocumentList();
        } catch (err) {
            showToast('Erro ao carregar documentos e pastas.', 'error');
        }
    }

    function updateFolderSelectDropdown() {
        if (!docFolderSelect) return;
        let html = '<option value="">Nenhuma (Documento Avulso)</option>';
        state.folders.forEach(f => {
            html += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
        });
        docFolderSelect.innerHTML = html;
    }

    function renderDocumentList() {
        const standaloneDocs = state.documents.filter(d => !d.folder_id);

        if (state.folders.length === 0 && standaloneDocs.length === 0) {
            docList.innerHTML = `
                <div class="doc-list-empty">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <rect x="8" y="4" width="24" height="32" rx="4" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
                        <path d="M14 14H26M14 20H22M14 26H18" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <p>Nenhum documento ou pasta encontrado</p>
                </div>
            `;
            return;
        }

        let html = '';

        // Renderiza Pastas primeiro (containers de acompanhamento de machucados/progressão)
        state.folders.forEach(folder => {
            const classBadges = folder.classifications && folder.classifications.length > 0
                ? folder.classifications.map(c => `<span class="folder-tag-badge">${escapeHtml(c)}</span>`).join(' ')
                : '';

            html += `
                <div class="folder-item" onclick="openFolderView(${folder.id})">
                    <div class="folder-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6C3 4.89543 3.89543 4 5 4H9.58579C10.1162 4 10.625 4.21071 11 4.58579L12.4142 6H19C20.1046 6 21 6.89543 21 8V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6Z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </div>
                    <div class="doc-info">
                        <div class="doc-title">${escapeHtml(folder.name)}</div>
                        <div class="doc-meta">
                            ${classBadges}
                            <span class="folder-count-badge">📁 ${folder.doc_count} registro${folder.doc_count !== 1 ? 's' : ''}</span>
                            ${folder.description ? `<span title="${escapeHtml(folder.description)}">📝 ${truncate(folder.description, 45)}</span>` : ''}
                        </div>
                    </div>
                    <div class="doc-actions" onclick="event.stopPropagation()">
                        <button class="doc-action-btn view" onclick="openFolderView(${folder.id})" title="Abrir pasta e linha do tempo">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <path d="M10 4C5.5 4 2 10 2 10C2 10 5.5 16 10 16C14.5 16 18 10 18 10C18 10 14.5 4 10 4Z" stroke="currentColor" stroke-width="1.5"/>
                                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
                            </svg>
                        </button>
                        <button class="doc-action-btn delete" onclick="deleteFolder(${folder.id}, '${escapeHtml(folder.name)}')" title="Excluir pasta">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M3 4H13M5.5 4V3C5.5 2.45 5.95 2 6.5 2H9.5C10.05 2 10.5 2.45 10.5 3V4M6.5 7V12M9.5 7V12M4 4L4.7 13.1C4.75 13.6 5.18 14 5.68 14H10.32C10.82 14 11.25 13.6 11.3 13.1L12 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });

        // Renderiza documentos avulsos
        standaloneDocs.forEach(doc => {
            const classBadges = doc.classifications 
                ? doc.classifications.map(c => `<span class="doc-classification-tag">${escapeHtml(c)}</span>`).join(' ')
                : `<span class="doc-classification-tag">${escapeHtml(doc.classification)}</span>`;

            html += `
                <div class="doc-item" data-id="${doc.id}">
                    <div class="doc-file-icon ${doc.file_type}">
                        ${getFileIcon(doc.file_type)}
                    </div>
                    <div class="doc-info">
                        <div class="doc-title">${escapeHtml(doc.title)}</div>
                        <div class="doc-meta">
                            ${classBadges}
                            <span>${formatDateTime(doc.created_at)}</span>
                            ${doc.notes ? `<span title="${escapeHtml(doc.notes)}">📝 ${truncate(doc.notes, 40)}</span>` : ''}
                        </div>
                    </div>
                    <div class="doc-actions">
                        <button class="doc-action-btn view" onclick="viewDoc(${doc.id}, '${escapeHtml(doc.title)}', '${doc.file_path}', '${doc.file_type}')" title="Visualizar documento">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <path d="M10 4C5.5 4 2 10 2 10C2 10 5.5 16 10 16C14.5 16 18 10 18 10C18 10 14.5 4 10 4Z" stroke="currentColor" stroke-width="1.5"/>
                                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
                            </svg>
                        </button>
                        <button class="doc-action-btn" onclick="downloadDoc(${doc.id})" title="Baixar documento">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 2V11M4 8L8 12L12 8M3 14H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="doc-action-btn delete" onclick="deleteDoc(${doc.id}, '${escapeHtml(doc.title)}')" title="Excluir documento">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M3 4H13M5.5 4V3C5.5 2.45 5.95 2 6.5 2H9.5C10.05 2 10.5 2.45 10.5 3V4M6.5 7V12M9.5 7V12M4 4L4.7 13.1C4.75 13.6 5.18 14 5.68 14H10.32C10.82 14 11.25 13.6 11.3 13.1L12 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });

        docList.innerHTML = html;
    }

    // ─── Visualizar Pasta e Linha do Tempo ─────────────────────
    window.openFolderView = async function(folderId) {
        state.selectedFolderId = folderId;
        try {
            const res = await fetch(`/api/folders/${folderId}`);
            if (!res.ok) {
                showToast('Erro ao carregar pasta.', 'error');
                return;
            }
            const folder = await res.json();
            folderViewTitle.textContent = folder.name;
            folderViewDesc.textContent = folder.description || 'Sem descrição cadastrada.';

            renderFolderTimeline(folder.documents || []);
            openModal(modalFolderView);
        } catch (err) {
            showToast('Erro ao carregar detalhes da pasta.', 'error');
        }
    };

    function renderFolderTimeline(documents) {
        if (!documents || documents.length === 0) {
            folderTimeline.innerHTML = `
                <div class="doc-list-empty" style="padding: 40px 0;">
                    <p>Nenhum registro de acompanhamento nesta pasta ainda.</p>
                </div>
            `;
            return;
        }

        folderTimeline.innerHTML = documents.map((doc, index) => {
            const isLatest = index === 0; // Documentos já ordenados DESC (estado mais recente primeiro)
            const classBadges = doc.classifications 
                ? doc.classifications.map(c => `<span class="doc-classification-tag">${escapeHtml(c)}</span>`).join(' ')
                : `<span class="doc-classification-tag">${escapeHtml(doc.classification)}</span>`;

            return `
                <div class="timeline-item ${isLatest ? 'latest-item' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-header">
                        <div class="timeline-title-row">
                            <span class="timeline-title">${escapeHtml(doc.title)}</span>
                            ${isLatest ? '<span class="badge-latest">Estado Mais Recente</span>' : ''}
                        </div>
                        <span class="timeline-date">${formatDateTime(doc.created_at)}</span>
                    </div>
                    <div class="doc-meta" style="margin-bottom: 8px;">
                        ${classBadges}
                    </div>
                    ${doc.notes ? `<div class="timeline-notes">📝 ${escapeHtml(doc.notes)}</div>` : ''}
                    <div class="timeline-actions">
                        <button class="doc-action-btn view" onclick="viewDoc(${doc.id}, '${escapeHtml(doc.title)}', '${doc.file_path}', '${doc.file_type}')" title="Visualizar documento">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <path d="M10 4C5.5 4 2 10 2 10C2 10 5.5 16 10 16C14.5 16 18 10 18 10C18 10 14.5 4 10 4Z" stroke="currentColor" stroke-width="1.5"/>
                                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
                            </svg>
                            <span style="font-size:0.78rem; margin-left:4px;">Visualizar</span>
                        </button>
                        <button class="doc-action-btn" onclick="downloadDoc(${doc.id})" title="Baixar documento">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 2V11M4 8L8 12L12 8M3 14H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="doc-action-btn delete" onclick="deleteDocFromFolder(${doc.id}, '${escapeHtml(doc.title)}')" title="Excluir do registro">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M3 4H13M5.5 4V3C5.5 2.45 5.95 2 6.5 2H9.5C10.05 2 10.5 2.45 10.5 3V4M6.5 7V12M9.5 7V12M4 4L4.7 13.1C4.75 13.6 5.18 14 5.68 14H10.32C10.82 14 11.25 13.6 11.3 13.1L12 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ─── Excluir Pasta ──────────────────────────────────────────
    window.deleteFolder = async function(folderId, name) {
        if (!confirm(`Tem certeza que deseja excluir a pasta "${name}"? Os documentos contidos nela voltarão para a lista avulsa.`)) return;

        try {
            const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Pasta excluída com sucesso.', 'success');
                const pRes = await fetch(`/api/patients/${state.selectedPatientId}`);
                const patient = await pRes.json();
                renderPatientDetails(patient);
                loadDocuments();
            } else {
                const data = await res.json();
                showToast(data.error || 'Erro ao excluir pasta.', 'error');
            }
        } catch (err) {
            showToast('Erro ao excluir pasta.', 'error');
        }
    };

    // ─── Excluir documento de dentro de uma pasta ───────────────
    window.deleteDocFromFolder = async function(docId, title) {
        if (!confirm(`Tem certeza que deseja excluir o documento "${title}"?`)) return;

        try {
            const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Registro excluído com sucesso.', 'success');
                if (state.selectedFolderId) {
                    openFolderView(state.selectedFolderId);
                }
                const pRes = await fetch(`/api/patients/${state.selectedPatientId}`);
                const patient = await pRes.json();
                renderPatientDetails(patient);
                loadDocuments();
            } else {
                const data = await res.json();
                showToast(data.error || 'Erro ao excluir documento.', 'error');
            }
        } catch (err) {
            showToast('Erro ao excluir documento.', 'error');
        }
    };

    // ─── Visualizar documento ──────────────────────────────────
    window.viewDoc = function(docId, title, filePath, fileType) {
        viewerTitle.textContent = title;
        viewerContent.innerHTML = '';

        const fullUrl = `/static/uploads/${filePath}`;

        if (fileType === 'pdf') {
            const iframe = document.createElement('iframe');
            iframe.src = fullUrl;
            viewerContent.appendChild(iframe);
        } else {
            const img = document.createElement('img');
            img.src = fullUrl;
            img.alt = title;
            viewerContent.appendChild(img);
        }

        openModal(modalViewer);
    };

    // ─── Toggles de Filtros ──────────────────────────────────────
    window.toggleFilter = function(classification) {
        const index = state.currentFilters.indexOf(classification);
        if (index > -1) {
            state.currentFilters.splice(index, 1);
        } else {
            state.currentFilters.push(classification);
        }

        syncFilterUI();
        loadDocuments();
    };

    function syncFilterUI() {
        // Sincroniza chips de estatísticas do paciente
        document.querySelectorAll('.doc-stat-chip').forEach(chip => {
            const val = chip.dataset.classification;
            chip.classList.toggle('active', state.currentFilters.includes(val));
        });

        // Sincroniza chips da barra de filtros rápidos
        document.querySelectorAll('.filter-chip-btn').forEach(btn => {
            const val = btn.dataset.value;
            btn.classList.toggle('active', state.currentFilters.includes(val));
        });
    }

    let docSearchTimeout;
    docSearch.addEventListener('input', () => {
        clearTimeout(docSearchTimeout);
        docSearchTimeout = setTimeout(() => {
            state.currentSearch = docSearch.value.trim();
            loadDocuments();
        }, 300);
    });

    // ─── Download de documento ──────────────────────────────────
    window.downloadDoc = function(docId) {
        window.open(`/api/documents/${docId}/download`, '_blank');
    };

    // ─── Excluir documento ──────────────────────────────────────
    window.deleteDoc = async function(docId, title) {
        if (!confirm(`Tem certeza que deseja excluir o documento "${title}"?`)) return;

        try {
            const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Documento excluído com sucesso.', 'success');
                // Recarrega dados do paciente e documentos
                const pRes = await fetch(`/api/patients/${state.selectedPatientId}`);
                const patient = await pRes.json();
                renderPatientDetails(patient);
                loadDocuments();
            } else {
                const data = await res.json();
                showToast(data.error || 'Erro ao excluir documento.', 'error');
            }
        } catch (err) {
            showToast('Erro ao excluir documento.', 'error');
        }
    };

    // ─── Modal: Novo Paciente ───────────────────────────────────
    document.getElementById('btn-add-patient').addEventListener('click', () => {
        openModal(modalNewPatient);
    });

    document.getElementById('btn-save-patient').addEventListener('click', async () => {
        const name = document.getElementById('new-patient-name').value.trim();
        const cns = document.getElementById('new-patient-cns').value.trim();
        const birthDate = document.getElementById('new-patient-birth').value;
        const notes = document.getElementById('new-patient-notes').value.trim();

        if (!name || !cns) {
            showToast('Nome e CNS são obrigatórios.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/patients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, cns, birth_date: birthDate, notes })
            });

            const data = await res.json();

            if (res.ok) {
                showToast('Paciente cadastrado com sucesso!', 'success');
                closeModal(modalNewPatient);
                document.getElementById('form-new-patient').reset();
                await loadPatients();
                selectPatient(data.id);
            } else {
                showToast(data.error || 'Erro ao cadastrar paciente.', 'error');
            }
        } catch (err) {
            showToast('Erro ao cadastrar paciente.', 'error');
        }
    });

    // ─── Modal: Upload de Documento ─────────────────────────────
    document.getElementById('btn-upload-doc').addEventListener('click', () => {
        if (!state.selectedPatientId) {
            showToast('Selecione um paciente primeiro.', 'error');
            return;
        }
        openModal(modalUploadDoc);
    });

    // Drag and drop
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('doc-file');
    const dropzoneContent = document.getElementById('dropzone-content');
    const dropzonePreview = document.getElementById('dropzone-preview');

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            showFilePreview(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            showFilePreview(fileInput.files[0]);
        }
    });

    function showFilePreview(file) {
        document.getElementById('preview-file-name').textContent = file.name;
        document.getElementById('preview-file-size').textContent = formatFileSize(file.size);
        dropzoneContent.style.display = 'none';
        dropzonePreview.style.display = 'flex';
    }

    document.getElementById('preview-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = '';
        dropzoneContent.style.display = 'flex';
        dropzonePreview.style.display = 'none';
    });

    // Salvar documento
    document.getElementById('btn-save-doc').addEventListener('click', async () => {
        const title = document.getElementById('doc-title').value.trim();
        const notes = document.getElementById('doc-notes').value.trim();
        const folderId = docFolderSelect ? docFolderSelect.value : '';
        const file = fileInput.files[0];

        // Coleta múltiplas classificações selecionadas nos chips/checkboxes
        const checkedClassifications = Array.from(
            document.querySelectorAll('input[name="classifications"]:checked')
        ).map(cb => cb.value);

        if (!title || checkedClassifications.length === 0) {
            showToast('Título e pelo menos uma classificação são obrigatórios.', 'error');
            return;
        }

        if (!file) {
            showToast('Selecione um arquivo.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        checkedClassifications.forEach(c => formData.append('classifications', c));
        if (folderId) formData.append('folder_id', folderId);
        formData.append('notes', notes);
        formData.append('file', file);

        try {
            const res = await fetch(`/api/patients/${state.selectedPatientId}/documents`, {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (res.ok) {
                showToast('Documento enviado com sucesso!', 'success');
                closeModal(modalUploadDoc);
                resetUploadForm();

                // Recarrega contagens e documentos do paciente selecionado
                const pRes = await fetch(`/api/patients/${state.selectedPatientId}`);
                const patient = await pRes.json();
                renderPatientDetails(patient);
                await loadDocuments();

                if (state.selectedFolderId) {
                    openFolderView(state.selectedFolderId);
                }
            } else {
                showToast(data.error || 'Erro ao enviar documento.', 'error');
            }
        } catch (err) {
            showToast('Erro ao enviar documento.', 'error');
        }
    });

    // ─── Modal: Criar Nova Pasta ────────────────────────────────
    document.getElementById('btn-create-folder').addEventListener('click', () => {
        if (!state.selectedPatientId) {
            showToast('Selecione um paciente primeiro.', 'error');
            return;
        }
        openModal(modalNewFolder);
    });

    document.getElementById('btn-save-folder').addEventListener('click', async () => {
        const name = document.getElementById('folder-name').value.trim();
        const description = document.getElementById('folder-description').value.trim();

        const checkedClassifications = Array.from(
            document.querySelectorAll('input[name="folder-classifications"]:checked')
        ).map(cb => cb.value);

        if (!name || checkedClassifications.length === 0) {
            showToast('Nome e pelo menos uma classificação são obrigatórios.', 'error');
            return;
        }

        try {
            const res = await fetch(`/api/patients/${state.selectedPatientId}/folders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, classifications: checkedClassifications })
            });

            const data = await res.json();

            if (res.ok) {
                showToast('Pasta criada com sucesso!', 'success');
                closeModal(modalNewFolder);
                document.getElementById('form-new-folder').reset();
                document.querySelectorAll('input[name="folder-classifications"]').forEach(cb => cb.checked = false);

                const pRes = await fetch(`/api/patients/${state.selectedPatientId}`);
                const patient = await pRes.json();
                renderPatientDetails(patient);
                await loadDocuments();
            } else {
                showToast(data.error || 'Erro ao criar pasta.', 'error');
            }
        } catch (err) {
            showToast('Erro ao criar pasta.', 'error');
        }
    });

    document.getElementById('btn-add-doc-to-folder').addEventListener('click', () => {
        if (state.selectedFolderId && docFolderSelect) {
            docFolderSelect.value = state.selectedFolderId;
        }
        openModal(modalUploadDoc);
    });

    function resetUploadForm() {
        document.getElementById('form-upload-doc').reset();
        fileInput.value = '';
        dropzoneContent.style.display = 'flex';
        dropzonePreview.style.display = 'none';
        // Desmarca todos os chips de checkboxes
        document.querySelectorAll('input[name="classifications"]').forEach(cb => cb.checked = false);
    }

    // ─── Modais: abrir / fechar ─────────────────────────────────
    function openModal(modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        // Se for o visualizador, limpa o iframe/img para liberar memória
        if (modal === modalViewer) {
            viewerContent.innerHTML = '';
        }
    }

    // Fechar modais com botões [x] e "Cancelar"
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById(btn.dataset.close);
            if (modal) closeModal(modal);
        });
    });

    // Fechar modal clicando no overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay);
        });
    });

    // Fechar modal com Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(m => {
                if (m.style.display !== 'none') closeModal(m);
            });
        }
    });

    // ─── Toast notifications ────────────────────────────────────
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="#168821" stroke-width="1.5"/><path d="M6 9L8 11L12 7" stroke="#168821" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            error: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="#E74C3C" stroke-width="1.5"/><path d="M9 5V10M9 12V13" stroke="#E74C3C" stroke-width="1.5" stroke-linecap="round"/></svg>',
            info: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="#2670E8" stroke-width="1.5"/><path d="M9 5V5.5M9 8V13" stroke="#2670E8" stroke-width="1.5" stroke-linecap="round"/></svg>',
        };

        toast.innerHTML = `${icons[type] || icons.info} ${escapeHtml(message)}`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ─── Utilitários ────────────────────────────────────────────
    function getInitials(name) {
        return name.split(' ')
            .filter(w => w.length > 2)
            .map(w => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    // Escapa HTML para prevenir XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
    }

    function formatDateTime(dtStr) {
        if (!dtStr) return '—';
        try {
            const d = new Date(dtStr);
            if (isNaN(d.getTime())) return dtStr;
            return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return dtStr;
        }
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // Corta string mantendo legibilidade
    function truncate(str, len) {
        return str.length > len ? str.substring(0, len) + '…' : str;
    }

    function getFileIcon(type) {
        if (type === 'pdf') {
            return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="1" width="14" height="18" rx="3" stroke="currentColor" stroke-width="1.3"/><path d="M7 7H13M7 10H11M7 13H9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
        }
        return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="13" r="1.5" fill="currentColor"/><path d="M2 12L6 8L10 12L14 6L18 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
});
