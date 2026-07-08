module.exports = {
	root: true,
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
		project: "./tsconfig.json",
	},
	plugins: ["@typescript-eslint"],
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
	rules: {
		"@typescript-eslint/no-explicit-any": "error",
		"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
		"@typescript-eslint/indent": ["error", "tab"],
		"@typescript-eslint/explicit-function-return-type": "warn",
		"@typescript-eslint/no-floating-promises": "error",
		"no-console": "off",
		"prefer-const": "error",
		eqeqeq: ["error", "always"],
	},
	ignorePatterns: ["dist/", "node_modules/", "coverage/"],
};
