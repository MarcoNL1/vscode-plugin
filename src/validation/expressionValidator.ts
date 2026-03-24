import * as vscode from 'vscode';
import { JSONPath } from 'jsonpath-plus';
import { evaluateXPath } from 'fontoxpath'

export class ExpressionValidator {


    private attributeValidators: Record<string, (expression: string) => string | null> = {
        'jsonPath': (expr) => this.validateJsonPath(expr),
        'xpathExpression': (expr) => this.validateXPath(expr)
    };

    private validateJsonPath(expression: string) : string | null {
        try {
            JSONPath({ path: expression, json: {} });
            return null;
        } catch (error: any) {
            return `Invalid JsonPath expression: ${error.message}`;
        }
    }

    private validateXPath(expression: string) : string | null {
        try {
            evaluateXPath(expression, null, null, null, evaluateXPath.BOOLEAN_TYPE);
            return null;
        } catch (error: any) {
            return `Invalid XPath expression: ${error.message}`;
        }
    }


    public checkExpression(
        attrName: string,
        attrValue: string,
        range: vscode.Range
    ): vscode.Diagnostic | null {
        const validator = this.attributeValidators[attrName];
        if (!validator) {
            return null;
        }

    const errorMessage = validator(attrValue);
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