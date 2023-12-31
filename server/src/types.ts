import { Connection, EntityManager, IDatabaseDriver } from '@mikro-orm/core';
import { Request, Response } from 'express';
import { Session } from 'express-session';

export type MyContext = {
	token?: String;
	em: EntityManager<IDatabaseDriver<Connection>>;
	req: Request & { session: Session & { userId?: number } };
	res: Response;
};
