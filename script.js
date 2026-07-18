// INTEGRAÇÃO DE ENDPOINTS DO SERVER N8N NO AZURE
const URL_SALVAR = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/salvar-combustivel"; 
const URL_ALTERAR = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/alterar-abastecimento";
const URL_DELETAR = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/deletar-abastecimento";
const URL_HISTORICO = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/buscar-abastecimentos"; 
const URL_FROTAS = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/buscar-frotas-abastecimento"; 
const URL_MOTORISTAS = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/buscar-motorista-abastecimento";

const URL_ROTAS = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/buscar-rotas-abastecimento";
const URL_ROTAS_TESTE = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/buscar-rotas-abastecimento/test";

const URL_CAD_FROTA = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/cadastrar-frota"; 
const URL_CAD_MOTORISTA = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/cadastrar-motorista-abastecimento"; 
const URL_CAD_ROTA = "https://n8nd-bjfva4gshggrgbe8.eastus-01.azurewebsites.net/webhook/cadastrar-rota"; 

let dicionarioFrotas = {}; let dicionarioMotoristas = {}; let dicionarioRotas = {};      
let bancoCombustivelCompleto = []; let listaFiltradaGlobal = [];
let paginaAtual = 1; const itensPorPagina = 12;
let lancamentoSendoEditado = null; let excecaoRelatorioAtiva = false; let filtroTempoAtualAnalytics = 'TODOS';

function abrirModalHistorico() { document.getElementById('modalHistorico').style.display = 'flex'; renderizarApenasPaginaAtual(); }
function fecharModalHistorico() { document.getElementById('modalHistorico').style.display = 'none'; fecharPopUpAcoes(); }
function fecharModalHistoricoOutside(e) { if(e.target.id === 'modalHistorico') fecharModalHistorico(); }

function obterValorCamaleao(obj, termosBusca) {
    if (!obj || typeof obj !== 'object') return "";
    const chaves = Object.keys(obj);
    for (let termo of termosBusca) {
        const chaveEncontrada = chaves.find(k => k.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === termo.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
        if (chaveEncontrada && obj[chaveEncontrada] !== undefined && obj[chaveEncontrada] !== null) {
            return obj[chaveEncontrada].toString();
        }
    }
    return "";
}

async function fetchWithTimeout(url, options = {}, timeout = 1500) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function carregarBancoDeDados() {
    try {
        const res = await fetch(URL_FROTAS);
        if (res.ok) {
            let frotas = await res.json();
            if (!Array.isArray(frotas) && frotas.frotas) frotas = frotas.frotas;
            const select = document.getElementById('selectFrota');
            select.innerHTML = '<option value="" disabled selected>Selecione a Frota...</option>';
            frotas.forEach(f => {
                const item = f.json || f;
                let frota = obterValorCamaleao(item, ['FROTA', 'frota']);
                let modelo = (obterValorCamaleao(item, ['MODELO', 'modelo']) || "EQUIPAMENTO").toUpperCase().trim();
                if(frota) { dicionarioFrotas[frota] = { modelo: modelo }; let opt = document.createElement('option'); opt.value = frota; opt.innerText = frota; select.appendChild(opt); }
            });
        }
    } catch(e){ console.error(e); }

    try {
        const res = await fetch(URL_MOTORISTAS);
        if(res.ok) {
            let motos = await res.json();
            let listMotos = (Array.isArray(motos) ? motos : motos.motoristas || []).map(m => m.json || m);
            const selectMoto = document.getElementById('selectMotorista');
            selectMoto.innerHTML = '<option value="" disabled selected>Selecione o Motorista...</option>';
            listMotos.forEach(m => {
                let cod = obterValorCamaleao(m, ['CODIGO', 'codigo']);
                let nome = obterValorCamaleao(m, ['NOME', 'nome']).toUpperCase().trim();
                if (nome) { dicionarioMotoristas[nome] = cod; let opt = document.createElement('option'); opt.value = nome; opt.innerText = `${getFormattedCode(cod)} - ${nome}`; selectMoto.appendChild(opt); }
            });
        }
    } catch(e){ console.error(e); }

    try {
        const selectRota = document.getElementById('selectRota');
        selectRota.innerHTML = '<option value="" disabled selected>Selecione a Rota...</option>';
        
        let listRotas = [];
        let res = null;

        try {
            res = await fetchWithTimeout(URL_ROTAS, {}, 1500);
            if(res && res.ok) {
                let rawData = await res.json();
                listRotas = Array.isArray(rawData) ? rawData : (rawData.rotas || rawData.data || []);
            }
        } catch(err) {
            console.warn("Redirecionando de forma transparente para URL de Teste...");
        }

        if (listRotas.length === 0) {
            res = await fetch(URL_ROTAS_TESTE);
            if (res.ok) {
                let rawData = await res.json();
                listRotas = Array.isArray(rawData) ? rawData : (rawData.rotas || rawData.data || []);
            }
        }

        if (listRotas.length === 0) {
            listRotas = [
                { CODIGO: "1", NOME: "CASCAVEL" },
                { CODIGO: "2", NOME: "TOLEDO" },
                { CODIGO: "3", NOME: "SANTA TEREZA" },
                { CODIGO: "4", NOME: "UMUARAMA" }
            ];
        }

        listRotas.forEach(r => {
            const item = r.json || r;
            let cod = obterValorCamaleao(item, ['CODIGO', 'codigo', 'id_rota']).trim();
            let rota = obterValorCamaleao(item, ['NOME', 'nome', 'ROTA', 'rota', 'nome_rota']).toUpperCase().trim();
            if (rota) {
                dicionarioRotas[rota] = cod; 
                let opt = document.createElement('option');
                opt.value = rota;
                opt.innerText = cod ? `${getFormattedCode(cod)} - ${rota}` : rota;
                selectRota.appendChild(opt);
            }
        });
    } catch(e){ 
        console.error(e);
        const selectRota = document.getElementById('selectRota');
        selectRota.innerHTML = '<option value="" disabled selected>Selecione a Rota...</option><option value="CASCAVEL">001 - CASCAVEL</option>';
        dicionarioRotas["CASCAVEL"] = "1";
    }

    carregarHistoricoTabela();
}

function getFormattedCode(cod) {
    if(!cod) return "";
    let n = parseInt(cod);
    if(!isNaN(n)) return n.toString().padStart(3, '0');
    return cod;
}

async function carregarHistoricoTabela() {
    try {
        const res = await fetch(URL_HISTORICO);
        if (!res.ok) throw new Error();
        let dados = await res.json();
        let list = Array.isArray(dados) ? dados : dados.abastecimentos || dados.data || [];
        bancoCombustivelCompleto = list.map(i => i.json || i).filter(i => i && typeof i === 'object');
        sincronizarListaFiltradaGlobal();
    } catch(e) { document.getElementById('dadosHistorico').innerHTML = `<tr><td colspan="13" style="text-align: center; color: red;">Erro ao carregar histórico.</td></tr>`; }
}

function sincronizarListaFiltradaGlobal() { listaFiltradaGlobal = [...bancoCombustivelCompleto]; listaFiltradaGlobal.reverse(); }

function renderizarApenasPaginaAtual() {
    const tbody = document.getElementById('dadosHistorico');
    document.getElementById('totalRegistros').innerText = `${listaFiltradaGlobal.length} registros`;
    if (listaFiltradaGlobal.length === 0) { tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; padding: 20px; color: #888;">Nenhum registro.</td></tr>`; return; }
    
    tbody.innerHTML = "";
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const sub = listaFiltradaGlobal.slice(inicio, inicio + itensPorPagina);

    sub.forEach(item => {
        let tr = document.createElement('tr');
        let idLanc = obterValorCamaleao(item, ['id_abas', 'id', 'id_abastecimento', 'id_lancamento']);
        tr.setAttribute('onclick', `abrirPopUpAcoes(event, '${idLanc}', this)`);

        let data = obterValorCamaleao(item, ['data', 'datasolicitacao']) || "---";
        let frota = obterValorCamaleao(item, ['frota']) || "---";
        let diesel = obterValorCamaleao(item, ['diesel', 'tipo_diesel']) || "---";
        let motorista = obterValorCamaleao(item, ['motorista', 'nome_motorista']) || "---";
        let rota = obterValorCamaleao(item, ['rota', 'nome_rota', 'nome', 'NOME']) || "---";
        
        let km = parseFloat(obterValorCamaleao(item, ['km_rodado', 'km', 'kmrodado', 'KM'])) || 0;
        let litInt = parseFloat(obterValorCamaleao(item, ['litros_interno', 'litro_interno', 'litrosinterno'])) || 0;
        let litExt = parseFloat(obterValorCamaleao(item, ['litros_externo', 'litro_externo', 'litrosexterno'])) || 0;
        let valLitro = parseFloat(obterValorCamaleao(item, ['valor_litro', 'preco_litro', 'valorlitro'])) || 0;
        let valTotal = parseFloat(obterValorCamaleao(item, ['valor_total_interno', 'valor_total'])) || (litInt * valLitro);
        let media = parseFloat(obterValorCamaleao(item, ['media', 'média'])) || 0;
        let relatorio = obterValorCamaleao(item, ['relatorio', 'numero_relatorio']) || "---";

        let badgeMediaClass = (media < 2 || media > 5) ? 'badge-media-alerta' : 'badge-media';
        let fInfo = dicionarioFrotas[frota] || { modelo: 'OUTRO' };
        let frotaBadge = ['VAN', '3/4', 'TOCO', 'TRUCK'].includes(fInfo.modelo) ? `<span class="badge-frota">${frota}</span>` : `<span class="badge-apoio">${frota}</span>`;

        tr.innerHTML = `
            <td class="td-check" onclick="event.stopPropagation();"><input type="checkbox" class="os-checkbox" onclick="atualizarContadorSelecionados()"></td>
            <td>${data}</td>
            <td>${frotaBadge}</td>
            <td><span style="font-size:10px; font-weight:800; color:#475569;">${diesel}</span></td>
            <td>${motorista.toUpperCase()}</td>
            <td>${rota.toUpperCase()}</td>
            <td style="color:#1e3a8a; font-weight:800;">${km > 0 ? km.toLocaleString('pt-BR') + ' KM' : '---'}</td>
            <td style="color:#10b981;">${litInt > 0 ? litInt.toFixed(1) + ' L' : '0.0 L'}</td>
            <td style="color:#ef4444;">${litExt > 0 ? litExt.toFixed(1) + ' L' : '---'}</td>
            <td>R$ ${valLitro.toFixed(2).replace('.',',')}</td>
            <td style="font-weight:800;">R$ ${valTotal.toFixed(2).replace('.',',')}</td>
            <td><span class="${badgeMediaClass}">${media > 0 ? media.toFixed(2) : '---'}</span></td>
            <td><span style="font-size:11px; background:#f1f5f9; padding:2px 4px; border-radius:4px;">${relatorio}</span></td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('checkMarcarTodos').checked = false;
    atualizarContadorSelecionados(); construirBotoesPaginador();
}

function construirBotoesPaginador() {
    const box = document.getElementById('boxPaginacao'); box.innerHTML = "";
    const totalPaginas = Math.ceil(listaFiltradaGlobal.length / itensPorPagina);
    if (totalPaginas <= 1) return;
    for (let i = 1; i <= totalPaginas; i++) {
        let btn = document.createElement('button'); btn.type = "button"; btn.className = `btn-page ${i === paginaAtual ? 'active' : ''}`; btn.innerText = i;
        btn.onclick = function() { paginaAtual = i; renderizarApenasPaginaAtual(); fecharPopUpAcoes(); }; box.appendChild(btn);
    }
}

document.getElementById('selectFrota').addEventListener('change', function() {
    const frota = this.value; const info = dicionarioFrotas[frota];
    if (info) {
        document.getElementById('txtTipoVeiculo').value = info.modelo;
        const rowRotaCampos = document.getElementById('rowRotaCampos'); const grpKm = document.getElementById('grpKm');
        const grpLitroExter = document.getElementById('grpLitroExter'); const grpRelatorio = document.getElementById('grpRelatorio');
        const grpMedia = document.getElementById('grpMedia'); const selectMotorista = document.getElementById('selectMotorista'); const selectRota = document.getElementById('selectRota');

        if (!['VAN', '3/4', 'TOCO', 'TRUCK'].includes(info.modelo)) {
            rowRotaCampos.style.display = 'none'; grpKm.style.display = 'none'; grpLitroExter.style.display = 'none'; grpRelatorio.style.display = 'none'; grpMedia.style.display = 'none';
            document.getElementById('numKm').required = false; document.getElementById('txtRelatorio').required = false; selectMotorista.required = false; selectRota.required = false;
            document.getElementById('numKm').value = ""; document.getElementById('numLitroExter').value = ""; document.getElementById('txtRelatorio').value = "SEM RELATORIO";
            selectMotorista.value = ""; selectRota.value = "";
        } else {
            rowRotaCampos.style.display = 'grid'; grpKm.style.display = 'block'; grpLitroExter.style.display = 'block'; grpRelatorio.style.display = 'block'; grpMedia.style.display = 'grid';
            document.getElementById('numKm').required = true; selectMotorista.required = true; selectRota.required = true;
            if (excecaoRelatorioAtiva) { document.getElementById('txtRelatorio').required = false; } else {
                document.getElementById('txtRelatorio').required = true; if(document.getElementById('txtRelatorio').value === "SEM RELATORIO") { document.getElementById('txtRelatorio').value = ""; }
            }
        }
    }
});

const inputsCalculo = ['numKm', 'numLitroInter', 'numLitroExter', 'numValorLitro'];
inputsCalculo.forEach(id => { document.getElementById(id).addEventListener('input', calcularValoresCombustivel); });

function calcularValoresCombustivel() {
    const km = parseFloat(document.getElementById('numKm').value) || 0;
    const litInt = parseFloat(document.getElementById('numLitroInter').value) || 0;
    const litExt = parseFloat(document.getElementById('numLitroExter').value) || 0;
    const valorLit = parseFloat(document.getElementById('numValorLitro').value) || 0;

    const totalInterno = litInt * valorLit;
    document.getElementById('txtValorTotal').value = `R$ ${totalInterno.toFixed(2).replace('.', ',')}`;

    const litTotal = litInt + litExt;
    if (km > 0 && litTotal > 0) { document.getElementById('txtMedia').value = `${(km / litTotal).toFixed(2)} KM/L`; } 
    else { document.getElementById('txtMedia').value = "---"; }
}

function alternarExcecaoRelatorio() {
    excecaoRelatorioAtiva = !excecaoRelatorioAtiva;
    const btn = document.getElementById('btnExcecao'); const inputRel = document.getElementById('txtRelatorio');
    if (excecaoRelatorioAtiva) { btn.classList.add('ativo'); btn.innerText = "🚨 Sem Relatório Ativo"; inputRel.disabled = true; inputRel.value = "SEM RELATORIO"; inputRel.required = false; } 
    else { btn.classList.remove('ativo'); btn.innerText = "⚠️ Sem Relatório"; inputRel.disabled = false; inputRel.value = ""; inputRel.required = true; }
}

function filtrarHistorico() {
    const fDat = document.getElementById('filtroData').value.toLowerCase(); const fFro = document.getElementById('filtroFrota').value.toLowerCase();
    const fMot = document.getElementById('filtroMoto').value.toLowerCase(); const fRot = document.getElementById('filtroRota').value.toLowerCase();

    listaFiltradaGlobal = bancoCombustivelCompleto.filter(item => {
        let data = obterValorCamaleao(item, ['data']).toLowerCase(); let frota = obterValorCamaleao(item, ['frota']).toLowerCase();
        let moto = obterValorCamaleao(item, ['motorista', 'nome_motorista']).toLowerCase(); let rota = obterValorCamaleao(item, ['rota', 'nome_rota', 'nome', 'NOME']).toLowerCase();
        return data.includes(fDat) && frota.includes(fFro) && moto.includes(fMot) && rota.includes(fRot);
    });
    listaFiltradaGlobal.reverse(); paginaAtual = 1; renderizarApenasPaginaAtual();
}

function abrirPopUpAcoes(evento, idLancamento, elementoTr) {
    evento.stopPropagation(); document.querySelectorAll('#dadosHistorico tr').forEach(tr => tr.classList.remove('linha-selecionada'));
    elementoTr.classList.add('linha-selecionada'); const popup = document.getElementById('popupMenuAcoes');
    popup.style.left = `${evento.clientX + 5}px`; popup.style.top = `${evento.clientY + 5}px`; popup.style.display = 'block';
    document.getElementById('popupBtnAlterar').onclick = function() { alterarLancamento(idLancamento); fecharModalHistorico(); };
    document.getElementById('popupBtnExcluir').onclick = function() { excluirLancamento(idLancamento); fecharPopUpAcoes(); };
}

function fecharPopUpAcoes() { document.getElementById('popupMenuAcoes').style.display = 'none'; document.querySelectorAll('#dadosHistorico tr').forEach(tr => tr.classList.remove('linha-selecionada')); }
document.addEventListener('click', function(e) { const popup = document.getElementById('popupMenuAcoes'); if (popup && popup.style.display === 'block' && !popup.contains(e.target)) fecharPopUpAcoes(); });

function alterarLancamento(idLancamento) {
    let registro = bancoCombustivelCompleto.find(i => obterValorCamaleao(i, ['id_abas', 'id', 'id_abastecimento', 'id_lancamento']) === idLancamento);
    if(!registro) return;

    lancamentoSendoEditado = idLancamento;
    let [d, m, a] = obterValorCamaleao(registro, ['data']).split('/');
    document.getElementById('txtData').value = `20${a}-${m}-${d}`;
    document.getElementById('selectFrentista').value = obterValorCamaleao(registro, ['frentista']);
    document.getElementById('selectDiesel').value = obterValorCamaleao(registro, ['diesel']);
    document.getElementById('selectFrota').value = obterValorCamaleao(registro, ['frota']);
    document.getElementById('selectFrota').dispatchEvent(new Event('change'));

    document.getElementById('selectMotorista').value = obterValorCamaleao(registro, ['motorista', 'nome_motorista']).toUpperCase().trim();
    document.getElementById('selectRota').value = obterValorCamaleao(registro, ['rota', 'nome_rota', 'nome', 'NOME']).toUpperCase().trim();
    document.getElementById('numKm').value = obterValorCamaleao(registro, ['km_rodado', 'km', 'kmrodado']);
    document.getElementById('numLitroInter').value = obterValorCamaleao(registro, ['litros_interno', 'litro_interno', 'litrosinterno']);
    document.getElementById('numLitroExter').value = obterValorCamaleao(registro, ['litros_externo', 'litro_externo', 'litrosexterno']);
    document.getElementById('numValorLitro').value = obterValorCamaleao(registro, ['valor_litro', 'preco_litro', 'valorlitro']);
    
    let rel = obterValorCamaleao(registro, ['relatorio', 'numero_relatorio']);
    if(rel === "SEM RELATORIO") { if(!excecaoRelatorioAtiva) alternarExcecaoRelatorio(); } else {
        if(excecaoRelatorioAtiva) alternarExcecaoRelatorio(); document.getElementById('txtRelatorio').value = rel;
    }
    calcularValoresCombustivel(); document.getElementById('btnSalvar').querySelector('span').innerText = `Atualizar Lançamento #${idLancamento}`;
}

async function excluirLancamento(idLancamento) {
    if(!confirm(`Deseja deletar permanentemente o abastecimento #${idLancamento}?`)) return;
    try {
        const res = await fetch(URL_DELETAR, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_abastecimento: idLancamento }) });
        if(res.ok) { alert("Removido com sucesso!"); carregarHistoricoTabela(); }
    } catch(e) { alert("Falha na conexão."); }
}

async function adicionarFrotaManual() {
    const nr = prompt("Número da Frota:"); if(!nr) return;
    const placa = prompt("Placa:").toUpperCase().trim();
    const mod = prompt("Modelo/Marca (VAN, 3/4, TOCO, TRUCK...):").toUpperCase().trim();
    try {
        const res = await fetch(URL_CAD_FROTA, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ FROTA: nr, PLACA: placa, MODELO: mod, FILIAL: "CASCAVEL", TIPO: "FROTA" }) });
        if(res.ok) { alert("Cadastrado!"); carregarBancoDeDados(); }
    } catch(e){ alert("Erro de rede."); }
}

async function adicionarMotoristaManual() {
    const cod = prompt("Código:"); if(!cod) return;
    const nome = prompt("Nome Completo:").toUpperCase().trim();
    try {
        const res = await fetch(URL_CAD_MOTORISTA, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ CODIGO: cod, NOME: nome }) });
        if(res.ok) { alert("Motorista Cadastrado!"); carregarBancoDeDados(); }
    } catch(e){ alert("Erro de rede."); }
}

async function adicionarRotaManual() {
    const cod = prompt("Código:"); if(!cod) return;
    const rota = prompt("Nome da Rota:").toUpperCase().trim();
    try {
        const res = await fetch(URL_CAD_ROTA, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ CODIGO: cod, ROTA: rota }) });
        if(res.ok) { alert("Rota Cadastrada!"); carregarBancoDeDados(); }
    } catch(e){ alert("Erro de rede."); }
}

function restaurarConfiguracoesSessao() {
    const dataSalva = localStorage.getItem('movistar_combustivel_data');
    if (dataSalva) { document.getElementById('txtData').value = dataSalva; } else { document.getElementById('txtData').valueAsDate = new Date(); }
    const frentistaSalvo = localStorage.getItem('movistar_combustivel_frentista'); if (frentistaSalvo) { document.getElementById('selectFrentista').value = frentistaSalvo; }
    const dieselSalvo = localStorage.getItem('movistar_combustivel_diesel'); if (dieselSalvo) { document.getElementById('selectDiesel').value = dieselSalvo; }
    const valorLitroSalvo = localStorage.getItem('movistar_combustivel_preco_litro'); if(valorLitroSalvo) { document.getElementById('numValorLitro').value = valorLitroSalvo; }
}

function marcarDesmarcarTodos(master) { document.querySelectorAll('.os-checkbox').forEach(cb => cb.checked = master.checked); atualizarContadorSelecionados(); }
function atualizarContadorSelecionados() { const nr = Array.from(document.querySelectorAll('.os-checkbox')).filter(cb => cb.checked).length; document.getElementById('contadorSelecionados').innerText = `(${nr} sel.)`; }

// --- 📊 ANALYTICS CENTRAL ---
function abrirCentralAnalytics() { document.getElementById('modalAnalytics').style.display = 'flex'; processarEMostrarAnalytics(); }
function fecharCentralAnalytics() { document.getElementById('modalAnalytics').style.display = 'none'; }
function fecharCentralAnalyticsOutside(e) { if(e.target.id === 'modalAnalytics') fecharCentralAnalytics(); }

function filtrarTempoAnalytics(tipo) {
    filtroTempoAtualAnalytics = tipo; document.querySelectorAll('.btn-time-filter').forEach(b => b.classList.remove('active'));
    if(tipo === 'TODOS') document.getElementById('filterAll').classList.add('active');
    if(tipo === 'MENSAL') document.getElementById('filterMonth').classList.add('active');
    if(tipo === 'SEMANAL') document.getElementById('filterWeek').classList.add('active');
    if(tipo === 'DIARIO') document.getElementById('filterDay').classList.add('active');
    processarEMostrarAnalytics();
}

function converterStringParaData(strData) {
    if(!strData) return new Date(0);
    let partes = strData.split('/');
    if(partes.length === 3) {
        let anoCompleto = partes[2].length === 2 ? '20' + partes[2] : partes[2];
        return new Date(parseInt(anoCompleto), parseInt(partes[1]) - 1, parseInt(partes[0]));
    }
    return new Date(0);
}

function processarEMostrarAnalytics() {
    const agora = new Date();
    let dadosFiltrados = bancoCombustivelCompleto.filter(item => {
        let dataItem = converterStringParaData(obterValorCamaleao(item, ['data']));
        if(filtroTempoAtualAnalytics === 'DIARIO') return dataItem.toDateString() === agora.toDateString();
        if(filtroTempoAtualAnalytics === 'SEMANAL') { let s = new Date(); s.setDate(agora.getDate() - 7); return dataItem >= s; }
        if(filtroTempoAtualAnalytics === 'MENSAL') { let m = new Date(); m.setDate(agora.getDate() - 30); return dataItem >= m; }
        return true;
    });

    let dadosCaminhao = {}; let dadosMotorista = {}; let dadosRota = {}; let dadosDiesel = { 'S-10': 0, 'S-500': 0 };
    let totalLitrosInt = 0; let totalLitrosExt = 0; let totalKm = 0; let totalCusto = 0;

    dadosFiltrados.forEach(item => {
        let frota = obterValorCamaleao(item, ['frota']) || "OUTROS";
        let motorista = (obterValorCamaleao(item, ['motorista', 'nome_motorista']) || "NÃO INFORMADO").toUpperCase().trim();
        let rota = (obterValorCamaleao(item, ['rota', 'nome_rota', 'nome', 'NOME']) || "INTERNO / APOIO").toUpperCase().trim();
        let tipoDiesel = obterValorCamaleao(item, ['diesel', 'tipo_diesel']) || "S-10";
        
        let litInt = parseFloat(obterValorCamaleao(item, ['litros_interno', 'litro_interno', 'litrosinterno'])) || 0;
        let litExt = parseFloat(obterValorCamaleao(item, ['litros_externo', 'litro_externo', 'litrosexterno'])) || 0;
        let km = parseFloat(obterValorCamaleao(item, ['km_rodado', 'km', 'kmrodado', 'KM'])) || 0;
        let valorLitro = parseFloat(obterValorCamaleao(item, ['valor_litro', 'preco_litro', 'valorlitro'])) || 0;

        totalLitrosInt += litInt; totalLitrosExt += litExt; totalKm += km; totalCusto += (litInt * valorLitro);

        if(!dadosCaminhao[frota]) dadosCaminhao[frota] = 0; dadosCaminhao[frota] += litInt;
        if(!dadosDiesel[tipoDiesel]) dadosDiesel[tipoDiesel] = 0; dadosDiesel[tipoDiesel] += litInt;

        if(km > 0 && (litInt + litExt) > 0) {
            if(!dadosMotorista[motorista]) dadosMotorista[motorista] = { km: 0, litros: 0 };
            dadosMotorista[motorista].km += km; dadosMotorista[motorista].litros += (litInt + litExt);
        }
        if(!dadosRota[rota]) dadosRota[rota] = { km: 0 }; dadosRota[rota].km += km;
    });

    let cCaminhao = document.getElementById('chartCaminhaoLitros'); cCaminhao.innerHTML = "";
    let fOrdenadas = Object.keys(dadosCaminhao).sort((a,b) => dadosCaminhao[b] - dadosCaminhao[a]);
    let maxC = dadosCaminhao[fOrdenadas[0]] || 1;
    fOrdenadas.forEach(f => { let pct = (dadosCaminhao[f] / maxC) * 100; cCaminhao.innerHTML += `<div class="chart-row"><div class="chart-label-container"><span>CC Frota ${f}</span><span>${dadosCaminhao[f].toFixed(1)} L</span></div><div class="chart-bar-bg"><div class="chart-bar-fill" style="width: ${pct}%"></div></div></div>`; });

    let cMotorista = document.getElementById('chartMotoristaMedia'); cMotorista.innerHTML = "";
    let mOrdenados = Object.keys(dadosMotorista).map(m => { return { nome: m, media: dadosMotorista[m].km / dadosMotorista[m].litros }; }).sort((a,b) => b.media - a.media);
    mOrdenados.forEach(m => { let pct = (m.media / 6) * 100; if(pct > 100) pct = 100; let cor = (m.media < 2.2 || m.media > 4.8) ? 'orange' : ''; cMotorista.innerHTML += `<div class="chart-row"><div class="chart-label-container"><span>👤 ${m.nome}</span><span>${m.media.toFixed(2)} KM/L</span></div><div class="chart-bar-bg"><div class="chart-bar-fill ${cor}" style="width: ${pct}%"></div></div></div>`; });

    let cDiesel = document.getElementById('chartDieselConsumo'); cDiesel.innerHTML = "";
    let maxD = Math.max(dadosDiesel['S-10'], dadosDiesel['S-500']) || 1;
    Object.keys(dadosDiesel).forEach(d => { let pct = (dadosDiesel[d] / maxD) * 100; cDiesel.innerHTML += `<div class="chart-row"><div class="chart-label-container"><span>⛽ Diesel ${d}</span><span>${dadosDiesel[d].toFixed(1)} L</span></div><div class="chart-bar-bg"><div class="chart-bar-fill purple" style="width: ${pct}%"></div></div></div>`; });

    let cRota = document.getElementById('chartRotaConsumo'); cRota.innerHTML = "";
    let rOrdenadas = Object.keys(dadosRota).sort((a,b) => dadosRota[b].km - dadosRota[a].km);
    let maxR = dadosRota[rOrdenadas[0]]?.km || 1;
    rOrdenadas.forEach(r => { let pct = (dadosRota[r].km / maxR) * 100; cRota.innerHTML += `<div class="chart-row"><div class="chart-label-container"><span>📍 ${r}</span><span>${dadosRota[r].km} KM</span></div><div class="chart-bar-bg"><div class="chart-bar-fill" style="width: ${pct}%"></div></div></div>`; });

    let cStats = document.getElementById('statsGeraisCombustivel');
    let mGeral = totalKm > 0 ? (totalKm / (totalLitrosInt + totalLitrosExt)) : 0;
    let custoPorKm = totalKm > 0 ? (totalCusto / totalKm) : 0;
    cStats.innerHTML = `
        <div style="background:#eff6ff; padding:10px; border-radius:8px; border-left:4px solid #3b82f6;"><label style="color:#1e40af;">Litros Internos</label><p style="font-size:15px; font-weight:900; color:#1e3a8a;">${totalLitrosInt.toLocaleString('pt-BR')} L</p></div>
        <div style="background:#ecfdf5; padding:10px; border-radius:8px; border-left:4px solid #10b981;"><label style="color:#065f46;">Média Frota</label><p style="font-size:15px; font-weight:900; color:#064e3b;">${mGeral > 0 ? mGeral.toFixed(2) + ' KM/L' : '---'}</p></div>
        <div style="background:#fef3c7; padding:10px; border-radius:8px; border-left:4px solid #f59e0b;"><label style="color:#92400e;">KM Rodados</label><p style="font-size:15px; font-weight:900; color:#78350f;">${totalKm.toLocaleString('pt-BR')} KM</p></div>
        <div style="background:#fdf2f8; padding:10px; border-radius:8px; border-left:4px solid #ec4899;"><label style="color:#9d174d;">Custo por KM</label><p style="font-size:15px; font-weight:900; color:#831843;">${custoPorKm > 0 ? 'R$ ' + custoPorKm.toFixed(2) : '---'}</p></div>
    `;
}

document.getElementById('combustivelForm').addEventListener('submit', async function(e) {
    e.preventDefault(); const btn = document.getElementById('btnSalvar'); const btnText = btn.querySelector('span');
    const dataOriginal = document.getElementById('txtData').value; const frentista = document.getElementById('selectFrentista').value;
    const diesel = document.getElementById('selectDiesel').value; const frota = document.getElementById('selectFrota').value; const tipoVeiculo = document.getElementById('txtTipoVeiculo').value;
    const km = parseFloat(document.getElementById('numKm').value) || 0; const litInt = parseFloat(document.getElementById('numLitroInter').value) || 0;
    const litExt = parseFloat(document.getElementById('numLitroExter').value) || 0; const precoLit = parseFloat(document.getElementById('numValorLitro').value) || 0;
    const totalInt = litInt * precoLit; const litTotal = litInt + litExt;

    if (litInt > 500 && !confirm(`⚠️ LITRAGEM ALTA!\n\nConfirma ${litInt} litros?`)) return;
    if (km > 2000 && !confirm(`⚠️ KM ALTO!\n\nConfirma ${km} KM?`)) return;

    localStorage.setItem('movistar_combustivel_data', dataOriginal); localStorage.setItem('movistar_combustivel_frentista', frentista);
    localStorage.setItem('movistar_combustivel_diesel', diesel); localStorage.setItem('movistar_combustivel_preco_litro', precoLit);

    let [ano, mes, dia] = dataOriginal.split('-'); const dataBR = `${dia}/${mes}/${ano.substring(2)}`; 
    const motoristaNome = document.getElementById('selectMotorista').value ? document.getElementById('selectMotorista').value.toUpperCase().trim() : "";
    const motoristaCod = dicionarioMotoristas[motoristaNome] || "";
    const rotaNome = document.getElementById('selectRota').value ? document.getElementById('selectRota').value.toUpperCase().trim() : "";
    const rotaCod = dicionarioRotas[rotaNome] || "";
    let relatorio = excecaoRelatorioAtiva ? "SEM RELATORIO" : document.getElementById('txtRelatorio').value.toUpperCase().trim();

    btnText.innerText = "Registrando..."; btn.disabled = true;
    const urlDestino = lancamentoSendoEditado ? URL_ALTERAR : URL_SALVAR;
    const idCalculado = lancamentoSendoEditado ? lancamentoSendoEditado : Math.floor(100000 + Math.random() * 900000).toString(); 

    const payload = {
        id_abastecimento: idCalculado, data: dataBR, frota: frota, frentista: frentista, diesel: diesel,
        codigo_motorista: motoristaCod, motorista: motoristaNome, codigo_rota: rotaCod, rota: rotaNome,
        km_rodado: km, litros_interno: litInt, litros_externo: litExt, valor_litro: precoLit,
        valor_total_interno: totalInt, media: ['VAN', '3/4', 'TOCO', 'TRUCK'].includes(tipoVeiculo) ? (km / litTotal) : 0, relatorio: relatorio
    };

    try { const r = await fetch(urlDestino, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (r.ok) { alert("Sucesso!"); location.reload(); } } 
    catch(e) { alert("Erro de conexão."); } finally { btnText.innerText = "Salvar Abastecimento"; btn.disabled = false; }
});

carregarBancoDeDados(); restaurarConfiguracoesSessao();