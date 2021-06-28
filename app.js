// Para poner en producción, descomentar las KEY, CERT y CA. También, cambiar el REQUIRE de IO a HTTPS.

//Require implementación
const express = require("express"); // Express
const app = express();
const fs = require("fs");
const http = require("http").createServer(app);
const https = require("https").createServer({
        // key: fs.readFileSync('/etc/letsencrypt/live/prolacciocosmetics.com/privkey.pem'),
        // cert: fs.readFileSync('/etc/letsencrypt/live/prolacciocosmetics.com/cert.pem'),
        // ca: fs.readFileSync('/etc/letsencrypt/live/prolacciocosmetics.com/chain.pem'),
        rejectUnauthorized: false,
    },
    app
);
const io = require("socket.io")(http); // Sockets.io (Usado en productos y Login / register)
const validator = require("email-validator"); // Validador de datos
const cookieParser = require("cookie-parser"); // Traspaso de cookies
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const multer = require("multer");
products = require("./data");
const mercadopago = require("mercadopago"); // Api de Mercadopago
const request = require("request");
const nodemailer = require("nodemailer"); // Emails
const porcentajePorReferido = 5; // Porcentaje que va al parentRefCode de cada venta
messageJSON = require("./dataMessage");

const PORT = 443;
https.listen(PORT, function() {
    console.log("My HTTPS server listening on port " + PORT + "...");
});

http.listen(80, function() {
    console.log("HTTP Funcionando");
});

// Configuración Transporter EMAIL SENDER
const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com.ar",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: "ventas@prolacciocosmetics.com",
        pass: "#Prol4cc10",
    },
});

// Agrega credenciales de MercadoPago
mercadopago.configure({
    access_token: "APP_USR-1058112956337318-112011-55225d95c6f168423cd169bc8861df9d-541148667",
});

// Configuracion multer
var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "public/img/slider");
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + "-" + req.body.posicion + ".jpg");
    },
});
var upload = multer({ storage: storage });

//Require propios
const db = require("./database");
const { stringify } = require("querystring");
const { signedCookie } = require("cookie-parser");
const CrearSesion = require("./generar-sesion-id").CrearSesion;

app.set("view engine", "ejs");
app.use(cookieParser());
app.use(express.static("public"));
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);
app.use(bodyParser.json());
app.use(fileUpload());

//Funciones que vienen del CLIENTE ECOMMERCE
io.on("connection", (socket) => {
    socket.on("intento-ingresar", (datos) => {
        if (validator.validate(datos.email)) {
            db.Usuario.findOne({ email: datos.email }, (err, usr) => {
                if (usr == null) {
                    console.log("Usuario no existe");
                }
                if (!(usr == null) &&
                    usr.email == datos.email &&
                    usr.pass == datos.pass
                ) {
                    usr.session = CrearSesion();
                    var now = new Date();
                    var day = ("0" + now.getDate()).slice(-2);
                    var month = ("0" + (now.getMonth() + 1)).slice(-2);
                    var today = now.getFullYear() + "-" + month + "-" + day;

                    usr.lastLogin = today;
                    usr.save(); //Código de sesion creada y guardada en base de datos
                    socket.emit("cookie ID", usr.session);
                } else {
                    socket.emit(
                        "error mensaje",
                        "Lo sentimos. El email " +
                        datos.email +
                        " no se encuentra en nuestra base de datos o su contraseña no coincide con la que has ingresado."
                    );
                }
            });
        } else {
            socket.emit(
                "error mensaje",
                "Al parecer, el email ingresado no es válido. ¿Seguro que está bien?"
            );
        }
    });
    socket.on("intento-registrar", (datos) => {
        console.log(datos.names.length);
        console.log(datos.email);
        console.log(datos.pass1);
        console.log(datos.pass2);
        console.log(datos.refco);

        if (datos.names.length == 0) {
            socket.emit(
                "error mensaje",
                "Debes introducir tu nombre para registrarte"
            );
        } else {
            if (!validator.validate(datos.email)) {
                socket.emit(
                    "error mensaje",
                    "Debes introducir un correo electrónico válido"
                );
            } else {
                if (datos.pass1.length < 8) {
                    socket.emit(
                        "error mensaje",
                        "Tu contraseña debe contener más de 8 caracteres"
                    );
                } else {
                    if (!(datos.pass1 == datos.pass2)) {
                        socket.emit(
                            "error mensaje",
                            "La confirmación de contraseña no coincide"
                        );
                    } else {
                        //Verificar refcode, que tenga dueño. Luego, verificar correo electrónico que no exista.
                    }
                }
            }
        }
    });
    socket.on("autenticacion", (cookie) => {
        db.Producto.findOne()
            .sort({ _id: -1 })
            .exec((err, producto) => {
                lastID = producto.id;
                db.Producto.create({
                    name: "Nombre Vacio",
                    stock: 0,
                    category: "Promocional",
                    description: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium dolore- mque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. N",
                    moreinfo: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium dolore- mque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. N",
                    images: "/img/products/general.png",
                    id: lastID + 1,
                    price: "0",
                });
            });
        //Crear un producto por defecto (Imagen genérica, id + 1 que el último, lorem ipsum, s)
    });
});



//Manejo de rutas de PANEL VENDEDOR
app.get("/login", (req, res) => {
    res.render("administracion/login");
});

app.get("/register", (req, res) => {
    var refcode;
    if (req.cookies.refcode) {
        refcode = req.cookies.refcode;
    } else {
        refcode = "none";
    }
    res.render("administracion/register", {
        referencia: refcode,
    });
});
app.post("/register", (req, res) => {
    telefono = req.body.telefono;
    nombre = req.body.name;
    email = req.body.email;
    pass1 = req.body.pass;
    pass2 = req.body.pass1;
    referencia = req.body.ref;
    db.Usuario.findOne({ email: email }, (error, usuario) => {
        if (error) {
            console.log(error); // Mostrar el error
        }
        if (usuario) {
            //Si existe un usuario con ese correo, rechazar y redirijir
            res.send(
                '<script> alert("El correo electrónico ya ha sido utilizado. Prueba con otro."); window.location.href="/register";</script>'
            );
        } else {
            db.Usuario.findOne({ refcode: referencia }, (err, usuario) => {
                if (err) {
                    console.log(err);
                } else {
                    if (pass1 == pass2) {
                        ref = nombre.replace(/ /g, "");

                        ref = ref + Math.round(Math.random() * 1000000);

                        if (usuario && usuario.refcode != "none") {
                            db.Usuario.findOne({ refcode: ref }, (rrr, nouser) => {
                                if (rrr) {
                                    console.log(rrr);
                                }
                                if (!nouser) {
                                    //Entonces se crea con referencia
                                    db.Usuario.create({
                                        name: nombre,
                                        email: email,
                                        ganancias: "0",
                                        pass: pass1,
                                        rolname: "vendedor",
                                        refcode: ref,
                                        refVisitas: "0",
                                        porcentaje: "15",
                                        parentrefcode: referencia,
                                        ventatotal: "0",
                                        session: "",
                                        telefono: telefono,
                                    });
                                    res.redirect("/login");
                                } else {
                                    res.redirect("/register");
                                }
                            });
                        } else {
                            db.Usuario.findOne({ refcode: ref }, (rrr, nouser) => {
                                if (rrr) {
                                    console.log(rrr);
                                }
                                console.log(nouser);
                                if (!nouser) {
                                    //Entonces se crea con referencia
                                    db.Usuario.create({
                                        name: nombre,
                                        email: email,
                                        ganancias: "0",
                                        pass: pass1,
                                        rolname: "vendedor",
                                        refcode: ref,
                                        refVisitas: "0",
                                        porcentaje: "15",
                                        parentrefcode: referencia,
                                        ventatotal: "0",
                                        session: "",
                                        telefono: telefono,
                                    });
                                    res.redirect("/login");
                                } else {
                                    res.redirect("/register");
                                    console.log("El usuario ya existe");
                                }
                            });
                        }
                    } else {
                        res.send(
                            '<script> alert("Las contraseñas no coinciden."); window.location.href="/register";</script>'
                        );
                    }
                }
            });
        }
    });
});
app.get("/panel/resumen", (req, res) => {
    if (req.cookies.id) {
        db.Usuario.findOne({ session: req.cookies.id }, (err, usr) => {
            if (!(usr == null)) {
                if (usr.rolname == "vendedor") {
                    db.Pedido.find({ refCode: usr.refcode }, (err, pedi) => {
                        console.log(usr.refVisitas);
                        res.render("administracion/resumen", {
                            visitas: usr.refVisitas,
                            ref: usr.refcode,
                            usersession: usr.session,
                            username: usr.name,
                            useremail: usr.email,
                            userrole: usr.rolname,
                            porcentaje: usr.porcentaje,
                            ganancia: usr.ganancias,
                            pedidos: pedi,
                            porcentajeequipo: porcentajePorReferido,
                        });
                    });
                } else {
                    if (usr.rolname == "administracion") {
                        res.redirect("/admin/resumen");
                    }
                }
            } else {
                res.redirect("/login");
            }
        });
    } else {
        res.redirect("/login");
    }
});
app.post("/panel/resumen", (req, res) => {
    if (req.body.seguridad == "on" && req.body.useremail != "") {
        db.Retiro.findOne({ identificador: req.body.identificador }, (err, doc) => {
            if (doc) {
                res.redirect("/panel/resumen");
            } else {
                if (req.body.ganancia != "0") {
                    db.Retiro.create({
                        montototal: req.body.ganancia,
                        identificador: req.body.identificador,
                        emailaretirar: req.body.useremail,
                    });
                    db.Usuario.findOne({ email: req.body.identificador }, (err, doc) => {
                        doc.ganancias = "0";
                        doc.save();
                    });
                    res.redirect("/panel/resumen");
                } else {
                    res.redirect("/panel/resumen");
                }
            }
        });
    } else {
        res.redirect("/panel/resumen");
    }
});
app.get("/panel/ventas", (req, res) => {
    if (req.cookies.id) {
        db.Usuario.findOne({ session: req.cookies.id }, (err, usr) => {
            if (!(usr == null)) {
                if (usr.rolname == "vendedor") {
                    db.Pedido.find({ refCode: usr.refcode }, (err, pedi) => {
                        res.render("administracion/ventas", {
                            usersession: usr.session,
                            username: usr.name,
                            useremail: usr.email,
                            userrole: usr.rolname,
                            porcentaje: usr.porcentaje,
                            ganancia: usr.ganancias,
                            pedidos: pedi,
                            productos: products,
                        });
                    });
                } else {
                    res.redirect("/login");
                }
            } else {
                res.redirect("/login");
            }
        });
    } else {
        res.redirect("/login");
    }
});
app.post("/panel/ventas", (req, res) => {
    db.Pedido.findOne({ _id: req.body.identificador }, function(err, doc) {
        doc.status = false;
        doc.save();
    });
    res.redirect("/panel/ventas");
});
app.get("/panel/informacion", (req, res) => {
    if (req.cookies.id) {
        db.Usuario.findOne({ session: req.cookies.id }, (err, usr) => {
            if (!(usr == null)) {
                if (usr.rolname == "vendedor") {
                    res.render("administracion/informacion", {
                        usersession: usr.session,
                        username: usr.name,
                        dataMessage: messageJSON,
                    });
                } else {
                    res.redirect("/login");
                }
            } else {
                res.redirect("/login");
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.get('/panel/informacion/catalogo', (req, res, next) => {
    var catalogo = __dirname + '/public/catalogo/catalogo.pdf';
    res.download(catalogo);
});

// Manejo PANEL ADMINISTRACION
app.get("/admin/editor", (req, res) => {
    res.render("admin/editor");
});

app.get("/admin/resumen", (req, res) => {
    if (req.cookies.id) {
        db.Usuario.findOne({ session: req.cookies.id }, (err, usr) => {
            if (!(usr == null)) {
                if (usr.rolname == "administracion") {
                    db.Usuario.find({ rolname: "vendedor" }, (err, usuarios) => {
                        if (err) {
                            console.log(err);
                        }
                        db.Pedido.find({}, (error, pedidos) => {
                            if (error) {
                                console.log(error);
                            }
                            db.Retiro.find({}, (errores, retiros) => {
                                if (errores) {
                                    console.log(errores);
                                } else {
                                    res.render("admin/resumen", {
                                        usersList: usuarios,
                                        retirosList: retiros,
                                        pedidosList: pedidos,
                                    });
                                }
                            });
                        });
                    });
                } else {
                    res.redirect("/login");
                }
            } else {
                res.redirect("/login");
            }
        });
    } else {
        res.redirect("/login");
    }
});
app.get("/admin/ventas", (req, res) => {
    if (req.cookies.id) {
        db.Usuario.findOne({ session: req.cookies.id }, (err, usr) => {
            if (!(usr == null)) {
                if (usr.rolname == "administracion") {
                    db.Pedido.find({}, (error, pedidos) => {
                        if (error) {
                            console.log(error);
                        }
                        res.render("admin/ventas", {
                            pedidos: pedidos,
                            productos: products,
                        });
                    });
                } else {
                    res.redirect("/login");
                }
            } else {
                res.redirect("/login");
            }
        });
    } else {
        res.redirect("/login");
    }
});
app.post("/admin/ventas", (req, res) => {
    db.Pedido.findOne({ _id: req.body.identificador }, function(err, doc) {
        doc.status = false;
        doc.fechaHora = Date.now();
        doc.save();
    });
    res.redirect("/admin/ventas");
});
app.get("/admin/usuarios", (req, res) => {
    if (req.cookies.id) {
        db.Usuario.findOne({ session: req.cookies.id }, (err, usr) => {
            if (!(usr == null)) {
                if (usr.rolname == "administracion") {
                    db.Usuario.find({ rolname: "vendedor" }, (error, usrs) => {
                        if (error) {
                            console.log(error);
                        }
                        db.Pedido.find({}, (errores, pedidos) => {
                            if (errores) {
                                console.log(errores);
                            }
                            res.render("admin/usuarios", {
                                usuarios: usrs,
                                productos: products,
                                pedidos: pedidos,
                            });
                        });
                    });
                } else {
                    res.redirect("/login");
                }
            } else {
                res.redirect("/login");
            }
        });
    } else {
        res.redirect("/login");
    }
});
app.post("/admin/deleteUser", (req, res) => {
    console.log(req.body.idUsuario);
    db.Usuario.findOneAndDelete({ _id: req.body.idUsuario }, (err, usr) => {
        if (err) {
            console.log(err);
        } else {
            console.log("Deleted User : ", usr);
        }
    });
    res.redirect("/admin/usuarios");
});
app.get("/admin/retiros", (req, res) => {
    if (req.cookies.id) {
        db.Usuario.findOne({ session: req.cookies.id }, (err, usr) => {
            if (!(usr == null)) {
                if (usr.rolname == "administracion") {
                    db.Retiro.find({}, (error, retiros) => {
                        if (error) {
                            console.log(error);
                        }
                        res.render("admin/retiros", {
                            retiros: retiros,
                        });
                    });
                } else {
                    res.redirect("/login");
                }
            } else {
                res.redirect("/login");
            }
        });
    } else {
        res.redirect("/login");
    }
});
app.post("/admin/retiros", (req, res) => {
    if (req.body.id) {
        db.Retiro.findOneAndDelete({ _id: req.body.id }, function(err, doc) {
            doc.remove();
        });
    }
    res.redirect("/admin/retiros");
});

app.get("/admin/modificaciones", (req, res) => {
    if (req.cookies.id) {
        db.Usuario.findOne({ session: req.cookies.id }, (err, usr) => {
            if (!(usr == null)) {
                if (usr.rolname == "administracion") {
                    res.render("admin/modificaciones", {
                        productos: products,
                        message: messageJSON
                    });
                } else {
                    res.redirect("/login");
                }
            } else {
                res.redirect("/login");
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.post("/admin/modificaciones", (req, res, next) => {
    if (req.files && req.body.posicion) {
        console.log(req.files.portada);
        portada = req.files.portada;
        portada.mv(`./public/img/slider/portada-${req.body.posicion}.jpg`, (err) => {
            if (err) {
                console.log(err);
                console.log('Ocurrió un error al subir la portada.')
                res.redirect('/admin/modificaciones');
            } else {
                console.log('La portada se subió correctamente.')
                res.redirect('/admin/modificaciones');
            }
        });
    } else {
        res.redirect("/admin/modificaciones");
    }
}); // Modificacion de imagenes de portada

app.post("/admin/nuevo-catalogo", (req, res, next) => {
    console.log('Cargando nuevo catalogo...')
    if (req.files && req.files.catalogo) {
        console.log('Se recibió el catalogo...')
        catalogo = req.files.catalogo;
        catalogo.mv(`./public/catalogo/catalogo.pdf`, (err) => {
            if (err) {
                console.log(err);
                console.log('Ocurrió un error al subir el catalogo.')
                res.redirect('/admin/resumen');
            } else {
                console.log('El catalogo se subió correctamente.')
                res.redirect('/admin/resumen');
            }
        });
    } else {
        console.log('No se ha seleccionado ningún catálogo...')
        res.redirect("/admin/resumen");
    }
});

app.post("/admin/modificarMensaje", (req, res, next) => {
    console.log(req.body.textoEnriquecido);
    strMessage = req.body.textoEnriquecido;
    res.redirect("/admin/modificaciones");
    messageJSON = {
        texto: strMessage,
    };
    jsonString = JSON.stringify(messageJSON);
    fs.writeFile("dataMessage.json", jsonString, (err) => {
        console.log(err);
    });
});

app.post("/admin/modificaciones/producto/precio", (req, res, next) => {
    if (req.body.productoId && req.body.precioNuevo) {
        i = 0;
        j = 0;
        jsonString = "";
        products.categorias.forEach((categoria) => {
            categoria.productos.forEach((producto) => {
                if (producto.id == req.body.productoId) {
                    products.categorias[i].productos[j].precio = parseInt(
                        req.body.precioNuevo
                    );
                    jsonString = JSON.stringify(products);
                    fs.writeFile("data.json", jsonString, (err) => {
                        console.log(err);
                    });
                    res.redirect("/admin/modificaciones");
                }
                j++;
            });
            i++;
            j = 0;
        });
    }
});

app.post("/carrito", function(req, res, next) {
    strProductos = req.cookies.productos;
    var indices = [];
    var aux = "";
    // Crea un objeto de preferencia
    for (let i = 0; i < strProductos.length; i++) {
        if (strProductos[i].toLowerCase() == ",") {
            indices.push(aux);
            aux = "";
        } else {
            aux = aux + strProductos[i];
        }
    }
    let precioFinal = 0;
    for (let i = 0; i < indices.length; i++) {
        products.categorias.forEach(function(categoria) {
            categoria.productos.forEach(function(producto) {
                if (producto.id == indices[i]) {
                    precioFinal = precioFinal + producto.precio;
                }
            });
        });
    }
    var external_ref = "";
    // Agregar refcode
    if (req.cookies.refcode) {
        external_ref = strProductos + "|" + req.cookies.refcode + "|";
    } else {
        external_ref = strProductos + "|none|";
    }

    //Agregar variables del formulario al external ref
    if (
        req.body.nombre &&
        req.body.apellido &&
        req.body.telefono &&
        req.body.direccion &&
        validator.validate(req.body.email)
    ) {
        external_ref =
            external_ref +
            req.body.nombre +
            " " +
            req.body.apellido +
            "|" +
            req.body.telefono +
            "|" +
            req.body.direccion +
            "|" +
            req.body.email +
            "|";

        preference = {
            binary_mode: true,
            external_reference: external_ref,
            notification_url: "http://prolacciocosmetics.com/notificacion/pago",
            items: [{
                id: "0",
                title: "Pago total - Prolaccio Web",
                unit_price: precioFinal,
                quantity: 1,
            }, ],
        };

        mercadopago.preferences
            .create(preference)
            .then(function(response) {
                global.id = response.body.id;
                //console.log(response);
                res.redirect(response.body.init_point);
            })
            .catch(function(error) {
                console.log(error);
            });
    } else {
        res.redirect("/carrito");
    }
});
app.post("/notificacion/pago", (req, res) => {
    res.send(200);
    if (req.query.topic == "payment") {
        idPago = req.query.id;
        var headers = {
            accept: "application/json",
            "content-type": "application/json",
            Authorization: "Bearer APP_USR-1058112956337318-112011-55225d95c6f168423cd169bc8861df9d-541148667",
        };
        var options = {
            url: "https://api.mercadopago.com/v1/payments/" + idPago,
            headers: headers,
        };

        function callback(error, response, body) {
            bodyObj = JSON.parse(body);
            if (!error) {
                if (
                    bodyObj.status == "approved" &&
                    bodyObj.description == "Pago total - Prolaccio Web"
                ) {
                    db.Pedido.findOne({ id: idPago }, (err, pedido) => {
                        if (pedido) {
                            console.log(
                                "El pedido existe, no hacer nada. Notificacion duplicada."
                            );
                        } else {
                            console.log("El pedido se va a crear");
                            //Crear el pedido con la info de bodyObj
                            // Rescatar los objetos de External Reference
                            ext_ref = bodyObj.external_reference;
                            dato = [];
                            aux = "";
                            for (let i = 0; i < ext_ref.length; i++) {
                                if (ext_ref[i].toLowerCase() == "|") {
                                    dato.push(aux);
                                    aux = "";
                                } else {
                                    aux = aux + ext_ref[i];
                                }
                            }
                            // ##### Datos de la venta #########
                            // dato[0] = String productos
                            // dato[1] = Refcode
                            // dato[2] = Nombre completo
                            // dato[3] = Telefono
                            // dato[4] = Direccion
                            // dato[5] = Email

                            var p, g, pg;
                            db.Usuario.findOne({ refcode: dato[1] }, (err, usuario) => {
                                if (usuario) {
                                    console.log("Existe un usuario");
                                    p = usuario.parentrefcode;
                                    g = usuario.ganancias;
                                    pg = usuario.porcentaje;
                                } else {
                                    console.log("El usuario no existe");
                                    p = "none";
                                    g = "0";
                                    pg = "100";
                                }

                                vt = bodyObj.transaction_amount;
                                pv = parseInt(pg);
                                gv = (pv * vt) / 100;
                                gv = Math.round(gv);
                                gv = gv.toString();

                                //Ganancia total:
                                console.log(gv);
                                db.Pedido.create({
                                    id: bodyObj.id,
                                    products: dato[0],
                                    refCode: dato[1],
                                    nombreCompleto: dato[2],
                                    total: bodyObj.transaction_amount,
                                    ganancia: gv,
                                    direccion: dato[4],
                                    telefono: dato[3],
                                    email: dato[5],
                                    status: true,
                                });

                                var gv2 = gv;
                                if (usuario) {
                                    // Se agrega la ganancia al vendedor
                                    usuario.ganancias = (
                                        parseInt(usuario.ganancias) + parseInt(gv2)
                                    ).toString();
                                    usuario.ventatotal = (
                                        parseInt(usuario.ventatotal) + bodyObj.transaction_amount
                                    ).toString();
                                    console.log(usuario.ganancias);
                                    console.log(usuario.ventatotal);
                                    // Se revisa el Porcentaje
                                    // Falta probar
                                    var nuevoPorcentaje;
                                    if (parseInt(usuario.ventatotal) > 25000) {
                                        nuevoPorcentaje = "30";
                                        usuario.porcentaje = nuevoPorcentaje;
                                    } else {
                                        if (parseInt(usuario.ventatotal) < 25000) {
                                            nuevoPorcentaje = "20";
                                            usuario.porcentaje = nuevoPorcentaje;
                                        }
                                        if (parseInt(usuario.ventatotal) < 12000) {
                                            nuevoPorcentaje = "15";
                                            usuario.porcentaje = nuevoPorcentaje;
                                        }
                                    }
                                    //Se envía el EMAIL al VENDEDOR
                                    var mailOptions = {
                                        from: "ventas@prolacciocosmetics.com",
                                        to: usuario.email,
                                        subject: "¡Se ha recibido una nueva venta!",
                                        text: "Ingresá a tu panel y revisá los detalles",
                                    };

                                    transporter.sendMail(mailOptions, function(error, info) {
                                        if (error) {
                                            console.log("Error en enviar EMAIL", error);
                                        }
                                    });

                                    //Se guarda lo del USUARIO
                                    usuario.save();

                                    //Se envia correo al COMPRADOR
                                    var mailOptions = {
                                        from: "ventas@prolacciocosmetics.com",
                                        to: dato[5].email,
                                        subject: "¡Se ha aceptado tu compra!",
                                        text: "Pronto una vendedora se contactará contigo para coordinar la entrega. ¡Muchas gracias por su compra!",
                                    };

                                    transporter.sendMail(mailOptions, function(error, info) {
                                        if (error) {
                                            console.log("Error en enviar EMAIL", error);
                                        }
                                    });
                                }
                                // acción Se agrega la ganancia al parentRefCode (% del total) - Si es diferente de NONE
                                if (p == "none") {
                                    console.log("El usuario no tiene ParentRefCode");
                                } else {
                                    db.Usuario.findOne({ refcode: p }, (problema, padre) => {
                                        if (problema) {
                                            console.log(problema);
                                        }
                                        console.log(
                                            "Se agrega la ganancia del: " +
                                            porcentajePorReferido +
                                            " al parentRefCode"
                                        );
                                        padreGanancia =
                                            (porcentajePorReferido * bodyObj.transaction_amount) /
                                            100;
                                        padreGananciaString = parseInt(padre.ganancias);
                                        padreGanancia = padreGanancia + padreGananciaString;
                                        padre.ganancias = padreGanancia.toString();
                                        padre.save();
                                    });
                                }
                            });
                        }
                    });
                } else {
                    console.log("El pedido no ha sido aprobado");
                }
            }
        }

        request(options, callback);
    }
});
app.get("/panel/desconectar", (req, res) => {
    res.cookie("id", "");
    res.redirect("/login");
});

//Agregar cookie de REFERIDO y Redireccionar a WEB - Para registros y compras referidas
app.get("/ref/:refcode", (req, res) => {
    db.Usuario.findOne({ refcode: req.params.refcode }, (err, user) => {
        if (err) {
            console.log(err);
        }
        if (user) {
            newVisitas = parseInt(user.refVisitas);
            newVisitas = newVisitas + 1;
            console.log(newVisitas);
            user.refVisitas = newVisitas.toString();
            user.save();
            res.cookie("refcode", req.params.refcode);
            res.redirect("/");
        } else {
            res.cookie("refcode", "none");
            res.redirect("/");
        }
    });
});
app.get("/ref/:refcode/reg", (req, res) => {
    db.Usuario.findOne({ refcode: req.params.refcode }, (err, user) => {
        if (err) {
            console.log(err);
        }
        if (user) {
            newVisitas = parseInt(user.refVisitas);
            newVisitas = newVisitas + 1;
            console.log(newVisitas);
            user.refVisitas = newVisitas.toString();
            user.save();
            res.cookie("refcode", req.params.refcode);
            res.redirect("/register");
        } else {
            res.cookie("refcode", "none");
            res.redirect("/register");
        }
    });
});

// Ecommerce - Web para el cliente
app.get("/", (req, res) => {
    res.render("ecommerce/index", {
        products: products,
    });
    //Obtener productos de la base de datos con sus datos, y guardarlos en una variable
});
app.post("/", (req, res) => {
    console.log("Se recibio el post");

    if (
        (req.body.cname != undefined) & (req.body.cemail != undefined) &&
        req.body.cmensaje != undefined
    ) {
        var mailOptions = {
            from: "ventas@prolacciocosmetics.com",
            to: "ventas@prolacciocosmetics.com",
            subject: "Nueva consulta - " + req.body.cname,
            text: "Correo para responder: " +
                req.body.cemail +
                " - Mensaje: " +
                req.body.cmensaje,
        };

        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log("Error en enviar EMAIL", error);
            }
        });
        res.send(
            '<script>alert("El email ha sido enviado. Pronto nos comunicaremos contigo."); window.location.assign("/");</script>'
        );
    } else {
        res.render("index");
    }
});

app.get("/politicas-de-privacidad", (req, res) => {
    res.render("ecommerce/politicas", {
        products: products,
    });
});

app.get("/terminos-y-condiciones", (req, res) => {
    res.render("ecommerce/terminos", {
        products: products,
    });
});

app.get("/carrito", (req, res) => {
    if (req.cookies.productos) {
        var indices = [];
        cadena = req.cookies.productos;
        var aux = "";
        for (let i = 0; i < cadena.length; i++) {
            if (cadena[i].toLowerCase() == ",") {
                indices.push(aux);
                aux = "";
            } else {
                aux = aux + cadena[i];
            }
        }
        if (indices[indices.length - 1] == "RELLENO") {
            indices.push("Relleno");
        }

        //Renderizar cuando el carrito tiene objetos y pasarle PRODUCTOS e INDICES.
        res.render("ecommerce/carrito/cart", {
            products: products,
            cart: indices,
            listos: [],
            art: global.id,
        });
    } else {
        //Aqui se debe renderizar el carrito vacio
        res.render("ecommerce/carrito/vacio", {
            products: products,
        });
    }
});
app.get("/nosotros", (req, res) => {
    res.render("ecommerce/nosotros", {
        products: products,
    });
});
app.get("/centros", (req, res) => {
    res.render("ecommerce/centros", {
        products: products,
    });
});
app.get("/productos/:id", (req, res, next) => {
    error = true;
    products.categorias.forEach(function(categoria) {
        categoria.productos.forEach(function(product) {
            if (product.id == req.params.id) {
                res.render("ecommerce/single-producto/index", {
                    imagen: product.imagen,
                    titulo: product.nombre,
                    categoria: categoria.nombre,
                    precio: product.precio,
                    descripcion: product.descripcion,
                    id: product.id,
                    products: products,
                });
                error = false;
            }
        });
    });
    if (error) {
        next();
    }
});
app.get("/categoria/:nombre", (req, res, next) => {
    decodificar = req.params.nombre.replace(/-/g, " ");
    console.log(decodificar);
    categoriaWeb = req.params.nombre;
    error = true;
    products.categorias.forEach(function(categoria) {
        if (decodificar == categoria.nombre) {
            res.render("ecommerce/categoria", {
                products: products,
                nombre: categoria.nombre,
                productosCat: categoria.productos,
            });
            error = false;
        }
    });
    if (error) {
        next();
    }
});

app.get("/contacto", (req, res) => {
    res.render("ecommerce/contacto", {
        products: products,
    });
});
app.post("contacto", (req, res) => {
    console.log("Se recibio el post");

    if (
        (req.body.cname != undefined) & (req.body.cemail != undefined) &&
        req.body.cmensaje != undefined
    ) {
        var mailOptions = {
            from: "ventas@prolacciocosmetics.com",
            to: "ventas@prolacciocosmetics.com",
            subject: "Nueva consulta - " + req.body.cname,
            text: "Correo para responder: " +
                req.body.cemail +
                " - Mensaje: " +
                req.body.cmensaje,
        };

        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log("Error en enviar EMAIL", error);
            }
        });
        res.send(
            '<script>alert("El email ha sido enviado. Pronto nos comunicaremos contigo."); window.location.assign("/");</script>'
        );
    } else {
        res.render("index");
    }
});

app.get("*", (req, res) => {
    res.status(404);
    url = req.url;
    res.render("error/error404", {
        title: "404: Página no encontrada ❤️",
        url: url,
    });
});