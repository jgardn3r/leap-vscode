import * as vscode from 'vscode';

const MIN_SEARCH_LEN = 1;
const SEARCH_CHAR_LEN = 2;
const LABEL_CONTEXT_SIZE = 4;
const LABEL_LEN = LABEL_CONTEXT_SIZE - SEARCH_CHAR_LEN;

export enum SearchOption {
    forward,
    backward,
    allEditors,
}

export class Widget implements vscode.Disposable {
    private readonly quickPick: vscode.QuickPick<vscode.QuickPickItem>;
    private readonly searchOptions: Set<SearchOption>;

    private lastLabelLength = 0;
    private labels = new Map<string, string>();
    private visibleDecorations = new Map<string, vscode.TextEditorDecorationType>();

    constructor(context: vscode.ExtensionContext, searchOptions: Set<SearchOption>) {
        this.quickPick = vscode.window.createQuickPick();
        this.quickPick.onDidChangeValue(searchString => {
            this.updateLabels(searchString);
        });
        this.quickPick.onDidAccept(() => {
            const searchString = this.quickPick.value;
            const matchingRanges = this.getMatchingRanges(searchString);

            if (searchString.length > 0 && matchingRanges.length > 0) {
                let [editor, range] = matchingRanges[0];
                editor.selections = [new vscode.Selection(range.start, range.start)];
            }
            this.dispose();
        });
        this.quickPick.onDidHide(() => {
            this.dispose();
        });
        this.searchOptions = searchOptions;
    }

    show(): void {
        this.quickPick.show();
    }

    dispose(): void {
        this.clearLabels();
        this.quickPick.dispose();
    }

    private getRangeStringKey(rangeKey: [vscode.TextEditor, vscode.Range]): string {
        return JSON.stringify(rangeKey);
    }

    private getLabel(rangeKey: [vscode.TextEditor, vscode.Range], size?: number): string | undefined {
        const label = this.labels.get(this.getRangeStringKey(rangeKey));
        return label?.substring(0, size ?? label.length);
    }

    private setLabel(rangeKey: [vscode.TextEditor, vscode.Range], label: string) {
        this.labels.set(this.getRangeStringKey(rangeKey), label);
    }

    private setVisibleLabel(rangeKey: [vscode.TextEditor, vscode.Range], decoration: vscode.TextEditorDecorationType) {
        this.visibleDecorations.set(this.getRangeStringKey(rangeKey), decoration);
    }

    private clearLabels() {
        this.visibleDecorations.forEach(decoration => decoration.dispose());
        this.visibleDecorations.clear();
        this.labels.clear();
    }

    private updateLabels(searchString: string): void {
        if (searchString.length < MIN_SEARCH_LEN) {
            this.clearLabels();
            return;
        }
        this.updateVisibleLabels(searchString);
    }

    private updateVisibleLabels(searchString: string) {
        if (this.labels.size === 0) {
            this.createLabels(searchString);
        }

        const labelLength = Math.max(searchString.length - SEARCH_CHAR_LEN, 0) + 1;
        const matchingRanges = this.getMatchingRanges(searchString);

        if (matchingRanges.length === 1) {
            let [editor, range] = matchingRanges[0];
            if (editor.viewColumn) {
                vscode.window.showTextDocument(editor.document, editor.viewColumn);
                editor.selections = [new vscode.Selection(range.start, range.start)];
            } else {
                // If the target editors viewColumn is undefined, it could be a diff editor
                (async () => {
                    await this.changeToDiffEditor(editor);
                    editor.selections = [new vscode.Selection(range.start, range.start)];
                })();
            }
            this.dispose();
            return;
        }

        if (this.lastLabelLength !== labelLength) {
            this.visibleDecorations.forEach(decoration => decoration.dispose());
            this.visibleDecorations.clear();
        }
        this.lastLabelLength = labelLength;
        const matchingRangesKeys = matchingRanges.map(this.getRangeStringKey);
        for (const visibleDecoration of this.visibleDecorations.keys()) {
            if (!matchingRangesKeys.includes(visibleDecoration)) {
                this.visibleDecorations.get(visibleDecoration)?.dispose();
                this.visibleDecorations.delete(visibleDecoration);
            }
        }

        for (const rangeKey of matchingRanges) {
            if (!this.visibleDecorations.has(this.getRangeStringKey(rangeKey))) {
                const [editor, range] = rangeKey;
                const decoration = this.createDecoration(this.getLabel(rangeKey, labelLength) ?? "");
                editor.setDecorations(decoration, [{ range: range }]);
                this.setVisibleLabel(rangeKey, decoration);
            }
        }
    }

    private async changeToDiffEditor(editor: vscode.TextEditor) {
        type DiffInput = {
            original: vscode.Uri,
            modified: vscode.Uri,
        };
        const isDiffEditor = (tab: vscode.Tab): boolean => {
            return tab !== undefined
                && tab.input !== undefined
                && tab.input !== null
                && tab.input.hasOwnProperty('original')
                && tab.input.hasOwnProperty('modified');
        };
        const editorHasDiffInput = (input: DiffInput): boolean => {
            return input.modified.path === editor.document.uri.path
                || input.original.path === editor.document.uri.path;
        };
        const VIEW_EDITOR_COUNT = vscode.window.tabGroups.all.length;
        for (const [tabGroup, tab] of
            vscode.window.tabGroups.all.map(
                (tabGroup) => [tabGroup, tabGroup.activeTab] as [vscode.TabGroup, vscode.Tab])) {
            if (!isDiffEditor(tab)) {
                continue;
            }
            const input = tab.input as DiffInput;
            if (!editorHasDiffInput(input)) {
                continue;
            }

            let count = 0;
            while (vscode.window.tabGroups.activeTabGroup !== tabGroup) {
                if (count >= VIEW_EDITOR_COUNT) {
                    // Failed to find to the tab group
                    return;
                }
                await vscode.commands.executeCommand('workbench.action.navigateEditorGroups');
                count++;
            }
            const DIFF_SIDE_COUNT = 3;
            count = 0;
            while (JSON.stringify(vscode.window.activeTextEditor?.document.uri) !== JSON.stringify(editor.document.uri)) {
                if (count >= DIFF_SIDE_COUNT) {
                    // Failed to find the correct side of diff
                    return;
                }
                await vscode.commands.executeCommand('diffEditor.switchSide');
                count++;
            }
        }
    }

    private getRelevantTextEditors(): readonly vscode.TextEditor[] {
        if (this.searchOptions.has(SearchOption.allEditors)) {
            return vscode.window.visibleTextEditors;
        }
        const activeTextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor !== undefined) {
            return [activeTextEditor];
        }
        return [];
    }

    private getVisibleLines(): [vscode.TextEditor, vscode.TextLine][] {
        return this.getRelevantTextEditors()
            .flatMap((editor) => editor.visibleRanges.map(range => [editor, range] as [vscode.TextEditor, vscode.Range]))
            .flatMap(([editor, range]: [vscode.TextEditor, vscode.Range]) =>
                Array.from(
                    { length: range.end.line - range.start.line + 1 },
                    (_, i) => i + range.start.line
                ).map(range => [editor, range] as [vscode.TextEditor, number])
            )
            .map(([editor, lineNumber]: [vscode.TextEditor, number]) => [editor, editor.document.lineAt(lineNumber)]);
    }

    private isRelevantRange(
        searchLabelChars: string,
        labelChars: string,
        [editor, range]: [vscode.TextEditor, vscode.Range]
    ): boolean {
        if (labelChars.indexOf(searchLabelChars) !== 0) {
            return false;
        }
        if (!this.searchOptions.has(SearchOption.backward)
            && editor === vscode.window.activeTextEditor
            && editor.selection.start.isAfter(range.start)) {
            return false;
        }
        if (!this.searchOptions.has(SearchOption.forward)
            && editor === vscode.window.activeTextEditor
            && editor.selection.end.isBefore(range.start)) {
            return false;
        }
        return true;
    }

    private isCaseSensitiveSearch(searchString: string): boolean {
        return searchString.toLowerCase() !== searchString;
    }

    private getMatchingRanges(searchString: string): [vscode.TextEditor, vscode.Range][] {
        let ranges = [];
        let searchingChars = searchString.substring(0, SEARCH_CHAR_LEN);
        let caseSensitiveSearch = this.isCaseSensitiveSearch(searchingChars);
        const searchLabelChars = searchString.substring(SEARCH_CHAR_LEN, searchString.length).toLowerCase();
        for (const [editor, line] of this.getVisibleLines()) {
            let lineText = line.text + ' ';
            if (!caseSensitiveSearch) {
                lineText = lineText.toLowerCase();
            }

            const firstCharPos = lineText.length - lineText.trimStart().length;
            let lastPosition = lineText.indexOf(searchingChars, firstCharPos);
            while (lastPosition >= 0) {
                const range = new vscode.Range(
                    new vscode.Position(line.lineNumber, lastPosition),
                    new vscode.Position(line.lineNumber, lastPosition + LABEL_CONTEXT_SIZE)
                );
                const rangeKey = [editor, range] as [vscode.TextEditor, vscode.Range];
                const labelChars = this.getLabel(rangeKey) ?? "";

                lastPosition = lineText.indexOf(searchingChars, lastPosition + 1);

                if (this.isRelevantRange(searchLabelChars, labelChars, rangeKey)) {
                    ranges.push(rangeKey);
                }
            }

            if (searchingChars.match(/^ +/)?.length) {
                const eolRange = new vscode.Range(
                    new vscode.Position(line.lineNumber, line.text.length),
                    new vscode.Position(line.lineNumber, line.text.length + 1)
                );
                const eolRangeKey = [editor, eolRange] as [vscode.TextEditor, vscode.Range];
                const labelChars = this.getLabel(eolRangeKey) ?? "";
                if (this.isRelevantRange(searchLabelChars, labelChars, eolRangeKey)) {
                    ranges.push(eolRangeKey);
                }
            }
        }
        return ranges;
    }

    private createLabels(searchString: string) {
        for (const rangeKey of this.getMatchingRanges(searchString)) {
            this.setLabel(rangeKey, this.getNewLabel());
        }
    }

    private getNewLabel(): string {
        const letterLabels = "abcdefghijklmnopqrstuvwxyz";
        let labelNumber = this.labels.size;
        let label = letterLabels[labelNumber % letterLabels.length];
        labelNumber = Math.floor(labelNumber / letterLabels.length);
        for (let place = 0; place < LABEL_LEN; place++) {
            label += letterLabels[labelNumber % letterLabels.length];
            labelNumber = Math.floor(labelNumber / letterLabels.length);
        }
        return label;
    }

    private createDecoration(label: string): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            before: {
                contentText: label,
                color: 'var(--vscode-editor-background)',
                backgroundColor: 'var(--vscode-editor-foreground)',
                fontWeight: 'bold',
                border: '0',
                margin: `0 ${SEARCH_CHAR_LEN}ch;
                position: absolute;
                `
            }
        });
    }
}
