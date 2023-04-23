import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

import * as vscode from 'vscode';

const LATEX_MODE: vscode.DocumentSelector = { scheme: 'file', language: 'latex' };

export function activate(context: vscode.ExtensionContext) {
	const formatter = new LatexFormatter();

	context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(LATEX_MODE, formatter));
	context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(LATEX_MODE, formatter));
}

class LatexFormatter implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {

	#process: ChildProcessWithoutNullStreams | undefined;

	logger: vscode.LogOutputChannel;

	constructor() {
		this.logger = vscode.window.createOutputChannel('latexindent', { log: true });
		this.logger.info('Extension activated');
	}

	async provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): Promise<vscode.TextEdit[]> {
		return await this.formatDocument(document, options, token);
	}

	async provideDocumentRangeFormattingEdits(
		document: vscode.TextDocument,
		range: vscode.Range,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): Promise<vscode.TextEdit[]> {
		return await this.formatDocument(document, options, token, range);
	}

	async formatDocument(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken,
		range?: vscode.Range,
	): Promise<vscode.TextEdit[]> {

		this.logger.info('Formatting', document.fileName);

		const config = vscode.workspace.getConfiguration('latexindent', document);

		const executable: string = config.get('executable', 'latexindent');
		const args: string[] = config.get('args', []).slice();

		if (range) {
			args.push(`-lines=${range.start.line + 1}-${range.end.line + 1}`);
		}

		if (config.get('useDocumentFormat')) {
			const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
			args.push(`-yaml="defaultIndent: '${indent}'"`);
		}

		// Take input from stdin
		args.push('-');

		const text = document.getText();

		// Use the workspace root folder if we're in a workspace,
		// otherwise the parent directory of our document
		const cwd = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ?? path.dirname(document.fileName);

		if (this.#process?.exitCode === null) {
			this.#process.kill();
		}

		token.onCancellationRequested(() => {
			this.logger.info('Cancellation has been requested, killing latexindent process');
			if (this.#process?.exitCode === null) {
				this.#process.kill();
			}
		});

		let stdout: string;
		try {
			stdout = await this.spawnProcess(executable, args, cwd, text);
		} catch {
			return [];
		}

		const fullRange = document.validateRange(new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE));

		return [vscode.TextEdit.replace(fullRange, stdout)];
	}

	private spawnProcess(executable: string, args: string[], cwd: string, stdin: string): Promise<string> {
		return new Promise((resolve, reject) => {

			const startTime = process.hrtime.bigint();

			this.logger.info('Spawning latexindent process:', executable, args.join(' '));

			const child = this.#process = spawn(executable, args, { cwd: cwd });

			this.logger.debug('Writing to process stdin:', stdin);
			child.stdin.write(stdin);
			child.stdin.end();

			child.stderr.setEncoding('utf8');
			child.stdout.setEncoding('utf8');

			let stdout = '';

			child.stdout.on('data', (data: string) => {
				this.logger.debug('Received stdout:', data);
				stdout += data;
			});

			child.stderr.on('data', (data: string) => {
				this.logger.warn('Unexpected stderr from latexindent:', data);
			});

			child.on('error', (error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') {
					this.logger.error("Can't find specified latexindent executable:", executable);

					vscode.window.showErrorMessage("Can't find the specified latexindent executable. Check that it's in your PATH or that the provided path is correct.");

					reject(error);
				} else {
					this.logger.error('Unexpected latexindent error:', error);
					reject(error);
				}
			});

			child.on('exit', code => {
				const endTime = process.hrtime.bigint();
				const durationMs = (endTime - startTime) / BigInt(1_000_000);

				this.logger.info(`latexindent exited with code ${code} in ${durationMs}ms`);

				// Exit code 1 is seen when -check or -checkv switches are passed and the indented text differs from the original
				// https://latexindentpl.readthedocs.io/en/latest/sec-how-to-use.html#id3
				if (code !== null && code <= 1) {
					resolve(stdout);
				}

				reject(code);
			});
		});
	}
}
