import type { WebviewMessage } from './types';

interface VsCodeApi {
  postMessage(msg: WebviewMessage): void;
  getState(): any;
  setState(state: any): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export const vscode: VsCodeApi = acquireVsCodeApi();
