import globals from "globals";
import typescriptEslint from "@typescript-eslint/eslint-plugin";

export default [
    {
        ignores: [
            ".vscode-test/**",
            "out/**",
            "dist/**",
            "node_modules/**",
            "test-workspace/**"
        ],
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            globals: {
                ...globals.commonjs,
                ...globals.node,
                ...globals.mocha,
                ...globals.browser,
                acquireVsCodeApi: "readonly",
                svgPanZoom: "readonly",
                container: "readonly"
            },

            ecmaVersion: 2022,
            sourceType: "module",
        },

        rules: {
            "no-const-assign": "warn",
            "no-this-before-super": "warn",
            "no-undef": "warn",
            "no-unreachable": "warn",
            "no-unused-vars": "warn",
            "constructor-super": "warn",
            "valid-typeof": "warn",
        },
    },
    {
        plugins: {
            "@typescript-eslint": typescriptEslint,
        }
    }
];