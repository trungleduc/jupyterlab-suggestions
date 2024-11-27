import { NotebookPanel } from '@jupyterlab/notebook';
import { ISignal } from '@lumino/signaling';
import { IDisposable } from '@lumino/disposable';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { ICell } from '@jupyterlab/nbformat';
export interface IDict<T = any> {
  [key: string]: T;
}

export interface ISuggestionsModel extends IDisposable {
  filePath: string;
  currentNotebookPanel: NotebookPanel | null;
  allSuggestions: IAllSuggestions | undefined;
  notebookSwitched: ISignal<ISuggestionsModel, void>;
  activeCellChanged: ISignal<ISuggestionsModel, { cellId?: string }>;
  suggestionChanged: ISignal<
    ISuggestionsModel,
    Omit<ISuggestionChange, 'notebookPath'>
  >;
  switchNotebook(panel: NotebookPanel | null): Promise<void>;
  addSuggestion(): void;
  getSuggestion(options: {
    cellId: string;
    suggestionId: string;
  }): { content: ICell } | undefined;
}

export interface ISuggestionChange {
  notebookPath: string;
  cellId: string;
  operator: 'added' | 'deleted' | 'modified';
  suggestionId: string;
}
export type IAllSuggestions = Map<string, IDict<{ content: ICell }>>;

export interface ISuggestionsManager extends IDisposable {
  getAllSuggestions(notebook: NotebookPanel): IAllSuggestions | undefined;
  addSuggestion(options: {
    notebook: NotebookPanel;
    cell: Cell<ICellModel>;
  }): Promise<string>;
  suggestionChanged: ISignal<ISuggestionsManager, ISuggestionChange>;
  getSuggestion(options: {
    notebookPath: string;
    cellId: string;
    suggestionId: string;
  }): { content: ICell } | undefined;
}
