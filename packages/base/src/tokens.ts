import { Token } from '@lumino/coreutils';
import { ISuggestionsManager, ISuggestionsModel } from './types';

export const ISuggestionsModelToken = new Token<ISuggestionsModel>(
  'jupyter-suggestions:suggestionsModel'
);

export const ISuggestionsManagerToken = new Token<ISuggestionsManager>(
  'jupyter-suggestions:suggestionsManager'
);
