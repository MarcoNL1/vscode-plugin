import * as vscode from 'vscode';
import { JSONPath } from 'jsonpath-plus';
import { evaluateXPath } from 'fontoxpath';

export class ExpressionValidator {

    private readonly attributeValidators: Record<string, (expression: string) => string | null> = {
        'jsonPath': (expr) => this.validateJsonPath(expr),
        'xpathExpression': (expr) => this.validateXPath(expr)
    };

    private validateJsonPath(expression: string): string | null {
        if (!expression.trim()) return 'JsonPath expression cannot be empty.';

        try {
            JSONPath({ path: expression, json: {} });
            return null;
        } catch (error: unknown) {
            if (error instanceof Error) {
                return `Invalid JsonPath expression: ${error.message}`;
            }
            return 'Invalid JsonPath expression: An unknown parsing error occurred.';
        }
    }

    private validateXPath(expression: string): string | null {
        if (!expression.trim()) return 'XPath expression cannot be empty.';

        try {
            // 1. Create a dummy document to act as the context node.
            const dummyDoc = new DOMParser().parseFromString('<dummyRoot/>', 'text/xml');

            // 2. Evaluate using ANY_TYPE. 
            evaluateXPath(expression, dummyDoc, null, null, evaluateXPath.ANY_TYPE);
            return null;
        } catch (error: unknown) {
            if (error instanceof Error) {
                return `Invalid XPath expression: ${error.message}`;
            }
            return 'Invalid XPath expression: An unknown parsing error occurred.';
        }
    }
    public async checkExpression(
        attrName: string,
        attrValue: string,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): Promise<vscode.Diagnostic | null> {
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
            const diagnostic = new vscode.Diagnostic(
                range,
                errorMessage,
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'Frank!Validator';
            return diagnostic;
        }

        return null;
    }
}