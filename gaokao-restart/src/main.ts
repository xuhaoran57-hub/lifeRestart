import { createGame } from './app/createGame';
import { createApp } from './ui/App';
import './ui/styles/base.css';
import './ui/styles/theme.css';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root element');
}

createApp(root, createGame());
