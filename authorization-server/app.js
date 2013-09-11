var config = require('./config')
    , express = require('express')
    , passport = require('passport')
    , site = require('./site')
    , oauth2 = require('./oauth2')
    , user = require('./user')
    , client = require('./client')
    , token = require('./token')
    , https = require('https')
    , fs = require('fs')
    , db = require('./db');

//Pull in the mongo store if we're configured to use it
//else pull in MemoryStore
var sessionStorage;
if (config.session.type === 'MongoStore') {
    var MongoStore = require('connect-mongo')(express);
    sessionStorage = new MongoStore({
        db: config.session.dbName
    });
} else if(config.session.type === 'MemoryStore') {
    var MemoryStore = express.session.MemoryStore;
    sessionStorage = new MemoryStore();
} else {
    //We have no idea here
    throw new Error("Within config/index.js the session.type is unknown: " + config.session.type )
}

// Express configuration
var app = express();
app.set('view engine', 'ejs');
app.use(express.logger());
app.use(express.cookieParser());
app.use(express.bodyParser());

//Session Configuration
app.use(express.session({
    secret: config.session.secret,
    store: sessionStorage,
    key: "authorization.sid",
    cookie: {maxAge: config.session.maxAge }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

// Passport configuration
require('./auth');

app.get('/', site.index);
app.get('/login', site.loginForm);
app.post('/login', site.login);
app.get('/logout', site.logout);
app.get('/account', site.account);

app.get('/dialog/authorize', oauth2.authorization);
app.post('/dialog/authorize/decision', oauth2.decision);
app.post('/oauth/token', oauth2.token);

app.get('/api/userinfo', user.info);
app.get('/api/clientinfo', client.info);

// Mimicking google's token info endpoint from
// https://developers.google.com/accounts/docs/OAuth2UserAgent#validatetoken
app.get('/api/tokeninfo', token.info);

//From time to time we need to clean up any expired tokens
//in the database
setInterval(function () {
    db.accessTokens.removeExpired(function(err) {
        if(err) {
            console.error("Error removing expired tokens");
        }
    });
}, config.db.timeToCheckExpiredTokens * 1000);

//TODO: Change these for your own certificates.  This was generated
//through the commands:
//openssl genrsa -out privatekey.pem 1024
//openssl req -new -key privatekey.pem -out certrequest.csr
//openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
var options = {
    key: fs.readFileSync('certs/privatekey.pem'),
    cert: fs.readFileSync('certs/certificate.pem')
};

// Create our HTTPS server listening on port 3000.
https.createServer(options, app).listen(3000);
console.log("OAuth 2.0 Authorization Server started on port 3000");


