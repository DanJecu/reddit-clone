import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { COOKIE_NAME, __prod__ } from './constants';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors from 'cors';

import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

import mikroConfig from './mikro-orm.config';
import { buildSchema } from 'type-graphql';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import { MyContext } from './types';
import { UserResolver } from './resolvers/user';

const main = async () => {
	const orm = await MikroORM.init(mikroConfig);
	await orm.getMigrator().up();

	const app = express();

	const redisClient = createClient();
	redisClient.connect().catch(console.error);

	const redisStore = new RedisStore({ client: redisClient, disableTouch: true });

	app.use(
		session({
			name: COOKIE_NAME,
			store: redisStore,
			cookie: {
				maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
				httpOnly: true,
				secure: __prod__, // cookie only works in https
				sameSite: 'lax',
			},
			secret: 'ajnqwjknjnqwe',
			resave: false,
			saveUninitialized: false,
		})
	);

	const httpServer = http.createServer(app);
	const server = new ApolloServer<MyContext>({
		schema: await buildSchema({
			resolvers: [HelloResolver, PostResolver, UserResolver],
			validate: false,
		}),
		plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
	});

	await server.start();

	app.use(
		'/graphql',
		cors<cors.CorsRequest>({ origin: 'http://localhost:3000', credentials: true }),
		express.json(),
		expressMiddleware<MyContext>(server, {
			context: async ({ req, res }) => ({
				token: req.headers.token as string,
				em: orm.em.fork({}),
				res,
				req,
			}),
		})
	);

	await new Promise<void>((resolve) => httpServer.listen({ port: 4000 }, resolve));
	console.log(`🚀 Server ready at http://localhost:4000/graphql`);
};

main().catch((err) => console.error(err));
