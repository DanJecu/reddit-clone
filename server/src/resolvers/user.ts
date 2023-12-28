import { Resolver } from 'type-graphql/dist/decorators/Resolver';
import { Mutation } from 'type-graphql/dist/decorators/Mutation';
import { Arg, Ctx, Field, InputType, ObjectType, Query } from 'type-graphql';
import { MyContext } from '../types';
import { User } from '../entities/User';
import argon2 from 'argon2';
import { COOKIE_NAME } from '../constants';

@InputType()
class UsernamePasswordInput {
	@Field()
	username: string;
	@Field()
	password: string;
}

@ObjectType()
class FieldError {
	@Field()
	field: string;
	@Field()
	message: string;
}

@ObjectType()
class UserResponse {
	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];

	@Field(() => User, { nullable: true })
	user?: User;
}

@Resolver()
export class UserResolver {
	@Query(() => User, { nullable: true })
	async me(@Ctx() { req, em }: MyContext) {
		console.log('session: ', req.session);

		if (!req.session.userId) {
			return null;
		}

		const user = await em.findOne(User, { id: req.session.userId });

		return user;
	}

	@Mutation(() => UserResponse)
	async register(@Arg('options') options: UsernamePasswordInput, @Ctx() { em, req }: MyContext): Promise<UserResponse> {
		const isUsernameTaken = await em.findOne(User, { username: options.username });

		if (isUsernameTaken) {
			return {
				errors: [
					{
						field: 'username',
						message: 'username already taken',
					},
				],
			};
		}

		if (options.username.length <= 2) {
			return {
				errors: [
					{
						field: 'username',
						message: 'length must be greater than 2',
					},
				],
			};
		}

		if (options.password.length <= 3) {
			return {
				errors: [
					{
						field: 'password',
						message: 'length must be greater than 3',
					},
				],
			};
		}

		const hashedPassword = await argon2.hash(options.password);
		const user = em.create(User, {
			username: options.username,
			password: hashedPassword,
		});

		await em.persistAndFlush(user);

		req.session.userId = user.id;

		return { user };
	}

	@Mutation(() => UserResponse)
	async login(@Arg('options') options: UsernamePasswordInput, @Ctx() { em, req }: MyContext): Promise<UserResponse> {
		const user = await em.findOne(User, { username: options.username });

		if (!user) {
			return {
				errors: [
					{
						field: 'username',
						message: "that username doesn't exist",
					},
				],
			};
		}

		const valid = await argon2.verify(user.password, options.password);
		if (!valid) {
			return {
				errors: [
					{
						field: 'password',
						message: 'incorrect password',
					},
				],
			};
		}

		req.session.userId = user.id;

		return { user };
	}

	@Mutation(() => Boolean)
	logout(@Ctx() { req, res }: MyContext) {
		return new Promise((resolve) =>
			req.session.destroy((err) => {
				if (err) {
					console.log(err);
					resolve(false);
					return;
				}
				// destroy cookie
				res.clearCookie(COOKIE_NAME);
				resolve(true);
			})
		);
	}
}
