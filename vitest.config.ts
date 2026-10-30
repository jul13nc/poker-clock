import { defineConfig } from 'vitest/config';

export default defineConfig({
	tsconfig: 'tsconfig.vitest.json',
	test: {
		include: ['src/**/*.test.ts']
	}
});
