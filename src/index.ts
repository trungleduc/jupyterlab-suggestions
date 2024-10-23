import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupyterlab-suggestions extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-suggestions:plugin',
  description: 'A JupyterLab extension for suggesting changes.',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab-suggestions is activated!');
  }
};

export default plugin;
