import {
  ISuggestionsManager,
  ISuggestionsManagerToken,
  LocalSuggestionsManager
} from '@jupyter/jupyter-suggestions-base';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';

const NAME_SPACE = '@jupyter/jupyter-suggestions-rtc';

export const suggestionsManagerPlugin: JupyterFrontEndPlugin<ISuggestionsManager> =
  {
    id: `${NAME_SPACE}:manager`,
    description: 'jupyter_suggestions with jupyter_collaboration backend',
    autoStart: true,
    requires: [INotebookTracker],
    provides: ISuggestionsManagerToken,
    activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
      const manager = new LocalSuggestionsManager({ tracker });
      return manager;
    }
  };
