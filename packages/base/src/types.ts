import { NotebookPanel } from '@jupyterlab/notebook';
import { ISignal } from '@lumino/signaling';
import { IDisposable } from '@lumino/disposable';
export interface IDict<T = any> {
  [key: string]: T;
}

export interface ISuggestionsModel extends IDisposable {
  filePath: string;
  currentNotebookPanel: NotebookPanel | null;
  allSuggestions: IDict | undefined;
  notebookSwitched: ISignal<ISuggestionsModel, void>;
  switchNotebook(panel: NotebookPanel | null): Promise<void>;
  addSuggestion(): void;
}

export interface ISuggestionsManager extends IDisposable {
  getAllSuggestions(notebook: NotebookPanel): IDict | undefined;
}
