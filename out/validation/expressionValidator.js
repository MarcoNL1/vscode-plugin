"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpressionValidator = void 0;
const vscode = require("vscode");
const jsonpath_plus_1 = require("jsonpath-plus");
const fontoxpath_1 = require("fontoxpath");
class ExpressionValidator {
    constructor() {
        this.attributeValidators = {
            'jsonPath': (expr) => this.validateJsonPath(expr),
            'xpathExpression': (expr) => this.validateXPath(expr)
        };
    }
    validateJsonPath(expression) {
        if (!expression.trim())
            return 'JsonPath expression cannot be empty.';
        try {
            (0, jsonpath_plus_1.JSONPath)({ path: expression, json: {} });
            return null;
        }
        catch (error) {
            if (error instanceof Error) {
                return `Invalid JsonPath expression: ${error.message}`;
            }
            return 'Invalid JsonPath expression: An unknown parsing error occurred.';
        }
    }
    validateXPath(expression) {
        if (!expression.trim())
            return 'XPath expression cannot be empty.';
        try {
            // 1. Create a dummy document to act as the context node.
            const dummyDoc = new DOMParser().parseFromString('<dummyRoot/>', 'text/xml');
            // 2. Evaluate using ANY_TYPE. 
            (0, fontoxpath_1.evaluateXPath)(expression, dummyDoc, null, null, fontoxpath_1.evaluateXPath.ANY_TYPE);
            return null;
        }
        catch (error) {
            if (error instanceof Error) {
                return `Invalid XPath expression: ${error.message}`;
            }
            return 'Invalid XPath expression: An unknown parsing error occurred.';
        }
    }
    async checkExpression(attrName, attrValue, range, token) {
        const validator = this.attributeValidators[attrName];
        if (!validator) {
            return null;
        }
        // 1. Yield the event loop.
        await new Promise(resolve => setTimeout(resolve, 0));
        // 2. Check for cancellation.
        if (token.isCancellationRequested) {
            return null;
        }
        // 3. Execute the synchronous CPU-bound parser.
        const errorMessage = validator(attrValue);
        // 4. Final cancellation check before committing to creating objects.
        if (token.isCancellationRequested) {
            return null;
        }
        if (errorMessage) {
            const diagnostic = new vscode.Diagnostic(range, errorMessage, vscode.DiagnosticSeverity.Error);
            diagnostic.source = 'Frank!Validator';
            return diagnostic;
        }
        return null;
    }
}
exports.ExpressionValidator = ExpressionValidator;
//# sourceMappingURL=expressionValidator.js.map