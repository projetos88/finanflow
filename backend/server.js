const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());

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

        return res.status(200).json({

            sucesso: true,

            mensagem: "Login realizado com sucesso!",

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

app.post("/api/transacoes", async (req, res) => {

    try {

        const {
            usuarioId,
            tipo,
            descricao,
            valor,
            categoria,
            data
        } = req.body;


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

app.get("/api/transacoes", (req, res) => {

    try {

        const usuarioId = Number(req.query.usuarioId);

        if (!usuarioId) {

            return res.status(400).json({

                sucesso: false,

                mensagem:
                    "Usuário não informado."

            });

        }

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

app.delete("/api/transacoes/:id", (req, res) => {


    console.log(
    "DELETE RECEBIDO:",
    req.params.id,
    "USUARIO:",
    req.query.usuarioId
);

    try {

        const id =
            Number(req.params.id);

        const usuarioId =
            Number(req.query.usuarioId);


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

