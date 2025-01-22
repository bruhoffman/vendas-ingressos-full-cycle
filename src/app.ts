import express from 'express'

const app = express();

app.use(express.json())

app.get('/', (req, res) => {
    res.json({ message: "Hello, World!" })
});

app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    console.log(email, password);
    res.send();
});

app.post('/partners', (req, res) => {
    const { name, email, password, company_name } = req.body;
    console.log(name, email, password, company_name)
    res.send();
});

app.post('/customers', (req, res) => {
    const { name, email, password, address, telefone } = req.body
});

app.post('/partners/events', (req, res) => {
    const { name, description, date, location } = req.body
});

app.get('/partners/events', (req, res) => {

});

app.get('/partners/:eventId', (req, res) => {
    const { eventId } = req.params;
    console.log(eventId);
    res.send();
});

app.get('/events', (req, res) => {

});

app.get('/events/:eventId', (req, res) => {
    const { eventId } = req.params;
    console.log(eventId);
    res.send();
});

app.listen(3000, () => {
    console.log('Running in http:://localhost:3000')
});

