import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as dotenv from 'dotenv';
import cors from 'cors';

import * as winston from 'winston';
import * as expressWinston from 'express-winston';

import debug from 'debug';


import RedisStore from 'connect-redis';
import session from 'express-session';
declare module 'express-session' {
    interface SessionData {
        //user: { [key: string]: any };
        _id: string;
    }
  }
import { createClient } from 'redis';

import { CommonRoutes } from './common/common.routes';
import { AuthRoutes } from './auth/auth.routes';
import { UsersRoutes } from './users/users.routes';
import { RoomsRoutes } from './rooms/rooms.routes';
import path from 'path';

const dotenvResult = dotenv.config();
if (dotenvResult.error) {
    throw dotenvResult.error;
}

const app: express.Application = express();
//socket
const httpServer = createServer(app);
const io = new Server(httpServer);
//socket
const port = 3000;
const routes: Array<CommonRoutes> = [];
const debugLog: debug.IDebugger = debug('app');

app.use(express.json());
app.use(express.urlencoded({extended : true}));
app.use(cors());
//socket
app.use(express.static(path.join(__dirname, 'public')));
//socket
const loggerOpts: expressWinston.LoggerOptions = {
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
        winston.format.json(),
        winston.format.prettyPrint(),
        winston.format.colorize({ all: true }),
    ),
};

if (!process.env.DEBUG) {
    loggerOpts.meta = false;
}

app.use(expressWinston.logger(loggerOpts));

//app.set('trust proxy', 1);

// Initialize client.
const redisClient = createClient();

redisClient.connect().catch(console.error);

// Initialize store.
const redisStore = new RedisStore({
    client: redisClient,
});

// Initialize sesssion storage.
app.use(
    session({
        store: redisStore,
        saveUninitialized: false,
        secret: 'topSecret',
        resave: false,
        name: 'sessionId',
        cookie: {
            secure: false,
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 30,
        },
    })
);

routes.push(new AuthRoutes(app));
routes.push(new UsersRoutes(app));
//socket
routes.push(new RoomsRoutes(app));
//socket

const runningMsg = `Server running at http://localhost:${port}`;

app.get('/', (req: express.Request, res: express.Response) => {
    res.status(200).send(runningMsg);
});

function errorHandler(error: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    debugLog( `error ${error.message}`); 
    const status = error.status || 500;
    res.status(status).send(JSON.stringify({
        error: error.message,
    }));
}

app.use(errorHandler);
/*
app.listen(port, () => {
    routes.forEach((route: CommonRoutes) => {
        debugLog(`Routes configured for ${route.getName()}`);
    });

    console.log(runningMsg);
});
*/
//socket
httpServer.listen(port, () => {
    routes.forEach((route: CommonRoutes) => {
        debugLog(`Routes configured for ${route.getName()}`);
    });

    console.log(runningMsg);
});
//socket

//socket
io.on('connection', (socket) => {
    console.log('user connected');

    socket.on('new-user', (chatroomId, userId) => {
        console.log('new-user');
        socket.join(chatroomId);
        //rooms[room].users[socket.id] = name
        //socket.to(chatroomId).local.emit('user-connected', userId);
        socket.broadcast.to(chatroomId).emit('user-connected', chatroomId, userId);
    });

    socket.on('send-chat-message', (chatroomId, message) => {
        socket.broadcast.to(chatroomId).emit('chat-message', chatroomId, message);
    });
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});
//socket