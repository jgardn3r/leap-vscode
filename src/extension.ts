import * as vscode from 'vscode';
import { SearchOption, Widget } from './widget';

export function activate(context: vscode.ExtensionContext) {
    // vscode.commands.registerTextEditorCommand('asdf', (textEditor, textEditorEdit) => {
    //     textEditor.
    // });
    context.subscriptions.push(vscode.commands.registerCommand('leap-vscode.forwardSearch', () => {
        let widget = new Widget(context, new Set([SearchOption.forward]));
        widget.show();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('leap-vscode.backwardSearch', () => {
        let widget = new Widget(context, new Set([SearchOption.backward]));
        widget.show();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('leap-vscode.globalSearch', () => {
        let widget = new Widget(context, new Set([
            SearchOption.forward,
            SearchOption.backward,
            SearchOption.allEditors
        ]));
        widget.show();
    }));
}

export function deactivate() { }
