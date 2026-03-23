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
        try {
            (0, jsonpath_plus_1.JSONPath)({ path: expression, json: {} });
            return null;
        }
        catch (error) {
            return `Invalid JsonPath expression: ${error.message}`;
        }
    }
    validateXPath(expression) {
        try {
            (0, fontoxpath_1.evaluateXPath)(expression, null, null, null, fontoxpath_1.evaluateXPath.BOOLEAN_TYPE);
            return null;
        }
        catch (error) {
            return `Invalid XPath expression: ${error.message}`;
        }
    }
    checkExpression(attrName, attrValue, range) {
        const validator = this.attributeValidators[attrName];
        if (!validator) {
            return null;
        }
        const errorMessage = validator(attrValue);
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