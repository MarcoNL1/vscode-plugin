"use strict";
const assert = Promise.resolve().then(() => require('assert'));
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = Promise.resolve().then(() => require('vscode'));
// const myExtension = require('../extension');
suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });
});
//# sourceMappingURL=extension.test.js.map