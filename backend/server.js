const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500"
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, "..")));


// ========================================
// BANCO DE DADOS
// ========================================

const db = new Database("finanflow.db");


// Cria a tabela de usuários
db.prepare(`
    CREATE TABLE IF NOT EXISTS usuarios (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        nome TEXT NOT NULL,

        email TEXT NOT NULL UNIQUE,

        senha_hash TEXT NOT NULL,

        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP

    )
`).run();


console.log("Banco de dados conectado.");





// ========================================
// TABELA DE TRANSAÇÕES
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS transacoes (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        usuario_id INTEGER NOT NULL,

        tipo TEXT NOT NULL,

        descricao TEXT NOT NULL,

        valor REAL NOT NULL,

        categoria TEXT NOT NULL,

        data TEXT NOT NULL,

        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (usuario_id)
            REFERENCES usuarios(id)
    )
`).run();

console.log("Tabela de transações pronta.");

// ========================================
// TABELA DE METAS
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS metas (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        usuario_id INTEGER NOT NULL,

        nome TEXT NOT NULL,

        objetivo REAL NOT NULL,

        guardado REAL NOT NULL DEFAULT 0,

        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (usuario_id)
            REFERENCES usuarios(id)

    )
`).run();

console.log("Tabela de metas pronta.");


// ========================================
// TABELA DE MENSALIDADES
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS mensalidades (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        usuario_id INTEGER NOT NULL,

        nome TEXT NOT NULL,

        valor REAL NOT NULL,

        dia INTEGER NOT NULL,

        categoria TEXT NOT NULL,

        paga INTEGER NOT NULL DEFAULT 0,

        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (usuario_id)
            REFERENCES usuarios(id)

    )
`).run();

console.log("Tabela de mensalidades pronta.");

// ========================================
// TABELA DE SESSÕES
// ========================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS sessoes (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        usuario_id INTEGER NOT NULL,

        token_hash TEXT NOT NULL UNIQUE,

        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

        expira_em DATETIME NOT NULL,

        FOREIGN KEY (usuario_id)
            REFERENCES usuarios(id)
    )
`).run();

console.log("Tabela de sessões pronta.");


// ========================================
// AUTENTICAÇÃO
// ========================================

function gerarToken() {
    return crypto.randomBytes(32).toString("hex");
}


function gerarHashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


function obterTokenDoCookie(req) {

    const cookies = req.headers.cookie;

    if (!cookies) {
        return null;
    }

    const partes = cookies.split(";");

    for (const parte of partes) {

        const [nome, ...resto] =
            parte.trim().split("=");

        if (nome === "finanflow_session") {

            return decodeURIComponent(
                resto.join("=")
            );

        }

    }

    return null;
}


function autenticar(req, res, next) {

    try {

        const token =
            obterTokenDoCookie(req);

        if (!token) {

            return res.status(401).json({

                sucesso: false,

                mensagem:
                    "Não autenticado."

            });

        }


        const tokenHash =
            gerarHashToken(token);


        const sessao =
            db.prepare(`
                SELECT
                    sessoes.usuario_id,
                    usuarios.nome,
                    usuarios.email
                FROM sessoes
                INNER JOIN usuarios
                    ON usuarios.id = sessoes.usuario_id
                WHERE sessoes.token_hash = ?
                AND datetime(sessoes.expira_em) > datetime('now')
            `).get(tokenHash);


        if (!sessao) {

            return res.status(401).json({

                sucesso: false,

                mensagem:
                    "Sessão inválida ou expirada."

            });

        }


        req.usuario = {

            id: sessao.usuario_id,

            nome: sessao.nome,

            email: sessao.email

        };


        next();

    } catch (erro) {

        console.error(
            "Erro na autenticação:",
            erro
        );

        return res.status(500).json({

            sucesso: false,

            mensagem:
                "Erro interno do servidor."

        });

    }

}

// ========================================
// CADASTRO DE USUÁRIO
// ========================================

app.post("/api/cadastro", async (req, res) => {

    try {

        const {
            nome,
            email,
            senha
        } = req.body;


        // Verifica campos obrigatórios

        if (
            !nome ||
            !email ||
            !senha
        ) {

            return res.status(400).json({

                sucesso: false,

                mensagem:
                    "Preencha nome, email e senha."

            });

        }


        // Normaliza o email

        const emailNormalizado =
            email.trim().toLowerCase();


        // Verifica tamanho mínimo

        if (senha.length < 8) {

            return res.status(400).json({

                sucesso: false,

                mensagem:
                    "A senha deve ter pelo menos 8 caracteres."

            });

        }


        // Verifica se o email já existe

        const usuarioExistente =
            db.prepare(`
                SELECT id
                FROM usuarios
                WHERE email = ?
            `).get(emailNormalizado);


        if (usuarioExistente) {

            return res.status(409).json({

                sucesso: false,

                mensagem:
                    "Este email já está cadastrado."

            });

        }


        // Cria o hash da senha

        const senhaHash =
            await bcrypt.hash(
                senha,
                12
            );


        // Salva o usuário

        const resultado =
            db.prepare(`
                INSERT INTO usuarios
                (
                    nome,
                    email,
                    senha_hash
                )
                VALUES (?, ?, ?)
            `).run(

                nome.trim(),

                emailNormalizado,

                senhaHash

            );


        return res.status(201).json({

            sucesso: true,

            mensagem:
                "Cadastro realizado com sucesso!",

            usuarioId:
                resultado.lastInsertRowid

        });


    } catch (erro) {

        console.error(
            "Erro no cadastro:",
            erro
        );


        return res.status(500).json({

            sucesso: false,

            mensagem:
                "Erro interno do servidor."

        });

    }

});


// ========================================
// LOGIN DE USUÁRIO
// ========================================

app.post("/api/login", async (req, res) => {

    try {

        const { email, senha } = req.body;

        if (!email || !senha) {

            return res.status(400).json({
                sucesso: false,
                mensagem: "Preencha email e senha."
            });

        }

        const emailNormalizado =
            email.trim().toLowerCase();

        const usuario = db.prepare(`
            SELECT
                id,
                nome,
                email,
                senha_hash
            FROM usuarios
            WHERE email = ?
        `).get(emailNormalizado);

        if (!usuario) {

            return res.status(401).json({
                sucesso: false,
                mensagem: "E-mail ou senha incorretos."
            });

        }

        const senhaCorreta =
            await bcrypt.compare(
                senha,
                usuario.senha_hash
            );

        if (!senhaCorreta) {

            return res.status(401).json({
                sucesso: false,
                mensagem: "E-mail ou senha incorretos."
            });

        }

     // ========================================
// CRIA SESSÃO
// ========================================

const token = gerarToken();

const tokenHash = gerarHashToken(token);


// Sessão válida por 7 dias
const expiraEm = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
).toISOString();


db.prepare(`
    INSERT INTO sessoes
    (
        usuario_id,
        token_hash,
        expira_em
    )
    VALUES (?, ?, ?)
`).run(

    usuario.id,

    tokenHash,

    expiraEm

);


// Cookie seguro
const cookieSeguro =
    process.env.NODE_ENV === "production"
        ? "Secure; "
        : "";


res.setHeader(
    "Set-Cookie",
    `finanflow_session=${encodeURIComponent(token)}; HttpOnly; ${cookieSeguro}SameSite=Lax; Path=/; Max-Age=604800`
);


return res.status(200).json({

    sucesso: true,

    mensagem:
        "Login realizado com sucesso!",

    usuario: {

        id: usuario.id,

        nome: usuario.nome,

        email: usuario.email

    }

});

    } catch (erro) {

        console.error("Erro no login:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno do servidor."
        });

    }

});
// ========================================
// CRIAR TRANSAÇÃO
// ========================================

app.post("/api/transacoes", autenticar, async (req, res) => {

    try {

        const {
    tipo,
    descricao,
    valor,
    categoria,
    data
} = req.body;

const usuarioId = req.usuario.id;


        // ========================================
        // VALIDAÇÃO
        // ========================================

        if (
            !usuarioId ||
            !tipo ||
            !descricao ||
            !valor ||
            !categoria ||
            !data
        ) {

            return res.status(400).json({

                sucesso: false,

                mensagem:
                    "Preencha todos os dados da transação."

            });

        }


        // ========================================
        // VERIFICA USUÁRIO
        // ========================================

        const usuario = db.prepare(`
            SELECT id
            FROM usuarios
            WHERE id = ?
        `).get(usuarioId);


        if (!usuario) {

            return res.status(404).json({

                sucesso: false,

                mensagem:
                    "Usuário não encontrado."

            });

        }


        // ========================================
        // VALIDA TIPO
        // ========================================

        if (
            tipo !== "entrada" &&
            tipo !== "despesa"
        ) {

            return res.status(400).json({

                sucesso: false,

                mensagem:
                    "Tipo de transação inválido."

            });

        }


        // ========================================
        // SALVA TRANSAÇÃO
        // ========================================

        const resultado = db.prepare(`
            INSERT INTO transacoes
            (
                usuario_id,
                tipo,
                descricao,
                valor,
                categoria,
                data
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(

            usuarioId,

            tipo,

            descricao.trim(),

            Number(valor),

            categoria,

            data

        );


        // ========================================
        // RESPOSTA
        // ========================================

        return res.status(201).json({

            sucesso: true,

            mensagem:
                "Transação salva com sucesso!",

            transacaoId:
                resultado.lastInsertRowid

        });


    } catch (erro) {

        console.error(
            "Erro ao salvar transação:",
            erro
        );


        return res.status(500).json({

            sucesso: false,

            mensagem:
                "Erro interno do servidor."

        });

    }

});

// ========================================
// LISTAR TRANSAÇÕES DO USUÁRIO
// ========================================

app.get("/api/transacoes", autenticar, (req, res) => {

    try {

        const usuarioId = req.usuario.id;

        

        const transacoes = db.prepare(`
            SELECT
                id,
                tipo,
                descricao,
                valor,
                categoria,
                data
            FROM transacoes
            WHERE usuario_id = ?
            ORDER BY data DESC, id DESC
        `).all(usuarioId);


        return res.status(200).json({

            sucesso: true,

            transacoes

        });


    } catch (erro) {

        console.error(
            "Erro ao buscar transações:",
            erro
        );


        return res.status(500).json({

            sucesso: false,

            mensagem:
                "Erro interno do servidor."

        });
 
    }

});


// ========================================
// EXCLUIR TRANSAÇÃO
// ========================================

app.delete("/api/transacoes/:id", autenticar, (req, res) => {


    console.log(
    "DELETE RECEBIDO:",
    req.params.id,
    "USUARIO:",
    req.usuario.id
);

    try {

        const id =
            Number(req.params.id);

       const usuarioId = req.usuario.id;


        if (!id || !usuarioId) {

            return res.status(400).json({

                sucesso: false,

                mensagem:
                    "Dados inválidos."

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


        if (resultado.changes === 0) {

            return res.status(404).json({

                sucesso: false,

                mensagem:
                    "Transação não encontrada."

            });

        }


        return res.status(200).json({

            sucesso: true,

            mensagem:
                "Transação excluída com sucesso."

        });


    } catch (erro) {

        console.error(
            "Erro ao excluir transação:",
            erro
        );


        return res.status(500).json({

            sucesso: false,

            mensagem:
                "Erro interno do servidor."

        });

    }

});
// ========================================
// ROTAS DE METAS
// ========================================

// CARREGAR METAS DO USUÁRIO
app.get("/api/metas", autenticar, (req, res) => {

    try {

        const usuarioId = req.usuario.id;

        const metas = db.prepare(`
            SELECT
                id,
                nome,
                objetivo,
                guardado
            FROM metas
            WHERE usuario_id = ?
            ORDER BY id DESC
        `).all(usuarioId);

        return res.status(200).json({
            sucesso: true,
            metas
        });

    } catch (erro) {

        console.error("Erro ao carregar metas:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar metas."
        });

    }

});


// CRIAR META
app.post("/api/metas", autenticar, (req, res) => {

    try {

        const usuarioId = req.usuario.id;

        const {
            nome,
            objetivo,
            guardado
        } = req.body;

        if (
            !nome ||
            Number(objetivo) <= 0 ||
            Number(guardado) < 0
        ) {

            return res.status(400).json({
                sucesso: false,
                mensagem: "Preencha os dados corretamente."
            });

        }

        const resultado = db.prepare(`
            INSERT INTO metas (
                usuario_id,
                nome,
                objetivo,
                guardado
            )
            VALUES (?, ?, ?, ?)
        `).run(
            usuarioId,
            nome.trim(),
            Number(objetivo),
            Number(guardado)
        );

        return res.status(201).json({
            sucesso: true,
            meta: {
                id: resultado.lastInsertRowid,
                nome: nome.trim(),
                objetivo: Number(objetivo),
                guardado: Number(guardado)
            }
        });

    } catch (erro) {

        console.error("Erro ao criar meta:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao criar meta."
        });

    }

});


// EXCLUIR META
app.delete("/api/metas/:id", autenticar, (req, res) => {

    try {

        const usuarioId = req.usuario.id;
        const metaId = Number(req.params.id);

        const resultado = db.prepare(`
            DELETE FROM metas
            WHERE id = ?
            AND usuario_id = ?
        `).run(
            metaId,
            usuarioId
        );

        if (resultado.changes === 0) {

            return res.status(404).json({
                sucesso: false,
                mensagem: "Meta não encontrada."
            });

        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Meta excluída com sucesso."
        });

    } catch (erro) {

        console.error("Erro ao excluir meta:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao excluir meta."
        });

    }

});

// ========================================
// CRIAR MENSALIDADE
// ========================================

app.post("/api/mensalidades", autenticar, (req, res) => {

    try {

        const usuarioId = req.usuario.id;

        const {
            nome,
            valor,
            dia,
            categoria
        } = req.body;

        if (
            !nome ||
            Number(valor) <= 0 ||
            Number(dia) < 1 ||
            Number(dia) > 31 ||
            !categoria
        ) {

            return res.status(400).json({
                sucesso: false,
                mensagem: "Preencha os dados corretamente."
            });

        }

        const resultado = db.prepare(`
            INSERT INTO mensalidades (
                usuario_id,
                nome,
                valor,
                dia,
                categoria
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            usuarioId,
            nome.trim(),
            Number(valor),
            Number(dia),
            categoria.trim()
        );

        return res.status(201).json({
            sucesso: true,
            mensalidade: {
                id: resultado.lastInsertRowid,
                nome: nome.trim(),
                valor: Number(valor),
                dia: Number(dia),
                categoria: categoria.trim(),
                paga: 0
            }
        });

    } catch (erro) {

        console.error("Erro ao criar mensalidade:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao criar mensalidade."
        });

    }

});

// ========================================
// LISTAR MENSALIDADES
// ========================================

app.get("/api/mensalidades", autenticar, (req, res) => {

    try {

        const usuarioId = req.usuario.id;

        const mensalidades = db.prepare(`
            SELECT
                id,
                nome,
                valor,
                dia,
                categoria,
                paga
            FROM mensalidades
            WHERE usuario_id = ?
            ORDER BY dia ASC
        `).all(usuarioId);

        return res.status(200).json({
            sucesso: true,
            mensalidades
        });

    } catch (erro) {

        console.error("Erro ao carregar mensalidades:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao carregar mensalidades."
        });

    }

});

// ========================================
// EXCLUIR MENSALIDADE
// ========================================

app.delete("/api/mensalidades/:id", autenticar, (req, res) => {

    try {

        const usuarioId = req.usuario.id;
        const mensalidadeId = Number(req.params.id);

        const resultado = db.prepare(`
            DELETE FROM mensalidades
            WHERE id = ?
            AND usuario_id = ?
        `).run(
            mensalidadeId,
            usuarioId
        );

        if (resultado.changes === 0) {

            return res.status(404).json({
                sucesso: false,
                mensagem: "Mensalidade não encontrada."
            });

        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Mensalidade excluída com sucesso."
        });

    } catch (erro) {

        console.error("Erro ao excluir mensalidade:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao excluir mensalidade."
        });

    }

});

// ========================================
// ALTERAR STATUS DA MENSALIDADE
// ========================================

app.put("/api/mensalidades/:id/status", autenticar, (req, res) => {

    try {

        const usuarioId = req.usuario.id;
        const mensalidadeId = Number(req.params.id);
        const paga = Number(req.body.paga);

        if (paga !== 0 && paga !== 1) {

            return res.status(400).json({
                sucesso: false,
                mensagem: "Status inválido."
            });

        }

        const resultado = db.prepare(`
            UPDATE mensalidades
            SET paga = ?
            WHERE id = ?
            AND usuario_id = ?
        `).run(
            paga,
            mensalidadeId,
            usuarioId
        );

        if (resultado.changes === 0) {

            return res.status(404).json({
                sucesso: false,
                mensagem: "Mensalidade não encontrada."
            });

        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Status da mensalidade atualizado."
        });

    } catch (erro) {

        console.error("Erro ao alterar status da mensalidade:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao alterar status da mensalidade."
        });

    }

});

// ========================================
// VERIFICAR USUÁRIO LOGADO
// ========================================

app.get("/api/me", autenticar, (req, res) => {

    return res.status(200).json({

        sucesso: true,

        usuario: {

            id: req.usuario.id,

            nome: req.usuario.nome,

            email: req.usuario.email

        }

    });

});




// ========================================
// LOGOUT
// ========================================

app.post("/api/logout", (req, res) => {

    try {

        const token = obterTokenDoCookie(req);

        if (token) {

            const tokenHash = gerarHashToken(token);

            db.prepare(`
                DELETE FROM sessoes
                WHERE token_hash = ?
            `).run(tokenHash);

        }


        res.setHeader(
            "Set-Cookie",
            "finanflow_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
        );


        return res.status(200).json({

            sucesso: true,

            mensagem:
                "Logout realizado com sucesso."

        });

    } catch (erro) {

        console.error(
            "Erro no logout:",
            erro
        );

        return res.status(500).json({

            sucesso: false,

            mensagem:
                "Erro interno do servidor."

        });

    }

});

// ========================================
// ROTA PRINCIPAL
// ========================================

app.get("/", (req, res) => {

    res.json({

        sucesso: true,

        mensagem:
            "Backend do FinanFlow funcionando!"

    });

});


// ========================================
// SERVIDOR
// ========================================

app.listen(PORT, () => {

    console.log(
        `FinanFlow backend rodando em http://localhost:${PORT}`
    );

});

