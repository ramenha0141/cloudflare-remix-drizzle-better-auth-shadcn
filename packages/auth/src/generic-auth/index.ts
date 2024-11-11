import { betterFetch } from '@better-fetch/fetch';
import {
	type BetterAuthPlugin,
	type User,
	generateId,
	generateState,
	logger,
	parseState,
	setSessionCookie,
} from 'better-auth';
import { createAuthEndpoint } from 'better-auth/api';
import {
	type OAuth2Tokens,
	createAuthorizationURL,
	validateAuthorizationCode,
} from 'better-auth/oauth2';
import { APIError } from 'better-call';
import { parseJWT } from 'oslo/jwt';
import { z } from 'zod';

import { handleOAuthUserInfo } from './link-account';
import { userSchema } from './schema';

/**
 * Configuration interface for generic OAuth providers.
 */
interface GenericOAuthConfig {
	/** Unique identifier for the OAuth provider */
	providerId: string;
	/**
	 * URL to fetch OAuth 2.0 configuration.
	 * If provided, the authorization and token endpoints will be fetched from this URL.
	 */
	discoveryUrl?: string;
	/**
	 * Type of OAuth flow.
	 * @default "oauth2"
	 */
	type?: 'oauth2' | 'oidc';
	/**
	 * URL for the authorization endpoint.
	 * Optional if using discoveryUrl.
	 */
	authorizationUrl?: string;
	/**
	 * URL for the token endpoint.
	 * Optional if using discoveryUrl.
	 */
	tokenUrl?: string;
	/**
	 * URL for the user info endpoint.
	 * Optional if using discoveryUrl.
	 */
	userInfoUrl?: string;
	/** OAuth client ID */
	clientId: string;
	/** OAuth client secret */
	clientSecret: string;
	/**
	 * Array of OAuth scopes to request.
	 * @default []
	 */
	scopes?: string[];
	/**
	 * Custom redirect URI.
	 * If not provided, a default URI will be constructed.
	 */
	redirectURI?: string;
	/**
	 * OAuth response type.
	 * @default "code"
	 */
	responseType?: string;
	/**
	 * Prompt parameter for the authorization request.
	 * Controls the authentication experience for the user.
	 */
	prompt?: string;
	/**
	 * Whether to use PKCE (Proof Key for Code Exchange)
	 * @default false
	 */
	pkce?: boolean;
	/**
	 * Access type for the authorization request.
	 * Use "offline" to request a refresh token.
	 */
	accessType?: string;
	/**
	 * Custom function to fetch user info.
	 * If provided, this function will be used instead of the default user info fetching logic.
	 * @param tokens - The OAuth tokens received after successful authentication
	 * @returns A promise that resolves to a User object or null
	 */
	getUserInfo?: (tokens: OAuth2Tokens) => Promise<User | null>;
}

interface GenericOAuthOptions {
	/**
	 * Array of OAuth provider configurations.
	 */
	config: GenericOAuthConfig[];
}

async function getUserInfo(
	tokens: OAuth2Tokens,
	type: 'oauth2' | 'oidc',
	finalUserInfoUrl: string | undefined,
) {
	if (type === 'oidc' && tokens.idToken) {
		const decoded = parseJWT(tokens.idToken);
		if (decoded?.payload) {
			return decoded.payload;
		}
	}

	if (!finalUserInfoUrl) {
		return null;
	}

	const userInfo = await betterFetch<User>(finalUserInfoUrl, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${tokens.accessToken}`,
		},
	});
	return userInfo.data;
}

/**
 * A generic OAuth plugin that can be used to add OAuth support to any provider
 */
export const genericOAuth = (options: GenericOAuthOptions) => {
	return {
		id: 'generic-oauth',
		endpoints: {
			signInWithOAuth2: createAuthEndpoint(
				'/sign-in/oauth2',
				{
					method: 'POST',
					query: z
						.object({
							/**
							 * Redirect to the current URL after the
							 * user has signed in.
							 */
							currentURL: z.string().optional(),
						})
						.optional(),
					body: z.object({
						providerId: z.string(),
						callbackURL: z.string().optional(),
					}),
				},
				async ctx => {
					const { providerId } = ctx.body;
					const config = options.config.find(c => c.providerId === providerId);
					if (!config) {
						throw new APIError('BAD_REQUEST', {
							message: `No config found for provider ${providerId}`,
						});
					}
					const {
						discoveryUrl,
						authorizationUrl,
						tokenUrl,
						clientId,
						clientSecret,
						scopes,
						redirectURI,
						responseType,
						pkce,
						prompt,
						accessType,
					} = config;
					let finalAuthUrl = authorizationUrl;
					let finalTokenUrl = tokenUrl;
					if (discoveryUrl) {
						const discovery = await betterFetch<{
							authorization_endpoint: string;
							token_endpoint: string;
						}>(discoveryUrl, {
							onError(context) {
								logger.error(context.error, {
									discoveryUrl,
								});
							},
						});
						if (discovery.data) {
							finalAuthUrl = discovery.data.authorization_endpoint;
							finalTokenUrl = discovery.data.token_endpoint;
						}
					}
					if (!finalAuthUrl || !finalTokenUrl) {
						throw new APIError('BAD_REQUEST', {
							message: 'Invalid OAuth configuration.',
						});
					}

					const currentURL = ctx.query?.currentURL
						? new URL(ctx.query?.currentURL)
						: null;
					const callbackURL = ctx.body.callbackURL?.startsWith('http')
						? ctx.body.callbackURL
						: `${currentURL?.origin}${ctx.body.callbackURL || ''}`;
					const { state, codeVerifier } = await generateState(ctx);

					const authUrl = await createAuthorizationURL({
						id: providerId,
						options: {
							clientId,
							clientSecret,
							redirectURI,
						},
						authorizationEndpoint: finalAuthUrl,
						state,
						codeVerifier: pkce ? codeVerifier : undefined,
						scopes: scopes || [],
						redirectURI: `${ctx.context.baseURL}/oauth2/callback/${providerId}`,
					});

					if (responseType && responseType !== 'code') {
						authUrl.searchParams.set('response_type', responseType);
					}

					if (prompt) {
						authUrl.searchParams.set('prompt', prompt);
					}

					if (accessType) {
						authUrl.searchParams.set('access_type', accessType);
					}

					return ctx.json({
						url: authUrl.toString(),
						redirect: true,
					});
				},
			),
			oAuth2Callback: createAuthEndpoint(
				'/oauth2/callback/:providerId',
				{
					method: 'GET',
					query: z.object({
						code: z.string().optional(),
						spapi_oauth_code: z.string().optional(),
						error: z.string().optional(),
						state: z.string(),
					}),
				},
				async ctx => {
					if (
						ctx.query.error ||
						!ctx.query.code ||
						!ctx.query.spapi_oauth_code
					) {
						throw ctx.redirect(
							`${ctx.context.baseURL}?error=${
								ctx.query.error || 'oAuth_code_missing'
							}`,
						);
					}
					const provider = options.config.find(
						p => p.providerId === ctx.params.providerId,
					);

					if (!provider) {
						throw new APIError('BAD_REQUEST', {
							message: `No config found for provider ${ctx.params.providerId}`,
						});
					}
					let tokens: OAuth2Tokens | undefined = undefined;
					const parsedState = await parseState(ctx);

					const { callbackURL, codeVerifier, errorURL } = parsedState;
					const code = ctx.query.code || ctx.query.spapi_oauth_code;

					let finalTokenUrl = provider.tokenUrl;
					let finalUserInfoUrl = provider.userInfoUrl;
					if (provider.discoveryUrl) {
						const discovery = await betterFetch<{
							token_endpoint: string;
							userinfo_endpoint: string;
						}>(provider.discoveryUrl, {
							method: 'GET',
						});
						if (discovery.data) {
							finalTokenUrl = discovery.data.token_endpoint;
							finalUserInfoUrl = discovery.data.userinfo_endpoint;
						}
					}
					try {
						if (!finalTokenUrl) {
							throw new APIError('BAD_REQUEST', {
								message: 'Invalid OAuth configuration.',
							});
						}
						tokens = await validateAuthorizationCode({
							code,
							codeVerifier,
							redirectURI: `${ctx.context.baseURL}/oauth2/callback/${provider.providerId}`,
							options: {
								clientId: provider.clientId,
								clientSecret: provider.clientSecret,
							},
							tokenEndpoint: finalTokenUrl,
						});
					} catch (e) {
						ctx.context.logger.error(e);
						throw ctx.redirect(
							`${errorURL}?error=oauth_code_verification_failed`,
						);
					}

					if (!tokens) {
						throw new APIError('BAD_REQUEST', {
							message: 'Invalid OAuth configuration.',
						});
					}
					const userInfo = (
						provider.getUserInfo
							? await provider.getUserInfo(tokens)
							: await getUserInfo(
									tokens,
									provider.type || 'oauth2',
									finalUserInfoUrl,
								)
					) as {
						id: string;
					};
					const id = generateId();
					const data = userSchema.safeParse({
						...userInfo,
						id,
					});

					if (!userInfo || data.success === false) {
						logger.error('Unable to get user info', data.error);
						throw ctx.redirect(
							`${ctx.context.baseURL}/error?error=please_restart_the_process`,
						);
					}
					const result = await handleOAuthUserInfo(ctx, {
						userInfo: data.data,
						account: {
							providerId: provider.providerId,
							accountId: userInfo.id,
							accessToken: tokens.accessToken,
						},
					});
					function redirectOnError(error: string) {
						throw ctx.redirect(
							`${
								errorURL || callbackURL || `${ctx.context.baseURL}/error`
							}?error=${error}`,
						);
					}
					if (result.error) {
						return redirectOnError(result.error.split(' ').join('_'));
					}
					const { session, user } = result.data!;
					await setSessionCookie(ctx, {
						session,
						user,
					});
					let toRedirectTo: string;
					try {
						const url = new URL(callbackURL);
						toRedirectTo = url.toString();
					} catch {
						toRedirectTo = callbackURL;
					}
					throw ctx.redirect(toRedirectTo);
				},
			),
		},
	} satisfies BetterAuthPlugin;
};
