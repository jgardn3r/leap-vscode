import * as vscode from 'vscode';
import { SearchOption, Widget } from './widget';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('leap-vscode.forwardSearch', () => {
		let widget = new Widget(context, new Set([SearchOption.forward]));
		widget.show();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('leap-vscode.backwardSearch', () => {
		let widget = new Widget(context, new Set([SearchOption.backward]));
		widget.show();
	}));
}

export function deactivate() { }
