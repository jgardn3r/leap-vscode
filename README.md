# Leap for Visual Studio Code

This plugin provides an easy way to jump around with the cursor without using the mouse. It is based on leap.nvim.

## Features

The actions provided are:
* `leap-vscode.forwardSearch`
* `leap-vscode.backwardSearch`
* `leap-vscode.globalSearch`

Leap allows you to jump to any visible location by entering a two-character search pattern and subsequently its associated label.

## Simulating leap.nvim

While using a vim extension in vscode, to mimic leap.nvim you could:
* nnoremap "s" "leap-vscode.forwardSearch"
* nnoremap "S" "leap-vscode.backwardSearch"
* nnoremap "gs" "leap-vscode.globalSearch"

## Future Plans

There are some features of leap.nvim that would do well in this extension. Namely:
* Removing the label for the first match
* Repeating labels for matches that will be disambiguated after the second character
* Adding the sets of results and the ability to toggle back and forth with `Space` and `Tab` rather than having to enter two labels

## Release Notes

## 0.1.0
Initial version. Implements basic leap functionality.