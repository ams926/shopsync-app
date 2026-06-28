import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDoc, doc, setDoc, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const firebaseConfig = { apiKey: "AIzaSyDawFRwy86-BlypCso-3U2oc0ffrRORjLw", authDomain: "shopsync-eb1cf.firebaseapp.com", projectId: "shopsync-eb1cf", storageBucket: "shopsync-eb1cf.firebasestorage.app", messagingSenderId: "725614316218", appId: "1:725614316218:web:bf503b548b3df04ac91083" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let historyStack = ['screen-home'];
window.baseDeDadosContas = {}; // Será preenchido pelo Firestore
window.todasAsVendas = [];

let servicoSelecionado = 'Netflix', pacoteSelecionado = 'Mensal', precoSelecionado = 249, diasSelecionados = 30;
let emailContaSelecionada = '', senhaContaSelecionada = '', perfilSelecionadoNome = '', perfilSelecionadoPin = '';

// --- AUTHENTICATION LOGIC ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        await inicializarBaseDeDados(); // Busca as credenciais de forma segura
        await carregarRegistosFirebase(); // Carrega vendas para o Dashboard
        navTo('screen-home');
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
});

window.fazerLogin = async function () {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginSenha').value;
    const btn = document.getElementById('btnLogin');
    btn.innerHTML = `<i data-lucide="loader" class="lucide-spin"></i> Entrando...`;
    btn.disabled = true;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        mostrarToast("❌ Erro no Login: Verifique as suas credenciais.");
    } finally {
        btn.innerHTML = `<i data-lucide="log-in" size="20"></i> Entrar`;
        btn.disabled = false;
        lucide.createIcons();
    }
}

window.fazerLogout = function () {
    document.getElementById('modalConfirmacao').style.display = 'none';
    signOut(auth);
}

window.mostrarPerfilUsuario = function () {
    const user = auth.currentUser;
    if (user) {
        document.getElementById('perfilEmail').innerText = user.email;
        document.getElementById('modalPerfil').style.display = 'flex';
        lucide.createIcons();
    } else {
        mostrarToast("⚠️ Nenhuma sessão iniciada.");
    }
}

window.togglePasswordVisibility = function () {
    window.toggleVisibility('loginSenha', document.getElementById('togglePasswordBtn'));
}

window.toggleVisibility = function (inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        iconElement.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
}

window.alterarSenha = async function () {
    const senhaAtual = document.getElementById('senhaAtualPerfil').value;
    const novaSenha = document.getElementById('novaSenhaPerfil').value;

    if (!senhaAtual || !novaSenha) {
        return mostrarToast("⚠️ Preencha ambas as palavras-passe.");
    }
    if (novaSenha.length < 6) {
        return mostrarToast("⚠️ A nova palavra-passe deve ter no mínimo 6 caracteres.");
    }

    const user = auth.currentUser;
    if (!user) return mostrarToast("⚠️ Sessão inválida.");

    const btn = document.getElementById('btnAlterarSenha');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader" class="lucide-spin"></i> A atualizar...`;
    btn.disabled = true;

    try {
        const credential = EmailAuthProvider.credential(user.email, senhaAtual);
        await reauthenticateWithCredential(user, credential);

        await updatePassword(user, novaSenha);
        mostrarToast("✅ Palavra-passe atualizada com sucesso!");

        document.getElementById('senhaAtualPerfil').value = '';
        document.getElementById('novaSenhaPerfil').value = '';

        setTimeout(() => {
            document.getElementById('modalPerfil').style.display = 'none';
        }, 1500);
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            mostrarToast("❌ A palavra-passe atual está incorreta.");
        } else {
            mostrarToast("❌ Erro ao atualizar palavra-passe.");
        }
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        lucide.createIcons();
    }
}

// --- SETUP INICIAL DE CONTAS (Migração segura) ---
async function inicializarBaseDeDados() {
    try {
        const docRef = doc(db, "configuracoes", "contasMaster");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            let dbData = docSnap.data();
            /*
            if (!dbData['Spotify']) {
                dbData['Spotify'] = {
                    email: "spotify@shopsync.com", senha: "N/A",
                    perfis: [{ nome: "Vaga 1", pin: "N/A" }, { nome: "Vaga 2", pin: "N/A" }, { nome: "Vaga 3", pin: "N/A" }, { nome: "Vaga 4", pin: "N/A" }, { nome: "Vaga 5", pin: "N/A" }]
                };
            }
            */
            // Ensure pacotes are initialized if they don't exist in existing data
            if (dbData['Prime Video'] && !dbData['Prime Video'].pacotes) {
                dbData['Prime Video'].pacotes = [
                    { nome: "1 Dia", dias: 1, preco: 35 },
                    { nome: "7 Dias", dias: 7, preco: 99 },
                    { nome: "15 Dias", dias: 15, preco: 149 },
                    { nome: "30 Dias", dias: 30, preco: 249 },
                    { nome: "60 Dias", dias: 60, preco: 479 }
                ];
            }
            if (dbData['Netflix'] && !dbData['Netflix'].pacotes) {
                dbData['Netflix'].pacotes = [
                    { nome: "1 Dia", dias: 1, preco: 39 },
                    { nome: "7 Dias", dias: 7, preco: 119 },
                    { nome: "15 Dias", dias: 15, preco: 189 },
                    { nome: "30 Dias", dias: 30, preco: 279 },
                    { nome: "60 Dias", dias: 60, preco: 529 }
                ];
            }

            window.baseDeDadosContas = dbData;
        } else {
            // Se não existir, migra as hardcoded antigas para o Firestore
            const dadosAntigos = {
                'Prime Video': {
                    email: "jim852614@gmail.com", senha: "prime@(??)/",
                    perfis: [{ nome: "Master Chief", pin: "60609" }, { nome: "Nabil", pin: "84500" }, { nome: "Beast", pin: "76760" }, { nome: "Ryan", pin: "22222" }, { nome: "Billy", pin: "45000" }, { nome: "Kimiko", pin: "10200" }],
                    pacotes: [
                        { nome: "1 Dia", dias: 1, preco: 35 },
                        { nome: "7 Dias", dias: 7, preco: 99 },
                        { nome: "15 Dias", dias: 15, preco: 149 },
                        { nome: "30 Dias", dias: 30, preco: 249 },
                        { nome: "60 Dias", dias: 60, preco: 479 }
                    ]
                },
                'Netflix': {
                    email: "shopsyncnetflixvenda@gmail.com", senha: "shopsyncnetflix",
                    perfis: [{ nome: "ShopSync", pin: "1212" }, { nome: "FADIL", pin: "7676" }, { nome: "KIER", pin: "5456" }, { nome: "GOJO", pin: "6060" }, { nome: "YUJI", pin: "3434" }],
                    pacotes: [
                        { nome: "1 Dia", dias: 1, preco: 39 },
                        { nome: "7 Dias", dias: 7, preco: 119 },
                        { nome: "15 Dias", dias: 15, preco: 189 },
                        { nome: "30 Dias", dias: 30, preco: 279 },
                        { nome: "60 Dias", dias: 60, preco: 529 }
                    ]
                }
                /*
                ,'Spotify': {
                    email: "spotify@shopsync.com", senha: "N/A",
                    perfis: [{ nome: "Vaga 1", pin: "N/A" }, { nome: "Vaga 2", pin: "N/A" }, { nome: "Vaga 3", pin: "N/A" }, { nome: "Vaga 4", pin: "N/A" }, { nome: "Vaga 5", pin: "N/A" }]
                }
                */
            };
            await setDoc(docRef, dadosAntigos);
            window.baseDeDadosContas = dadosAntigos;
        }
    } catch (e) {
        console.error("Erro ao carregar contas: ", e);
        mostrarToast("⚠️ Aviso: Falha ao carregar credenciais da base de dados.");
    }
}

// --- NAVEGAÇÃO ---
window.navTo = function (screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll(`[data-target="${screenId}"]`).forEach(btn => btn.classList.add('active'));

    if (screenId === 'screen-sales') {
        if (!servicoSelecionado) {
            document.getElementById('venda-escolha-servico').style.display = 'block';
            document.getElementById('venda-form').style.display = 'none';
        } else {
            document.getElementById('venda-escolha-servico').style.display = 'none';
            document.getElementById('venda-form').style.display = 'block';
        }
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar && overlay) {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        }

        const btnBack = document.getElementById('btnBack');
        const btnMenu = document.getElementById('btnMenu');
        if (screenId !== 'screen-home') {
            if (btnMenu) btnMenu.style.display = 'none';
            if (btnBack) btnBack.style.display = 'flex';
        } else {
            if (btnMenu) btnMenu.style.display = 'flex';
            if (btnBack) btnBack.style.display = 'none';
        }
    } else {
        const btnBack = document.getElementById('btnBack');
        if (btnBack) btnBack.style.display = (screenId !== 'screen-home') ? 'flex' : 'none';
    }

    if (screenId !== 'screen-home' && historyStack[historyStack.length - 1] !== screenId) historyStack.push(screenId);

    const titles = { 'screen-home': 'Painel Geral', 'screen-sales': 'Nova Venda', 'screen-records': 'Registos', 'screen-settings': 'Configurações' };
    const tituloHtml = document.getElementById('appTitle');
    if (tituloHtml) tituloHtml.innerText = screenId === 'screen-sales' ? (servicoSelecionado || 'Nova Venda') : titles[screenId];

    if (screenId === 'screen-records' || screenId === 'screen-home') {
        if (typeof carregarRegistosFirebase === 'function') carregarRegistosFirebase();
    }

    if (screenId === 'screen-settings') {
        if (window.carregarConfiguracoesNaUI) window.carregarConfiguracoesNaUI();
    }
}

window.prepararNovaVenda = function () {
    servicoSelecionado = null;
    document.getElementById('clienteNome').value = '';
    document.getElementById('clienteContacto').value = '';
    window.navTo('screen-sales');
}

window.goBack = function () { historyStack.pop(); navTo(historyStack[historyStack.length - 1] || 'screen-home'); }

window.toggleSidebar = function () {
    console.log("Menu Hamburger Clicado!");
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('show');
    }
}

// --- THEME TOGGLE ---
window.toggleTheme = function () {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('shopsync-theme', isLight ? 'light' : 'dark');
    window.atualizarIconeTema();
}

window.atualizarIconeTema = function () {
    const isLight = document.body.classList.contains('light-mode');
    const btn = document.getElementById('btnToggleTheme');
    if (btn) {
        btn.innerHTML = isLight
            ? '<i data-lucide="moon"></i> Modo Escuro'
            : '<i data-lucide="sun"></i> Modo Claro';
        lucide.createIcons();
    }
}

// Inicializar Tema ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('shopsync-theme') === 'light') {
        document.body.classList.add('light-mode');
    }
    window.atualizarIconeTema();
});

window.selectPkg = function (element, nomePacote, preco, dias) {
    document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected'); pacoteSelecionado = nomePacote; precoSelecionado = preco; diasSelecionados = dias;
}

window.selectProfile = function (element, nomePerfil, pinPerfil) {
    if (element.classList.contains('full')) { mostrarToast('⚠️ Ação Negada: Este perfil atingiu o limite máximo de 3 clientes ativos.'); return; }
    document.querySelectorAll('.profile-card:not(.full)').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected'); perfilSelecionadoNome = nomePerfil; perfilSelecionadoPin = pinPerfil;
    document.querySelectorAll('.profile-card .slot.active').forEach(s => { s.classList.remove('active'); s.style.boxShadow = 'none'; });
    const slots = element.querySelectorAll('.slot:not(.filled)'); if (slots.length > 0) slots[0].classList.add('active');
}

// --- 1. LER LOTAÇÃO DOS PERFIS AO ABRIR O SERVIÇO ---
window.selecionarServico = async function (nome) {
    servicoSelecionado = nome; document.getElementById('tituloVenda').innerText = `Venda: ${nome}`;
    const dadosServico = window.baseDeDadosContas[nome];
    emailContaSelecionada = dadosServico.email; senhaContaSelecionada = dadosServico.senha;

    const contEmail = document.getElementById('containerEmailCliente');
    if (contEmail) {
        // contEmail.style.display = (nome === 'Spotify') ? 'flex' : 'none';
        contEmail.style.display = 'none';
    }

    // Atualizar Pacotes Dinamicamente da Base de Dados
    const pacotesRenderizar = dadosServico.pacotes || [{ nome: 'Mensal', preco: 250, dias: 30 }];
    let pacotesHTML = '';
    pacotesRenderizar.forEach(pacote => {
        const isSel = pacote.dias === 30 ? 'selected' : '';
        pacotesHTML += `<div class="pkg-card ${isSel}" onclick="selectPkg(this, '${pacote.nome}', ${pacote.preco}, ${pacote.dias})"><span class="pkg-name">${pacote.nome}</span><span class="pkg-price">${pacote.preco} MZN</span></div>`;
    });
    document.getElementById('containerPacotes').innerHTML = pacotesHTML;

    const pacoteDefault = pacotesRenderizar.find(p => p.dias === 30) || pacotesRenderizar[0];
    pacoteSelecionado = pacoteDefault.nome;
    precoSelecionado = pacoteDefault.preco;
    diasSelecionados = pacoteDefault.dias;

    const container = document.getElementById('containerPerfis');
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
            <div class="skeleton skeleton-card" style="height: 140px;"></div>
            <div class="skeleton skeleton-card" style="height: 140px;"></div>
            <div class="skeleton skeleton-card" style="height: 140px;"></div>
        </div>
    `;
    lucide.createIcons(); navTo('screen-sales');

    try {
        let ocupacao = {};
        const q = query(collection(db, "vendas"), where("servico", "==", nome));
        const snapshot = await getDocs(q);
        const hoje = new Date();

        snapshot.forEach(doc => {
            const d = doc.data();
            const exp = d.dataExpiracao ? d.dataExpiracao.toDate() : new Date(0);
            if (exp > hoje) {
                ocupacao[d.perfil] = (ocupacao[d.perfil] || 0) + 1;
            }
        });

        container.innerHTML = '';
        let primeiroSelecionavel = true;

        dadosServico.perfis.forEach((perfil) => {
            const count = ocupacao[perfil.nome] || 0;
            const isFull = count >= 3;

            let isSelectedClass = '';
            let activeSlotHtml = '';

            if (!isFull && primeiroSelecionavel) {
                isSelectedClass = 'selected';
                perfilSelecionadoNome = perfil.nome;
                perfilSelecionadoPin = perfil.pin;
                activeSlotHtml = '<div class="slot active"></div>';
                primeiroSelecionavel = false;
            }

            let slotsHTML = '';
            for (let i = 0; i < 3; i++) {
                if (i < count) slotsHTML += '<div class="slot filled"></div>';
                else if (i === count && isSelectedClass) slotsHTML += activeSlotHtml;
                else slotsHTML += '<div class="slot"></div>';
            }

            const iconeStatus = isFull ? 'user-x' : 'user';
            const corStatus = isFull ? 'var(--danger)' : '#3b82f6';
            const textoStatus = isFull ? 'Lotação Esgotada' : `PIN: ${perfil.pin}`;

            container.innerHTML += `
                <div class="profile-card ${isSelectedClass} ${isFull ? 'full' : ''}" onclick="selectProfile(this, '${perfil.nome}', '${perfil.pin}')">
                    <div class="profile-info">
                        <div class="profile-avatar"><i data-lucide="${iconeStatus}" size="20" color="${corStatus}"></i></div>
                        <div class="profile-texts">
                            <h4>${perfil.nome}</h4><p style="color:${isFull ? 'var(--danger)' : ''}">${textoStatus}</p>
                        </div>
                    </div>
                    <div class="slots">${slotsHTML}</div>
                </div>`;
        });
        lucide.createIcons();
    } catch (e) {
        console.log(e);
        container.innerHTML = "<p style='color:red'>Erro ao carregar perfis.</p>";
    }
};

// --- 2. GRAVAR VENDA ---
window.salvarVendaFirebase = async function () {
    const nome = document.getElementById('clienteNome').value;
    const contactoInput = document.getElementById('clienteContacto').value;
    const clienteEmail = document.getElementById('clienteEmail') ? document.getElementById('clienteEmail').value.trim() : '';

    if (!nome || !contactoInput) return mostrarToast("⚠️ Preencha o Nome e o Contacto.");
    // if (servicoSelecionado === 'Spotify' && !clienteEmail) return mostrarToast("⚠️ Insira o email do cliente para o Spotify.");
    const telefoneFinal = "+258 " + contactoInput.replace("+258 ", "");
    const btn = document.getElementById('btnSalvar'); const originalHTML = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader" class="lucide-spin"></i> A processar...`; btn.disabled = true;

    try {
        const dataInput = document.getElementById('dataInicioVenda').value;
        const dataInicio = dataInput ? new Date(dataInput) : new Date();
        const dataFim = new Date(dataInicio);
        dataFim.setDate(dataFim.getDate() + diasSelecionados);

        const docRef = await addDoc(collection(db, "vendas"), {
            nomeCliente: nome,
            telefone: telefoneFinal,
            emailCliente: clienteEmail,
            servico: servicoSelecionado,
            perfil: perfilSelecionadoNome,
            pacote: pacoteSelecionado,
            precoMZN: precoSelecionado,
            dataRegisto: dataInicio,
            dataExpiracao: dataFim,
            status: "ativo"
        });

        const vendaTemp = {
            id: docRef.id, nomeCliente: nome, telefone: telefoneFinal, emailCliente: clienteEmail,
            servico: servicoSelecionado, perfil: perfilSelecionadoNome, pacote: pacoteSelecionado,
            precoMZN: precoSelecionado, dataRegisto: dataInicio, dataExpiracao: dataFim
        };

        document.getElementById('btnSucessoWhatsApp').onclick = () => window.enviarWhatsApp(vendaTemp);
        document.getElementById('btnSucessoPDF').onclick = async () => { await window.gerarPDF(vendaTemp); };
        document.getElementById('btnSucessoEmail').onclick = () => window.enviarEmailAutomatico(vendaTemp);
        document.getElementById('modalSucesso').style.display = 'flex';

    } catch (error) { mostrarToast("❌ Erro ao guardar na nuvem."); } finally { btn.innerHTML = originalHTML; btn.disabled = false; }
};

// --- NOVA FUNÇÃO: RENOVAÇÃO RÁPIDA ---
window.prepararRenovacao = function (idVenda) {
    const vendaAntiga = window.todasAsVendas.find(v => v.id === idVenda);
    if (!vendaAntiga) return;

    // Seleciona o serviço correspondente
    servicoSelecionado = vendaAntiga.servico;
    document.getElementById('tituloVenda').innerText = `Renovar: ${vendaAntiga.servico}`;

    // Preenche dados do cliente
    document.getElementById('clienteNome').value = vendaAntiga.nomeCliente;
    document.getElementById('clienteContacto').value = vendaAntiga.telefone.replace("+258 ", "");
    document.getElementById('dataInicioVenda').valueAsDate = new Date(); // Nova venda inicia hoje

    // Puxa para a tab de vendas
    navTo('screen-sales');

    // Auto-selecionar pacote antigo
    const cards = document.querySelectorAll('.pkg-card');
    cards.forEach(c => {
        if (c.querySelector('.pkg-name').innerText === vendaAntiga.pacote) {
            c.click();
        }
    });

    // Auto carrega os perfis e tenta selecionar o mesmo
    window.selecionarServico(vendaAntiga.servico).then(() => {
        setTimeout(() => {
            const perfisHtml = document.querySelectorAll('.profile-card');
            perfisHtml.forEach(p => {
                if (p.querySelector('h4').innerText === vendaAntiga.perfil) {
                    if (!p.classList.contains('full')) {
                        p.click();
                    } else {
                        mostrarToast("⚠️ O perfil anterior está lotado. Selecione outro.");
                    }
                }
            });
        }, 800); // Aguarda carregar as vagas
    });
}

// --- 3. CARREGAR HISTÓRICO ---
window.carregarRegistosFirebase = async function () {
    const container = document.getElementById('containerRegistos');
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; width: 100%;">
            <div class="skeleton skeleton-card" style="height: 90px;"></div>
            <div class="skeleton skeleton-card" style="height: 90px;"></div>
            <div class="skeleton skeleton-card" style="height: 90px;"></div>
            <div class="skeleton skeleton-card" style="height: 90px;"></div>
        </div>
    `;
    lucide.createIcons();
    try {
        const q = query(collection(db, "vendas"), orderBy("dataRegisto", "desc"));
        const querySnapshot = await getDocs(q);
        window.todasAsVendas = [];

        querySnapshot.forEach((doc) => {
            const d = doc.data();
            window.todasAsVendas.push({
                id: doc.id,
                nomeCliente: d.nomeCliente || '',
                telefone: d.telefone || '',
                servico: d.servico || '',
                perfil: d.perfil || '',
                pacote: d.pacote || '',
                precoMZN: d.precoMZN || 0,
                emailCliente: d.emailCliente || '',
                dataRegisto: d.dataRegisto ? d.dataRegisto.toDate() : new Date(),
                dataExpiracao: d.dataExpiracao ? d.dataExpiracao.toDate() : new Date(0)
            });
        });
        window.calcularEstatisticas();
        window.aplicarFiltrosLocal();
    } catch (error) {
        console.error("Erro: ", error);
        container.innerHTML = `<p style="color:var(--danger); text-align:center;">Erro ao carregar o histórico.</p>`;
    }
}

window.calcularEstatisticas = function () {
    let receita = 0;
    let ativos = 0;
    let expirar = 0;
    const hoje = new Date();
    const tresDias = new Date();
    tresDias.setDate(hoje.getDate() + 3);

    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const filtroEl = document.getElementById('dashFiltroServico');
    const filtroServico = filtroEl ? filtroEl.value : 'Todos';

    // Preparar labels para o gráfico (últimos 7 dias)
    const diasGrafico7 = 7;
    let labelsGrafico7 = [];
    let dadosNetflix7 = Array(diasGrafico7).fill(0);
    let dadosPrime7 = Array(diasGrafico7).fill(0);

    for (let i = diasGrafico7 - 1; i >= 0; i--) {
        const d = new Date(hojeZero);
        d.setDate(d.getDate() - i);
        labelsGrafico7.push(d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }));
    }

    window.todasAsVendas.forEach(venda => {
        if (filtroServico !== 'Todos' && venda.servico !== filtroServico) return;

        // Receita Mensal
        const dataVenda = venda.dataRegisto;
        if (dataVenda.getMonth() === mesAtual && dataVenda.getFullYear() === anoAtual) {
            receita += Number(venda.precoMZN) || 0;
        }

        // Ativos e Expirar
        if (venda.dataExpiracao > hoje) {
            ativos++;
            if (venda.dataExpiracao <= tresDias) {
                expirar++;
            }
        }

        // Dados para o Gráfico de 7 dias (Comparativo)
        const dataVendaZero = new Date(dataVenda.getFullYear(), dataVenda.getMonth(), dataVenda.getDate());
        const diffDias = Math.round((hojeZero - dataVendaZero) / (1000 * 60 * 60 * 24));
        if (diffDias >= 0 && diffDias < diasGrafico7) {
            const indexGrafico7 = (diasGrafico7 - 1) - diffDias;
            if (venda.servico === 'Netflix') {
                dadosNetflix7[indexGrafico7] += Number(venda.precoMZN) || 0;
            } else if (venda.servico === 'Prime Video') {
                dadosPrime7[indexGrafico7] += Number(venda.precoMZN) || 0;
            }
        }
    });

    // Margem de Lucro Perfeita (Receita - Custos Fixos)
    const custoPrime = 409;
    const custoNetflix = 638.36;
    const custoSpotify = 371;

    let custosTotais = 0;
    if (filtroServico === 'Todos') {
        custosTotais = custoPrime + custoNetflix + custoSpotify;
    } else if (filtroServico === 'Netflix') {
        custosTotais = custoNetflix;
    } else if (filtroServico === 'Prime Video') {
        custosTotais = custoPrime;
    } else if (filtroServico === 'Spotify') {
        custosTotais = custoSpotify;
    }

    let lucro = receita - custosTotais;

    const lucroFormatado = Number.isInteger(lucro) ? lucro : lucro.toFixed(2);
    const receitaFormatada = Number.isInteger(receita) ? receita : receita.toFixed(2);

    const elReceita = document.getElementById('dashReceita');
    const elLucro = document.getElementById('dashLucro');
    const elAtivos = document.getElementById('dashAtivos');
    const elExpirar = document.getElementById('dashExpirar');

    if (elReceita) elReceita.innerText = `${receitaFormatada} MZN`;
    if (elLucro) {
        elLucro.innerText = `${lucroFormatado} MZN`;
        elLucro.style.color = lucro >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    if (elAtivos) elAtivos.innerText = ativos.toString();
    if (elExpirar) elExpirar.innerText = expirar.toString();

    // Atualizar Gráfico de 7 Dias
    const ctx7 = document.getElementById('graficoDesempenho7Dias');
    if (ctx7) {
        if (window.meuGrafico7Dias) {
            window.meuGrafico7Dias.data.labels = labelsGrafico7;
            window.meuGrafico7Dias.data.datasets[0].data = dadosNetflix7;
            window.meuGrafico7Dias.data.datasets[1].data = dadosPrime7;
            window.meuGrafico7Dias.update();
        } else {
            window.meuGrafico7Dias = new Chart(ctx7, {
                type: 'line',
                data: {
                    labels: labelsGrafico7,
                    datasets: [
                        {
                            label: 'Netflix (MZN)',
                            data: dadosNetflix7,
                            borderColor: '#E50914',
                            backgroundColor: 'rgba(229, 9, 20, 0.15)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#E50914',
                            pointBorderColor: '#121214',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: 'Prime Video (MZN)',
                            data: dadosPrime7,
                            borderColor: '#00A8E1',
                            backgroundColor: 'rgba(0, 168, 225, 0.15)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#00A8E1',
                            pointBorderColor: '#121214',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true, labels: { color: '#888' } } },
                    scales: {
                        x: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: '#888' } },
                        y: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: '#888' }, beginAtZero: true }
                    },
                    interaction: { mode: 'index', intersect: false }
                }
            });
        }
    }
}

window.aplicarFiltrosLocal = function () {
    const container = document.getElementById('containerRegistos');
    const termo = document.getElementById('filtroPesquisa').value.toLowerCase();
    const fServico = document.getElementById('filtroServico').value;
    const fStatus = document.getElementById('filtroStatus').value;
    const hoje = new Date();

    container.innerHTML = '';
    let exibidos = 0;

    window.todasAsVendas.forEach(venda => {
        const isAtivo = venda.dataExpiracao > hoje;
        const statusAtual = isAtivo ? "ativo" : "expirado";

        const passaPesquisa = venda.nomeCliente.toLowerCase().includes(termo) || venda.telefone.includes(termo) || venda.perfil.toLowerCase().includes(termo);
        const passaServico = fServico === "" || venda.servico === fServico;
        const passaStatus = fStatus === "" || statusAtual === fStatus;

        if (passaPesquisa && passaServico && passaStatus) {
            exibidos++;
            const statusClasse = isAtivo ? 'status-ativo' : 'status-expirado';
            const statusTexto = isAtivo ? 'Ativo' : 'Expirado';

            let btnPdfHtml = '';
            if (window.baseDeDadosContas[venda.servico]) {
                btnPdfHtml = `<div style="display:flex; flex-wrap:wrap; gap:8px; justify-content: flex-end;">
                    <button class="btn-icon" style="color: #eab308; border-color: rgba(234, 179, 8, 0.3);" onclick="enviarLembreteWhatsApp('${venda.id}')" title="Aviso de Renovação"><i data-lucide="bell" size="14"></i> Cobrar</button>
                    <button class="btn-icon" style="color: #25D366; border-color: rgba(37, 211, 102, 0.3);" onclick="enviarWhatsAppByID('${venda.id}')" title="Enviar Dados Iniciais (WhatsApp)"><i data-lucide="message-circle" size="14"></i> WA</button>
                    <button class="btn-icon" onclick="gerarPDFByID('${venda.id}')" title="Baixar Recibo PDF"><i data-lucide="download" size="14"></i> PDF</button>
                </div>`;
            }

            container.innerHTML += `
                <div class="profile-card" style="align-items: center; cursor: default; margin-bottom: 12px; ${!isAtivo ? 'opacity: 0.6;' : ''}">
                    <div class="profile-texts">
                        <div class="status-badge ${statusClasse}" style="margin-bottom:8px;">
                            <div class="status-dot"></div> ${statusTexto}
                        </div>
                        <h3 style="margin: 0 0 4px 0; font-size: 16px; color: var(--text-main);">${venda.nomeCliente}</h3>
                        <p style="font-size: 13px;">${venda.telefone}</p>
                        <p style="font-size: 12px; margin-top:8px;">${venda.pacote} • Expira a ${venda.dataExpiracao.toLocaleDateString('pt-PT')}</p>
                        
                        <div style="margin-top: 12px; display: flex; gap: 8px;">
                            <button class="btn-success" onclick="prepararRenovacao('${venda.id}')"><i data-lucide="refresh-cw" size="12"></i> Renovar</button>
                        </div>
                    </div>
                    <div style="text-align: right; display:flex; flex-direction:column; align-items:flex-end; gap:10px;">
                        <div>
                            <span style="font-weight: bold; font-size:14px; color: var(--text-main);">${venda.perfil}</span>
                            <p style="margin:4px 0 0 0; font-size:11px; color:var(--text-muted);">${venda.servico}</p>
                        </div>
                        ${btnPdfHtml}
                    </div>
                </div>
            `;
        }
    });

    if (exibidos === 0) container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">Nenhum registo encontrado com estes filtros.</p>`;
    lucide.createIcons();
}

// --- 4. FUNÇÃO REUTILIZÁVEL PARA GERAR PDF E WHATSAPP ---
window.gerarPDFByID = async function (id) {
    const venda = window.todasAsVendas.find(v => v.id === id);
    if (venda) await window.gerarPDF(venda);
};

window.fecharModalSucesso = function () {
    document.getElementById('modalSucesso').style.display = 'none';
    document.getElementById('clienteNome').value = '';
    document.getElementById('clienteContacto').value = '';
    document.getElementById('dataInicioVenda').valueAsDate = new Date();
    goBack();
};

window.enviarWhatsApp = function (venda) {
    if (!venda) return;
    const dbContas = window.baseDeDadosContas;
    const conf = dbContas ? dbContas[venda.servico] : null;

    let email = "Não configurado";
    let senha = "Não configurada";
    let pin = "N/A";

    if (conf) {
        email = conf.email || email;
        senha = conf.senha || senha;
        const perfilObj = conf.perfis.find(p => p.nome === venda.perfil);
        if (perfilObj) pin = perfilObj.pin;
    }

    let phone = venda.telefone.replace(/\D/g, '');
    if (phone.length <= 9) {
        phone = '258' + phone;
    } else if (!phone.startsWith('258') && phone.length > 9) {
        // Se já tiver código de outro país, não adiciona 258, só mantém numérico
    }

    let texto = "";
    if (venda.servico === 'Spotify') {
        texto = `Olá ${venda.nomeCliente}! Obrigado pela preferência.
Aqui estão os detalhes da sua assinatura ${venda.servico} Familiar:

👤 Vaga Designada: ${venda.perfil}
🗓️ Válido até: ${venda.dataExpiracao.toLocaleDateString('pt-PT')}

🔗 Como Ativar:
Será enviado um convite oficial do Spotify para o seu email pessoal. Por favor, abra a sua caixa de entrada, clique em "Aceitar Convite" e confirme com a sua própria conta.`;
    } else {
        texto = `Olá ${venda.nomeCliente}! Obrigado pela preferência.
Aqui estão os dados do seu acesso ${venda.servico}:

- Email: ${email}
- Senha: ${senha}
- Perfil: ${venda.perfil}
- PIN: ${pin}

O seu acesso expira a: ${venda.dataExpiracao.toLocaleDateString('pt-PT')}.
Bom entretenimento!`;
    }

    const encoded = encodeURIComponent(texto);
    const url = `https://wa.me/${phone}?text=${encoded}`;
    window.open(url, '_blank');
};

window.enviarEmailAutomatico = function (venda) {
    let emailDestino = venda.emailCliente;
    if (!emailDestino) {
        emailDestino = prompt("Não existe email guardado para este cliente. Por favor, introduza o email:");
        if (!emailDestino) return;
    }

    const contaMaster = window.baseDeDadosContas[venda.servico];
    let pin = "N/A";
    const perfilObj = contaMaster.perfis.find(p => p.nome === venda.perfil);
    if (perfilObj) pin = perfilObj.pin;

    let instrucoes = "";
    if (venda.servico === 'Spotify') {
        instrucoes = 'Será enviado um convite oficial do Spotify para este email. Por favor, abra a sua caixa de entrada, clique em "Aceitar Convite" e confirme com a sua própria conta.';
    } else {
        instrucoes = `Email da Conta: ${contaMaster.email}<br>Palavra-passe: ${contaMaster.senha}<br>PIN do Perfil: ${pin}`;
    }

    const templateParams = {
        nome_cliente: venda.nomeCliente,
        servico: venda.servico,
        pacote: venda.pacote,
        perfil: venda.perfil,
        data_expiracao: venda.dataExpiracao.toLocaleDateString('pt-PT'),
        instrucoes_ativacao: instrucoes,
        to_email: emailDestino
    };

    const btn = document.getElementById('btnSucessoEmail') || document.createElement('button');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader" class="lucide-spin"></i> A Enviar...`;

    emailjs.send("service_cpl0cqi", "template_ejnhvzd", templateParams)
        .then(function (response) {
            mostrarToast("✅ Email enviado com sucesso!");
            btn.innerHTML = originalHTML;
        }, function (error) {
            mostrarToast("❌ Falha ao enviar email. Tente novamente.");
            console.error("Erro EmailJS:", error);
            btn.innerHTML = originalHTML;
        });
};

window.enviarWhatsAppByID = function (id) {
    const venda = window.todasAsVendas.find(v => v.id === id);
    if (venda) window.enviarWhatsApp(venda);
};

window.enviarLembreteWhatsApp = function (id) {
    const venda = window.todasAsVendas.find(v => v.id === id);
    if (!venda) return;

    let phone = venda.telefone.replace(/\D/g, '');
    if (phone.length <= 9) phone = '258' + phone;

    const hoje = new Date();
    const isExpirado = venda.dataExpiracao < hoje;

    let texto = "";
    if (isExpirado) {
        texto = `Olá ${venda.nomeCliente}!\nO seu acesso ${venda.servico} (Perfil: ${venda.perfil}) expirou no dia ${venda.dataExpiracao.toLocaleDateString('pt-PT')}.\n\nGostaria de renovar a sua subscrição para continuar a assistir aos seus conteúdos favoritos? Aguardo o seu feedback!`;
    } else {
        texto = `Olá ${venda.nomeCliente}!\nLembramos que o seu acesso ${venda.servico} (Perfil: ${venda.perfil}) expira em breve, no dia ${venda.dataExpiracao.toLocaleDateString('pt-PT')}.\n\nDeseja já renovar a subscrição para evitar interrupções? Aguardo o seu feedback!`;
    }

    const encoded = encodeURIComponent(texto);
    const url = `https://wa.me/${phone}?text=${encoded}`;
    window.open(url, '_blank');
};

window.gerarPDF = async function (venda) {
    const contaMaster = window.baseDeDadosContas[venda.servico];
    const perfilDetalhes = contaMaster.perfis.find(p => p.nome === venda.perfil);
    const pinExato = perfilDetalhes ? perfilDetalhes.pin : "N/A";

    document.getElementById('pdfId').innerText = `#SYS-${venda.id.substring(0, 6).toUpperCase()}`;
    document.getElementById('pdfNomeCliente').innerText = venda.nomeCliente;
    document.getElementById('pdfTelefone').innerText = venda.telefone;

    if (venda.servico === 'Spotify') {
        document.getElementById('pdfEmailContaLabel').innerText = "Destino do Convite";
        document.getElementById('pdfEmailConta').innerText = venda.emailCliente || "Verifique o seu Email Pessoal";
        document.getElementById('pdfSenhaContaLabel').innerText = "Método de Acesso";
        document.getElementById('pdfSenhaConta').innerText = "Convite Automático";
    } else {
        document.getElementById('pdfEmailContaLabel').innerText = "Email de Login";
        document.getElementById('pdfEmailConta').innerText = contaMaster.email;
        document.getElementById('pdfSenhaContaLabel').innerText = "Palavra-passe";
        document.getElementById('pdfSenhaConta').innerText = contaMaster.senha;
    }
    document.getElementById('pdfNomePerfil').innerText = venda.perfil;
    document.getElementById('pdfPinPerfil').innerText = venda.servico === 'Spotify' ? 'N/A' : pinExato;
    document.getElementById('pdfServicoTexto').innerText = `${venda.servico} (${venda.pacote})`;
    document.getElementById('pdfDataInicio').innerText = venda.dataRegisto.toLocaleDateString('pt-PT');
    document.getElementById('pdfDataFim').innerText = venda.dataExpiracao.toLocaleDateString('pt-PT');
    document.getElementById('pdfPreco').innerText = `${venda.precoMZN},00 MZN`;
    document.getElementById('pdfTotal').innerText = `${venda.precoMZN},00 MZN`;

    await html2pdf().set({
        margin: 0,
        filename: `Recibo_${venda.servico}_${venda.nomeCliente.replace(/ /g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
    }).from(document.getElementById('molde-pdf')).save();
}

function mostrarToast(mensagem) {
    const toast = document.createElement('div');
    toast.innerText = mensagem;
    toast.style.cssText = "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--bg-elevated); color:white; padding:12px 24px; border-radius:8px; z-index:9999; box-shadow:0 5px 15px rgba(0,0,0,0.5); font-weight:600; border: 1px solid var(--border-color); animation: fadeIn 0.3s ease;";
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    document.getElementById('dataInicioVenda').valueAsDate = new Date();
});

// --- 5. CONFIGURAÇÕES ---
window.carregarConfiguracoesNaUI = function () {
    const container = document.getElementById('settingsContainer');
    if (!container) return;

    if (Object.keys(window.baseDeDadosContas).length === 0) {
        container.innerHTML = `<div class="loader-container">Erro ao carregar dados. Tente atualizar a página.</div>`;
        return;
    }

    container.innerHTML = `
        <div class="grid-brands" style="margin-bottom: 24px;">
            <div class="brand-card netflix" onclick="mostrarFormularioConfiguracao('Netflix')">
                <div class="svg-container"><span style="font-weight:bold; font-size:24px; color:#E50914;"><img src="icons8-netflix.svg" alt=""></span></div>
                <div style="display: flex; justify-content: space-between; width: 100%; color: var(--text-muted); font-size: 14px;">
                    <span>Plataforma</span><span style="color: var(--text-main); font-weight: 600;">Configurar &rarr;</span>
                </div>
            </div>
            <div class="brand-card prime" onclick="mostrarFormularioConfiguracao('Prime Video')">
                <div class="svg-container"><span style="font-weight:bold; font-size:20px; color:#00A8E1;"><img src="icons8-amazon-prime.svg" alt=""></span></div>
                <div style="display: flex; justify-content: space-between; width: 100%; color: var(--text-muted); font-size: 14px;">
                    <span>Plataforma</span><span style="color: var(--text-main); font-weight: 600;">Configurar &rarr;</span>
                </div>
            </div>
            <!-- 
            <div class="brand-card spotify" onclick="mostrarFormularioConfiguracao('Spotify')" style="border-left: 4px solid #1DB954;">
                <div class="svg-container"><span style="font-weight:bold; font-size:24px; color:#1DB954;"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.261 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.56.3z"/></svg></span></div>
                <div style="display: flex; justify-content: space-between; width: 100%; color: var(--text-muted); font-size: 14px;">
                    <span>Plataforma</span><span style="color: var(--text-main); font-weight: 600;">Configurar &rarr;</span>
                </div>
            </div>
            -->
        </div>
    `;
    lucide.createIcons();
}

window.mostrarFormularioConfiguracao = function (servico) {
    const container = document.getElementById('settingsContainer');
    const dados = window.baseDeDadosContas[servico];
    if (!dados) return;

    const maxLength = servico === 'Netflix' ? 4 : (servico === 'Prime Video' ? 5 : 5);
    const onInputStr = 'oninput="this.value = this.value.replace(/[^0-9]/g, \'\')"';
    const pinPlaceholder = `${maxLength} d.`;

    let perfisHtml = '<div style="display: flex; overflow-x: auto; gap: 12px; padding-bottom: 8px; width: 100%;">';

    dados.perfis.forEach((p, idx) => {
        perfisHtml += `
            <div style="min-width: 130px; background:var(--bg-elevated); padding:16px 12px; border-radius:12px; border:1px solid var(--border-color); text-align:center;">
                <input type="text" id="cfg_${servico.replace(' ', '')}_nome_${idx}" value="${p.nome}" 
                    placeholder="Nome"
                    style="width:100%; text-align:center; font-size:12px; color:var(--text-main); font-weight:600; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px; background:transparent; border:none; border-bottom:1px solid var(--border-color); padding-bottom:4px; outline:none;">
                <input type="text" id="cfg_${servico.replace(' ', '')}_pin_${idx}" value="${p.pin}" 
                    maxlength="${maxLength}" 
                    placeholder="${pinPlaceholder}" 
                    ${onInputStr}
                    style="width:100%; text-align:center; letter-spacing:2px; font-weight:bold; background:var(--bg-base); border:1px solid var(--border-color); border-radius:8px; padding:10px 8px; color:var(--text-main); outline:none; transition:0.2s;">
            </div>
        `;
    });
    perfisHtml += '</div>';

    if (!dados.pacotes) dados.pacotes = [];
    let pacotesHtml = '<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px;">';
    dados.pacotes.forEach((pacote, idx) => {
        pacotesHtml += `
            <div style="display: flex; gap: 8px; align-items: center; background: var(--bg-elevated); padding: 8px; border-radius: 8px; border: 1px solid var(--border-color);">
                <input type="text" id="cfg_${servico.replace(' ', '')}_pkg_nome_${idx}" value="${pacote.nome}" placeholder="Nome (ex: Mensal)" style="flex: 2; width: 100%; background: transparent; border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; color: var(--text-main); outline:none;">
                <input type="number" id="cfg_${servico.replace(' ', '')}_pkg_dias_${idx}" value="${pacote.dias}" placeholder="Dias" style="flex: 1; width: 100%; background: transparent; border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; color: var(--text-main); outline:none;">
                <input type="number" id="cfg_${servico.replace(' ', '')}_pkg_preco_${idx}" value="${pacote.preco}" placeholder="Preço" style="flex: 1; width: 100%; background: transparent; border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; color: var(--text-main); outline:none;">
                <button class="btn-secondary" onclick="window.removerPacoteConfig('${servico}', ${idx})" style="padding: 6px; border-color: var(--danger); color: var(--danger);"><i data-lucide="trash-2" size="16"></i></button>
            </div>
        `;
    });
    pacotesHtml += `
        <button class="btn-secondary" onclick="window.adicionarPacoteConfig('${servico}')" style="align-self: flex-start; padding: 6px 12px; margin-top: 8px; font-size: 13px;">
            <i data-lucide="plus" size="16"></i> Adicionar Pacote
        </button>
    </div>`;

    const html = `
        <div style="margin-bottom: 20px;">
            <button class="btn-secondary" onclick="carregarConfiguracoesNaUI()" style="padding: 8px 16px;">
                <i data-lucide="arrow-left" size="16"></i> Voltar às opções
            </button>
        </div>
        <div class="brand-card" style="cursor:default;">
            <h3 style="margin-top:0; border-bottom:1px solid var(--border-color); padding-bottom:12px; margin-bottom:20px; font-size:18px;">Configurações: ${servico}</h3>
            
            <div class="input-group" style="margin-bottom: 12px;">
                <i data-lucide="mail" class="input-icon"></i>
                <input type="email" id="cfg_${servico.replace(' ', '')}_email" value="${dados.email}" placeholder="Email da Conta" style="background:var(--bg-elevated); color:var(--text-main);">
            </div>
            
            <div class="input-group" style="margin-bottom: 24px;">
                <i data-lucide="lock" class="input-icon"></i>
                <input type="text" id="cfg_${servico.replace(' ', '')}_senha" value="${dados.senha}" placeholder="Palavra-passe" style="background:var(--bg-elevated); color:var(--text-main);">
            </div>
            
            <h4 style="font-size:12px; color:var(--text-muted); margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">Gerir Pacotes</h4>
            ${pacotesHtml}

            <h4 style="font-size:12px; color:var(--text-muted); margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">Gerir PINs dos Perfis</h4>
            ${perfisHtml}
            
            <button class="btn-primary" style="margin-top:20px; width:100%; justify-content:center;" onclick="salvarConfiguracoes('${servico}')" id="btnSave_${servico.replace(' ', '')}">
                <i data-lucide="save"></i> Guardar Alterações
            </button>
        </div>
    `;

    container.innerHTML = html;
    lucide.createIcons();
}

window.salvarConfiguracoes = async function (servico) {
    const dados = window.baseDeDadosContas[servico];
    const safeServicoId = servico.replace(' ', '');
    if (!dados) return;

    const email = document.getElementById(`cfg_${safeServicoId}_email`).value;
    const senha = document.getElementById(`cfg_${safeServicoId}_senha`).value;

    if (!email || !senha) return mostrarToast("⚠️ Email e Senha não podem estar vazios.");

    const maxLength = servico === 'Netflix' ? 4 : 5;
    let pinInvalido = false;

    for (let idx = 0; idx < dados.perfis.length; idx++) {
        const pinInput = document.getElementById(`cfg_${safeServicoId}_pin_${idx}`).value;
        if (pinInput.length !== maxLength) {
            pinInvalido = true;
            break;
        }
    }

    if (pinInvalido) {
        return mostrarToast(`⚠️ Todos os PINs do ${servico} devem ter exatamente ${maxLength} dígitos numéricos.`);
    }

    const btn = document.getElementById(`btnSave_${safeServicoId}`);
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader" class="lucide-spin"></i> A guardar...`;
    btn.disabled = true;

    dados.email = email;
    dados.senha = senha;

    dados.perfis.forEach((p, idx) => {
        const nomeInput = document.getElementById(`cfg_${safeServicoId}_nome_${idx}`).value;
        const pinInput = document.getElementById(`cfg_${safeServicoId}_pin_${idx}`).value;
        p.nome = nomeInput || p.nome;
        p.pin = pinInput;
    });

    if(dados.pacotes) {
        dados.pacotes.forEach((pacote, idx) => {
            const nomeInput = document.getElementById(`cfg_${safeServicoId}_pkg_nome_${idx}`);
            const diasInput = document.getElementById(`cfg_${safeServicoId}_pkg_dias_${idx}`);
            const precoInput = document.getElementById(`cfg_${safeServicoId}_pkg_preco_${idx}`);
            if(nomeInput && diasInput && precoInput) {
                pacote.nome = nomeInput.value;
                pacote.dias = parseInt(diasInput.value) || 0;
                pacote.preco = parseFloat(precoInput.value) || 0;
            }
        });
    }

    try {
        await setDoc(doc(db, "configuracoes", "contasMaster"), window.baseDeDadosContas);
        mostrarToast("✅ Configurações atualizadas com sucesso!");
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Erro ao guardar definições.");
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        lucide.createIcons();
    }
}

window.abrirModalVIP = function () {
    const listaVIP = document.getElementById('listaVIP');
    if (!listaVIP) return;

    listaVIP.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i data-lucide="loader" class="lucide-spin"></i> Calculando...</div>';
    lucide.createIcons();

    document.getElementById('modalVIP').style.display = 'flex';

    setTimeout(() => {
        const clientesMap = {};

        window.todasAsVendas.forEach(venda => {
            let phone = venda.telefone.replace(/\D/g, '');
            if (!phone) return;

            if (!clientesMap[phone]) {
                clientesMap[phone] = {
                    telefone: venda.telefone,
                    nome: venda.nomeCliente,
                    totalGasto: 0,
                    compras: 0
                };
            }

            clientesMap[phone].totalGasto += Number(venda.precoMZN) || 0;
            clientesMap[phone].compras += 1;

            if (venda.nomeCliente.length > clientesMap[phone].nome.length) {
                clientesMap[phone].nome = venda.nomeCliente;
            }
        });

        const clientesArray = Object.values(clientesMap);

        // Ordenar por total gasto
        clientesArray.sort((a, b) => b.totalGasto - a.totalGasto);

        listaVIP.innerHTML = '';

        if (clientesArray.length === 0) {
            listaVIP.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">Nenhum cliente registado ainda.</p>';
            return;
        }

        clientesArray.forEach((cli, index) => {
            let medalha = '';
            if (index === 0) medalha = '<i data-lucide="medal" size="20" style="color:#fbbf24;"></i>';
            else if (index === 1) medalha = '<i data-lucide="medal" size="20" style="color:#94a3b8;"></i>';
            else if (index === 2) medalha = '<i data-lucide="medal" size="20" style="color:#b45309;"></i>';
            else medalha = `<span style="color:var(--text-muted); font-size:14px; font-weight:bold; width:20px; text-align:center;">${index + 1}</span>`;

            listaVIP.innerHTML += `
                <div style="display:flex; align-items:center; background:var(--bg-elevated); padding:16px; border-radius:12px; gap:12px; border: 1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; justify-content:center; width:30px;">
                        ${medalha}
                    </div>
                    <div style="flex:1;">
                        <h4 style="margin:0 0 4px 0; font-size:15px; color:var(--text-main); display:flex; align-items:center; gap:6px;">${cli.nome}</h4>
                        <p style="margin:0; font-size:12px; color:var(--text-muted);">${cli.telefone} • ${cli.compras} compras</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="display:block; font-size:15px; font-weight:bold; color:var(--success);">${cli.totalGasto.toFixed(2)} MT</span>
                    </div>
                </div>
            `;
        });
        lucide.createIcons();
    }, 100);
};

window.removerPacoteConfig = function(servico, index) {
    if(!window.baseDeDadosContas[servico] || !window.baseDeDadosContas[servico].pacotes) return;
    
    // Save current state of inputs to avoid losing unsubmitted changes
    const safeServicoId = servico.replace(' ', '');
    window.baseDeDadosContas[servico].pacotes.forEach((pacote, idx) => {
        const nomeInput = document.getElementById(`cfg_${safeServicoId}_pkg_nome_${idx}`);
        const diasInput = document.getElementById(`cfg_${safeServicoId}_pkg_dias_${idx}`);
        const precoInput = document.getElementById(`cfg_${safeServicoId}_pkg_preco_${idx}`);
        if(nomeInput && diasInput && precoInput) {
            pacote.nome = nomeInput.value;
            pacote.dias = parseInt(diasInput.value) || 0;
            pacote.preco = parseFloat(precoInput.value) || 0;
        }
    });

    window.baseDeDadosContas[servico].pacotes.splice(index, 1);
    window.mostrarFormularioConfiguracao(servico);
}

window.adicionarPacoteConfig = function(servico) {
    if(!window.baseDeDadosContas[servico]) return;
    if(!window.baseDeDadosContas[servico].pacotes) window.baseDeDadosContas[servico].pacotes = [];

    // Save current state of inputs to avoid losing unsubmitted changes
    const safeServicoId = servico.replace(' ', '');
    window.baseDeDadosContas[servico].pacotes.forEach((pacote, idx) => {
        const nomeInput = document.getElementById(`cfg_${safeServicoId}_pkg_nome_${idx}`);
        const diasInput = document.getElementById(`cfg_${safeServicoId}_pkg_dias_${idx}`);
        const precoInput = document.getElementById(`cfg_${safeServicoId}_pkg_preco_${idx}`);
        if(nomeInput && diasInput && precoInput) {
            pacote.nome = nomeInput.value;
            pacote.dias = parseInt(diasInput.value) || 0;
            pacote.preco = parseFloat(precoInput.value) || 0;
        }
    });

    window.baseDeDadosContas[servico].pacotes.push({ nome: 'Novo Pacote', dias: 30, preco: 0 });
    window.mostrarFormularioConfiguracao(servico);
}
