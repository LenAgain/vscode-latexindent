# latexindent

A minimal Visual Studio Code extension providing support for LaTeX formatting via [latexindent](https://github.com/cmhughes/latexindent.pl).

## Requirements

This extension doesn't come with latexindent bundled and therefore requires an executable to be available.

latexindent is included with most major TeX distributions but can be installed as a standalone script. Please refer to the [latexindent documentation](https://latexindentpl.readthedocs.io/en/latest/sec-how-to-use.html#requirements) for installation instructions.

## Usage

This extension supports formatting whole documents and selections. To enable formatting on-save see the [VS Code docs](https://code.visualstudio.com/docs/editor/codebasics#_formatting).

## Settings
| Setting                         | Type             | Default       | Description                                            |
|---------------------------------|------------------|---------------|--------------------------------------------------------|
| `latexindent.executable`        | String           | `latexindent` | The path to the `latexindent` executable.              |
| `latexindent.args`              | Array of strings | `[]`          | Additional arguments to pass to `latexindent`.         |
| `latexindent.useDocumentFormat` | Boolean          | `false`       | Whether to use the editor tabsize to format documents. |
