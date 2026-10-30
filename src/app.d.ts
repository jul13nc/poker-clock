import type { D1Database } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				ADMIN_PIN?: string;
				SESSION_SECRET?: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
				passThroughOnException(): void;
			};
			caches: CacheStorage;
		}

		interface Locals {
			isAdmin: boolean;
		}
	}
}

export {};
