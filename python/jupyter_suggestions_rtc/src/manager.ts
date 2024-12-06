import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import {
  IAllSuggestions,
  ISuggestionChange,
  ISuggestionData,
  ISuggestionsManager
} from '@jupyter/jupyter-suggestions-base';
import { ISignal, Signal } from '@lumino/signaling';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { IForkManager, requestAPI } from '@jupyter/docprovider';
import { ICollaborativeDrive } from '@jupyter/collaborative-drive';
import { WebsocketProvider as YWebsocketProvider } from 'y-websocket';

import { URLExt } from '@jupyterlab/coreutils';
const DOCUMENT_PROVIDER_URL = 'api/collaboration/room';

export class RtcSuggestionsManager implements ISuggestionsManager {
  constructor(options: RtcSuggestionsManager.IOptions) {
    this._tracker = options.tracker;
    this._forkManager = options.forkManager;
    this._drive = options.drive;
    this._serverUrl = URLExt.join(
      this._drive.serverSettings.wsUrl,
      DOCUMENT_PROVIDER_URL
    );
    console.log(this._tracker);
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get suggestionChanged(): ISignal<ISuggestionsManager, ISuggestionChange> {
    return this._suggestionChanged;
  }
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    Signal.clearData(this);
    this._isDisposed = true;
  }

  async getAllSuggestions(
    notebook: NotebookPanel
  ): Promise<IAllSuggestions | undefined> {
    if (!this._serverSession) {
      const res = await requestAPI<{ sessionId: string }>(
        URLExt.join('api/collaboration/session/'),
        {
          method: 'GET'
        }
      );
      this._serverSession = res.sessionId;
    }
    const rootDocId = notebook.context.model.sharedModel.getState(
      'document_id'
    ) as string;
    const [format, type, _] = rootDocId.split(':');
    const allForks = await this._forkManager.getAllForks(rootDocId);
    Object.keys(allForks).forEach(forkRoomId => {
      console.log('getting', format, type, forkRoomId);
      const sharedModelFactory =
        this._drive.sharedModelFactory.documentFactories.get(type);
      if (sharedModelFactory) {
        const shared = sharedModelFactory({
          path: forkRoomId,
          format: format as any,
          contentType: type,
          collaborative: true
        });

        const _yWebsocketProvider = new YWebsocketProvider(
          this._serverUrl,
          forkRoomId,
          shared.ydoc,
          {
            disableBc: true,
            params: { sessionId: this._serverSession! },
            awareness: shared.awareness
          }
        );
        console.log('FOKRED', shared, _yWebsocketProvider);
        _yWebsocketProvider.on('sync', (isSynced: boolean) => {
          console.log('isSynced', isSynced);
        });
      }
    });

    console.log('session', rootDocId, allForks);
    return;
  }

  async getSuggestion(options: {
    notebookPath: string;
    cellId: string;
    suggestionId: string;
  }): Promise<ISuggestionData | undefined> {
    return;
  }
  async addSuggestion(options: {
    notebook: NotebookPanel;
    cell: Cell<ICellModel>;
  }): Promise<string> {
    const rootId = options.notebook.context.model.sharedModel.getState(
      'document_id'
    ) as string;
    const [format, contentType, _] = rootId.split(':');
    const response = await this._forkManager.createFork({
      rootId,
      synchronize: false
    });
    if (response?.fork_roomid) {
      console.log('adding', options, rootId, response);
      const sharedModel = this._drive.sharedModelFactory.createNew({
        path: response.fork_roomid,
        format: format as any,
        contentType
      });
      console.log('FOKRED', sharedModel);
      return response?.fork_roomid ?? '';
    } else {
      return '';
    }
  }

  async acceptSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<boolean> {
    return false;
  }

  async deleteSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<void> {
    console.log('deleting', options);
    await this._forkManager.deleteFork({
      forkId: options.suggestionId,
      merge: false
    });
    return;
  }

  async updateSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void> {
    return;
  }

  private _suggestionChanged = new Signal<
    ISuggestionsManager,
    ISuggestionChange
  >(this);
  private _isDisposed = false;
  private _tracker: INotebookTracker;
  private _forkManager: IForkManager;
  private _drive: ICollaborativeDrive;
  private _serverSession?: string;
  private _serverUrl: string;
}

export namespace RtcSuggestionsManager {
  export interface IOptions {
    tracker: INotebookTracker;
    forkManager: IForkManager;
    drive: ICollaborativeDrive;
  }
}
