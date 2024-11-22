import { NotebookPanel } from '@jupyterlab/notebook';
import { ISignal } from '@lumino/signaling';
import { IDisposable } from '@lumino/disposable';
export interface IDict<T = any> {
  [key: string]: T;
}

export interface ISuggestionsModel extends IDisposable {
  filePath: string;
  switchNotebook(panel: NotebookPanel | null): Promise<void>;
  notebookSwitched: ISignal<ISuggestionsModel, void>;
}
