import { render } from 'preact';
import { Site } from './Site.jsx';
import { AppBoundary } from './components/AppBoundary.jsx';
import './app.css';

render(<AppBoundary><Site/></AppBoundary>, document.getElementById('app'));
