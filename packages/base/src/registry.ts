import { ISignal, Signal } from '@lumino/signaling';
import { ISuggestionsManager, ISuggestionsManagerRegistry } from './types';

export class SuggestionsManagerRegistry implements ISuggestionsManagerRegistry {
  constructor() {
    this._managers = new Map();
    this._managerChanged = new Signal(this);
    this._managerRegistered = new Signal(this);
  }

  get isDisposed() {
    return this._isDisposed;
  }

  get managerChanged(): ISignal<
    ISuggestionsManagerRegistry,
    ISuggestionsManager
  > {
    return this._managerChanged;
  }
  get managerRegistered(): ISignal<ISuggestionsManagerRegistry, string> {
    return this._managerRegistered;
  }

  async register(options: {
    id: string;
    manager: ISuggestionsManager;
  }): Promise<boolean> {
    const { id, manager } = options;
    if (this._managers.has(id)) {
      console.error(`Suggestions manager with id ${id} exists!`);
      return false;
    }
    this._managers.set(id, manager);
    this._managerRegistered.emit(id);
    return true;
  }

  async setManager(id: string): Promise<boolean> {
    if (!this._managers.has(id)) {
      return false;
    }
    this._currentManager = this._managers.get(id)!;
    this._managerChanged.emit(this._currentManager);
    return true;
  }

  async getActivatedManager(): Promise<ISuggestionsManager | undefined> {
    return this._currentManager;
  }

  getAllManagers(): string[] {
    return [...this._managers.keys()];
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._managers.forEach(it => it.dispose());
    this._managers.clear();
  }

  private _managers: Map<string, ISuggestionsManager>;
  private _managerChanged: Signal<
    ISuggestionsManagerRegistry,
    ISuggestionsManager
  >;
  private _managerRegistered: Signal<ISuggestionsManagerRegistry, string>;
  private _currentManager: ISuggestionsManager | undefined;
  private _isDisposed = false;
}
