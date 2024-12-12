import { CellList, Notebook, NotebookPanel } from '@jupyterlab/notebook';
import {
  IAllSuggestionViewData,
  IAllSuggestionData,
  IDict,
  ISuggestionChange,
  ISuggestionViewData,
  ISuggestionData,
  ISuggestionsManager,
  ISuggestionsModel
} from '../types';
import { ISignal, Signal } from '@lumino/signaling';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { IObservableList } from '@jupyterlab/observables';
import { User } from '@jupyterlab/services';
import { ISharedCell, ISharedNotebook, NotebookChange } from '@jupyter/ydoc';
import { PromiseDelegate } from '@lumino/coreutils';
export class SuggestionsModel implements ISuggestionsModel {
  constructor(options: SuggestionsModel.IOptions) {
    this._userManager = options.userManager;
    this.switchNotebook(options.panel);
    this.switchManager(options.suggestionsManager);
  }

  get sourceLiveUpdate(): boolean {
    return Boolean(this._suggestionsManager?.sourceLiveUpdate);
  }
  get filePath(): string {
    return this._filePath ?? '';
  }
  get allSuggestionsChanged(): ISignal<ISuggestionsModel, void> {
    return this._allSuggestionsChanged;
  }
  get activeCellChanged(): ISignal<ISuggestionsModel, { cellId?: string }> {
    return this._activeCellChanged;
  }
  get suggestionChanged(): ISignal<
    ISuggestionsModel,
    Omit<ISuggestionChange, 'notebookPath'>
  > {
    return this._suggestionChanged;
  }
  get currentNotebookPanel(): NotebookPanel | null {
    return this._notebookPanel;
  }
  get isDisposed(): boolean {
    return this._isDisposed;
  }
  get allSuggestions(): IAllSuggestionViewData | undefined {
    return this._allSuggestions;
  }
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._suggestionsManager?.suggestionChanged.disconnect(
      this._handleSuggestionChanged
    );
    Signal.clearData(this);
  }

  getSuggestionManagerName(): string {
    return this._suggestionsManager?.name ?? '';
  }
  async addSuggestion(): Promise<void> {
    const activeCell = this._notebookPanel?.content.activeCell;
    if (activeCell && this._notebookPanel && this._suggestionsManager) {
      await this._suggestionsManager.addSuggestion({
        notebook: this._notebookPanel,
        cell: activeCell,
        author: this._userManager.identity
      });
    }
  }
  async deleteSuggestion(options: {
    cellId?: string;
    suggestionId: string;
  }): Promise<void> {
    const { cellId, suggestionId } = options;
    if (cellId && this._notebookPanel) {
      if (this._suggestionsManager) {
        await this._suggestionsManager.deleteSuggestion({
          notebook: this._notebookPanel,
          cellId,
          suggestionId
        });
      }
      if (this._allSuggestions && this._allSuggestions.has(cellId)) {
        const cellSuggestions = this._allSuggestions.get(cellId)!;
        delete cellSuggestions[suggestionId];
      }
    }
  }

  async acceptSuggestion(options: {
    cellId?: string;
    suggestionId: string;
  }): Promise<boolean> {
    const { cellId, suggestionId } = options;
    if (cellId && this._notebookPanel && this._suggestionsManager) {
      return await this._suggestionsManager.acceptSuggestion({
        notebook: this._notebookPanel,
        cellId,
        suggestionId
      });
    }
    return false;
  }
  async updateSuggestion(options: {
    cellId?: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void> {
    const { cellId, suggestionId, newSource } = options;
    if (cellId && this._notebookPanel && this._suggestionsManager) {
      await this._suggestionsManager.updateSuggestion({
        notebook: this._notebookPanel,
        cellId,
        suggestionId,
        newSource
      });
    }
  }
  async getSuggestion(options: {
    cellId: string;
    suggestionId: string;
  }): Promise<ISuggestionViewData | undefined> {
    if (!this._filePath || !this._suggestionsManager) {
      return;
    }
    const { cellId, suggestionId } = options;
    let cellSuggestions: IDict<ISuggestionViewData> | undefined = undefined;
    if (!this._allSuggestions?.has(cellId)) {
      cellSuggestions = {};
      this._allSuggestions?.set(cellId, cellSuggestions);
    } else {
      cellSuggestions = this._allSuggestions.get(cellId)!;
    }
    if (!cellSuggestions[suggestionId]) {
      const suggestionFromManager =
        await this._suggestionsManager.getSuggestion({
          notebookPath: this._filePath,
          ...options
        });
      const suggestionData = this._convertSuggestionFromManager(
        suggestionFromManager
      );
      if (suggestionData) {
        cellSuggestions[suggestionId] = suggestionData;
      }
    }
    return cellSuggestions[suggestionId];
  }

  getActiveCell(): Cell<ICellModel> | null | undefined {
    return this._notebookPanel?.content.activeCell;
  }
  getCellIndex(cellId?: string): number {
    if (!cellId) {
      return -1;
    }

    const allCells = this._notebookPanel?.content.model?.cells;
    if (!allCells) {
      return -1;
    }
    for (let idx = 0; idx < allCells.length; idx++) {
      const element = allCells.get(idx);
      if (element.id === cellId) {
        return idx;
      }
    }
    return -1;
  }
  async switchNotebook(panel: NotebookPanel | null): Promise<void> {
    if (panel) {
      await panel.context.ready;
      this._disconnectPanelSignal();
      this._notebookPanel = panel;
      this._connectPanelSignal();
      this._filePath = this._notebookPanel?.context.localPath;

      const allSuggestionsFromManager =
        await this._suggestionsManager?.getAllSuggestions(panel);
      this._allSuggestions = this._convertAllSuggestionsFromManager(
        allSuggestionsFromManager
      );
    } else {
      this._allSuggestions = undefined;
    }
    this._allSuggestionsChanged.emit();
  }
  async switchManager(manager: ISuggestionsManager | undefined): Promise<void> {
    if (!manager) {
      return;
    }
    this._suggestionsManager?.suggestionChanged.disconnect(
      this._handleSuggestionChanged
    );

    this._suggestionsManager = manager;
    this._suggestionsManager.suggestionChanged.connect(
      this._handleSuggestionChanged,
      this
    );
    if (this._notebookPanel) {
      const allSuggestionsFromManager =
        await this._suggestionsManager?.getAllSuggestions(this._notebookPanel);
      this._allSuggestions = this._convertAllSuggestionsFromManager(
        allSuggestionsFromManager
      );
      this._allSuggestionsChanged.emit();
    }
  }

  private _convertSuggestionFromManager(
    source?: ISuggestionData
  ): ISuggestionViewData | undefined {
    if (!source || !this._notebookPanel) {
      return;
    }
    const { originalCellId, metadata, cellModel } = source;
    const cells = this._notebookPanel.context.model.cells;
    for (const it of cells) {
      if (it.id === originalCellId) {
        return {
          cellModel,
          originalCellModel: it,
          metadata
        };
      }
    }
  }

  private _convertAllSuggestionsFromManager(
    all?: IAllSuggestionData | undefined
  ): IAllSuggestionViewData | undefined {
    if (!all || !this._notebookPanel) {
      return;
    }
    const newMap: IAllSuggestionViewData = new Map();
    all.forEach((suggestionDict, key) => {
      const newDict: IDict<ISuggestionViewData> = {};
      for (const suggestionKey in suggestionDict) {
        const convertedData = this._convertSuggestionFromManager(
          suggestionDict[suggestionKey]
        );
        if (convertedData) {
          newDict[suggestionKey] = convertedData;
        }
      }
      newMap.set(key, newDict);
    });
    return newMap;
  }
  private _connectPanelSignal() {
    if (!this._notebookPanel) {
      return;
    }
    this._notebookPanel.content.activeCellChanged.connect(
      this._handleActiveCellChanged,
      this
    );

    this._notebookPanel.content.model?.cells.changed.connect(
      this._handleCellListChanged,
      this
    );
    this._notebookPanel.content.model?.sharedModel.changed.connect(
      this._handleNotebookChanged,
      this
    );
  }

  private _disconnectPanelSignal() {
    if (!this._notebookPanel) {
      return;
    }
    this._notebookPanel.content.activeCellChanged.disconnect(
      this._handleActiveCellChanged
    );
    this._notebookPanel.content.model?.cells.changed.disconnect(
      this._handleCellListChanged
    );
  }
  private _handleActiveCellChanged(
    nb: Notebook,
    cell: Cell<ICellModel> | null
  ) {
    this._activeCellChanged.emit({ cellId: cell?.model.id });
  }
  private async _handleNotebookChanged(
    _: ISharedNotebook,
    changed: NotebookChange
  ) {
    const { cellsChange } = changed;
    if (cellsChange) {
      let haveDelete = false;
      let haveInsert: ISharedCell[] | undefined;
      for (const c of cellsChange) {
        if (c.delete !== undefined) {
          haveDelete = true;
        }
        if (c.insert !== undefined) {
          haveInsert = c.insert;
        }
      }
      const cellMap: IDict<ICellModel> = {};
      [...(this._notebookPanel?.model?.cells ?? [])].forEach(it => {
        cellMap[it.id] = it;
      });

      if (!haveInsert && haveDelete) {
        // Cell deleted
        const cellInNotebook = new Set(Object.keys(cellMap));
        const cellInModel = [...(this._allSuggestions?.keys() ?? [])];
        const removedElements = cellInModel.filter(
          el => !cellInNotebook.has(el)
        );
        for (const removed of removedElements) {
          const suggestions = this._allSuggestions?.get(removed) ?? {};
          for (const suggestionId in suggestions) {
            await this.deleteSuggestion({ cellId: removed, suggestionId });
          }
        }
      }
      if (haveInsert && haveDelete) {
        // Cell moved
        const movedCells = haveInsert;
        let needEmit = false;
        for (const cell of movedCells) {
          const cellId = cell.id;
          if (!this._queue[cellId]) {
            this._queue[cellId] = new PromiseDelegate<void>();
          }
          const pd = this._queue[cellId];
          if (this._allSuggestions?.has(cellId)) {
            const cellSuggestions = this._allSuggestions.get(cellId)!;
            const allSuggestions = Object.entries(cellSuggestions);
            const originalCell = cellMap[cellId];
            let shouldWait = false;
            if (originalCell && allSuggestions.length > 0) {
              needEmit = true;
              allSuggestions.forEach(([suggestionId, it]) => {
                it.originalCellModel = originalCell;
                shouldWait = it.cellModel.sharedModel.isStandalone;
              });
              if (shouldWait) {
                await pd.promise;
              }
            }
          }

          delete this._queue[cellId];
        }
        if (needEmit) {
          this._allSuggestionsChanged.emit();
        }
      }
    }
  }
  private async _handleCellListChanged(
    cellList: CellList,
    changed: IObservableList.IChangedArgs<ICellModel>
  ) {
    // console.log('changed', changed);
    // switch (changed.type) {
    //   case 'remove': {
    //     const cellInNotebook = new Set([...cellList].map(it => it.id));
    //     const cellInModel = [...(this._allSuggestions?.keys() ?? [])];
    //     console.log('cellInNotebook', cellInNotebook);
    //     console.log('cellInModel', cellInModel);
    //     const removedElements = cellInModel.filter(
    //       el => !cellInNotebook.has(el)
    //     );
    //     for (const removed of removedElements) {
    //       const suggestions = this._allSuggestions?.get(removed) ?? {};
    //       for (const suggestionId in suggestions) {
    //         await this.deleteSuggestion({ cellId: removed, suggestionId });
    //       }
    //     }
    //     break;
    //   }
    //   case 'add': {
    //     const newCells = changed.newValues;
    //     let needEmit = false;
    //     for (const cell of newCells) {
    //       const id = cell.id;
    //       if (this._allSuggestions?.has(id)) {
    //         const cellSuggestions = this._allSuggestions.get(id)!;
    //         const allSuggestions = Object.values(cellSuggestions);
    //         needEmit = allSuggestions.length > 0;
    //         allSuggestions.forEach(it => {
    //           console.log(
    //             'updating original source',
    //             cell.sharedModel.getSource()
    //           );
    //           it.originalCellModel = cell;
    //         });
    //       }
    //     }
    //     if (needEmit) {
    //       this._allSuggestionsChanged.emit();
    //     }
    //     break;
    //   }
    //   default:
    //     break;
    // }
  }
  private _handleSuggestionChanged(
    manager: ISuggestionsManager,
    changed: ISuggestionChange
  ) {
    const { notebookPath, ...newChanged } = changed;
    if (notebookPath === this._filePath) {
      if (changed.operator === 'modified') {
        const { cellId, suggestionId, modifiedData } = changed;
        if (this._allSuggestions?.has(cellId)) {
          const cellSuggestions = this._allSuggestions.get(cellId)!;
          const updatedSuggestion = cellSuggestions[suggestionId];
          if (updatedSuggestion && modifiedData) {
            if (modifiedData.cellModel) {
              updatedSuggestion.cellModel = modifiedData.cellModel;
            }
            if (modifiedData.metadata) {
              updatedSuggestion.metadata = modifiedData.metadata;
            }
          }
        }
        if (!this._queue[cellId]) {
          this._queue[cellId] = new PromiseDelegate<void>();
        }
        const pd = this._queue[cellId];
        pd.resolve();
      } else {
        this._suggestionChanged.emit(newChanged);
      }
    }
  }

  private _isDisposed = false;
  private _filePath?: string;
  private _notebookPanel: NotebookPanel | null = null;
  private _allSuggestionsChanged: Signal<this, void> = new Signal(this);
  private _allSuggestions?: IAllSuggestionViewData;
  private _suggestionsManager?: ISuggestionsManager;
  private _userManager: User.IManager;
  private _suggestionChanged = new Signal<
    ISuggestionsModel,
    Omit<ISuggestionChange, 'notebookPath'>
  >(this);
  private _activeCellChanged = new Signal<
    ISuggestionsModel,
    { cellId?: string }
  >(this);

  private _queue: IDict<PromiseDelegate<void>> = {};
}

export namespace SuggestionsModel {
  export interface IOptions {
    panel: NotebookPanel | null;
    suggestionsManager?: ISuggestionsManager;
    userManager: User.IManager;
  }
}
