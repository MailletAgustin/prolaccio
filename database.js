const { Int32 } = require('mongodb');
const mongoose = require('mongoose');
const uri = 'mongodb+srv://admin:nuevaass@cluster0.0qhmg.mongodb.net/' +
    'prolaccio-panel?retryWrites=true&w=majority';
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
}).catch(err => console.log(err));
mongoose.connection.once('open', () => {
    console.log('Conexion a la base de datos creada con exito');
});

var UsuarioSchema = mongoose.Schema({
    name: String,
    email: String,
    ganancias: String,
    pass: String,
    rolname: String,
    refcode: String,
    refVisitas: String,
    porcentaje: String,
    parentrefcode: String,
    ventatotal: String,
    session: String,
    lastLogin: String,
    telefono: String,
    fechaIngresoNegocio: { type: Date, default: Date.now }
});

var PedidoSchema = mongoose.Schema({
    id: String,
    products: String,
    refCode: String,
    nombreCompleto: String,
    total: String,
    ganancia: String,
    direccion: String,
    telefono: String,
    email: String,
    status: Boolean,
    fechaHora: { type: Date, default: Date.now }
});

var RetiroSchema = mongoose.Schema({
    montototal: String,
    identificador: String,
    emailaretirar: String
});

exports.Retiro = mongoose.model("Retiro", RetiroSchema);
exports.Pedido = mongoose.model("Pedido", PedidoSchema);
exports.Usuario = mongoose.model("Usuario", UsuarioSchema);