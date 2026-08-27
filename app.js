// ========================================
// FINANFLOW - SISTEMA PRINCIPAL
// ========================================


// ========================================
// VERIFICAÇÃO DE LOGIN
// ========================================

const usuarioLogado =
    JSON.parse(
        localStorage.getItem("finanflow_usuario_logado")
    );


// Se não estiver logado,
// volta para a tela de login.

if (!usuarioLogado) {

    window.location.href = "login.html";

}


// ========================================
// IDENTIFICAÇÃO DO USUÁRIO
// ========================================

const usuarioId =
    usuarioLogado ? usuarioLogado.id : null;


// ========================================
// CHAVES INDIVIDUAIS
// ========================================

const chaveTransacoes =
    `finanflow_transacoes_${usuarioId}`;

const chaveMensalidades =
    `finanflow_mensalidades_${usuarioId}`;

const chaveMetas =
    `finanflow_metas_${usuarioId}`;


// ========================================
// CARREGAMENTO DOS DADOS
// ========================================

let transacoes =
    JSON.parse(
        localStorage.getItem(chaveTransacoes)
    ) || [];


let mensalidades =
    JSON.parse(
        localStorage.getItem(chaveMensalidades)
    ) || [];


let metas =
    JSON.parse(
        localStorage.getItem(chaveMetas)
    ) || [];


let graficoFinanceiro = null;

let graficoCategorias = null;


// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        document.getElementById(
            "dataTransacao"
        ).value =
            new Date()
                .toISOString()
                .split("T")[0];


        configurarMenu();

        configurarFormularios();

        atualizarUsuarioNaInterface();

        carregarTransacoesDoBanco();

    }
);


// ========================================
// MOSTRAR USUÁRIO
// ========================================

function atualizarUsuarioNaInterface() {

    const elementos =
        document.querySelectorAll(
            ".usuario-nome"
        );

    elementos.forEach(elemento => {

        elemento.textContent =
            usuarioLogado.nome;

    });

}


// ========================================
// MENU
// ========================================

function configurarMenu() {

    document
        .querySelectorAll(".menu-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const section =
                        button.dataset.section;

                    mostrarSecao(section);

                }
            );

        });

}


function mostrarSecao(section) {

    document
        .querySelectorAll(".section")
        .forEach(sec => {

            sec.classList.remove("active");

        });


    document
        .querySelectorAll(".menu-btn")
        .forEach(btn => {

            btn.classList.remove("active");

        });


    const alvo =
        document.getElementById(section);


    if (alvo) {

        alvo.classList.add("active");

    }


    const botao =
        document.querySelector(
            `.menu-btn[data-section="${section}"]`
        );


    if (botao) {

        botao.classList.add("active");

    }


    const titulos = {

        dashboard: [
            "Dashboard",
            "Visão geral das suas finanças"
        ],

        transacoes: [
            "Transações",
            "Controle suas entradas e despesas"
        ],

        mensalidades: [
            "Mensalidades",
            "Controle suas contas recorrentes"
        ],

        metas: [
            "Metas",
            "Acompanhe seus objetivos financeiros"
        ]

    };


    if (titulos[section]) {

        document.getElementById(
            "pageTitle"
        ).textContent =
            titulos[section][0];


        document.getElementById(
            "pageSubtitle"
        ).textContent =
            titulos[section][1];

    }

}


// ========================================
// FORMULÁRIOS
// ========================================

function configurarFormularios() {

    document
        .getElementById("formTransacao")
        .addEventListener(
            "submit",
            salvarTransacao
        );


    document
        .getElementById("formMensalidade")
        .addEventListener(
            "submit",
            salvarMensalidade
        );


    document
        .getElementById("formMeta")
        .addEventListener(
            "submit",
            salvarMeta
        );

}


// ========================================
// TRANSAÇÕES
// ========================================
async function carregarTransacoesDoBanco() {

    try {

        const resposta =
            await fetch(
                `http://localhost:3000/api/transacoes?usuarioId=${usuarioId}`
            );

        const dados =
            await resposta.json();

        if (!resposta.ok) {

            throw new Error(
                dados.mensagem ||
                "Erro ao carregar transações."
            );

        }

        transacoes =
            dados.transacoes || [];

        atualizarDashboard();

        renderizarTransacoes();

        renderizarUltimasTransacoes();

    } catch (erro) {

        console.error(
            "Erro ao carregar transações:",
            erro
        );

        alert(
            "Não foi possível carregar suas transações."
        );

    }

}

async function excluirTransacao(id) {

    if (
        !confirm(
            "Deseja realmente excluir esta transação?"
        )
    ) {
        return;
    }

    try {

        const resposta =
            await fetch(
                `http://localhost:3000/api/transacoes/${id}?usuarioId=${usuarioId}`,
                {
                    method: "DELETE"
                }
            );

        const dados =
            await resposta.json();

        if (!resposta.ok) {

            throw new Error(
                dados.mensagem ||
                "Erro ao excluir transação."
            );

        }

        // ========================================
        // CARREGA NOVAMENTE DO SQLITE
        // ========================================
        
        await carregarTransacoesDoBanco();

    } catch (erro) {

        console.error(
            "Erro ao excluir transação:",
            erro
        );

        alert(
            "Não foi possível excluir a transação."
        );

    }

}


async function salvarTransacao(event) {

    event.preventDefault();


    const tipo =
        document.getElementById(
            "tipoTransacao"
        ).value;


    const descricao =
        document.getElementById(
            "descricaoTransacao"
        ).value.trim();


    const valor =
        Number(
            document.getElementById(
                "valorTransacao"
            ).value
        );


    const categoria =
        document.getElementById(
            "categoriaTransacao"
        ).value;


    const data =
        document.getElementById(
            "dataTransacao"
        ).value;


    // ========================================
    // VALIDAÇÃO
    // ========================================

    if (
        !descricao ||
        valor <= 0 ||
        !data
    ) {

        alert(
            "Preencha todos os campos corretamente."
        );

        return;

    }


    // ========================================
    // SALVAR NO SQLITE
    // ========================================

    try {

        const resposta =
            await fetch(
                "http://localhost:3000/api/transacoes",
                {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        usuarioId: usuarioId,

                        tipo: tipo,

                        descricao: descricao,

                        valor: valor,

                        categoria: categoria,

                        data: data

                    })

                }
            );


        const dados =
            await resposta.json();


        if (!resposta.ok) {

            throw new Error(
                dados.mensagem ||
                "Erro ao salvar transação."
            );

        }


        // ========================================
        // LIMPA O FORMULÁRIO
        // ========================================

        document
            .getElementById(
                "formTransacao"
            )
            .reset();


        document.getElementById(
            "dataTransacao"
        ).value =
            new Date()
                .toISOString()
                .split("T")[0];


        fecharModal(
            "modalTransacao"
        );


        // ========================================
        // CARREGA NOVAMENTE DO SQLITE
        // ========================================

        await carregarTransacoesDoBanco();


    } catch (erro) {

        console.error(
            "Erro ao salvar transação:",
            erro
        );


        alert(
            "Não foi possível salvar a transação."
        );

    }

}

app.delete("/api/transacoes/:id", (req, res) => {

    console.log(
        "DELETE RECEBIDO:",
        req.params.id,
        "USUARIO:",
        req.query.usuarioId
    );

    try {

        const id = Number(req.params.id);
        const usuarioId = Number(req.query.usuarioId);

        if (!id || !usuarioId) {

            return res.status(400).json({
                sucesso: false,
                mensagem: "Dados inválidos."
            });

        }

        const resultado = db.prepare(`
            DELETE FROM transacoes
            WHERE id = ?
            AND usuario_id = ?
        `).run(
            id,
            usuarioId
        );

        console.log("RESULTADO DO DELETE:", resultado);

        if (resultado.changes === 0) {

            return res.status(404).json({
                sucesso: false,
                mensagem: "Transação não encontrada."
            });

        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Transação excluída com sucesso."
        });

    } catch (erro) {

        console.error(
            "Erro ao excluir transação:",
            erro
        );

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno do servidor."
        });

    }

});


function renderizarTransacoes() {

    const lista =
        document.getElementById(
            "listaTransacoes"
        );


    const filtro =
        document.getElementById(
            "filtroTipo"
        ).value;


    let dados =
        [...transacoes];


    if (filtro !== "todos") {

        dados =
            dados.filter(
                item =>
                    item.tipo === filtro
            );

    }


    dados.sort(
        (a, b) =>
            new Date(b.data) -
            new Date(a.data)
    );


    if (dados.length === 0) {

        lista.innerHTML =
            `<p class="empty">
                Nenhuma transação encontrada.
            </p>`;

        return;

    }


    lista.innerHTML =
        dados.map(item => {

            const sinal =
                item.tipo === "entrada"
                    ? "+"
                    : "-";


            const icone =
                item.tipo === "entrada"
                    ? "📈"
                    : "📉";


            return `

                <div class="transaction">

                    <div class="transaction-left">

                        <div class="transaction-icon">
                            ${icone}
                        </div>

                        <div class="transaction-info">

                            <strong>
                                ${escapeHTML(
                                    item.descricao
                                )}
                            </strong>

                            <small>
                                ${escapeHTML(
                                    item.categoria
                                )}
                                •
                                ${formatarData(
                                    item.data
                                )}
                            </small>

                        </div>

                    </div>


                    <div>

                        <span class="transaction-value ${item.tipo}">
                            ${sinal}
                            ${formatarMoeda(
                                item.valor
                            )}
                        </span>


                        <button
                            class="delete-btn"
                            onclick="excluirTransacao(${item.id})"
                        >
                            Excluir
                        </button>

                    </div>

                </div>

            `;

        }).join("");

}


function renderizarUltimasTransacoes() {

    const lista =
        document.getElementById(
            "ultimasTransacoes"
        );


    const dados =
        [...transacoes]
            .sort(
                (a, b) =>
                    new Date(b.data) -
                    new Date(a.data)
            )
            .slice(0, 5);


    if (dados.length === 0) {

        lista.innerHTML =
            `<p class="empty">
                Nenhuma transação cadastrada.
            </p>`;

        return;

    }


    lista.innerHTML =
        dados.map(item => {

            const sinal =
                item.tipo === "entrada"
                    ? "+"
                    : "-";


            const icone =
                item.tipo === "entrada"
                    ? "📈"
                    : "📉";


            return `

                <div class="transaction">

                    <div class="transaction-left">

                        <div class="transaction-icon">
                            ${icone}
                        </div>


                        <div class="transaction-info">

                            <strong>
                                ${escapeHTML(
                                    item.descricao
                                )}
                            </strong>

                            <small>
                                ${escapeHTML(
                                    item.categoria
                                )}
                                •
                                ${formatarData(
                                    item.data
                                )}
                            </small>

                        </div>

                    </div>


                    <span class="transaction-value ${item.tipo}">
                        ${sinal}
                        ${formatarMoeda(
                            item.valor
                        )}
                    </span>

                </div>

            `;

        }).join("");

}


// ========================================
// MENSALIDADES
// ========================================

function salvarMensalidade(event) {

    event.preventDefault();


    const nome =
        document.getElementById(
            "nomeMensalidade"
        ).value.trim();


    const valor =
        Number(
            document.getElementById(
                "valorMensalidade"
            ).value
        );


    const dia =
        Number(
            document.getElementById(
                "diaMensalidade"
            ).value
        );


    const categoria =
        document.getElementById(
            "categoriaMensalidade"
        ).value;


    if (
        !nome ||
        valor <= 0 ||
        dia < 1 ||
        dia > 31
    ) {

        alert(
            "Preencha os dados corretamente."
        );

        return;

    }


    mensalidades.push({

        id: Date.now(),

        nome,

        valor,

        dia,

        categoria,

        paga: false

    });


    salvarDados();


    document
        .getElementById(
            "formMensalidade"
        )
        .reset();


    fecharModal(
        "modalMensalidade"
    );


    atualizarTudo();

}


function excluirMensalidade(id) {

    if (
        !confirm(
            "Deseja excluir esta mensalidade?"
        )
    ) {

        return;

    }


    mensalidades =
        mensalidades.filter(
            item => item.id !== id
        );


    salvarDados();

    atualizarTudo();

}


function alternarPagamento(id) {

    const mensalidade =
        mensalidades.find(
            item => item.id === id
        );


    if (!mensalidade) {

        return;

    }


    mensalidade.paga =
        !mensalidade.paga;


    salvarDados();

    atualizarTudo();

}


function verificarStatusMensalidade(item) {

    if (item.paga) {

        return "paga";

    }


    const hoje =
        new Date();


    const diaAtual =
        hoje.getDate();


    if (diaAtual > item.dia) {

        return "atrasada";

    }


    return "pendente";

}


function renderizarMensalidades() {

    const lista =
        document.getElementById(
            "listaMensalidades"
        );


    if (mensalidades.length === 0) {

        lista.innerHTML =
            `<p class="empty">
                Nenhuma mensalidade cadastrada.
            </p>`;


        atualizarResumoMensalidades();

        return;

    }


    const dados =
        [...mensalidades]
            .sort(
                (a, b) =>
                    a.dia - b.dia
            );


    lista.innerHTML =
        dados.map(item => {

            const status =
                verificarStatusMensalidade(
                    item
                );


            let textoStatus =
                "Pendente";


            if (status === "paga") {

                textoStatus =
                    "Paga";

            }


            if (status === "atrasada") {

                textoStatus =
                    "Atrasada";

            }


            return `

                <div class="monthly-item">

                    <div class="monthly-left">

                        <div class="monthly-icon">
                            📅
                        </div>


                        <div class="monthly-info">

                            <strong>
                                ${escapeHTML(
                                    item.nome
                                )}
                            </strong>

                            <small>
                                ${escapeHTML(
                                    item.categoria
                                )}
                                • Vencimento dia
                                ${item.dia}
                            </small>

                        </div>

                    </div>


                    <div class="monthly-right">

                        <strong>
                            ${formatarMoeda(
                                item.valor
                            )}
                        </strong>


                        <span class="status ${status}">
                            ${textoStatus}
                        </span>


                        <button
                            class="pay-btn"
                            onclick="alternarPagamento(${item.id})"
                        >

                            ${
                                item.paga
                                    ? "Desmarcar"
                                    : "Pagar"
                            }

                        </button>


                        <button
                            class="delete-btn"
                            onclick="excluirMensalidade(${item.id})"
                        >
                            Excluir
                        </button>

                    </div>

                </div>

            `;

        }).join("");


    atualizarResumoMensalidades();

}


function atualizarResumoMensalidades() {

    const total =
        mensalidades.reduce(
            (soma, item) =>
                soma + item.valor,
            0
        );


    const pagas =
        mensalidades
            .filter(
                item => item.paga
            )
            .reduce(
                (soma, item) =>
                    soma + item.valor,
                0
            );


    const pendentes =
        mensalidades
            .filter(
                item => !item.paga
            )
            .reduce(
                (soma, item) =>
                    soma + item.valor,
                0
            );


    const atrasadas =
        mensalidades.filter(
            item =>
                verificarStatusMensalidade(
                    item
                ) === "atrasada"
        ).length;


    document.getElementById(
        "mensalTotal"
    ).textContent =
        formatarMoeda(total);


    document.getElementById(
        "mensalPagas"
    ).textContent =
        formatarMoeda(pagas);


    document.getElementById(
        "mensalPendentes"
    ).textContent =
        formatarMoeda(pendentes);


    document.getElementById(
        "mensalAtrasadas"
    ).textContent =
        atrasadas;


    document.getElementById(
        "totalMensalidades"
    ).textContent =
        formatarMoeda(total);

}


// ========================================
// METAS
// ========================================

function salvarMeta(event) {

    event.preventDefault();


    if (
        !usuarioPremium() &&
        metas.length >= 3
    ) {

        alert(
            "O plano gratuito permite até 3 metas. Faça upgrade para o Premium para criar metas ilimitadas."
        );

        window.location.href =
            "planos.html";

        return;

    }


    const nome =
        document.getElementById(
            "nomeMeta"
        ).value.trim();

    


    const objetivo =
        Number(
            document.getElementById(
                "valorObjetivo"
            ).value
        );


    const guardado =
        Number(
            document.getElementById(
                "valorGuardado"
            ).value
        );


    if (
        !nome ||
        objetivo <= 0 ||
        guardado < 0
    ) {

        alert(
            "Preencha os dados corretamente."
        );

        return;

    }


    metas.push({

        id: Date.now(),

        nome,

        objetivo,

        guardado

    });


    salvarDados();


    document
        .getElementById(
            "formMeta"
        )
        .reset();


    fecharModal(
        "modalMeta"
    );


    atualizarTudo();

}


function excluirMeta(id) {

    if (
        !confirm(
            "Deseja excluir esta meta?"
        )
    ) {

        return;

    }


    metas =
        metas.filter(
            item => item.id !== id
        );


    salvarDados();

    atualizarTudo();

}


function renderizarMetas() {

    const lista =
        document.getElementById(
            "listaMetas"
        );


    if (metas.length === 0) {

        lista.innerHTML =
            `<div class="panel">
                <p class="empty">
                    Nenhuma meta criada ainda.
                </p>
            </div>`;

        return;

    }


    lista.innerHTML =
        metas.map(meta => {

            let percentual =
                (
                    meta.guardado /
                    meta.objetivo
                ) * 100;


            percentual =
                Math.min(
                    100,
                    Math.max(
                        0,
                        percentual
                    )
                );


            return `

                <div class="goal">

                    <div class="goal-header">

                        <h3>
                            🎯
                            ${escapeHTML(
                                meta.nome
                            )}
                        </h3>


                        <button
                            onclick="excluirMeta(${meta.id})"
                        >
                            Excluir
                        </button>

                    </div>


                    <div class="goal-values">

                        <span>

                            Guardado:

                            <strong>
                                ${formatarMoeda(
                                    meta.guardado
                                )}
                            </strong>

                        </span>


                        <span>

                            Meta:

                            <strong>
                                ${formatarMoeda(
                                    meta.objetivo
                                )}
                            </strong>

                        </span>

                    </div>


                    <div class="progress">

                        <div
                            class="progress-bar"
                            style="width: ${percentual}%"
                        ></div>

                    </div>


                    <p class="goal-percent">

                        ${percentual.toFixed(0)}%
                        concluído

                    </p>

                </div>

            `;

        }).join("");

}


// ========================================
// DASHBOARD
// ========================================

function atualizarDashboard() {

    const entradas =
        transacoes
            .filter(
                item =>
                    item.tipo === "entrada"
            )
            .reduce(
                (soma, item) =>
                    soma + item.valor,
                0
            );


    const despesas =
        transacoes
            .filter(
                item =>
                    item.tipo === "despesa"
            )
            .reduce(
                (soma, item) =>
                    soma + item.valor,
                0
            );


    const saldo =
        entradas - despesas;


    document.getElementById(
        "saldo"
    ).textContent =
        formatarMoeda(saldo);


    document.getElementById(
        "entradas"
    ).textContent =
        formatarMoeda(entradas);


    document.getElementById(
        "despesas"
    ).textContent =
        formatarMoeda(despesas);


    criarGraficos();

}


// ========================================
// GRÁFICOS
// ========================================

function criarGraficos() {

    const ctxFinanceiro =
        document.getElementById(
            "graficoFinanceiro"
        );


    const ctxCategorias =
        document.getElementById(
            "graficoCategorias"
        );


    if (
        !ctxFinanceiro ||
        !ctxCategorias
    ) {

        return;

    }


    if (graficoFinanceiro) {

        graficoFinanceiro.destroy();

    }


    if (graficoCategorias) {

        graficoCategorias.destroy();

    }


    const entradas =
        transacoes
            .filter(
                item =>
                    item.tipo === "entrada"
            )
            .reduce(
                (soma, item) =>
                    soma + item.valor,
                0
            );


    const despesas =
        transacoes
            .filter(
                item =>
                    item.tipo === "despesa"
            )
            .reduce(
                (soma, item) =>
                    soma + item.valor,
                0
            );


    graficoFinanceiro =
        new Chart(
            ctxFinanceiro,
            {

                type: "bar",

                data: {

                    labels: [
                        "Entradas",
                        "Despesas"
                    ],

                    datasets: [{

                        label: "Valor",

                        data: [
                            entradas,
                            despesas
                        ]

                    }]

                },

                options: {

                    responsive: true,

                    plugins: {

                        legend: {
                            display: false
                        }

                    }

                }

            }
        );


    const categorias = {};


    transacoes
        .filter(
            item =>
                item.tipo === "despesa"
        )
        .forEach(item => {

            if (
                !categorias[
                    item.categoria
                ]
            ) {

                categorias[
                    item.categoria
                ] = 0;

            }


            categorias[
                item.categoria
            ] += item.valor;

        });


    graficoCategorias =
        new Chart(
            ctxCategorias,
            {

                type: "doughnut",

                data: {

                    labels:
                        Object.keys(
                            categorias
                        ),

                    datasets: [{

                        data:
                            Object.values(
                                categorias
                            )

                    }]

                },

                options: {

                    responsive: true

                }

            }
        );

}


// ========================================
// MODAIS
// ========================================

function abrirModalTransacao() {

    document
        .getElementById(
            "modalTransacao"
        )
        .classList.add("show");

}


function abrirModalMensalidade() {

    document
        .getElementById(
            "modalMensalidade"
        )
        .classList.add("show");

}


function abrirModalMeta() {

    // Plano grátis pode criar até 3 metas
    if (
        !usuarioPremium() &&
        metas.length >= 3
    ) {

        const confirmar =
            confirm(
                "Você atingiu o limite de 3 metas do plano gratuito.\n\nDeseja conhecer o plano Premium?"
            );

        if (confirmar) {

            window.location.href =
                "planos.html";

        }

        return;

    }


    document
        .getElementById(
            "modalMeta"
        )
        .classList.add("show");

}


function fecharModal(id) {

    document
        .getElementById(id)
        .classList.remove("show");

}


document.addEventListener(
    "click",
    event => {

        if (
            event.target.classList.contains(
                "modal"
            )
        ) {

            event.target.classList.remove(
                "show"
            );

        }

    }
);


// ========================================
// SALVAR DADOS DO USUÁRIO
// ========================================

function salvarDados() {

    localStorage.setItem(
        chaveTransacoes,
        JSON.stringify(
            transacoes
        )
    );


    localStorage.setItem(
        chaveMensalidades,
        JSON.stringify(
            mensalidades
        )
    );


    localStorage.setItem(
        chaveMetas,
        JSON.stringify(
            metas
        )
    );

}


// ========================================
// ATUALIZAÇÃO GERAL
// ========================================

function atualizarTudo() {

    atualizarDashboard();

    renderizarTransacoes();

    renderizarUltimasTransacoes();

    renderizarMensalidades();

    renderizarMetas();

    atualizarAssinatura();

}



// ========================================
// FORMATAÇÃO
// ========================================

function formatarMoeda(valor) {

    return new Intl.NumberFormat(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    ).format(valor);

}


function formatarData(data) {

    if (!data) {

        return "";

    }


    const partes =
        data.split("-");


    if (
        partes.length !== 3
    ) {

        return data;

    }


    return `
        ${partes[2]}/
        ${partes[1]}/
        ${partes[0]}
    `;

}


// ========================================
// SEGURANÇA BÁSICA
// ========================================

function escapeHTML(texto) {

    return String(texto)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ========================================
// LOGOUT
// ========================================

function sairDaConta() {

    const confirmar =
        confirm(
            "Deseja realmente sair da sua conta?"
        );

    if (!confirmar) {
        return;
    }

    localStorage.removeItem(
        "finanflow_usuario_logado"
    );

    window.location.href =
        "login.html";
}


// ========================================
// ASSINATURA
// ========================================

function atualizarAssinatura() {

    if (!usuarioLogado) {
        return;
    }


    const assinatura =
        JSON.parse(
            localStorage.getItem(
                `finanflow_assinatura_${usuarioId}`
            )
        );


    const planoElemento =
        document.getElementById(
            "planoAtual"
        );


    const valorElemento =
        document.getElementById(
            "valorPlano"
        );


    const inicioElemento =
        document.getElementById(
            "inicioPlano"
        );


    const statusElemento =
        document.getElementById(
            "statusAssinatura"
        );


    if (!assinatura) {

        planoElemento.textContent =
            "Sem plano";


        valorElemento.textContent =
            "R$ 0,00";


        inicioElemento.textContent =
            "--";


        statusElemento.textContent =
            "Não assinante";


        statusElemento.className =
            "subscription-status inactive";


        return;

    }


    if (
        assinatura.plano ===
        "premium"
    ) {

        planoElemento.textContent =
            "Premium";


        valorElemento.textContent =
            "R$ 19,90/mês";

    } else {

        planoElemento.textContent =
            "Grátis";


        valorElemento.textContent =
            "R$ 0,00/mês";

    }


    inicioElemento.textContent =
        formatarDataCompleta(
            assinatura.dataInicio
        );


    statusElemento.textContent =
        assinatura.status === "ativa"
            ? "Ativo"
            : "Inativo";


    statusElemento.className =
        assinatura.status === "ativa"
            ? "subscription-status"
            : "subscription-status inactive";

}


function formatarDataCompleta(data) {

    if (!data) {
        return "--";
    }


    return new Date(
        data
    ).toLocaleDateString(
        "pt-BR"
    );

}


function abrirPlanos() {

    window.location.href =
        "planos.html";

}

// ========================================
// CONTROLE DO PLANO
// ========================================

function obterAssinatura() {

    if (!usuarioLogado) {
        return null;
    }

    return JSON.parse(
        localStorage.getItem(
            `finanflow_assinatura_${usuarioId}`
        )
    ) || null;

}


function usuarioPremium() {

    const assinatura =
        obterAssinatura();

    return (
        assinatura &&
        assinatura.plano === "premium" &&
        assinatura.status === "ativa"
    );

}


function verificarPremium() {

    if (!usuarioPremium()) {

        const confirmar =
            confirm(
                "Este recurso está disponível no plano Premium.\n\nDeseja conhecer os planos?"
            );

        if (confirmar) {

            window.location.href =
                "planos.html";

        }

        return false;

    }

    return true;

}