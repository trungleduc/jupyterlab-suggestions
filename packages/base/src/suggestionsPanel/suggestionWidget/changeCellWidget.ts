import { ICellModel } from '@jupyterlab/cells';
import { EditorExtensionRegistry } from '@jupyterlab/codemirror';

import { diffTextExtensionFactory } from '../cmExtension';
import { BaseCellwidget } from './baseWidget';

export class SuggestChangeCellWidget extends BaseCellwidget {
  constructor(options: BaseCellwidget.IOptions) {
    super(options);
  }

  protected _cmExtensioRegistry(
    originalCell: ICellModel,
    liveUpdate: boolean
  ): EditorExtensionRegistry {
    const registry = super._cmExtensioRegistry(originalCell, liveUpdate);
    registry.addExtension({
      name: 'suggestion-view',
      factory: options => {
        return EditorExtensionRegistry.createImmutableExtension([
          diffTextExtensionFactory({ originalCell, liveUpdate })
        ]);
      }
    });
    return registry;
  }
}
