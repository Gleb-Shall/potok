import { Component, render } from 'preact';
import { Site } from './Site.jsx';
import './styles.css';
import './editor.css';
import './workspace.css';
import './planner.css';
import './landing.css';
import './experience.css';
import './sidebar.css';
import './state-appearance.css';

class AppBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render(props, state) {
    if (state.error) return <main class="startup-error"><h1>Не удалось открыть расписание</h1><p>{state.error.message}</p><p>Исходные данные сохранены. Не очищай хранилище браузера.</p><button class="button secondary" onClick={() => location.reload()}>Попробовать снова</button></main>;
    return props.children;
  }
}

render(<AppBoundary><Site/></AppBoundary>, document.getElementById('app'));
