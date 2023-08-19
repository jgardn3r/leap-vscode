import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('leap-vscode.forwardSearch', () => { }));
	context.subscriptions.push(vscode.commands.registerCommand('leap-vscode.backwardSearch', () => { }));
}

export function deactivate() { }
