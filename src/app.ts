// Importação das bibliotecas necessárias
import express from 'express'; // Framework para criar o servidor HTTP
import * as mysql from 'mysql2/promise'; // Biblioteca para conectar e interagir com o MySQL
import bcrypt from 'bcrypt'; // Biblioteca para criptografar senhas
import jwt from "jsonwebtoken"; // Biblioteca para criar e verificar tokens JWT

// Função para criar uma conexão com o banco de dados MySQL
function createConnection() {
    return mysql.createConnection({
        host: 'localhost', // Endereço do banco de dados
        user: 'root', // Usuário do banco de dados
        password: 'root', // Senha do banco de dados
        database: 'tickets', // Nome do banco de dados
        port: 33060 // Porta do banco de dados
    });
}

// Cria uma instância do Express
const app = express();

// Middleware para permitir que o Express entenda requisições com corpo no formato JSON
app.use(express.json());

// Lista de rotas que não precisam de autenticação (rotas públicas)
const unprotectedRoutes = [
    { method: 'POST', path: '/auth/login' }, // Rota de login
    { method: 'POST', path: '/customers/register' }, // Rota de registro de clientes
    { method: 'POST', path: '/partners/register' }, // Rota de registro de parceiros
    { method: 'GET', path: '/events' } // Rota para listar eventos
];

// Middleware para verificar autenticação em rotas protegidas
app.use(async (req, res, next) => {
    // Verifica se a rota atual é uma rota pública
    const insUnprotectedRoute = unprotectedRoutes.some(route => route.method == req.method && req.path.startsWith(route.path));

    // Se for uma rota pública, passa para o próximo middleware
    if (insUnprotectedRoute) {
        return next();
    }

    // Extrai o token JWT do cabeçalho da requisição
    const token = req.headers['authorization']?.split(' ')[1];

    // Se não houver token, retorna um erro 401 (Não autorizado)
    if (!token) {
        res.status(401).json({ message: "No token provided" });
        return;
    }

    try {
        // Verifica o token JWT e extrai o payload (dados do usuário)
        const payload = jwt.verify(token, '123456') as { id: number, email: string };
        // Conecta ao banco de dados
        const connection = await createConnection();
        // Busca o usuário no banco de dados pelo ID contido no token
        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM users WHERE id = ?', [payload.id]
        );
        const user = rows.length ? rows[0] : null;

        // Se o usuário não for encontrado, retorna um erro 401
        if (!user) {
            res.status(401).json({ message: 'Failed to authenticate token' })
            return;
        }

        // Adiciona o usuário à requisição para uso posterior
        req.user = user as { id: number; email: string };
        next(); // Passa para o próximo middleware ou rota
    } catch (error) {
        // Se houver erro na verificação do token, retorna um erro 401
        res.status(401).json({ message: 'Failed to authenticate token' })
    }

})

// Rota raiz para teste
app.get('/', (req, res) => {
    res.json({ message: "Hello, World!" })
});

// Rota de login
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body; // Extrai e-mail e senha do corpo da requisição
    const connection = await createConnection(); // Conecta ao banco de dados

    try {
        // Busca o usuário no banco de dados pelo email
        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM users WHERE email = ?', [email]
        );

        const user = rows.length ? rows[0] : null;

        // Verifica se o usuário existe e se a senha está correta
        if (user && bcrypt.compareSync(password, user.password)) {
            // Gera um token JWT válido por 1 hora
            const token = jwt.sign({ id: user.id, email: user.email }, "123456", { expiresIn: "1h" });
            res.json({ token })
        } else {
            res.status(401).json({ message: "Invalid credentials" })
        }
        res.send();
    } finally {
        await connection.end(); // Fecha a conexão com o banco de dados
    }

});

// Rota de registro de parceiros
app.post('/partners/register', async (req, res) => {
    const { name, email, password, company_name } = req.body;
    const connection = await createConnection();

    try {
        const createdAt = new Date(); // Data de criação
        const hashedPassword = bcrypt.hashSync(password, 10); // Criptografa a senha

        // Insere o usuário no banco de dados
        const [userResult] = await connection.execute<mysql.ResultSetHeader>('INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, createdAt]
        );
        /*
            * O ponto de interrogação(?) é um placeholder que será substituído pelos valores reais que você deseja inserir no banco de dados.
            * Ao usar placeholders, você evita a concatenação direta de valores na string SQL, o que pode levar a vulnerabilidades de SQL Injection.O SQL Injection é um ataque onde um invasor pode manipular a consulta SQL para executar comandos maliciosos.
            * Quando você usa ?, a biblioteca de banco de dados(no caso, o mysql2 ou mysql) automaticamente escapa os valores fornecidos, garantindo que eles sejam tratados como dados e não como parte do código SQL. 
            * Neste exemplo, os ? serão substituídos pelos valores contidos no array [name, email, hashedPassword, createdAt].
            * A ordem dos valores no array corresponde à ordem dos placeholders na string SQL.
        */
        const userId = userResult.insertId; // ID do usuário inserido

        // Insere o parceiro no banco de dados
        const [partnerResult] = await connection.execute<mysql.ResultSetHeader>('INSERT INTO partners (user_id, company_name, created_at) VALUES (?, ?, ?)',
            [userId, company_name, createdAt]
        );
        res.status(201).json({ id: partnerResult.insertId, name, user_id: userId, company_name, created_at: createdAt })
    } finally {
        await connection.end();
    }
});

// Rota de registro de clientes
app.post('/customers/register', async (req, res) => {
    const { name, email, password, address, phone } = req.body; // Extrai dados do corpo da requisição
    const connection = await createConnection(); // Conecta ao banco de dados

    try {
        const createdAt = new Date(); // Data de criação
        const hashedPassword = bcrypt.hashSync(password, 10); // Criptografa a senha

        // Insere o usuário no banco de dados
        const [userResult] = await connection.execute<mysql.ResultSetHeader>('INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, createdAt]
        );
        const userId = userResult.insertId;

        // Insere o cliente no banco de dados
        const [customerResult] = await connection.execute<mysql.ResultSetHeader>('INSERT INTO customers (user_id, address, phone, created_at) VALUES (?, ?, ?, ?)',
            [userId, address, phone, createdAt]
        );
        res.status(201).json({ id: customerResult.insertId, name, user_id: userId, address, phone, created_at: createdAt })
    } finally {
        await connection.end();
    }
});

// Rota para criar eventos (apenas para parceiros autenticados)
app.post('/partners/events', async (req, res) => {
    const { name, description, date, location } = req.body;
    const userId = req.user!.id;

    const connection = await createConnection();

    try {
        // Verifica se o usuário é um parceiro
        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM partners WHERE user_id = ?', [userId]
        );

        const partner = rows.length ? rows[0] : null;

        if (!partner) {
            res.status(403).json({ message: 'Not authorized' });
            return;
        }

        const eventDate = new Date(date); // Converte a data do evento
        const createdAt = new Date(); // Data de criação

        // Insere o evento no banco de dados
        const [eventResult] = await connection.execute<mysql.ResultSetHeader>('INSERT INTO events (name, description, date, location, created_at, partners_id) VALUES (?, ?, ?, ?, ?, ?)',
            [name, description, eventDate, location, createdAt, partner.id]
        );

        res.status(201).json({ id: eventResult.insertId, name, description, date: eventDate, location, created_at: createdAt, partner_id: partner.id })
    } finally {
        await connection.end();
    }
});

// Rota para listar eventos de um parceiro (apenas para parceiros autenticados)
app.get('/partners/events', async (req, res) => {
    const userId = req.user!.id;

    const connection = await createConnection();

    try {
        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM partners WHERE user_id = ?', [userId]
        );

        const partner = rows.length ? rows[0] : null;

        if (!partner) {
            res.status(403).json({ message: 'Not authorized' });
            return;
        };

        const [eventsRows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM events WHERE partners_id = ?', [partner.id]
        );

        res.json(eventsRows)

    } finally {
        await connection.end();
    }
});

// Rota para obter detalhes de um evento específico (por ID)
app.get('/partners/events/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user!.id;
    const connection = await createConnection();

    try {
        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM partners WHERE user_id = ?', [userId]
        );

        const partner = rows.length ? rows[0] : null;

        if (!partner) {
            res.status(403).json({ message: 'Not authorized' });
            return;
        };

        const [eventsRows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM events WHERE partners_id = ? and id = ?', [partner.id, eventId]
        );

        const event = eventsRows.length ? eventsRows[0] : null;

        if (!event) {
            res.status(404).json({ message: "Event not found" });
        };

        res.json(event)

    } finally {
        await connection.end();
    }
});

// Rota para listar todos os eventos (pública)
app.get('/events', async (req, res) => {
    const connection = await createConnection();

    try {
        const [eventsRows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM events'
        );

        res.json(eventsRows)

    } finally {
        await connection.end();
    }
});

// Rota para obter detalhes de um evento específico (por ID, pública)
app.get('/events/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const connection = await createConnection();

    try {
        const [eventsRows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM events WHERE id = ?', [eventId]
        );

        const event = eventsRows.length ? eventsRows[0] : null;

        if (!event) {
            res.status(404).json({ message: "Event not found" });
            return
        };

        res.json(eventsRows)

    } finally {
        await connection.end();
    }
});

// Inicia o servidor na porta 3000
app.listen(3000, async () => {
    const connection = await createConnection(); // Conecta ao banco de dados

    // Comandos para resetar o banco de dados toda vez que o servidor é reiniciado
    await connection.execute("SET FOREIGN_KEY_CHECKS = 0"); // Desabilita verificações de chave estrangeira
    await connection.execute("TRUNCATE TABLE events"); // Limpa a tabela de eventos
    await connection.execute("TRUNCATE TABLE customers"); // Limpa a tabela de clientes
    await connection.execute("TRUNCATE TABLE partners"); // Limpa a tabela de parceiros
    await connection.execute("TRUNCATE TABLE users"); // Limpa a tabela de usuários
    await connection.execute("SET FOREIGN_KEY_CHECKS = 1"); // Reabilita verificações de chave estrangeira

    console.log('Running in http://localhost:3000'); // Log de que o servidor está rodando
});